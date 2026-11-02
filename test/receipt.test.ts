import { describe, expect, it } from "vitest";
import { makeLedgerEntry, rebuildState } from "../src/ledger.js";
import { createReceipt, receiptHtml, sharedCompany, verifyReceipt } from "../src/receipt.js";
import type { EventSubEnvelope, LedgerEntry } from "../src/types.js";

const envelope = (id: string, type: string, time: string, event: Record<string, unknown>): EventSubEnvelope => ({ metadata: { message_id: id, message_type: "notification", message_timestamp: time, subscription_type: type }, payload: { event } });

function fixture(): { entries: LedgerEntry[]; receipt: ReturnType<typeof createReceipt> } {
  const events = [
    envelope("online", "stream.online", "2026-11-01T10:00:00Z", { id: "stream-1", started_at: "2026-11-01T10:00:00Z" }),
    envelope("chat", "channel.chat.message", "2026-11-01T10:01:00Z", { chatter_user_id: "secret-user-id", chatter_user_login: "friend", chatter_user_name: "Friend", message: { text: "!lamp", fragments: [{ type: "text", text: "!lamp" }] } }),
    envelope("sample-1", "lamplight.viewer.sample", "2026-11-01T10:02:00Z", { stream_id: "stream-1", viewer_count: 12, lit_lamps: 1 }),
    envelope("sample-2", "lamplight.viewer.sample", "2026-11-01T10:03:00Z", { stream_id: "stream-1", viewer_count: 9, lit_lamps: 1 }),
    envelope("offline", "stream.offline", "2026-11-01T10:05:00Z", { broadcaster_user_id: "broadcaster" })
  ];
  const entries: LedgerEntry[] = [];
  for (const event of events) entries.push(makeLedgerEntry(event, entries.at(-1)?.hash ?? "", event.metadata.message_timestamp));
  const state = rebuildState(entries.slice(0, 2), { broadcasterLogin: "owner" });
  return { entries, receipt: createReceipt(state, entries, events[2]!.metadata.message_timestamp, "eventsub", "2026-11-01T10:05:01Z") };
}

describe("presence receipts", () => {
  it("seals and verifies against the ledger", () => {
    const { entries, receipt } = fixture();
    expect(receipt.presence[0]?.streak).toBe(1);
    expect(receipt.attendance).toMatchObject({ peakTwitchViewers: 12, peakLitLamps: 1, summary: "Twitch reported 12 viewers at peak; 1 lit a lamp." });
    expect(receipt.attendance.samples).toHaveLength(2);
    expect(receipt.presence[0]?.recentAttendance).toEqual([false, false, false, false, false, false, false, false, false, true]);
    expect(() => verifyReceipt(receipt, entries)).not.toThrow();
  });

  it("detects receipt tampering", () => {
    const { entries, receipt } = fixture();
    receipt.presence[0]!.displayName = "Changed";
    expect(() => verifyReceipt(receipt, entries)).toThrow("Receipt hash mismatch");
  });

  it("keeps user ids out of public HTML and draws a lamp for each name", () => {
    const { receipt } = fixture();
    const html = receiptHtml(receipt);
    expect(html).toContain('<a class="back-to-controls" href="/control">Back to controls</a>');
    expect(html).toContain("Friend");
    expect(html).toContain("drawLampDesign");
    expect(html).toContain("Local streamer record");
    expect(html).toContain("Declared versus verified presence");
    expect(html).toContain("Twitch reported 12 viewers at peak; 1 lit a lamp.");
    expect(html).toContain("Find an attendee");
    expect((html.match(/class=\"dot(?: filled)?\"/g) ?? []).length).toBe(10);
    expect(html).not.toContain("secret-user-id");
    expect(html).not.toContain(receipt.receiptHash);
    expect(html).not.toContain(receipt.receiptHash.slice(0, 16));
  });

  it("keeps pre-sampling receipts viewable", () => {
    const { receipt } = fixture();
    const legacy = { ...receipt } as Partial<typeof receipt>;
    delete legacy.attendance;
    expect(receiptHtml(legacy as typeof receipt)).toContain("No viewer-count samples were available for this stream.");
  });

  it("lists up to three display names with the most shared streams", () => {
    const lamp = (userId: string, displayName: string, attendedStreamIds: string[]) => ({ userId, displayName, attendedStreamIds });
    const lamps = {
      me: lamp("me", "Me", ["s1", "s2", "s3"]),
      a: lamp("a", "Avery", ["s1", "s2", "s3"]),
      b: lamp("b", "Bao", ["s2", "s3"]),
      c: lamp("c", "Chika", ["s1"]),
      d: lamp("d", "Dara", ["other"])
    } as unknown as Parameters<typeof sharedCompany>[1];
    expect(sharedCompany("me", lamps)).toEqual(["Avery", "Bao", "Chika"]);
  });

  it("keeps the v0.2.0 receipt shape when threads are disabled", () => {
    const { receipt } = fixture();
    expect(receipt).not.toHaveProperty("threadsTonight");
    expect(receipt).not.toHaveProperty("nightSummary");
    expect(receiptHtml(receipt)).not.toContain("Threads tonight");
  });

  it("lists mutual pairs and generates all four rule-based night-summary lines when enabled", () => {
    const events = [
      envelope("online", "stream.online", "2026-11-01T10:00:00Z", { id: "stream-threads", started_at: "2026-11-01T10:00:00Z" }),
      envelope("alice", "channel.chat.message", "2026-11-01T10:01:00Z", { chatter_user_id: "a", chatter_user_login: "alice", chatter_user_name: "Alice", message: { text: "!lamp", fragments: [{ type: "text", text: "!lamp" }] } }),
      envelope("bob", "channel.chat.message", "2026-11-01T10:02:00Z", { chatter_user_id: "b", chatter_user_login: "bob", chatter_user_name: "Bob", message: { text: "!lamp", fragments: [{ type: "text", text: "!lamp" }] } }),
      envelope("thread", "lamplight.thread.tied", "2026-11-01T10:03:00Z", { stream_id: "stream-threads", user_id_a: "a", user_id_b: "b" }),
      envelope("offline", "stream.offline", "2026-11-01T10:05:00Z", {})
    ];
    const entries: LedgerEntry[] = [];
    for (const event of events) entries.push(makeLedgerEntry(event, entries.at(-1)?.hash ?? "", event.metadata.message_timestamp));
    const state = rebuildState(entries.slice(0, -1), { broadcasterLogin: "owner" });
    const receipt = createReceipt(state, entries, events.at(-1)!.metadata.message_timestamp, "eventsub", "2026-11-01T10:05:01Z", true);
    expect(receipt.threadsTonight).toEqual([["Alice", "Bob"]]);
    expect(receipt.threadDetails).toEqual([{ names: ["Alice", "Bob"], streamsTogether: 1, currentStreak: 1, bestStreak: 1 }]);
    expect(receipt.nightSummary).toEqual({ firstLitAt: "2026-11-01T10:01:00Z", lastLitAt: "2026-11-01T10:02:00Z", firstArrival: "Alice", longestStreakName: "Alice", longestStreak: 1, threadsTied: 1 });
    const html = receiptHtml(receipt);
    for (const line of ["Threads tonight", "Alice — Bob: 1 streams together · current 1 · best 1", "Lamps were lit", "First to arrive: Alice.", "Longest streak tonight: Alice (1).", "Threads tied tonight: 1."]) expect(html).toContain(line);
    expect(html).not.toContain("user_id_a");
    expect(() => verifyReceipt(receipt, entries)).not.toThrow();
  });
});
