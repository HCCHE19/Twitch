import { describe, expect, it, vi } from "vitest";
import type { Config } from "../src/config.js";
import { createSubscription, getLiveStream, validateToken } from "../src/twitch-api.js";

const config: Config = { accessToken: "test-token", clientId: "client-1", channelLogin: "lamplight" };

describe("Twitch API", () => {
  it("validates the broadcaster token and minimum scope", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      client_id: "client-1", login: "Lamplight", scopes: ["user:read:chat"], user_id: "42", expires_in: 3600
    }), { status: 200 }));
    await expect(validateToken(config, fetcher)).resolves.toMatchObject({ userId: "42", login: "Lamplight" });
  });

  it("rejects a token for another account", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      client_id: "client-1", login: "someone_else", scopes: ["user:read:chat"], user_id: "99", expires_in: 3600
    }), { status: 200 }));
    await expect(validateToken(config, fetcher)).rejects.toThrow("not broadcaster");
  });

  it("recovers the current live stream by login", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ data: [{ id: "stream-7", started_at: "2026-11-01T08:00:00Z", viewer_count: 12 }] })));
    await expect(getLiveStream(config, fetcher)).resolves.toEqual({ id: "stream-7", startedAt: "2026-11-01T08:00:00Z", viewerCount: 12 });
    expect(String(fetcher.mock.calls[0]?.[0])).toContain("user_login=lamplight");
  });

  it.each(["channel.chat.message", "stream.online", "stream.offline"] as const)("builds %s WebSocket subscription", async (type) => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ data: [{}] }), { status: 202 }));
    await createSubscription(config, "session-1", type, "42", fetcher);
    const init = fetcher.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body).toMatchObject({ type, version: "1", transport: { method: "websocket", session_id: "session-1" } });
    expect(body.condition).toEqual(type === "channel.chat.message"
      ? { broadcaster_user_id: "42", user_id: "42" }
      : { broadcaster_user_id: "42" });
  });
});
