import { describe, expect, it } from "vitest";
// @ts-expect-error The overlay helper is intentionally plain browser JavaScript.
import { closingFrame } from "../public/shared/closing.js";

const moment = { startedAt: "2026-11-01T00:00:00Z", litUserIds: ["a", "b", "c"], totalLamps: 3, returningLamps: 2, promisedLamps: 1 };
const start = Date.parse(moment.startedAt);

describe("closing moment", () => {
  it("extinguishes in lit order every 150ms, summarizes for ten seconds, then clears", () => {
    expect(closingFrame(moment, start)).toEqual({ kind: "lamps", visibleUserIds: ["a", "b", "c"] });
    expect(closingFrame(moment, start + 150)).toEqual({ kind: "lamps", visibleUserIds: ["b", "c"] });
    expect(closingFrame(moment, start + 300)).toEqual({ kind: "lamps", visibleUserIds: ["c"] });
    expect(closingFrame(moment, start + 450)).toEqual({ kind: "summary", lines: ["3 lamps tonight, 2 returning", "1 of 3 promised to come back"] });
    expect(closingFrame(moment, start + 10_449).kind).toBe("summary");
    expect(closingFrame(moment, start + 10_450)).toEqual({ kind: "clear" });
  });

  it("skips sequential motion when reduced motion is requested", () => {
    expect(closingFrame(moment, start, true)).toEqual({ kind: "summary", lines: ["3 lamps tonight, 2 returning", "1 of 3 promised to come back"] });
  });
});
