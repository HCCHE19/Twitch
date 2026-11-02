import { describe, expect, it } from "vitest";
import { makeLedgerEntry, rebuildState } from "../src/ledger.js";
import { emptyState, reduceEnvelope } from "../src/presence.js";
import { chooseSkyFragment, CONSTELLATIONS, createSkyFragmentEnvelope, FRAGMENTS } from "../src/sky.js";
import { createReceipt, receiptHtml } from "../src/receipt.js";
import type { EventSubEnvelope, LedgerEntry, SkyFragment } from "../src/types.js";

const event = (id: string, type: string, timestamp: string, payload: Record<string, unknown>): EventSubEnvelope => ({ metadata: { message_id: id, message_type: "internal", message_timestamp: timestamp, subscription_type: type }, payload: { event: payload } });
const fragment = (constellation: string, letter: string): SkyFragment => ({ streamId: `${constellation}-${letter}`, constellation, fragment: letter, earnedAt: "2026-11-02T00:00:00Z", litUserIds: [] });

describe("constellation sky", () => {
  it("is deterministic and never chooses an owned fragment", () => {
    const owned = [fragment("Leo", "A"), fragment("Leo", "B")];
    const first = chooseSkyFragment("stream-42", owned);
    expect(chooseSkyFragment("stream-42", owned)).toEqual(first);
    expect(owned.some((item) => item.constellation === first?.constellation && item.fragment === first.fragment)).toBe(false);
  });

  it("takes the in-progress path roughly 70 percent of the time", () => {
    const owned = [fragment("Leo", "A")]; let progress = 0;
    for (let index = 0; index < 5000; index++) if (chooseSkyFragment(`weight-${index}`, owned)?.constellation === "Leo") progress++;
    expect(progress / 5000).toBeGreaterThan(.67); expect(progress / 5000).toBeLessThan(.73);
  });

  it("awards once per stream, detects completion, and returns null after all 72", () => {
    const state = emptyState(); state.currentStream = { id: "one-night", startedAt: "2026-11-02T00:00:00Z", litUserIds: ["a", "b"] };
    const award = createSkyFragmentEnvelope(state, "2026-11-02T00:01:00Z"); expect(award).not.toBeNull();
    reduceEnvelope(state, award!, { broadcasterLogin: "owner" });
    expect(createSkyFragmentEnvelope(state, "2026-11-02T00:02:00Z")).toBeNull();
    const all = CONSTELLATIONS.flatMap((name) => FRAGMENTS.map((letter) => fragment(name, letter)));
    expect(chooseSkyFragment("complete", all)).toBeNull();
    expect(all.filter((item) => item.constellation === "Leo")).toHaveLength(6);
  });

  it("rebuilds sky state only from hash-chained ledger events", () => {
    const envelope = event("sky:s1", "lamplight.sky.fragment", "2026-11-02T00:02:00Z", { stream_id: "s1", constellation: "Leo", fragment: "C", lit_user_ids: ["private-a"] });
    const entry = makeLedgerEntry(envelope, "", envelope.metadata.message_timestamp);
    expect(rebuildState([entry], { broadcasterLogin: "owner" }).skyFragments).toEqual([{ streamId: "s1", constellation: "Leo", fragment: "C", earnedAt: "2026-11-02T00:02:00Z", litUserIds: ["private-a"] }]);
  });

  it("keeps ids out of the public receipt while naming the stars", () => {
    const events = [
      event("online", "stream.online", "2026-11-02T00:00:00Z", { id: "s1", started_at: "2026-11-02T00:00:00Z" }),
      event("chat", "channel.chat.message", "2026-11-02T00:01:00Z", { chatter_user_id: "private-a", chatter_user_login: "alice", chatter_user_name: "Alice", message: { text: "!lamp", fragments: [{ type: "text", text: "!lamp" }] } }),
      event("sky:s1", "lamplight.sky.fragment", "2026-11-02T00:02:00Z", { stream_id: "s1", constellation: "Leo", fragment: "C", lit_user_ids: ["private-a"] }),
      event("offline", "stream.offline", "2026-11-02T00:03:00Z", {})
    ];
    const entries: LedgerEntry[]=[]; for(const item of events)entries.push(makeLedgerEntry(item,entries.at(-1)?.hash??"",item.metadata.message_timestamp));
    const state=rebuildState(entries.slice(0,-1),{broadcasterLogin:"owner"});
    const receipt=createReceipt(state,entries,"2026-11-02T00:03:00Z","eventsub","2026-11-02T00:03:01Z",false,true);
    expect(receipt.sky?.tonight).toEqual({ constellation:"Leo",fragment:"C",stars:["Alice"] });
    const html=receiptHtml(receipt);expect(html).toContain("stars of this fragment: Alice");expect(html).not.toContain("private-a");
  });

  it("keeps the v0.3.0 receipt surface when SKY is off", () => {
    const state=emptyState();state.currentStream={id:"s",startedAt:"2026-11-02T00:00:00Z",litUserIds:[]};
    const start=event("online","stream.online","2026-11-02T00:00:00Z",{id:"s",started_at:"2026-11-02T00:00:00Z"});
    const entry=makeLedgerEntry(start,"",start.metadata.message_timestamp);
    const receipt=createReceipt(state,[entry],"2026-11-02T00:01:00Z","eventsub","2026-11-02T00:01:01Z",false,false);
    expect(receipt).not.toHaveProperty("sky");expect(receipt).not.toHaveProperty("nightSummary");
    const html=receiptHtml(receipt);expect(html).not.toContain('<canvas id="sky-map"');expect(html).not.toContain("/shared/sky.js");
  });
});
