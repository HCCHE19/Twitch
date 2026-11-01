import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson } from "./canonical.js";
import { verifyLedger } from "./ledger.js";
import { generateLamp } from "./lamp-generator.js";
import type { DerivedState, LedgerEntry, PresenceReceipt, PresenceReceiptRow } from "./types.js";

const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");
const escapeHtml = (value: string): string => value.replace(/[&<>"']/gu, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);

export function createReceipt(state: DerivedState, entries: LedgerEntry[], endedAt: string, finalization: "eventsub" | "manual" = "eventsub", sealedAt = new Date().toISOString()): PresenceReceipt {
  const stream = state.currentStream;
  if (!stream) throw new Error("No live stream to finalize");
  verifyLedger(entries);
  const start = entries.findIndex((entry) => {
    const event = entry.payload.event as Record<string, unknown> | undefined;
    return (entry.subscriptionType === "stream.online" || entry.subscriptionType === "lamplight.stream.recovered") && String(event?.id ?? "") === stream.id;
  });
  if (start < 0) throw new Error(`Stream ${stream.id} has no ledger start event`);
  const slice = entries.slice(start);
  const rows: PresenceReceiptRow[] = stream.litUserIds.map((userId) => {
    const lamp = state.lamps[userId];
    if (!lamp) throw new Error(`Missing lamp state for ${userId}`);
    const source = slice.find((entry) => entry.subscriptionType === "channel.chat.message" && String((entry.payload.event as Record<string, unknown> | undefined)?.chatter_user_id ?? "") === userId);
    if (!source) throw new Error(`Missing source message for ${lamp.displayName}`);
    return { userId, displayName: lamp.displayName, firstSeenAt: lamp.firstSeenAt, litAt: lamp.lastLitAt, streak: lamp.streak, lifetimeStreams: lamp.attendedStreamIds.length, sourceMessageId: source.messageId };
  }).sort((left, right) => left.litAt.localeCompare(right.litAt));
  const withoutHash = {
    schemaVersion: 1 as const,
    stream: { id: stream.id, startedAt: stream.startedAt, endedAt, finalization },
    presence: rows,
    ledger: { startPrevHash: entries[start]!.prevHash, endHash: entries.at(-1)?.hash ?? "", eventCount: slice.length },
    sealedAt
  };
  return { ...withoutHash, receiptHash: sha256(canonicalJson(withoutHash)) };
}

export function verifyReceipt(receipt: PresenceReceipt, entries: LedgerEntry[]): void {
  verifyLedger(entries);
  const { receiptHash, ...withoutHash } = receipt;
  if (sha256(canonicalJson(withoutHash)) !== receiptHash) throw new Error("Receipt hash mismatch");
  const start = entries.findIndex((entry) => entry.prevHash === receipt.ledger.startPrevHash);
  if (start < 0) throw new Error("Receipt start anchor not found");
  const end = entries.findIndex((entry, index) => index >= start && entry.hash === receipt.ledger.endHash);
  if (end < 0) throw new Error("Receipt end anchor not found");
  if (end - start + 1 !== receipt.ledger.eventCount) throw new Error("Receipt event count mismatch");
  const startEvent = entries[start]!.payload.event as Record<string, unknown> | undefined;
  if (String(startEvent?.id ?? "") !== receipt.stream.id) throw new Error("Receipt stream does not match start event");
  for (const row of receipt.presence) {
    const source = entries.slice(start, end + 1).find((entry) => entry.messageId === row.sourceMessageId);
    if (!source || source.subscriptionType !== "channel.chat.message") throw new Error(`Source event missing for ${row.displayName}`);
    const event = source.payload.event as Record<string, unknown> | undefined;
    if (String(event?.chatter_user_id ?? "") !== row.userId) throw new Error(`Source identity mismatch for ${row.displayName}`);
    if (source.messageTimestamp !== row.litAt) throw new Error(`Source time mismatch for ${row.displayName}`);
  }
}

export function receiptHtml(receipt: PresenceReceipt): string {
  const publicRows = receipt.presence.map((row) => ({ displayName: row.displayName, litAt: row.litAt, streak: row.streak, lifetimeStreams: row.lifetimeStreams, lampDesign: generateLamp(row.userId) }));
  const cards = publicRows.map((row, index) => `<article><canvas width="180" height="180" data-index="${index}"></canvas><div><h2>${escapeHtml(row.displayName)}</h2><p>Streak ${row.streak} · ${row.lifetimeStreams} stream${row.lifetimeStreams === 1 ? "" : "s"} attended</p><time>${escapeHtml(row.litAt)}</time></div></article>`).join("\n");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Presence Receipt</title><style>@font-face{font-family:Space;src:url(/fonts/SpaceGrotesk-wght.woff2)}*{box-sizing:border-box}body{margin:0;background:#071014;color:#f5e9cf;font:16px Space,system-ui,sans-serif;padding:48px}main{max-width:820px;margin:auto}header{border-bottom:1px solid #294048;padding-bottom:24px}h1{margin:0 0 8px;color:#ffc56f}article{display:flex;align-items:center;gap:22px;border-bottom:1px solid #182c32;padding:14px 0}canvas{width:120px;height:120px}h2,p{margin:4px 0}time,.seal{color:#8eaaa9;font-size:13px}</style></head><body><main><header><h1>Presence Receipt</h1><p>${escapeHtml(receipt.stream.startedAt)} — ${escapeHtml(receipt.stream.endedAt)}</p><p class="seal">${receipt.presence.length} present · sealed ${escapeHtml(receipt.sealedAt)} · ${escapeHtml(receipt.receiptHash.slice(0, 16))}…</p></header>${cards || "<p>No presences recorded.</p>"}</main><script type="module">import{drawLampDesign}from'/shared/lamp.js';const rows=${JSON.stringify(publicRows).replace(/</gu, "\\u003c")};document.querySelectorAll('canvas').forEach((canvas)=>{const row=rows[Number(canvas.dataset.index)];const context=canvas.getContext('2d');context.scale(1.5,1.5);drawLampDesign(context,row.lampDesign,60,92,100,1,0)});</script></body></html>`;
}

export async function writeReceiptFiles(receipt: PresenceReceipt, directory = "receipts"): Promise<{ jsonPath: string; htmlPath: string }> {
  await mkdir(directory, { recursive: true });
  const safeId = receipt.stream.id.replace(/[^a-zA-Z0-9_-]/gu, "-");
  const jsonPath = join(directory, `${safeId}.json`);
  const htmlPath = join(directory, `${safeId}.html`);
  await writeFile(jsonPath, `${JSON.stringify(receipt, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await writeFile(htmlPath, receiptHtml(receipt), { encoding: "utf8", mode: 0o600 });
  return { jsonPath, htmlPath };
}

export async function readReceipt(path: string): Promise<PresenceReceipt> {
  return JSON.parse(await readFile(path, "utf8")) as PresenceReceipt;
}
