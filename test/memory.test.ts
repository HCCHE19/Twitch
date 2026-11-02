import { describe, expect, it } from "vitest";
// @ts-expect-error The overlay helper is intentionally plain browser JavaScript.
import { openingCardFrame, returnCardFrame, returnGreeting } from "../public/shared/memory.js";

describe("opening memory card", () => {
  const start = Date.parse("2026-11-02T05:00:00Z");
  const card = { startedAt: "2026-11-02T05:00:00Z", previousStreamId: "s1", previousUserIds: ["a", "b", "c"], previousPromiseUserIds: [] };

  it("uses previous attendance and current relights for ten seconds", () => {
    expect(openingCardFrame(card, { id: "s2", startedAt: card.startedAt, litUserIds: ["a", "c"] }, [], [], start + 9_999)).toEqual({
      active: true,
      lampOpacity: 0,
      panelPulse: 0,
      lines: ["3 lamps last time."]
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
    expect(frame.lines).toEqual(["3 lamps last time."]);
    expect(frame.panelPulse).toBe(1);
    expect(openingCardFrame(promised, stream, [], [], start + 1500).lines).toHaveLength(1);
    expect(openingCardFrame(promised, stream, ["a"], [], start + 1500).panelPulse).toBe(0);
  });
});

describe("return card cutoff", () => {
  const start = Date.parse("2026-11-02T05:00:00Z");
  const time = (ms: number) => new Date(start + ms).toISOString();
  const makeState = () => ({
    openingCard: { startedAt: time(0), previousUserIds: ["a", "b"], previousPromiseUserIds: ["a", "b"] },
    currentStream: { id: "s2", startedAt: time(0), litUserIds: ["a"] },
    lamps: { a: { lastLitAt: time(20_000) }, b: { lastLitAt: time(65_000) } },
    skyFragments: [] as { streamId: string; earnedAt: string }[],
    promiseKeptUserIds: ["a"], promiseKeptAtByUserId: { a: time(20_000), b: time(65_000) }
  });
  it("defaults to ten minutes and never repeats for later fragments", () => {
    const state = makeState();
    expect(returnCardFrame(state, undefined, start + 599_999).active).toBe(false);
    expect(returnCardFrame(state, undefined, start + 600_000).lines).toEqual(["1 is back.", "1 kept their promise."]);
    expect(returnCardFrame(state, undefined, start + 610_000).active).toBe(false);
    state.skyFragments.push({ streamId: "s2", earnedAt: time(620_000) });
    expect(returnCardFrame(state, undefined, start + 620_000).active).toBe(false);
  });
  it("uses the first fragment if earlier, including its threshold arrival", () => {
    const state = makeState();
    state.skyFragments.push({ streamId: "s1", earnedAt: time(-20_000) }, { streamId: "s2", earnedAt: time(20_000) });
    expect(returnCardFrame(state, 1, start + 19_999).active).toBe(false);
    expect(returnCardFrame(state, 1, start + 20_000).lines).toEqual(["1 is back.", "1 kept their promise."]);
    state.skyFragments.push({ streamId: "s2", earnedAt: time(40_000) });
    expect(returnCardFrame(state, 1, start + 40_000).active).toBe(false);
    expect(returnCardFrame(state, 1, start + 60_000).active).toBe(false);
  });
  it("keeps the card frozen for late arrivals, including after browser refresh", () => {
    const state = makeState();
    const before = returnCardFrame(state, 1, start + 60_000);
    state.currentStream.litUserIds.push("b"); state.promiseKeptUserIds.push("b");
    expect(returnCardFrame(structuredClone(state), 1, start + 65_000)).toEqual(before);
    expect(state.currentStream.litUserIds).toHaveLength(2);
    expect(returnCardFrame(state, 1, start + 70_000).active).toBe(false);
    expect(returnCardFrame({ ...state, currentStream: null }, 1, start + 60_000).active).toBe(false);
    expect(returnCardFrame({ ...state, openingCard: null }, 1, start + 60_000).active).toBe(false);
  });
  it("uses the delay locked in stream state rather than a changed setting", () => {
    const state = makeState(); Object.assign(state.currentStream, { returnCardDelayMinutes: 1 });
    expect(returnCardFrame(state, 20, start + 60_000).active).toBe(true);
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
