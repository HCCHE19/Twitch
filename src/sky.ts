import { createHash } from "node:crypto";
import type { DerivedState, EventSubEnvelope, SkyFragment } from "./types.js";

export const CONSTELLATIONS = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpius", "Sagittarius", "Capricornus", "Aquarius", "Pisces"] as const;
export const FRAGMENTS = ["A", "B", "C", "D", "E", "F"] as const;
export type Constellation = typeof CONSTELLATIONS[number];
export type FragmentLetter = typeof FRAGMENTS[number];

function unit(seed: string): number {
  return Number.parseInt(createHash("sha256").update(seed).digest("hex").slice(0, 13), 16) / 0x10000000000000;
}

export function chooseSkyFragment(streamId: string, collected: Pick<SkyFragment, "constellation" | "fragment">[]): { constellation: Constellation; fragment: FragmentLetter } | null {
  const owned = new Set(collected.map((item) => `${item.constellation}:${item.fragment}`));
  if (owned.size >= CONSTELLATIONS.length * FRAGMENTS.length) return null;
  const progress = CONSTELLATIONS.filter((name) => {
    const count = FRAGMENTS.filter((letter) => owned.has(`${name}:${letter}`)).length;
    return count > 0 && count < FRAGMENTS.length;
  });
  const untouched = CONSTELLATIONS.filter((name) => FRAGMENTS.every((letter) => !owned.has(`${name}:${letter}`)));
  const useProgress = progress.length > 0 && (untouched.length === 0 || unit(`${streamId}:path`) < .7);
  const candidates = useProgress ? progress : untouched.length ? untouched : progress;
  const constellation = candidates[Math.floor(unit(`${streamId}:constellation`) * candidates.length)]!;
  const missing = FRAGMENTS.filter((letter) => !owned.has(`${constellation}:${letter}`));
  const fragment = missing[Math.floor(unit(`${streamId}:fragment`) * missing.length)]!;
  return { constellation, fragment };
}

export function createSkyFragmentEnvelope(state: DerivedState, timestamp: string): EventSubEnvelope | null {
  const stream = state.currentStream;
  if (!stream || state.skyFragments.some((item) => item.streamId === stream.id)) return null;
  const choice = chooseSkyFragment(stream.id, state.skyFragments);
  if (!choice) return null;
  return {
    metadata: { message_id: `sky:${stream.id}`, message_type: "internal", message_timestamp: timestamp, subscription_type: "lamplight.sky.fragment" },
    payload: { event: { stream_id: stream.id, constellation: choice.constellation, fragment: choice.fragment, lit_user_ids: [...stream.litUserIds] } }
  };
}
