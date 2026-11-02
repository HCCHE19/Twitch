import type { DerivedState, EventSubEnvelope } from "./types.js";

export type ThresholdSetting = number | "auto";
export function autoThreshold(counts: number[]): number {
  const recent = counts.slice(-5).sort((a, b) => a - b);
  if (!recent.length) return 10;
  const middle = Math.floor(recent.length / 2);
  const median = recent.length % 2 ? recent[middle]! : (recent[middle - 1]! + recent[middle]!) / 2;
  return Math.max(3, Math.round(median / 2.5));
}
export function resolveThreshold(state: DerivedState, setting: ThresholdSetting): number {
  if (setting !== "auto") return setting;
  return autoThreshold(state.completedStreamIds.slice(-5).map(id => Object.values(state.lamps).filter(lamp => lamp.attendedStreamIds.includes(id)).length));
}
export function thresholdEnvelope(state: DerivedState, setting: ThresholdSetting, timestamp: string): EventSubEnvelope | null {
  if (!state.currentStream || state.currentStream.thresholdMode !== undefined) return null;
  return { metadata: { message_id: `threshold:${state.currentStream.id}`, message_type: "internal", message_timestamp: timestamp, subscription_type: "lamplight.sky.threshold" }, payload: { event: { stream_id: state.currentStream.id, threshold: resolveThreshold(state, setting), mode: setting === "auto" ? "auto" : "manual" } } };
}
