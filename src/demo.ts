import { readFile } from "node:fs/promises";
import { emptyState, reduceEnvelope } from "./presence.js";
import { startOverlayServer } from "./overlay-server.js";
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
const overlay = await startOverlayServer(() => state);
console.log("[demo] DEMO REPLAY");
console.log("[demo] overlay: http://localhost:8787/overlay/");
let previousTime: number | undefined;
for (const envelope of envelopes) {
  const currentTime = Date.parse(envelope.metadata.message_timestamp);
  if (previousTime !== undefined && Number.isFinite(currentTime)) {
    const delay = Math.min(3_000, Math.max(0, currentTime - previousTime) / speed);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  reduceEnvelope(state, envelope, { broadcasterLogin: "demo_broadcaster" });
  overlay.broadcast(state);
  console.log(`[demo] ${envelope.metadata.subscription_type ?? envelope.metadata.message_type}`);
  previousTime = currentTime;
}
console.log(`[demo] complete: ${Object.keys(state.lamps).length} lamps; overlay state flag demoReplay=${state.demoReplay}`);
if (args.includes("--exit")) await overlay.close();
else console.log("[demo] replay complete; overlay remains open until Ctrl+C");
