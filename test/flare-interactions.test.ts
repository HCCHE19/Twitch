import { describe, expect, it } from "vitest";
// @ts-expect-error The overlay helper is intentionally plain browser JavaScript.
import { flareInteractions } from "../public/shared/flare-interactions.js";

describe("flare interactions", () => {
  const items = ["left", "flare", "right", "other"].map((userId) => ({ lamp: { userId } }));
  const start = Date.parse("2026-11-02T05:00:00Z");
  it("ripples to immediate neighbours after 200ms at one-third strength", () => {
    const result = flareInteractions(items, { flare: "2026-11-02T05:00:00Z" }, start + 500);
    expect(result.ripples.left).toBeCloseTo(1 / 3);
    expect(result.ripples.right).toBeCloseTo(1 / 3);
    expect(result.ripples.other).toBeUndefined();
  });
  it("sparks for 400ms only when distinct viewers flare within five seconds", () => {
    const result = flareInteractions(items, { other: "2026-11-02T05:00:00Z", flare: "2026-11-02T05:00:04Z" }, start + 4_200);
    expect(result.spark).toMatchObject({ fromUserId: "other", toUserId: "flare", intensity: 1 });
    expect(flareInteractions(items, { other: "2026-11-02T05:00:00Z", flare: "2026-11-02T05:00:06Z" }, start + 6_200).spark).toBeNull();
  });
});
