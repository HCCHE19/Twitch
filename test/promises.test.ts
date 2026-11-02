import { describe, expect, it } from "vitest";
import { makeLedgerEntry, rebuildState } from "../src/ledger.js";
import { emptyState, reduceEnvelope } from "../src/presence.js";
import { applyPromiseCommand, weightedLampCount } from "../src/promises.js";
import { createReceipt, receiptHtml } from "../src/receipt.js";
import type { EventSubEnvelope, LedgerEntry } from "../src/types.js";
// @ts-expect-error Browser helper is intentionally plain JavaScript.
import { openingCardFrame } from "../public/shared/memory.js";
// @ts-expect-error Browser helper is intentionally plain JavaScript.
import { closingHintPosition, closingHintVisible } from "../public/shared/promises.js";

const options = { broadcasterLogin: "host" };
const envelope = (id: string, type: string, time: string, event: Record<string, unknown>): EventSubEnvelope => ({ metadata: { message_id: id, message_type: "notification", message_timestamp: time, subscription_type: type }, payload: { event } });
const online = (id: string, time: string) => envelope(`online-${id}`, "stream.online", time, { id, started_at: time });
const offline = (id: string, time: string) => envelope(`offline-${id}`, "stream.offline", time, {});
const chat = (id: string, userId: string, login: string, text: string, time: string) => envelope(id, "channel.chat.message", time, { chatter_user_id: userId, chatter_user_login: login, chatter_user_name: login[0]!.toUpperCase() + login.slice(1), message: { text, fragments: [{ type: "text", text }] } });

function appendPromise(state: ReturnType<typeof emptyState>, source: EventSubEnvelope): EventSubEnvelope | null {
  reduceEnvelope(state, source, options);
  const event = applyPromiseCommand(state, source, { ...options, enabled: true });
  if (event) reduceEnvelope(state, event, options);
  return event;
}

describe("return promises", () => {
  it("records !back once per lit viewer per stream and does nothing while disabled", () => {
    const state = emptyState(); reduceEnvelope(state, online("s1", "2026-11-01T10:00:00Z"), options);
    expect(appendPromise(state, chat("early", "a", "alice", "!back", "2026-11-01T10:00:05Z"))).toBeNull();
    reduceEnvelope(state, chat("light", "a", "alice", "!lamp", "2026-11-01T10:00:10Z"), options);
    const source = chat("promise", "a", "alice", "!back", "2026-11-01T10:00:20Z");
    const made = applyPromiseCommand(state, source, { ...options, enabled: true }); expect(made?.metadata.subscription_type).toBe("lamplight.promise.made"); reduceEnvelope(state, made!, options);
    expect(applyPromiseCommand(state, chat("again", "a", "alice", "!back", "2026-11-01T10:00:30Z"), { ...options, enabled: true })).toBeNull();
    expect(applyPromiseCommand(state, chat("off", "a", "alice", "!back", "2026-11-01T10:00:40Z"), { ...options, enabled: false })).toBeNull();
    expect(state.promises).toHaveLength(1);
  });

  it("detects kept promises only in the next stream and double-weights them at the threshold", () => {
    const state = emptyState(); reduceEnvelope(state, online("s1", "2026-11-01T10:00:00Z"), options);
    reduceEnvelope(state, chat("a1", "a", "alice", "!lamp", "2026-11-01T10:01:00Z"), options);
    const promise = applyPromiseCommand(state, chat("ap", "a", "alice", "!back", "2026-11-01T10:02:00Z"), { ...options, enabled: true }); reduceEnvelope(state, promise!, options);
    reduceEnvelope(state, offline("s1", "2026-11-01T11:00:00Z"), options); reduceEnvelope(state, online("s2", "2026-11-02T10:00:00Z"), options);
    reduceEnvelope(state, chat("a2", "a", "alice", "✨", "2026-11-02T10:00:01Z"), options);
    expect(state.promiseKeptUserIds).toEqual(["a"]); expect(state.lamps.a?.lifetimePromisesKept).toBe(1); expect(weightedLampCount(state)).toBe(2);
    reduceEnvelope(state, chat("b2", "b", "bao", "!lamp", "2026-11-02T10:00:02Z"), options); expect(weightedLampCount(state)).toBe(3);
    const card = openingCardFrame(state.openingCard, state.currentStream, state.promiseKeptUserIds, [], Date.parse("2026-11-02T10:00:03Z"));
    expect(card.lines[1]).toBe("1 promised, 1 kept it — the sky starts ahead tonight.");
  });

  it("never lists non-returners in the receipt", () => {
    const events: EventSubEnvelope[] = [online("s1", "2026-11-01T10:00:00Z"), chat("a1", "a", "alice", "!lamp", "2026-11-01T10:01:00Z"), envelope("pa", "lamplight.promise.made", "2026-11-01T10:02:00Z", { stream_id: "s1", user_id: "a" }), chat("b1", "b", "bao", "!lamp", "2026-11-01T10:03:00Z"), envelope("pb", "lamplight.promise.made", "2026-11-01T10:04:00Z", { stream_id: "s1", user_id: "b" }), offline("s1", "2026-11-01T11:00:00Z"), online("s2", "2026-11-02T10:00:00Z"), chat("a2", "a", "alice", "!lamp", "2026-11-02T10:01:00Z"), offline("s2", "2026-11-02T11:00:00Z")];
    const entries: LedgerEntry[] = []; for (const event of events) entries.push(makeLedgerEntry(event, entries.at(-1)?.hash ?? "", event.metadata.message_timestamp));
    const state = rebuildState(entries.slice(0, -1), options); const receipt = createReceipt(state, entries, events.at(-1)!.metadata.message_timestamp, "eventsub", "2026-11-02T11:00:01Z", false, false, true);
    expect(receipt.promises).toEqual({ promisedTonight: 0, promisedLastStream: 2, kept: 1, keptNames: ["Alice"] });
    const html = receiptHtml(receipt); expect(html).toContain("Kept by Alice."); expect(html).not.toContain("Kept by Bao");
  });

  it("shows the closing hint at 90 percent of a reliable last-five median or after !closing", () => {
    const state = emptyState(); state.currentStream = { id: "s2", startedAt: "2026-11-02T10:00:00Z", litUserIds: [] };
    state.completedStreamDurationsMs = [2 * 60_000, 40 * 60_000, 50 * 60_000, 60 * 60_000, 70 * 60_000, 80 * 60_000];
    expect(closingHintVisible(state, Date.parse("2026-11-02T10:53:59Z"))).toBe(false); expect(closingHintVisible(state, Date.parse("2026-11-02T10:54:00Z"))).toBe(true);
    state.completedStreamDurationsMs = [10 * 60_000, 20 * 60_000, 29 * 60_000]; expect(closingHintVisible(state, Date.parse("2026-11-02T12:00:00Z"))).toBe(false);
    state.closingHintAt = "2026-11-02T10:20:00Z"; expect(closingHintVisible(state, Date.parse("2026-11-02T10:20:00Z"))).toBe(true);
  });

  it("positions the hint clear of lamps at both dense tiers", () => {
    expect(closingHintPosition(0, 1920, 1080, 950.4, "bottom").y).toBe(922.4);
    expect(closingHintPosition(1, 1920, 1080, 950.4, "bottom").y).toBeLessThan(870);
    expect(closingHintPosition(2, 1920, 1080, 129.6, "top").y).toBeGreaterThan(210);
  });
});
