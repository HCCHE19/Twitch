import { describe, expect, it } from "vitest";
// @ts-expect-error The overlay helper is intentionally plain browser JavaScript.
import { neighbourWelcome } from "../public/shared/neighbours.js";

describe("neighbour welcome", () => {
  it("tilts only the two adjacent lamps toward a first-ever lamp for two seconds", () => {
    const now = Date.parse("2026-11-02T05:00:01Z");
    const lamp = (userId: string, first = false) => ({ lamp: { userId, attendedStreamIds: first ? ["s1"] : ["old", "s1"], lastLitAt: "2026-11-02T05:00:00Z" } });
    const effects = neighbourWelcome([lamp("left"), lamp("new", true), lamp("right"), lamp("far")], { id: "s1", litUserIds: ["new"], startedAt: "" }, now);
    expect(effects.left.tilt).toBeCloseTo(4);
    expect(effects.right.tilt).toBeCloseTo(-4);
    expect(effects.far).toBeUndefined();
    expect(neighbourWelcome([lamp("left"), lamp("new", true)], { id: "s1", litUserIds: ["new"], startedAt: "" }, now + 1_000)).toEqual({});
  });
});
