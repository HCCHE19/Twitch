import { loadConfig, loadIgnoredUsers, loadSkyEnabled, loadThreadsEnabled } from "./config.js";
import { appendEnvelope, readLedger, rebuildState, writeState } from "./ledger.js";
import { reduceEnvelope } from "./presence.js";
import { createReceipt, writeReceiptFiles } from "./receipt.js";

const config = await loadConfig();
const ignoredUsers = await loadIgnoredUsers();
const threadsEnabled = await loadThreadsEnabled();
const skyEnabled = await loadSkyEnabled();
const entries = await readLedger("data/events.jsonl");
const options = { broadcasterLogin: config.channelLogin, ignoredUsers };
const state = rebuildState(entries, options);
if (!state.currentStream) throw new Error("There is no unfinished stream to finalize");
const now = new Date().toISOString();
const envelope = {
  metadata: { message_id: `manual-finalize:${state.currentStream.id}:${now}`, message_type: "internal", message_timestamp: now, subscription_type: "lamplight.stream.finalized" },
  payload: { event: { id: state.currentStream.id, source: "manual" } }
};
const entry = await appendEnvelope("data/events.jsonl", envelope, state.lastHash);
const receipt = createReceipt(state, [...entries, entry], now, "manual", now, threadsEnabled, skyEnabled);
const paths = await writeReceiptFiles(receipt);
reduceEnvelope(state, envelope, options);
state.lastHash = entry.hash;
await writeState("data/state.json", state);
console.log(`[finalize] sealed ${paths.jsonPath}; public view ${paths.htmlPath}`);
