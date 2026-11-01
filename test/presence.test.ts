import { describe, expect, it } from "vitest";
import { emptyState, historicalOpacity, isPresenceMessage, lampScale, reduceEnvelope } from "../src/presence.js";
import type { EventSubEnvelope } from "../src/types.js";

function envelope(id: string, type: string, event: Record<string, unknown>): EventSubEnvelope {
  return {
    metadata: { message_id: id, message_type: "notification", message_timestamp: `2026-11-01T00:00:${id.padStart(2, "0")}Z`, subscription_type: type },
    payload: { event }
  };
}

function chat(id: string, login: string, text: string, fragments: unknown[] = [{ type: "text", text }]): EventSubEnvelope {
  return envelope(id, "channel.chat.message", {
    chatter_user_id: `user-${login}`, chatter_user_login: login, chatter_user_name: login,
    message: { text, fragments }
  });
}

describe("presence rules", () => {
  it("accepts exact commands and a single emote only", () => {
    expect(isPresenceMessage({ message: { text: " !LAMP ", fragments: [] } })).toBe(true);
    expect(isPresenceMessage({ message: { text: "!lurk", fragments: [] } })).toBe(true);
    expect(isPresenceMessage({ message: { text: "Kappa", fragments: [{ type: "emote", text: "Kappa" }] } })).toBe(true);
    expect(isPresenceMessage({ message: { text: "Kappa hi", fragments: [{ type: "emote", text: "Kappa" }, { type: "text", text: " hi" }] } })).toBe(false);
    expect(isPresenceMessage({ message: { text: "hello", fragments: [{ type: "text", text: "hello" }] } })).toBe(false);
  });

  it("lights once per stream and ignores broadcaster and bots", () => {
    const state = emptyState();
    const options = { broadcasterLogin: "host" };
    reduceEnvelope(state, envelope("1", "stream.online", { id: "s1", started_at: "2026-11-01T00:00:00Z" }), options);
    reduceEnvelope(state, chat("2", "host", "!lamp"), options);
    reduceEnvelope(state, chat("3", "nightbot", "!lamp"), options);
    reduceEnvelope(state, chat("4", "viewer", "!lamp"), options);
    reduceEnvelope(state, chat("5", "viewer", "!lamp"), options);
    expect(Object.keys(state.lamps)).toEqual(["user-viewer"]);
    expect(state.lamps["user-viewer"]?.lifetimeLights).toBe(1);
  });

  it("resets a missed streak and never shrinks lifetime size", () => {
    const state = emptyState();
    const options = { broadcasterLogin: "host" };
    reduceEnvelope(state, envelope("1", "stream.online", { id: "s1" }), options);
    reduceEnvelope(state, chat("2", "viewer", "!lamp"), options);
    reduceEnvelope(state, envelope("3", "stream.offline", {}), options);
    reduceEnvelope(state, envelope("4", "stream.online", { id: "s2" }), options);
    reduceEnvelope(state, envelope("5", "stream.offline", {}), options);
    expect(state.lamps["user-viewer"]?.streak).toBe(0);
    reduceEnvelope(state, envelope("6", "stream.online", { id: "s3" }), options);
    reduceEnvelope(state, chat("7", "viewer", "!lamp"), options);
    expect(state.lamps["user-viewer"]?.streak).toBe(1);
    expect(state.lamps["user-viewer"]?.lifetimeLights).toBe(2);
    expect(lampScale(2)).toBeGreaterThan(lampScale(1));
    expect(lampScale(1_000)).toBe(1.32);
  });

  it("uses the specified historical opacity floor", () => {
    expect([0, 1, 2, 3, 20].map(historicalOpacity)).toEqual([1, 0.45, 0.3, 0.20, 0.20]);
  });
});
