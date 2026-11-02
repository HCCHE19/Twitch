import { chmod, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadEnvValues, loadIgnoredUsers } from "./config.js";
import { envelopeFromEntry, makeLedgerEntry, readLedger, rebuildState, writeState } from "./ledger.js";
import { readReceipt, rehashReceipt, verifyReceipt } from "./receipt.js";
import type { LedgerEntry, PresenceReceipt } from "./types.js";

const path = "data/events.jsonl";
const oldEntries = await readLedger(path);
if (!oldEntries.length) { console.log("[privacy] no ledger events to migrate"); process.exit(0); }

let previous = "";
const entries = oldEntries.map((entry) => {
  const next = makeLedgerEntry(envelopeFromEntry(entry), previous, entry.receivedAt);
  previous = next.hash; return next;
});

const temporary = `${path}.privacy.tmp`;
await writeFile(temporary, entries.map((entry) => JSON.stringify(entry)).join("\n") + "\n", { encoding: "utf8", mode: 0o600 });
await rename(temporary, path); await chmod(path, 0o600);

let receiptCount = 0;
for (const name of await readdir("receipts")) {
  if (!name.endsWith(".json")) continue;
  const receiptPath = join("receipts", name), receipt = await readReceipt(receiptPath);
  const start = oldEntries.findIndex((entry) => entry.prevHash === receipt.ledger.startPrevHash);
  const end = oldEntries.findIndex((entry, index) => index >= start && entry.hash === receipt.ledger.endHash);
  if (start < 0 || end < 0) throw new Error(`Cannot migrate receipt anchors for ${name}`);
  const updated: PresenceReceipt = rehashReceipt({ ...receipt, ledger: { ...receipt.ledger, startPrevHash: entries[start]!.prevHash, endHash: entries[end]!.hash } });
  verifyReceipt(updated, entries);
  const receiptTemporary = `${receiptPath}.privacy.tmp`;
  await writeFile(receiptTemporary, `${JSON.stringify(updated, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(receiptTemporary, receiptPath); await chmod(receiptPath, 0o600); receiptCount += 1;
}

const values = await loadEnvValues(), ignoredUsers = await loadIgnoredUsers();
const state = rebuildState(entries, { broadcasterLogin: values.TWITCH_CHANNEL_LOGIN?.toLowerCase() ?? "", ignoredUsers });
await writeState("data/state.json", state);
const stripped = oldEntries.filter((entry) => entry.subscriptionType === "channel.chat.message" && typeof (entry.payload.event as { message?: { text?: unknown } } | undefined)?.message?.text === "string").length;
console.log(`[privacy] stripped chat text from ${stripped} ledger events; re-sealed ${receiptCount} local receipt${receiptCount === 1 ? "" : "s"}`);
