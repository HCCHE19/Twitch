import { describe, expect, it } from "vitest";
import { makeLedgerEntry, rebuildState } from "../src/ledger.js";
import { emptyState, reduceEnvelope } from "../src/presence.js";
import { applyThreadCommand, applyThreadCommandDetailed, applyThreadReunion } from "../src/threads.js";
import type { DerivedState, EventSubEnvelope } from "../src/types.js";
// @ts-expect-error The overlay helper is intentionally plain browser JavaScript.
import { displayedThreadStreak, placeThreadArrival, preferThreadAdjacency, threadLineWidth, threadVisuals } from "../public/shared/threads.js";

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
const tieOnce = (state: DerivedState, actorId: string, actorName: string, target: string, id = "tie"): EventSubEnvelope[] => {
  const events = applyThreadCommand(state, chat(id, actorId, actorName, `!tie ${target}`), { ...options, enabled: true }); applyEvents(state, events); return events;
};

describe("red threads", () => {
  it("does absolutely nothing when disabled", () => {
    const state = setup(["a", "Alice"], ["b", "Bob"]); const before = structuredClone(state);
    expect(applyThreadCommand(state, chat("3", "a", "Alice", "!tie Bob"), { ...options, enabled: false })).toEqual([]);
    expect(state).toEqual(before);
  });

  it("creates a solid thread in one step and allows one outgoing tie per sender", () => {
    const state = setup(["a", "Alice"], ["b", "Bob"], ["c", "Chika"]);
    const tied = tieOnce(state, "a", "Alice", "Bob", "4");
    expect(tied[0]?.metadata.subscription_type).toBe("lamplight.thread.tied");
    expect(state.threads).toHaveLength(1); expect(state.pendingThreads).toHaveLength(0);
    expect(applyThreadCommand(state, chat("5", "a", "Alice", "!tie Chika"), { ...options, enabled: true })).toEqual([]);
    expect(tieOnce(state, "b", "Bob", "Chika", "6")).toHaveLength(1);
    expect(state.threads).toHaveLength(2); expect(state.threadOutgoingUserIds).toEqual(expect.arrayContaining(["a", "b"]));
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
    const events=applyThreadCommand(state, chat("4", "a", "Alice", "!tie Ch"), { ...options, enabled: true });
    expect(events[0]?.payload.event).toMatchObject({user_id_a:"a",user_id_b:"c",initiator_user_id:"a"});
  });

  it("accepts @name and Twitch mention fragments", () => {
    const state = setup(["a", "Alice"], ["b", "Bao"]);
    const source = chat("4", "a", "Alice", "!tie @Bao");
    (source.payload.event!.message as { fragments: unknown[] }).fragments = [{ type: "text", text: "!tie " }, { type: "mention", text: "@Bao", mention: { user_id: "b", user_name: "Bao" } }];
    const events=applyThreadCommand(state, source, { ...options, enabled: true });
    expect(events[0]?.payload.event).toMatchObject({user_id_a:"a",user_id_b:"b",initiator_user_id:"a"});
  });

  it("handles Twitch-shaped named, mention, and bare commands end to end with an explicit outcome", () => {
    const state = setup(["a", "Alice"], ["b", "Bao"], ["c", "Chika"]);
    const mention = chat("real-mention", "c", "Chika", "!tie @Bao");
    (mention.payload.event!.message as { fragments: unknown[] }).fragments = [
      { type: "text", text: "!tie ", cheermote: null, emote: null, mention: null },
      { type: "mention", text: "@Bao", cheermote: null, emote: null, mention: { user_id: "b", user_name: "Bao", user_login: "bao" } }
    ];
    const mentionResult=applyThreadCommandDetailed(state, mention, { ...options, enabled: true });
    expect(mentionResult).toMatchObject({ command: "!tie", applied: true, reason: "solid thread tied", targetUserId: "b" });applyEvents(state,mentionResult!.events);
    const namedState=setup(["a","Alice"],["b","Bao"],["c","Chika"]),named=applyThreadCommandDetailed(namedState,chat("real-name","b","Bao","!tie Chika"),{...options,enabled:true});
    expect(named).toMatchObject({applied:true,reason:"solid thread tied",targetUserId:"c"});
    const bare = applyThreadCommandDetailed(state, chat("real-bare", "a", "Alice", "!tie"), { ...options, enabled: true });
    expect(bare).toMatchObject({ applied: false, reason: "there is no lamp immediately left of the sender" });
  });

  it("explains the silent live-test rejection when the sender has not lit a lamp", () => {
    const state = setup(["b", "Bao"]);
    expect(applyThreadCommandDetailed(state, chat("unlit", "a", "Alice", "!tie Bao"), { ...options, enabled: true })).toMatchObject({ command: "!tie", applied: false, reason: "sender's lamp is not lit tonight" });
  });

  it("uses the immediately previous arrival for bare tie and untie, and does nothing without one", () => {
    const state = setup(["a", "Alice"], ["b", "Bob"], ["c", "Chika"]);
    expect(applyThreadCommand(state, chat("4", "a", "Alice", "!tie"), { ...options, enabled: true })).toEqual([]); expect(state.pendingThreads).toEqual([]);
    const tied=applyThreadCommand(state, chat("5", "c", "Chika", "!tie"), { ...options, enabled: true });applyEvents(state,tied);expect(state.threads[0]?.userIds).toEqual(["b","c"]);
    const untied = applyThreadCommand(state, chat("7", "c", "Chika", "!untie"), { ...options, enabled: true }); expect(untied).toHaveLength(1);
  });

  it("allows targeted untie from either side and explicit moderator untie", () => {
    for (const actor of [["a", "Alice", "Bob"], ["b", "Bob", "Alice"]] as const) {
      const state = setup(["a", "Alice"], ["b", "Bob"]); expect(tieOnce(state,"a","Alice","Bob","3")).toHaveLength(1);
      const untie = applyThreadCommand(state, chat("5", actor[0], actor[1], `!untie ${actor[2]}`), { ...options, enabled: true }); expect(untie[0]?.metadata.subscription_type).toBe("lamplight.thread.untied"); applyEvents(state, untie); expect(state.threads).toEqual([]);
    }
    const state = setup(["a", "Alice"], ["b", "Bob"]); tieOnce(state,"a","Alice","Bob","3");
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
    state.currentStream!.litUserIds.push("b"); expect(applyThreadReunion(state, "b", "2026-11-02T05:00:10Z")).toEqual(expect.arrayContaining(["a", "b"])); expect(state.threadReunionAtByUserId).toMatchObject({ a: "2026-11-02T05:00:10Z", b: "2026-11-02T05:00:10Z" }); expect(state.flareAtByUserId).toEqual({});
    expect(threadVisuals(items, state).solid).toHaveLength(1);
    const row = preferThreadAdjacency([{ lamp: { userId: "a" } }, { lamp: { userId: "x" } }, { lamp: { userId: "b" } }], state.threads, ["a", "b"]); expect(row.map((item) => item.lamp.userId)).toEqual(["a", "b", "x"]);
  });

  it("draws solid threads at full, medium, and dense tiers",()=>{
    const state=setup(["a","Alice"],["b","Bob"]);tieOnce(state,"a","Alice","Bob","3");
    for(const tier of [0,1,2]){const items=[{lamp:state.lamps.a,x:100,y:900,size:100,tier},{lamp:state.lamps.b,x:220,y:900,size:100,tier}],line=threadVisuals(items,state).solid[0];expect(line).toBeDefined();expect(threadLineWidth(line)).toBe(tier===0?2:1.5)}
  });

  it("counts consecutive together streams, resets on a miss, and restarts at one", () => {
    const state = setup(["a", "Alice"], ["b", "Bob"]);
    state.threads = [{ userIds: ["a", "b"], createdAt: "2026-11-01T00:00:00Z", createdStreamId: "s1", streamsTogether: 0, currentStreak: 0, bestStreak: 0, lastCountedStreamId: null }];
    expect(displayedThreadStreak(state.threads[0], state.currentStream)).toBe(1);
    reduceEnvelope(state, envelope("off10", "stream.offline", {}, 10), options); expect(state.threads[0]).toMatchObject({ streamsTogether: 1, currentStreak: 1, bestStreak: 1 });
    reduceEnvelope(state, envelope("on11", "stream.online", { id: "s2" }, 11), options); light(state, "a12", "a", "Alice"); reduceEnvelope(state, envelope("off13", "stream.offline", {}, 13), options); expect(state.threads[0]?.currentStreak).toBe(0);
    reduceEnvelope(state, envelope("on14", "stream.online", { id: "s3" }, 14), options); light(state, "a15", "a", "Alice"); light(state, "b16", "b", "Bob"); expect(displayedThreadStreak(state.threads[0], state.currentStream)).toBe(1);
    reduceEnvelope(state, envelope("off17", "stream.offline", {}, 17), options); expect(state.threads[0]).toMatchObject({ streamsTogether: 2, currentStreak: 1, bestStreak: 1 });
  });

  it("places a threaded arrival adjacently only within the two-lamp and five-second slide limits", () => {
    const thread = { userIds: ["a", "b"], createdAt: "2026-11-01T00:00:00Z" };
    expect(placeThreadArrival(["a", "x", "b"], "b", [thread], ["a", "b"], 10_000, null)).toMatchObject({ orderIds: ["a", "b", "x"], slid: true, lastSlideAt: 10_000 });
    expect(placeThreadArrival(["a", "x", "y", "z", "b"], "b", [thread], ["a", "b"], 10_000, null)).toMatchObject({ orderIds: ["a", "x", "y", "z", "b"], slid: false });
    expect(placeThreadArrival(["a", "x", "b"], "b", [thread], ["a", "b"], 12_000, 10_000)).toMatchObject({ orderIds: ["a", "x", "b"], slid: false, lastSlideAt: 10_000 });
    const crowded = Array.from({ length: 31 }, (_, index) => index === 0 ? "a" : index === 30 ? "b" : `x${index}`);
    expect(placeThreadArrival(crowded, "b", [thread], ["a", "b"], 20_000, null).slid).toBe(false);
  });

  it("draws arcs over at most three intervening lamps and suppresses longer overlay lines", () => {
    const state = setup(["a", "Alice"], ["x", "X"], ["y", "Y"], ["b", "Bob"]); state.threads = [{ userIds: ["a", "b"], createdAt: "2026-11-01T00:00:00Z", createdStreamId: "old", streamsTogether: 2, currentStreak: 2, bestStreak: 2, lastCountedStreamId: "old" }];
    const items = state.currentStream!.litUserIds.map((userId, index) => ({ lamp: state.lamps[userId], x: index * 10, y: 10, size: 100 }));
    expect(threadVisuals(items, state).solid[0]).toMatchObject({ arc: true, gap: 2, streak: 3 });
    items.splice(1, 0, { lamp: { ...state.lamps.x!, userId: "z" }, x: 5, y: 10, size: 100 }, { lamp: { ...state.lamps.x!, userId: "w" }, x: 6, y: 10, size: 100 });
    expect(threadVisuals(items, state).solid).toEqual([]);
  });
});
