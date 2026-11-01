import { describe, expect, it } from "vitest";
import { makeLedgerEntry, rebuildState } from "../src/ledger.js";
import { createReceipt, receiptHtml, verifyReceipt } from "../src/receipt.js";
import type { EventSubEnvelope, LedgerEntry } from "../src/types.js";

const envelope = (id: string, type: string, time: string, event: Record<string, unknown>): EventSubEnvelope => ({ metadata: { message_id: id, message_type: "notification", message_timestamp: time, subscription_type: type }, payload: { event } });

function fixture(): { entries: LedgerEntry[]; receipt: ReturnType<typeof createReceipt> } {
  const events = [
    envelope("online", "stream.online", "2026-11-01T10:00:00Z", { id: "stream-1", started_at: "2026-11-01T10:00:00Z" }),
    envelope("chat", "channel.chat.message", "2026-11-01T10:01:00Z", { chatter_user_id: "secret-user-id", chatter_user_login: "friend", chatter_user_name: "Friend", message: { text: "!lamp", fragments: [{ type: "text", text: "!lamp" }] } }),
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
    expect(html).toContain("drawLamp");
    expect(html).not.toContain("secret-user-id");
  });
});
