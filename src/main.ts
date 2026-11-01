import { loadConfig } from "./config.js";
import { EventSubClient } from "./eventsub.js";
import { getLiveStream, validateToken } from "./twitch-api.js";

async function main(): Promise<void> {
  const config = await loadConfig();
  const identity = await validateToken(config);
  console.log(`[auth] validated broadcaster ${identity.login}; scope user:read:chat; expires in ${Math.floor(identity.expiresIn / 3600)}h`);
  const live = await getLiveStream(config);
  console.log(live ? `[stream] live since ${live.startedAt} (stream ${live.id})` : "[stream] currently offline");

  const client = new EventSubClient({
    config,
    broadcasterUserId: identity.userId,
    onReady: () => console.log("[ready] send a message in your Twitch channel; Ctrl+C stops Lamplight"),
    onChat: (displayName, text) => console.log(`[chat] ${displayName}: ${text}`),
    onStream: (type, event) => console.log(`[stream] ${type}: ${JSON.stringify(event)}`)
  });
  client.start();
  const stop = (): void => { client.stop(); process.exitCode = 0; };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}

main().catch((error: unknown) => {
  console.error(`[fatal] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
