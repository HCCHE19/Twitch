import { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createAuthManager } from "../src/auth.js";

// Isolate tests from the real .env; all credentials below are fictional.
vi.mock("../src/config.js", () => ({ loadEnvValues: async (values: NodeJS.ProcessEnv) => values }));

const env = { TWITCH_CLIENT_ID: "client-id", TWITCH_CLIENT_SECRET: "client-secret", TWITCH_CHANNEL_LOGIN: "owner", TWITCH_ACCESS_TOKEN: "" };

describe("Twitch authorization manager", () => {
  it("keeps the existing env-token fallback unchanged", async () => {
    const directory = await mkdtemp(join(tmpdir(), "lamplight-auth-"));
    const auth = await createAuthManager({ path: join(directory, "auth.json"), env: { ...env, TWITCH_ACCESS_TOKEN: "oauth:legacy-token" } });
    expect(auth.config()).toEqual({ accessToken: "legacy-token", clientId: "client-id", channelLogin: "owner" });
    await auth.close(); await rm(directory, { recursive: true });
  });

  it("starts disconnected and creates a state-protected code-flow URL without exposing the secret", async () => {
    const directory = await mkdtemp(join(tmpdir(), "lamplight-auth-"));
    const auth = await createAuthManager({ path: join(directory, "auth.json"), env });
    expect(auth.config()).toBeNull(); const url = new URL(auth.createAuthorizationUrl());
    expect(url.origin + url.pathname).toBe("https://id.twitch.tv/oauth2/authorize");
    expect(url.searchParams.get("force_verify")).toBe("true");
    expect(url.searchParams.get("response_type")).toBe("code"); expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:3939"); expect(url.searchParams.get("scope")).toBe("user:read:chat"); expect(url.searchParams.get("state")).toHaveLength(48);
    expect(url.toString()).not.toContain("client-secret"); await auth.close(); await rm(directory, { recursive: true });
  });

  it("refreshes stored authorization before expiry and rotates the saved tokens", async () => {
    const directory = await mkdtemp(join(tmpdir(), "lamplight-auth-")), path = join(directory, "auth.json");
    await writeFile(path, JSON.stringify({ accessToken: "old-access", refreshToken: "old-refresh", expiresAt: new Date(Date.now() - 1_000).toISOString(), scopes: ["user:read:chat"] }));
    const calls: string[] = [];
    const fetcher = async (_input: string | URL | Request, init?: RequestInit): Promise<Response> => { calls.push(String(init?.body)); return new Response(JSON.stringify({ access_token: "new-access", refresh_token: "new-refresh", expires_in: 3600, scope: ["user:read:chat"] }), { status: 200 }); };
    const auth = await createAuthManager({ path, env, fetcher: fetcher as typeof fetch });
    expect(auth.config()?.accessToken).toBe("new-access"); expect(calls[0]).toContain("grant_type=refresh_token");
    const stored = JSON.parse(await readFile(path, "utf8")) as { accessToken: string; refreshToken: string }; expect(stored).toMatchObject({ accessToken: "new-access", refreshToken: "new-refresh" });
    await auth.close(); await rm(directory, { recursive: true });
  });

  it("exchanges a verified callback code, saves locally, and exposes no token in the redirect", async () => {
    const directory = await mkdtemp(join(tmpdir(), "lamplight-auth-")), path = join(directory, "auth.json");
    const fetcher = async (_input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      expect(String(init?.body)).toContain("grant_type=authorization_code");
      return new Response(JSON.stringify({ access_token: "callback-access", refresh_token: "callback-refresh", expires_in: 3600, scope: ["user:read:chat"] }), { status: 200 });
    };
    const auth = await createAuthManager({ path, env, fetcher: fetcher as typeof fetch }); const authorize = new URL(auth.createAuthorizationUrl());
    // Use an ephemeral test port so the user's running callback server is untouched.
    let callbackServer: Server;
    const originalListen = Server.prototype.listen;
    const listen = vi.spyOn(Server.prototype, "listen").mockImplementationOnce(function(this: Server, ...args: any[]) {
      callbackServer = this; args[0] = 0; return originalListen.apply(this, args as any);
    });
    await auth.startCallbackServer(); listen.mockRestore();
    const callbackPort = (callbackServer!.address() as AddressInfo).port;
    const callback = await fetch(`http://127.0.0.1:${callbackPort}/?code=test-code&state=${authorize.searchParams.get("state")}`, { redirect: "manual" });
    expect(callback.status).toBe(302); expect(callback.headers.get("location")).toBe("http://localhost:8787/setup?connected=1"); expect(callback.headers.get("location")).not.toContain("callback-access");
    expect(auth.config()?.accessToken).toBe("callback-access"); expect(JSON.parse(await readFile(path, "utf8"))).toMatchObject({ accessToken: "callback-access", refreshToken: "callback-refresh" });
    const reconnect = new URL(auth.createAuthorizationUrl());
    expect(reconnect.searchParams.get("force_verify")).toBe("true");
    expect(reconnect.searchParams.get("state")).not.toBe(authorize.searchParams.get("state"));
    const second = await fetch(`http://127.0.0.1:${callbackPort}/?code=test-code&state=${reconnect.searchParams.get("state")}`, { redirect: "manual" });
    expect(second.status).toBe(302);
    await auth.close(); await rm(directory, { recursive: true });
  });
});
