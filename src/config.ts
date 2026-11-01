import { readFile } from "node:fs/promises";

export interface Config {
  accessToken: string;
  clientId: string;
  channelLogin: string;
}

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
