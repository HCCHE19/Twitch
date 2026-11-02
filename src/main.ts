import { loadIgnoredUsers, loadMomentLevel, loadOverlayLayout, loadShowNames, loadSkyEnabled, loadThresholdN, loadThreadsEnabled, loadWindEnabled } from "./config.js";
import { EventSubClient } from "./eventsub.js";
import { appendEnvelope, readLedger, rebuildState, writeState } from "./ledger.js";
import { startOverlayServer } from "./overlay-server.js";
import { createFlareEnvelope, reduceEnvelope } from "./presence.js";
import { createReceipt, writeReceiptFiles } from "./receipt.js";
import { getLiveStream, validateToken } from "./twitch-api.js";
import { startViewerSampler, viewerSampleEnvelope } from "./viewer-sampling.js";
import { applyThreadCommand, applyThreadReunion } from "./threads.js";
import { createSkyFragmentEnvelope } from "./sky.js";
import { createAuthManager } from "./auth.js";

async function main(): Promise<void> {
  const auth = await createAuthManager();
  const ignoredUsers = await loadIgnoredUsers();
  const layout = await loadOverlayLayout();
  const thresholdN = await loadThresholdN();
  const showNames = await loadShowNames();
  const threadsEnabled = await loadThreadsEnabled();
  const skyEnabled = await loadSkyEnabled();
  const windEnabled = await loadWindEnabled();
  const moments = await loadMomentLevel();
  const entries = await readLedger("data/events.jsonl");
  const state = rebuildState(entries, { broadcasterLogin: auth.channelLogin, ignoredUsers });
  await writeState("data/state.json", state);
  const overlay = await startOverlayServer(() => state, 8787, layout, thresholdN, showNames, threadsEnabled, skyEnabled, windEnabled, moments, auth);
  await auth.startCallbackServer();
  console.log(`[overlay] http://localhost:8787/overlay/ (${layout})`);
  let config = auth.config();
  if (!config) { console.log("open http://localhost:8787/setup to connect Twitch"); config = await auth.waitForConfig(); }
  const identity = await validateToken(config);
  console.log(`[auth] validated broadcaster ${identity.login}; scope user:read:chat; expires in ${Math.floor(identity.expiresIn / 3600)}h`);
  const live = await getLiveStream(config);
  console.log(live ? `[stream] live since ${live.startedAt} (stream ${live.id})` : "[stream] currently offline");
  if (live && !state.currentStream) {
    const recoveryEnvelope = {
      metadata: {
        message_id: `recovery:${live.id}`,
        message_type: "internal",
        message_timestamp: new Date().toISOString(),
        subscription_type: "lamplight.stream.recovered"
      },
      payload: { event: { id: live.id, started_at: live.startedAt, source: "helix.get-streams" } }
    };
    const recoveryEntry = await appendEnvelope("data/events.jsonl", recoveryEnvelope, state.lastHash);
    reduceEnvelope(state, recoveryEnvelope, { broadcasterLogin: config.channelLogin, ignoredUsers });
    state.lastHash = recoveryEntry.hash;
    entries.push(recoveryEntry);
  }
  await writeState("data/state.json", state);
  console.log(`[state] rebuilt from ${entries.length} ledger events; ${Object.keys(state.lamps).length} lamps`);

  let mutationQueue = Promise.resolve();
  const serialize = async (operation: () => Promise<void>): Promise<void> => {
    const next = mutationQueue.then(operation, operation);
    mutationQueue = next.catch(() => undefined);
    await next;
  };
  const appendInternal = async (envelope: Parameters<typeof appendEnvelope>[1]): Promise<void> => {
    await serialize(async () => {
      const entry = await appendEnvelope("data/events.jsonl", envelope, state.lastHash);
      reduceEnvelope(state, envelope, { broadcasterLogin: config.channelLogin, ignoredUsers });
      state.lastHash = entry.hash;
      entries.push(entry);
      await writeState("data/state.json", state);
      overlay.broadcast(state);
    });
  };
  const sampler = startViewerSampler(
    () => state.currentStream !== null,
    async () => {
      const expectedStreamId = state.currentStream?.id;
      if (!expectedStreamId) return;
      try {
        const sampled = await getLiveStream(config);
        if (!sampled || sampled.id !== expectedStreamId || !state.currentStream) return;
        const litLamps = state.currentStream.litUserIds.length;
        await appendInternal(viewerSampleEnvelope(expectedStreamId, sampled.viewerCount, litLamps));
        console.log(`[viewer-sample] Twitch ${sampled.viewerCount}; lit ${litLamps}`);
      } catch (error) {
        console.error(`[viewer-sample] skipped: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );
  if (state.currentStream) void sampler.trigger();

  const client = new EventSubClient({
    config,
    broadcasterUserId: identity.userId,
    onReady: () => console.log("[ready] send a message in your Twitch channel; Ctrl+C stops Lamplight"),
    onEnvelope: async (envelope) => {
      await serialize(async () => {
        const flare = createFlareEnvelope(state, envelope, { broadcasterLogin: config.channelLogin, ignoredUsers });
        const litBefore = new Set(state.currentStream?.litUserIds ?? []);
        const entry = await appendEnvelope("data/events.jsonl", envelope, state.lastHash);
        const allEntries = [...entries, entry];
        if (envelope.metadata.subscription_type === "stream.offline" && state.currentStream) {
          const receipt = createReceipt(state, allEntries, envelope.metadata.message_timestamp, "eventsub", new Date().toISOString(), threadsEnabled, skyEnabled);
          const paths = await writeReceiptFiles(receipt);
          console.log(`[receipt] sealed ${paths.jsonPath}; public view ${paths.htmlPath}`);
        }
        reduceEnvelope(state, envelope, { broadcasterLogin: config.channelLogin, ignoredUsers });
        state.lastHash = entry.hash;
        entries.push(entry);
        if (threadsEnabled && envelope.metadata.subscription_type === "channel.chat.message" && state.currentStream) {
          const newlyLit = state.currentStream.litUserIds.find((userId) => !litBefore.has(userId));
          if (newlyLit) applyThreadReunion(state, newlyLit, envelope.metadata.message_timestamp);
          const threadEvents = applyThreadCommand(state, envelope, { enabled: true, broadcasterLogin: config.channelLogin, ignoredUsers });
          for (const threadEnvelope of threadEvents) {
            const threadEntry = await appendEnvelope("data/events.jsonl", threadEnvelope, state.lastHash);
            reduceEnvelope(state, threadEnvelope, { broadcasterLogin: config.channelLogin, ignoredUsers });
            state.lastHash = threadEntry.hash; entries.push(threadEntry);
            console.log(`[thread] ${threadEnvelope.metadata.subscription_type}`);
          }
        }
        if (flare) {
          const flareEntry = await appendEnvelope("data/events.jsonl", flare, state.lastHash);
          reduceEnvelope(state, flare, { broadcasterLogin: config.channelLogin, ignoredUsers });
          state.lastHash = flareEntry.hash;
          entries.push(flareEntry);
          console.log(`[flare] ${String((envelope.payload.event ?? {}).chatter_user_name ?? "viewer")}`);
        }
        const litAfter = state.currentStream?.litUserIds.length ?? 0;
        if (skyEnabled && litBefore.size < thresholdN && litAfter >= thresholdN) {
          const skyEnvelope = createSkyFragmentEnvelope(state, envelope.metadata.message_timestamp);
          if (skyEnvelope) {
            const skyEntry = await appendEnvelope("data/events.jsonl", skyEnvelope, state.lastHash);
            reduceEnvelope(state, skyEnvelope, { broadcasterLogin: config.channelLogin, ignoredUsers });
            state.lastHash = skyEntry.hash; entries.push(skyEntry);
            console.log(`[sky] ${String((skyEnvelope.payload.event ?? {}).constellation)} ${String((skyEnvelope.payload.event ?? {}).fragment)}`);
          }
        }
        await writeState("data/state.json", state);
        overlay.broadcast(state);
      });
      if (envelope.metadata.subscription_type === "stream.online") void sampler.trigger();
    },
    onChat: (displayName, text) => console.log(`[chat] ${displayName}: ${text}`),
    onStream: (type, event) => console.log(`[stream] ${type}: ${JSON.stringify(event)}`)
  });
  client.start();
  const stop = async (): Promise<void> => { sampler.stop(); client.stop(); await auth.close(); await overlay.close(); process.exitCode = 0; };
  process.once("SIGINT", () => void stop());
  process.once("SIGTERM", () => void stop());
}

main().catch((error: unknown) => {
  console.error(`[fatal] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
