import { describe, expect, it } from "vitest";
import { makeLedgerEntry, rebuildState } from "../src/ledger.js";
import { createReceipt, receiptHtml, verifyReceipt } from "../src/receipt.js";
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
    expect(html).toContain("Friend");
    expect(html).toContain("drawLampDesign");
    expect(html).toContain("Public view · names only");
    expect(html).toContain("Declared versus verified presence");
    expect(html).toContain("Twitch reported 12 viewers at peak; 1 lit a lamp.");
    expect(html).toContain("Find your lamp");
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
});
