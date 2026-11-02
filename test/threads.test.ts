import { describe, expect, it } from "vitest";
import { makeLedgerEntry, rebuildState } from "../src/ledger.js";
import { emptyState, reduceEnvelope } from "../src/presence.js";
import { applyThreadCommand, applyThreadReunion } from "../src/threads.js";
import type { DerivedState, EventSubEnvelope } from "../src/types.js";
// @ts-expect-error The overlay helper is intentionally plain browser JavaScript.
import { preferThreadAdjacency, threadVisuals } from "../public/shared/threads.js";

const options = { broadcasterLogin: "host", ignoredUsers: ["nightbot"] };
const envelope = (id: string, type: string, event: Record<string, unknown>, second = Number(id.replace(/\D/gu, "")) || 0): EventSubEnvelope => ({
  metadata: { message_id: id, message_type: "notification", message_timestamp: `2026-11-02T05:00:${String(second).padStart(2, "0")}Z`, subscription_type: type }, payload: { event }
});
const chat = (id: string, userId: string, name: string, text: string, badges: unknown[] = []): EventSubEnvelope => envelope(id, "channel.chat.message", { chatter_user_id: userId, chatter_user_login: name.toLowerCase(), chatter_user_name: name, badges, message: { text, fragments: [{ type: "text", text }] } });
const light = (state: DerivedState, id: string, userId: string, name: string): void => reduceEnvelope(state, chat(id, userId, name, "!lamp"), options);
const setup = (...people: Array<[string, string]>): DerivedState => {
  const state = emptyState(); reduceEnvelope(state, envelope("online", "stream.online", { id: "s1" }, 0), options);
  people.forEach(([id, name], index) => light(state, String(index + 1), id, name)); return state;
};
const applyEvents = (state: DerivedState, events: EventSubEnvelope[]): void => events.forEach((event) => reduceEnvelope(state, event, options));

