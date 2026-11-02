import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { MomentLevel, OverlayLayout } from "./config.js";
import { loadMomentLevel, loadOverlayLayout, loadPromisesEnabled, loadShowNames, loadSkyEnabled, loadThresholdN, loadThreadsEnabled, loadWindEnabled } from "./config.js";

export interface RuntimeSettings {
  sky: boolean;
  threads: boolean;
  wind: boolean;
  promises: boolean;
  showNames: boolean;
  moments: MomentLevel;
  thresholdN: number | "auto";
  layout: OverlayLayout;
}

export interface SettingsManager {
  get: () => RuntimeSettings;
  update: (patch: Partial<RuntimeSettings>) => Promise<RuntimeSettings>;
}

export async function loadDefaultRuntimeSettings(): Promise<RuntimeSettings> {
  const [layout, thresholdN, showNames, threads, sky, wind, promises, moments] = await Promise.all([loadOverlayLayout(), loadThresholdN(), loadShowNames(), loadThreadsEnabled(), loadSkyEnabled(), loadWindEnabled(), loadPromisesEnabled(), loadMomentLevel()]);
  return { layout, thresholdN, showNames, threads, sky, wind, promises, moments };
}

export function validateSettings(value: unknown, fallback: RuntimeSettings): RuntimeSettings {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const boolean = (key: keyof RuntimeSettings): boolean => typeof input[key] === "boolean" ? input[key] as boolean : fallback[key] as boolean;
  const moments = input.moments === "quiet" || input.moments === "normal" || input.moments === "big" ? input.moments : fallback.moments;
  const layout = input.layout === "top" || input.layout === "bottom" ? input.layout : fallback.layout;
  const thresholdN = input.thresholdN === "auto" ? "auto" : typeof input.thresholdN === "number" && Number.isInteger(input.thresholdN) && input.thresholdN > 0 ? input.thresholdN : fallback.thresholdN;
  return { sky: boolean("sky"), threads: boolean("threads"), wind: boolean("wind"), promises: boolean("promises"), showNames: boolean("showNames"), moments, thresholdN, layout };
}

export async function createSettingsManager(defaults: RuntimeSettings, path = "data/settings.json"): Promise<SettingsManager> {
  let current = defaults;
  try { current = validateSettings(JSON.parse(await readFile(path, "utf8")), defaults); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const save = async (): Promise<void> => {
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.tmp`;
    await writeFile(temporary, `${JSON.stringify(current, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await rename(temporary, path);
  };
  return {
    get: () => ({ ...current }),
    update: async (patch) => { current = validateSettings({ ...current, ...patch }, current); await save(); return { ...current }; }
  };
}
