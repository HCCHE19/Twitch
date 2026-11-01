import { readFile } from "node:fs/promises";
import { emptyState, reduceEnvelope } from "./presence.js";
import type { EventSubEnvelope } from "./types.js";

const args = process.argv.slice(2);
const speedIndex = args.indexOf("--speed");
const speed = speedIndex >= 0 ? Number(args[speedIndex + 1]) : 1;
const file = args.find((arg, index) => !arg.startsWith("--") && index !== speedIndex + 1);
if (!file || !Number.isFinite(speed) || speed <= 0) {
  throw new Error("Usage: npm run demo -- <events.jsonl> --speed 2");
}
const lines = (await readFile(file, "utf8")).split(/\r?\n/u).filter(Boolean);
const envelopes = lines.map((line) => JSON.parse(line) as EventSubEnvelope);
const state = emptyState(true);
console.log("[demo] DEMO REPLAY");
let previousTime: number | undefined;
for (const envelope of envelopes) {
  const currentTime = Date.parse(envelope.metadata.message_timestamp);
  if (previousTime !== undefined && Number.isFinite(currentTime)) {
    const delay = Math.min(3_000, Math.max(0, currentTime - previousTime) / speed);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  reduceEnvelope(state, envelope, { broadcasterLogin: "demo_broadcaster" });
  console.log(`[demo] ${envelope.metadata.subscription_type ?? envelope.metadata.message_type}`);
  previousTime = currentTime;
}
console.log(`[demo] complete: ${Object.keys(state.lamps).length} lamps; overlay state flag demoReplay=${state.demoReplay}`);
