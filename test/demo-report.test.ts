import { expect, it } from "vitest";
import { demoNotices, demoSpeed } from "../src/demo-report.js";
import { nightDemo, retimeDemoEnvelope } from "../src/demo-events.js";
import { emptyState } from "../src/presence.js";

it("stretches all night intervals evenly to the requested minutes", () => {
  const events = nightDemo(), origin = Date.parse(events[0]!.metadata.message_timestamp);
  for (const minutes of [4, 8, 12]) {
    const speed = demoSpeed(events, minutes);
    const timed = events.map(event => retimeDemoEnvelope(event, 0, origin, speed));
    expect(Date.parse(timed.at(-1)!.metadata.message_timestamp)).toBe(minutes * 60_000);
    for (let i = 1; i < events.length; i++) {
      const actual = Date.parse(timed[i]!.metadata.message_timestamp) - Date.parse(timed[i-1]!.metadata.message_timestamp);
      const source = Date.parse(events[i]!.metadata.message_timestamp) - Date.parse(events[i-1]!.metadata.message_timestamp);
      expect(Math.abs(actual - source / speed)).toBeLessThanOrEqual(1);
    }
  }
  expect(() => demoSpeed(events, 0)).toThrow();
});

it("prints notable outcomes with names and fragment progress", () => {
  const before = emptyState(), after = emptyState();
  after.pendingThreads = [{ fromUserId: "a", toUserId: "b", createdAt: "now" }];
  after.lamps.a = { displayName: "Alex" } as typeof after.lamps[string];
  after.lamps.b = { displayName: "Bao" } as typeof after.lamps[string];
  after.promises = [{ streamId: "s", userId: "a", madeAt: "now" }];
  before.skyFragments = ["A", "B", "C", "D", "E"].map(fragment => ({ streamId: "s", constellation: "Leo", fragment, earnedAt: "now", litUserIds: [] }));
  after.skyFragments = [...before.skyFragments, { ...before.skyFragments[0]!, fragment: "F" }];
  after.closingHintAt = "now";
  expect(demoNotices(before, after)).toEqual(["tie Alex to Bao (pending)", "promise — Alex", "fragment earned — Leo 6 of 6", "constellation complete — Leo", "closing hint"]);
});