describe("red threads", () => {
  it("does absolutely nothing when disabled", () => {
    const state = setup(["a", "Alice"], ["b", "Bob"]); const before = structuredClone(state);
    expect(applyThreadCommand(state, chat("3", "a", "Alice", "!tie Bob"), { ...options, enabled: false })).toEqual([]);
    expect(state).toEqual(before);
  });

  it("requires mutual ties, expires unreturned pending ties, and allows one outgoing per stream", () => {
    const state = setup(["a", "Alice"], ["b", "Bob"], ["c", "Chika"]);
    expect(applyThreadCommand(state, chat("4", "a", "Alice", "!tie Bob"), { ...options, enabled: true })).toEqual([]);
    expect(state.pendingThreads).toHaveLength(1);
    expect(applyThreadCommand(state, chat("5", "a", "Alice", "!tie Chika"), { ...options, enabled: true })).toEqual([]);
    const tied = applyThreadCommand(state, chat("6", "b", "Bob", "!tie Alice"), { ...options, enabled: true });
    expect(tied[0]?.metadata.subscription_type).toBe("lamplight.thread.tied"); applyEvents(state, tied);
    expect(state.threads).toHaveLength(1); expect(state.pendingThreads).toHaveLength(0);
    const pending = setup(["x", "Xena"], ["y", "Yuki"]); applyThreadCommand(pending, chat("3", "x", "Xena", "!tie Yuki"), { ...options, enabled: true });
    reduceEnvelope(pending, envelope("off", "stream.offline", {}, 8), options); expect(pending.pendingThreads).toEqual([]);
  });

  it("rejects self, dim, absent, broadcaster and ambiguous-prefix targets", () => {
    const state = setup(["a", "Alice"], ["b", "Bao"], ["c", "Basil"]);
    state.lamps.dim = { ...state.lamps.b!, userId: "dim", displayName: "Dim", login: "dim" };
    for (const target of ["Alice", "Dim", "Missing", "Ba"]) expect(applyThreadCommand(state, chat(`x${target}`, "a", "Alice", `!tie ${target}`), { ...options, enabled: true })).toEqual([]);
    expect(applyThreadCommand(state, chat("host", "host-id", "host", "!tie Alice"), { ...options, enabled: true })).toEqual([]);
    expect(state.pendingThreads).toEqual([]);
  });

  it("supports exact then unique-prefix matching", () => {
    const state = setup(["a", "Alice"], ["b", "Bao"], ["c", "Chika"]);
    applyThreadCommand(state, chat("4", "a", "Alice", "!tie Ch"), { ...options, enabled: true });
    expect(state.pendingThreads[0]).toMatchObject({ fromUserId: "a", toUserId: "c" });
  });

  it("allows targeted untie from either side and explicit moderator untie", () => {
    for (const actor of [["a", "Alice", "Bob"], ["b", "Bob", "Alice"]] as const) {
      const state = setup(["a", "Alice"], ["b", "Bob"]); const tie = applyThreadCommand(state, chat("3", "a", "Alice", "!tie Bob"), { ...options, enabled: true }); expect(tie).toEqual([]);
      applyEvents(state, applyThreadCommand(state, chat("4", "b", "Bob", "!tie Alice"), { ...options, enabled: true }));
      const untie = applyThreadCommand(state, chat("5", actor[0], actor[1], `!untie ${actor[2]}`), { ...options, enabled: true }); expect(untie[0]?.metadata.subscription_type).toBe("lamplight.thread.untied"); applyEvents(state, untie); expect(state.threads).toEqual([]);
    }
    const state = setup(["a", "Alice"], ["b", "Bob"]); applyThreadCommand(state, chat("3", "a", "Alice", "!tie Bob"), { ...options, enabled: true }); applyEvents(state, applyThreadCommand(state, chat("4", "b", "Bob", "!tie Alice"), { ...options, enabled: true }));
    const mod = applyThreadCommand(state, chat("6", "mod", "Moderator", "!untie Alice | Bob", [{ set_id: "moderator" }]), { ...options, enabled: true }); expect(mod).toHaveLength(1); applyEvents(state, mod); expect(state.threads).toEqual([]);
  });

  it("persists on rebuild and caps each lamp at the oldest three threads", () => {
    const events = [envelope("online", "stream.online", { id: "s1" }, 0)]; let chain = ""; const entries = events.map((event) => { const entry = makeLedgerEntry(event, chain); chain = entry.hash; return entry; });
    for (const [index, other] of ["b", "c", "d", "e"].entries()) {
      const tied = envelope(`t${index}`, "lamplight.thread.tied", { stream_id: "s1", user_id_a: "a", user_id_b: other }, index + 1); const entry = makeLedgerEntry(tied, chain); chain = entry.hash; entries.push(entry);
    }
    const rebuilt = rebuildState(entries, options); expect(rebuilt.threads.map((thread) => thread.userIds)).toEqual([["a", "b"], ["a", "c"], ["a", "d"]]);
  });

  it("renders waiting state, reunites with two flares, and prefers adjacent placement", () => {
    const state = setup(["a", "Alice"]); state.lamps.b = { ...state.lamps.a!, userId: "b", displayName: "Bob", login: "bob" }; state.threads = [{ userIds: ["a", "b"], createdAt: "2026-11-01T00:00:00Z", createdStreamId: "old" }];
    const items = [{ lamp: state.lamps.a, x: 10, y: 10, size: 100 }, { lamp: state.lamps.b, x: 20, y: 10, size: 100 }];
    expect(threadVisuals(items, state).waiting).toHaveLength(1);
    state.pendingThreads = [{ fromUserId: "a", toUserId: "b", createdAt: "2026-11-02T05:00:00Z" }];
    state.currentStream!.litUserIds.push("b"); expect(threadVisuals(items, state).pending).toHaveLength(1); state.currentStream!.litUserIds.pop(); state.pendingThreads = [];
    state.currentStream!.litUserIds.push("b"); expect(applyThreadReunion(state, "b", "2026-11-02T05:00:10Z")).toEqual(expect.arrayContaining(["a", "b"])); expect(state.threadReunionAtByUserId).toMatchObject({ a: "2026-11-02T05:00:10Z", b: "2026-11-02T05:00:10Z" }); expect(state.flareAtByUserId).toEqual({});
    expect(threadVisuals(items, state).solid).toHaveLength(1);
    const row = preferThreadAdjacency([{ lamp: { userId: "a" } }, { lamp: { userId: "x" } }, { lamp: { userId: "b" } }], state.threads, ["a", "b"]); expect(row.map((item) => item.lamp.userId)).toEqual(["a", "b", "x"]);
  });
});
