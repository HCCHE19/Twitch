import { describe, expect, it } from "vitest";
import { makeLedgerEntry, rebuildState, verifyLedger } from "../src/ledger.js";
import type { EventSubEnvelope } from "../src/types.js";

function item(id: string, type: string, event: Record<string, unknown>): EventSubEnvelope {
  return { metadata: { message_id: id, message_type: "notification", message_timestamp: "2026-11-01T00:00:00Z", subscription_type: type }, payload: { event } };
}

describe("ledger", () => {
  it("chains, verifies, and deterministically rebuilds state", () => {
    const first = makeLedgerEntry(item("1", "stream.online", { id: "s1" }), "", "2026-11-01T00:00:01Z");
    const second = makeLedgerEntry(item("2", "channel.chat.message", {
      chatter_user_id: "u1", chatter_user_login: "viewer", chatter_user_name: "Viewer",
      message: { text: "!lamp", fragments: [{ type: "text", text: "!lamp" }] }
    }), first.hash, "2026-11-01T00:00:02Z");
    expect(() => verifyLedger([first, second])).not.toThrow();
    const stateA = rebuildState([first, second], { broadcasterLogin: "host" });
    const stateB = rebuildState([first, second], { broadcasterLogin: "host" });
    expect(stateA).toEqual(stateB);
    expect(stateA.lamps.u1?.displayName).toBe("Viewer");
    expect(JSON.stringify(second.payload)).not.toContain("!lamp");
    expect(second.payload).toMatchObject({ event: { chatter_user_id: "u1", message: { lamplight_presence: true } } });
  });

  it("stores neither text nor identity for ordinary non-presence chat", () => {
    const entry = makeLedgerEntry(item("chat", "channel.chat.message", { chatter_user_id: "quiet-user", chatter_user_login: "quiet", chatter_user_name: "Quiet", message: { text: "private conversation", fragments: [{ type: "text", text: "private conversation" }] } }), "");
    expect(JSON.stringify(entry.payload)).not.toContain("private conversation"); expect(JSON.stringify(entry.payload)).not.toContain("quiet-user");
    expect(entry.payload).toEqual({ event: { message: { lamplight_presence: false } } });
  });

  it("detects payload tampering and chain breaks", () => {
    const first = makeLedgerEntry(item("1", "stream.online", { id: "s1" }), "");
    const tampered = { ...first, payload: { event: { id: "changed" } } };
    expect(() => verifyLedger([tampered])).toThrow("hash mismatch");
    const wrongPrev = makeLedgerEntry(item("2", "stream.offline", {}), "wrong");
    expect(() => verifyLedger([first, wrongPrev])).toThrow("chain break");
  });

  it("rebuilds a mid-stream boot recovered from GET /streams", () => {
    const recovered = makeLedgerEntry(item("recovery:s9", "lamplight.stream.recovered", { id: "s9", started_at: "2026-11-01T00:00:00Z", source: "helix.get-streams" }), "");
    const chat = makeLedgerEntry(item("chat-1", "channel.chat.message", {
      chatter_user_id: "u9", chatter_user_login: "viewer", chatter_user_name: "Viewer",
      message: { text: "!lamp", fragments: [{ type: "text", text: "!lamp" }] }
    }), recovered.hash);
    const state = rebuildState([recovered, chat], { broadcasterLogin: "host" });
    expect(state.currentStream?.id).toBe("s9");
    expect(state.lamps.u9?.lastStreamId).toBe("s9");
  });
});
