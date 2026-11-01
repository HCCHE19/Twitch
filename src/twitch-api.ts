import type { Config } from "./config.js";

const API_ROOT = "https://api.twitch.tv/helix";
const VALIDATE_URL = "https://id.twitch.tv/oauth2/validate";

export interface ValidatedIdentity {
  clientId: string;
  login: string;
  scopes: string[];
  userId: string;
  expiresIn: number;
}

export interface LiveStream {
  id: string;
  startedAt: string;
}

async function jsonResponse<T>(response: Response, context: string): Promise<T> {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${context} failed (${response.status}): ${body.slice(0, 500)}`);
  }
  return response.json() as Promise<T>;
}

// https://dev.twitch.tv/docs/authentication/validate-tokens/
export async function validateToken(config: Config, fetcher = fetch): Promise<ValidatedIdentity> {
  const response = await fetcher(VALIDATE_URL, {
    headers: { Authorization: `OAuth ${config.accessToken}` }
  });
  const body = await jsonResponse<{
    client_id: string; login: string; scopes: string[]; user_id: string; expires_in: number;
  }>(response, "Token validation");
  if (body.client_id !== config.clientId) throw new Error("TWITCH_CLIENT_ID does not match the token's client ID.");
  if (body.login.toLowerCase() !== config.channelLogin) {
    throw new Error(`Token belongs to ${body.login}, not broadcaster ${config.channelLogin}. Mint it while logged into the broadcaster account.`);
  }
  if (!body.scopes.includes("user:read:chat")) throw new Error("Token is missing required scope user:read:chat.");
  return {
    clientId: body.client_id,
    login: body.login,
    scopes: body.scopes,
    userId: body.user_id,
    expiresIn: body.expires_in
  };
}

// https://dev.twitch.tv/docs/api/reference/#get-streams
export async function getLiveStream(config: Config, fetcher = fetch): Promise<LiveStream | null> {
  const url = new URL(`${API_ROOT}/streams`);
  url.searchParams.set("user_login", config.channelLogin);
  const response = await fetcher(url, {
    headers: { Authorization: `Bearer ${config.accessToken}`, "Client-Id": config.clientId }
  });
  const body = await jsonResponse<{ data: Array<{ id: string; started_at: string }> }>(response, "Get Streams");
  const stream = body.data[0];
  return stream ? { id: stream.id, startedAt: stream.started_at } : null;
}

// https://dev.twitch.tv/docs/api/reference/#create-eventsub-subscription
export async function createSubscription(
  config: Config,
  sessionId: string,
  type: "channel.chat.message" | "stream.online" | "stream.offline",
  broadcasterUserId: string,
  fetcher = fetch
): Promise<void> {
  const condition = type === "channel.chat.message"
    ? { broadcaster_user_id: broadcasterUserId, user_id: broadcasterUserId }
    : { broadcaster_user_id: broadcasterUserId };
  const response = await fetcher(`${API_ROOT}/eventsub/subscriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Client-Id": config.clientId,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ type, version: "1", condition, transport: { method: "websocket", session_id: sessionId } })
  });
  await jsonResponse(response, `Subscribe ${type}`);
}
