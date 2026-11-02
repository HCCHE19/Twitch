import { describe, expect, it } from "vitest";
// @ts-expect-error The overlay helper is intentionally plain browser JavaScript.
import { rollCallFrame } from "../public/shared/roll-call.js";

describe("roll call", () => {
  const stream = { id: "s1", startedAt: "2026-11-02T05:00:00Z", litUserIds: ["first", "second", "third"] };
  const start = Date.parse("2026-11-02T05:01:00Z");
  it("cycles uncalled lamps every four seconds in first-lit order", () => {
    const preferences = { rollCall: true, rollCallCalled: [], rollCallStartedAt: "2026-11-02T05:01:00Z" };
    expect(rollCallFrame(preferences, stream, start).currentUserId).toBe("first");
    expect(rollCallFrame(preferences, stream, start + 4_000).currentUserId).toBe("second");
    expect(rollCallFrame({ ...preferences, rollCallCalled: ["first"] }, stream, start).currentUserId).toBe("second");
    expect(rollCallFrame({ ...preferences, rollCallCalled: [...stream.litUserIds] }, stream, start)).toEqual({ active: false, complete: true });
  });
});
