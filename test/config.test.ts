import { describe, expect, it } from "vitest";
import { loadShowNames, loadThresholdN, loadThreadsEnabled } from "../src/config.js";

describe("overlay feature configuration", () => {
  it("parses threshold and name visibility overrides", async () => {
    await expect(loadThresholdN({ THRESHOLD_N: "3" })).resolves.toBe(3);
    await expect(loadShowNames({ SHOW_NAMES: "false" })).resolves.toBe(false);
    await expect(loadShowNames({ SHOW_NAMES: "maybe" })).rejects.toThrow("SHOW_NAMES");
    await expect(loadThreadsEnabled({ THREADS: "true" })).resolves.toBe(true);
    await expect(loadThreadsEnabled({ THREADS: "false" })).resolves.toBe(false);
  });
});
