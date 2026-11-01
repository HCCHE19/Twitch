import { describe, expect, it } from "vitest";
// @ts-expect-error The overlay helper is intentionally plain browser JavaScript.
import { flarePulse } from "../public/shared/flare.js";

describe("flare pulse", () => {
  const start = Date.parse("2026-11-01T00:00:00Z");

  it("pulses for 600ms without producing a count", () => {
    expect(flarePulse("2026-11-01T00:00:00Z", start)).toMatchObject({ active: true, scale: 1 });
    expect(flarePulse("2026-11-01T00:00:00Z", start + 300)).toMatchObject({ active: true, intensity: 1, scale: 1.12 });
    expect(flarePulse("2026-11-01T00:00:00Z", start + 599).active).toBe(true);
    expect(flarePulse("2026-11-01T00:00:00Z", start + 600)).toEqual({ active: false, intensity: 0, scale: 1 });
  });
});
