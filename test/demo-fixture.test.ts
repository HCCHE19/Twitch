import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { emptyState, historicalOpacity, reduceEnvelope } from "../src/presence.js";
import type { EventSubEnvelope } from "../src/types.js";

describe("twelve-lamp composition fixture", () => {
  it("ends live with twelve lamps, mixed streaks, and three historical dim lamps", async () => {
    const source = await readFile("test/fixtures/demo-events.jsonl", "utf8");
    const state = emptyState(true);
    for (const line of source.trim().split(/\r?\n/u)) {
      reduceEnvelope(state, JSON.parse(line) as EventSubEnvelope, { broadcasterLogin: "demo_broadcaster" });
    }
    expect(Object.keys(state.lamps)).toHaveLength(12);
    expect(state.currentStream?.litUserIds).toHaveLength(9);
    const dim = Object.values(state.lamps).filter((lamp) => !state.currentStream?.litUserIds.includes(lamp.userId));
    expect(dim).toHaveLength(3);
    expect(dim.every((lamp) => historicalOpacity(lamp.streamsSinceLit) === 0.20)).toBe(true);
    expect(new Set(Object.values(state.lamps).map((lamp) => lamp.streak))).toEqual(new Set([0, 1, 2, 3]));
  });
});
