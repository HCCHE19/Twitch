import { readFile } from "node:fs/promises";

export interface Config {
  accessToken: string;
  clientId: string;
  channelLogin: string;
}

export type OverlayLayout = "bottom" | "top";

function parseEnvFile(source: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const rawLine of source.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const equals = line.indexOf("=");
    if (equals < 1) continue;
    const key = line.slice(0, equals).trim();
    let value = line.slice(equals + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

export async function loadConfig(env = process.env): Promise<Config> {
  let fileValues: Record<string, string> = {};
  try {
    fileValues = parseEnvFile(await readFile(".env", "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const value = (key: string): string => env[key]?.trim() || fileValues[key]?.trim() || "";
  const config = {
    accessToken: value("TWITCH_ACCESS_TOKEN").replace(/^oauth:/u, ""),
    clientId: value("TWITCH_CLIENT_ID"),
    channelLogin: value("TWITCH_CHANNEL_LOGIN").toLowerCase()
  };
  const missing = Object.entries(config).filter(([, item]) => !item).map(([key]) => key);
  if (missing.length) {
    throw new Error(`Missing configuration: ${missing.join(", ")}. Copy .env.example to .env and fill it in.`);
  }
  return config;
}

export async function loadOverlayLayout(env = process.env): Promise<OverlayLayout> {
  let fileValues: Record<string, string> = {};
  try {
    fileValues = parseEnvFile(await readFile(".env", "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const layout = (env.LAYOUT?.trim() || fileValues.LAYOUT?.trim() || "bottom").toLowerCase();
  if (layout !== "bottom" && layout !== "top") throw new Error("LAYOUT must be bottom or top");
  return layout;
}

export async function loadIgnoredUsers(path = "config/ignored-users.json"): Promise<string[]> {
  const values = JSON.parse(await readFile(path, "utf8")) as unknown;
  if (!Array.isArray(values) || values.some((value) => typeof value !== "string")) {
    throw new Error(`${path} must contain a JSON array of Twitch login names.`);
  }
  return values.map((value) => value.toLowerCase());
}
