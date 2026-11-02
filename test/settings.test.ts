import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createSettingsManager, validateSettings, type RuntimeSettings } from "../src/settings.js";

const defaults: RuntimeSettings = { sky: false, threads: false, wind: false, promises: true, showNames: true, moments: "normal", thresholdN: 10, layout: "bottom" };

describe("live settings", () => {
  it("validates settings and preserves safe defaults for invalid fields", () => {
    expect(validateSettings({ sky: true, thresholdN: 0, moments: "loud", layout: "middle" }, defaults)).toEqual({ ...defaults, sky: true });
  });

  it("persists updates locally and reloads them over env defaults", async () => {
    const directory = await mkdtemp(join(tmpdir(), "lamplight-settings-")); const path = join(directory, "settings.json");
    const manager = await createSettingsManager(defaults, path);
    await manager.update({ sky: true, threads: true, thresholdN: 3, layout: "top", moments: "quiet" });
    expect(JSON.parse(await readFile(path, "utf8"))).toMatchObject({ sky: true, threads: true, thresholdN: 3, layout: "top", moments: "quiet" });
    const reloaded = await createSettingsManager({ ...defaults, sky: false }, path); expect(reloaded.get()).toMatchObject({ sky: true, threads: true, thresholdN: 3, layout: "top", moments: "quiet" });
    await reloaded.update({ thresholdN: "auto" });
    expect((await createSettingsManager(defaults, path)).get().thresholdN).toBe("auto");
  });
});
