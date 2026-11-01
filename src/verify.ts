import { readLedger } from "./ledger.js";
import { readReceipt, verifyReceipt } from "./receipt.js";

const receiptPath = process.argv[2];
const ledgerPath = process.argv[3] ?? "data/events.jsonl";
if (!receiptPath) throw new Error("Usage: npm run verify -- receipts/<stream-id>.json [data/events.jsonl]");
const receipt = await readReceipt(receiptPath);
const entries = await readLedger(ledgerPath);
verifyReceipt(receipt, entries);
console.log(`[verify] valid receipt for stream ${receipt.stream.id}; ${receipt.presence.length} present; ${receipt.ledger.eventCount} chained events`);
