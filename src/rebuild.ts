import { loadConfig, loadIgnoredUsers } from "./config.js";
import { readLedger, rebuildState, writeState } from "./ledger.js";

const config = await loadConfig();
const ignoredUsers = await loadIgnoredUsers();
const entries = await readLedger("data/events.jsonl");
const state = rebuildState(entries, { broadcasterLogin: config.channelLogin, ignoredUsers });
await writeState("data/state.json", state);
console.log(`[rebuild] ${entries.length} ledger events -> ${Object.keys(state.lamps).length} lamps`);
