import { describe, expect, it } from "vitest";
// @ts-expect-error The overlay helper is intentionally plain browser JavaScript.
import { openingCardFrame, returnGreeting } from "../public/shared/memory.js";

describe("opening memory card", () => {
  const start = Date.parse("2026-11-02T05:00:00Z");
  const card = { startedAt: "2026-11-02T05:00:00Z", previousStreamId: "s1", previousUserIds: ["a", "b", "c"], previousPromiseUserIds: [] };

  it("uses previous attendance and current relights for ten seconds", () => {
    expect(openingCardFrame(card, { id: "s2", startedAt: card.startedAt, litUserIds: ["a", "c"] }, [], [], start + 9_999)).toEqual({
      active: true,
      lampOpacity: 0,
      panelPulse: 0,
      lines: ["3 lamps last time. 2 are back."]
    });
    expect(openingCardFrame(null, { id: "s1", startedAt: card.startedAt, litUserIds: [] }, start)).toEqual({ active: false, lampOpacity: 1 });
  });

  it("fades lamps in after the card", () => {
    expect(openingCardFrame(card, { id: "s2", startedAt: card.startedAt, litUserIds: [] }, [], [], start + 10_500)).toEqual({ active: false, lampOpacity: .5 });
    expect(openingCardFrame(card, { id: "s2", startedAt: card.startedAt, litUserIds: [] }, [], [], start + 11_000)).toEqual({ active: false, lampOpacity: 1 });
  });

  it("keeps only a short attendance line and optional kept-promise line, with one panel pulse", () => {
    const stream = { litUserIds: ["a"] }, promised = { ...card, previousPromiseUserIds: ["a", "b"] };
    const frame = openingCardFrame(promised, stream, ["a"], [{ userIds: ["a", "b"] }], start + 600);
    expect(frame.lines).toEqual(["3 lamps last time. 1 is back.", "1 kept their promise."]);
    expect(frame.panelPulse).toBe(1);
    expect(openingCardFrame(promised, stream, [], [], start + 1500).lines).toHaveLength(1);
    expect(openingCardFrame(promised, stream, ["a"], [], start + 1500).panelPulse).toBe(0);
  });
});

describe("return greeting", () => {
  const lamp = { userId: "u1", lastLitAt: "2026-11-02T05:00:00Z", lastStreamId: "s3", attendedStreamIds: ["s1", "s2", "s3"] };
  const stream = { id: "s3", startedAt: "2026-11-02T04:59:00Z", litUserIds: ["u1"] };
  const start = Date.parse(lamp.lastLitAt);

  it("shows the lifetime attendance count for three seconds on a returning relight", () => {
    expect(returnGreeting(lamp, stream, start)).toBe("back for stream 3");
    expect(returnGreeting(lamp, stream, start + 2_999)).toBe("back for stream 3");
    expect(returnGreeting(lamp, stream, start + 3_000)).toBeNull();
    expect(returnGreeting({ ...lamp, attendedStreamIds: ["s3"] }, stream, start)).toBeNull();
  });
});
