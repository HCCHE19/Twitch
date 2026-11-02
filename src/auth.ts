import { randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { loadEnvValues, type Config } from "./config.js";

const AUTHORIZE_URL = "https://id.twitch.tv/oauth2/authorize";
const TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const REDIRECT_URI = "http://localhost:3939";
const REQUIRED_SCOPE = "user:read:chat";

interface StoredAuth { accessToken: string; refreshToken: string; expiresAt: string; scopes: string[] }
interface TokenResponse { access_token: string; refresh_token?: string; expires_in: number; scope?: string[] }

export interface AuthManager {
  clientId: string;
  channelLogin: string;
  createAuthorizationUrl: () => string;
  connected: () => boolean;
  config: () => Config | null;
  waitForConfig: () => Promise<Config>;
  startCallbackServer: () => Promise<void>;
  close: () => Promise<void>;
}

async function tokenRequest(parameters: URLSearchParams, fetcher: typeof fetch): Promise<TokenResponse> {
  // Twitch authorization-code and refresh flows:
  // https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#authorization-code-grant-flow
  // https://dev.twitch.tv/docs/authentication/refresh-tokens/
  const response = await fetcher(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: parameters });
  if (!response.ok) throw new Error(`Twitch token exchange failed (${response.status})`);
  const body = await response.json() as Partial<TokenResponse>;
  if (!body.access_token || !Number.isFinite(body.expires_in)) throw new Error("Twitch token response was incomplete");
  return body as TokenResponse;
}

export async function createAuthManager(options: { path?: string; fetcher?: typeof fetch; env?: NodeJS.ProcessEnv } = {}): Promise<AuthManager> {
  const path = options.path ?? "data/auth.json", fetcher = options.fetcher ?? fetch, values = await loadEnvValues(options.env);
  const clientId = values.TWITCH_CLIENT_ID ?? "", clientSecret = values.TWITCH_CLIENT_SECRET ?? "", channelLogin = (values.TWITCH_CHANNEL_LOGIN ?? "").toLowerCase(), envToken = (values.TWITCH_ACCESS_TOKEN ?? "").replace(/^oauth:/u, "");
  if (!clientId || !channelLogin) throw new Error("Missing configuration: clientId, channelLogin. Fill TWITCH_CLIENT_ID and TWITCH_CHANNEL_LOGIN in .env.");
  let activeConfig: Config | null = null, stored: StoredAuth | null = null, expectedState = "", stateExpiresAt = 0, callbackServer: Server | null = null, refreshTimer: NodeJS.Timeout | null = null;
  let resolveWait: ((config: Config) => void) | null = null;
  const waiting = new Promise<Config>((resolve) => { resolveWait = resolve; });

  const persist = async (next: StoredAuth): Promise<void> => {
    await mkdir(dirname(path), { recursive: true }); const temporary = `${path}.tmp`;
    await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, { encoding: "utf8", mode: 0o600 }); await rename(temporary, path);
  };
  const activate = (token: string): Config => {
    if (activeConfig) activeConfig.accessToken = token; else activeConfig = { accessToken: token, clientId, channelLogin };
    resolveWait?.(activeConfig); resolveWait = null; return activeConfig;
  };
  const scheduleRefresh = (): void => {
    if (refreshTimer) clearTimeout(refreshTimer); if (!stored?.refreshToken) return;
    const delay = Math.max(10_000, Date.parse(stored.expiresAt) - Date.now() - 5 * 60_000);
    const attempt = async (): Promise<void> => { try { await refresh(); } catch { console.error("[auth] automatic token refresh failed; retrying in 60s"); refreshTimer = setTimeout(() => void attempt(), 60_000); } };
    refreshTimer = setTimeout(() => void attempt(), delay);
  };
  const accept = async (body: TokenResponse, previousRefresh = ""): Promise<Config> => {
    stored = { accessToken: body.access_token, refreshToken: body.refresh_token || previousRefresh, expiresAt: new Date(Date.now() + body.expires_in * 1000).toISOString(), scopes: body.scope ?? [REQUIRED_SCOPE] };
    await persist(stored); const config = activate(stored.accessToken); scheduleRefresh(); return config;
  };
  const refresh = async (): Promise<Config> => {
    if (!stored?.refreshToken || !clientSecret) throw new Error("Stored Twitch login cannot be refreshed");
    const parameters = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "refresh_token", refresh_token: stored.refreshToken });
    return accept(await tokenRequest(parameters, fetcher), stored.refreshToken);
  };
  try { stored = JSON.parse(await readFile(path, "utf8")) as StoredAuth; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  if (stored?.accessToken) {
    if (Date.parse(stored.expiresAt) <= Date.now() + 5 * 60_000) await refresh(); else { activate(stored.accessToken); scheduleRefresh(); }
  } else if (envToken) activate(envToken);

  const createAuthorizationUrl = (): string => {
    if (!clientSecret) throw new Error("TWITCH_CLIENT_SECRET is required for one-click setup");
    expectedState = randomBytes(24).toString("hex"); stateExpiresAt = Date.now() + 10 * 60_000;
    // Explicit clicks should show authorization again, including an already-connected account.
    // https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#authorization-code-grant-flow
    const url = new URL(AUTHORIZE_URL); url.search = new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: REDIRECT_URI, scope: REQUIRED_SCOPE, force_verify: "true", state: expectedState }).toString(); return url.toString();
  };
  const startCallbackServer = async (): Promise<void> => {
    callbackServer = createServer(async (request, response) => {
      const url = new URL(request.url ?? "/", REDIRECT_URI), code = url.searchParams.get("code"), state = url.searchParams.get("state");
      if (!code || !state || state !== expectedState || Date.now() > stateExpiresAt) { response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" }).end("Twitch connection could not be verified. Return to Lamplight setup and try again."); return; }
      expectedState = "";
      try {
        const parameters = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, grant_type: "authorization_code", redirect_uri: REDIRECT_URI });
        await accept(await tokenRequest(parameters, fetcher)); response.writeHead(302, { Location: "http://localhost:8787/setup?connected=1" }).end();
      } catch { response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" }).end("Twitch connection failed. Return to Lamplight setup and try again."); }
    });
    await new Promise<void>((resolve, reject) => { callbackServer!.once("error", reject); callbackServer!.listen(3939, "127.0.0.1", () => { callbackServer!.off("error", reject); resolve(); }); });
  };
  return { clientId, channelLogin, createAuthorizationUrl, connected: () => activeConfig !== null, config: () => activeConfig, waitForConfig: () => activeConfig ? Promise.resolve(activeConfig) : waiting, startCallbackServer, close: async () => { if (refreshTimer) clearTimeout(refreshTimer); if (callbackServer) await new Promise<void>((resolve, reject) => callbackServer!.close((error) => error ? reject(error) : resolve())); } };
}
