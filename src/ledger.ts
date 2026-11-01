import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { canonicalJson } from "./canonical.js";
import { emptyState, reduceEnvelope, type ReduceOptions } from "./presence.js";
import type { DerivedState, EventSubEnvelope, LedgerEntry } from "./types.js";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function makeLedgerEntry(envelope: EventSubEnvelope, prevHash: string, receivedAt = new Date().toISOString()): LedgerEntry {
  const withoutHash = {
    schemaVersion: 1 as const,
    messageId: envelope.metadata.message_id,
    messageType: envelope.metadata.message_type,
    ...(envelope.metadata.subscription_type ? { subscriptionType: envelope.metadata.subscription_type } : {}),
    messageTimestamp: envelope.metadata.message_timestamp,
    receivedAt,
    payload: envelope.payload,
    prevHash
  };
  return { ...withoutHash, hash: sha256(canonicalJson(withoutHash)) };
}

export function verifyLedger(entries: LedgerEntry[]): void {
  let prevHash = "";
  for (const [index, entry] of entries.entries()) {
    const { hash, ...withoutHash } = entry;
    if (entry.prevHash !== prevHash) throw new Error(`Ledger chain break at line ${index + 1}`);
    if (sha256(canonicalJson(withoutHash)) !== hash) throw new Error(`Ledger hash mismatch at line ${index + 1}`);
    prevHash = hash;
  }
}

export async function readLedger(path: string): Promise<LedgerEntry[]> {
  try {
    const source = await readFile(path, "utf8");
    const entries = source.split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line) as LedgerEntry);
    verifyLedger(entries);
    return entries;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export function envelopeFromEntry(entry: LedgerEntry): EventSubEnvelope {
  return {
    metadata: {
      message_id: entry.messageId,
      message_type: entry.messageType,
      message_timestamp: entry.messageTimestamp,
      ...(entry.subscriptionType ? { subscription_type: entry.subscriptionType } : {})
    },
    payload: entry.payload
  };
}

export async function appendEnvelope(path: string, envelope: EventSubEnvelope, prevHash: string): Promise<LedgerEntry> {
  const entry = makeLedgerEntry(envelope, prevHash);
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(entry)}\n`, { encoding: "utf8", mode: 0o600 });
  return entry;
}

export function rebuildState(entries: LedgerEntry[], options: ReduceOptions, demoReplay = false): DerivedState {
  verifyLedger(entries);
  const state = emptyState(demoReplay);
  for (const entry of entries) {
    reduceEnvelope(state, envelopeFromEntry(entry), options);
    state.lastHash = entry.hash;
  }
  return state;
}

export async function writeState(path: string, state: DerivedState): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, path);
}
