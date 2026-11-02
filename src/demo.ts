import { readFile } from "node:fs/promises";
import { loadMomentLevel, loadOverlayLayout } from "./config.js";
import { createFlareEnvelope, emptyState, reduceEnvelope } from "./presence.js";
import { startOverlayServer } from "./overlay-server.js";
import type { EventSubEnvelope } from "./types.js";
import { momentDemo, nightDemo, retimeDemoEnvelope } from "./demo-events.js";
import { applyThreadCommand, applyThreadReunion } from "./threads.js";
import { applyPromiseCommand } from "./promises.js";
import { demoNotices, demoSpeed } from "./demo-report.js";

const args = process.argv.slice(2);
const speedIndex = args.indexOf("--speed");
let speed = speedIndex >= 0 ? Number(args[speedIndex + 1]) : 1;
const lampsIndex = args.indexOf("--lamps");
const lampCount = lampsIndex >= 0 ? Number(args[lampsIndex + 1]) : undefined;
const portIndex = args.indexOf("--port");
const port = portIndex >= 0 ? Number(args[portIndex + 1]) : 8787;
const momentIndex = args.indexOf("--moment");
const moment = momentIndex >= 0 ? args[momentIndex + 1] : undefined;
const delayIndex = args.indexOf("--delay");
const delaySeconds = delayIndex >= 0 ? Number(args[delayIndex + 1]) : moment ? 10 : 0;
const minutesIndex = args.indexOf("--minutes");
const minutes = minutesIndex >= 0 ? Number(args[minutesIndex + 1]) : moment === "night" && speedIndex < 0 ? 4 : undefined;
if (minutesIndex >= 0 && speedIndex >= 0) throw new Error("Choose --minutes or --speed, not both");
const valueIndexes = new Set([speedIndex + 1, lampsIndex + 1, portIndex + 1, momentIndex + 1, delayIndex + 1, minutesIndex + 1].filter((index) => index > 0));
const file = args.find((arg, index) => !arg.startsWith("--") && !valueIndexes.has(index));
if ((!file && lampCount === undefined && !moment) || (moment && !["ignite", "fragment", "complete", "night"].includes(moment)) || !Number.isFinite(speed) || speed <= 0 || !Number.isFinite(delaySeconds) || delaySeconds < 0 || delaySeconds > 60 || !Number.isInteger(port) || port < 1 || port > 65535 || (lampCount !== undefined && (!Number.isInteger(lampCount) || lampCount < 1))) {
  throw new Error("Usage: npm run demo -- [events.jsonl | --lamps 5|30|200 | --moment ignite|fragment|complete|night] [--minutes 4 | --speed 1] [--delay 10] [--port 8787]");
}

function generatedDemo(count: number): EventSubEnvelope[] {
  const envelopes: EventSubEnvelope[] = [];
  let sequence = 0;
  const push = (subscriptionType: string, event: Record<string, unknown>): void => {
    const timestamp = new Date(Date.UTC(2026, 10, 1, 0, 0, 0, sequence++)).toISOString();
    envelopes.push({ metadata: { message_id: `generated-${sequence}`, message_type: "notification", message_timestamp: timestamp, subscription_type: subscriptionType }, payload: { event } });
  };
  const online = (id: string): void => push("stream.online", { id, started_at: new Date(Date.UTC(2026, 10, 1, 0, 0, 0, sequence)).toISOString() });
  const offline = (): void => push("stream.offline", { broadcaster_user_login: "demo_broadcaster" });
  const firstFive = [1, 2, 6, 8, 10];
  const remaining = Array.from({ length: count + 10 }, (_, offset) => offset + 3).filter((value) => !firstFive.includes(value)).slice(0, Math.max(0, count - firstFive.length));
  const identityNumber = (index: number): number => [...firstFive, ...remaining][index - 1] ?? index;
  const light = (index: number): void => push("channel.chat.message", {
    chatter_user_id: `fictional-${identityNumber(index).toString().padStart(3, "0")}`,
    chatter_user_login: `guest_${index.toString().padStart(3, "0")}`,
    chatter_user_name: `Guest ${index.toString().padStart(3, "0")}`,
    message: { text: "!lamp", fragments: [{ type: "text", text: "!lamp" }] }
  });
  online("generated-stream-1"); for (let index = 1; index <= count; index += 1) light(index); offline();
  online("generated-stream-2"); for (let index = 1; index <= Math.max(0, count - 3); index += 2) light(index); offline();
  online("generated-stream-3"); for (let index = 1; index <= Math.max(0, count - 3); index += 1) light(index);
  return envelopes;
}

const envelopes = moment
  ? moment === "night" ? nightDemo() : momentDemo(moment as "ignite" | "fragment" | "complete")
  : lampCount !== undefined
  ? generatedDemo(lampCount)
  : (await readFile(file!, "utf8")).split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line) as EventSubEnvelope);
if (minutes !== undefined) speed = demoSpeed(envelopes, minutes);
const state = emptyState(true);
const layout = await loadOverlayLayout();
const moments = await loadMomentLevel();
const night = moment === "night";
const overlay = await startOverlayServer(() => state, port, layout, night ? 3 : 10, true, night, night || moment === "fragment" || moment === "complete", night, night ? "normal" : moments, undefined, true);
console.log("[demo] DEMO REPLAY");
console.log(`[demo] overlay: http://localhost:${port}/overlay/ (${layout})`);
if(delaySeconds>0){console.log(`[demo] replay starts in ${delaySeconds} seconds`);await new Promise((resolve)=>setTimeout(resolve,delaySeconds*1000))}
const sourceStart = Date.parse(envelopes[0]!.metadata.message_timestamp);
const replayStart = Date.now();
for (const envelope of envelopes) {
  const currentTime = Date.parse(envelope.metadata.message_timestamp);
  const wait = replayStart + (currentTime - sourceStart) / speed - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  const previousState = structuredClone(state);
  const replayEnvelope = retimeDemoEnvelope(envelope, replayStart, sourceStart, speed);
  const flare = night ? createFlareEnvelope(state, replayEnvelope, { broadcasterLogin: "demo_broadcaster" }) : null;
  const before = new Set(state.currentStream?.litUserIds ?? []);
  reduceEnvelope(state, replayEnvelope, { broadcasterLogin: "demo_broadcaster" });
  if (night && replayEnvelope.metadata.subscription_type === "channel.chat.message" && state.currentStream) {
    const newlyLit = state.currentStream.litUserIds.find((userId) => !before.has(userId));
    if (newlyLit) applyThreadReunion(state, newlyLit, replayEnvelope.metadata.message_timestamp);
    const promise = applyPromiseCommand(state, replayEnvelope, { enabled: true, broadcasterLogin: "demo_broadcaster" });
    if (promise) reduceEnvelope(state, promise, { broadcasterLogin: "demo_broadcaster" });
    for (const thread of applyThreadCommand(state, replayEnvelope, { enabled: true, broadcasterLogin: "demo_broadcaster" })) reduceEnvelope(state, thread, { broadcasterLogin: "demo_broadcaster" });
  }
  if (flare) reduceEnvelope(state, flare, { broadcasterLogin: "demo_broadcaster" });
  overlay.broadcast(state);
  for (const notice of demoNotices(previousState, state)) console.log(`[demo] ${notice}`);
}
console.log(`[demo] complete: ${Object.keys(state.lamps).length} lamps; overlay state flag demoReplay=${state.demoReplay}`);
if (args.includes("--exit")) await overlay.close();
else console.log("[demo] replay complete; overlay remains open until Ctrl+C");
