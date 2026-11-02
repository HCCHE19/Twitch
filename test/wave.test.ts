import { describe, expect, it } from "vitest";
// @ts-expect-error The overlay helper is intentionally plain browser JavaScript.
import { updateWaveTracker, waveIntensity } from "../public/shared/wave.js";

describe("threshold wave", () => {
  it("fires once on the threshold crossing and resets for a new stream", () => {
    let tracker = updateWaveTracker(null, "s1", 2, 3, 100);
    expect(tracker.fired).toBe(false);
    tracker = updateWaveTracker(tracker, "s1", 3, 3, 200);
    expect(tracker).toEqual({ streamId: "s1", fired: true, startedAt: 200 });
    expect(updateWaveTracker(tracker, "s1", 8, 3, 900)).toEqual(tracker);
    expect(updateWaveTracker(tracker, "s2", 1, 3, 1_000).fired).toBe(false);
  });
  it("brightens each lamp for 300ms with a left-to-right stagger", () => {
    expect(waveIntensity(1_000, 0, 1_150)).toBe(1);
    expect(waveIntensity(1_000, 1, 1_150)).toBeCloseTo(.5);
    expect(waveIntensity(1_000, 0, 1_300)).toBe(0);
  });
});
