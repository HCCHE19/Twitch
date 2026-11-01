import { loadConfig, loadIgnoredUsers } from "./config.js";
import { EventSubClient } from "./eventsub.js";
import { appendEnvelope, readLedger, rebuildState, writeState } from "./ledger.js";
import { startOverlayServer } from "./overlay-server.js";
import { reduceEnvelope } from "./presence.js";
import { createReceipt, writeReceiptFiles } from "./receipt.js";
import { getLiveStream, validateToken } from "./twitch-api.js";

async function main(): Promise<void> {
  const config = await loadConfig();
  const ignoredUsers = await loadIgnoredUsers();
  const identity = await validateToken(config);
  console.log(`[auth] validated broadcaster ${identity.login}; scope user:read:chat; expires in ${Math.floor(identity.expiresIn / 3600)}h`);
  const live = await getLiveStream(config);
  console.log(live ? `[stream] live since ${live.startedAt} (stream ${live.id})` : "[stream] currently offline");
  const entries = await readLedger("data/events.jsonl");
  const state = rebuildState(entries, { broadcasterLogin: config.channelLogin, ignoredUsers });
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
  }
  await writeState("data/state.json", state);
  console.log(`[state] rebuilt from ${entries.length} ledger events; ${Object.keys(state.lamps).length} lamps`);
  const overlay = await startOverlayServer(() => state);
  console.log("[overlay] http://localhost:8787/overlay/");

  const client = new EventSubClient({
    config,
    broadcasterUserId: identity.userId,
    onReady: () => console.log("[ready] send a message in your Twitch channel; Ctrl+C stops Lamplight"),
    onEnvelope: async (envelope) => {
      const entry = await appendEnvelope("data/events.jsonl", envelope, state.lastHash);
      const allEntries = [...entries, entry];
      if (envelope.metadata.subscription_type === "stream.offline" && state.currentStream) {
        const receipt = createReceipt(state, allEntries, envelope.metadata.message_timestamp);
        const paths = await writeReceiptFiles(receipt);
        console.log(`[receipt] sealed ${paths.jsonPath}; public view ${paths.htmlPath}`);
      }
      reduceEnvelope(state, envelope, { broadcasterLogin: config.channelLogin, ignoredUsers });
      state.lastHash = entry.hash;
      entries.push(entry);
      await writeState("data/state.json", state);
      overlay.broadcast(state);
    },
    onChat: (displayName, text) => console.log(`[chat] ${displayName}: ${text}`),
    onStream: (type, event) => console.log(`[stream] ${type}: ${JSON.stringify(event)}`)
  });
  client.start();
  const stop = async (): Promise<void> => { client.stop(); await overlay.close(); process.exitCode = 0; };
  process.once("SIGINT", () => void stop());
  process.once("SIGTERM", () => void stop());
}

main().catch((error: unknown) => {
  console.error(`[fatal] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
