import { describe, expect, it } from "vitest";
import { nightDemo } from "../src/demo-events.js";
import { createFlareEnvelope, emptyState, reduceEnvelope } from "../src/presence.js";
import { applyPromiseCommand } from "../src/promises.js";
import { applyThreadCommand, applyThreadReunion } from "../src/threads.js";

describe("full-night demo", () => {
  it("contains the requested stacked, rebuildable feature state", () => {
    const events = nightDemo(), state = emptyState(true), options = { broadcasterLogin: "demo_broadcaster" };
    for (const event of events) {
      const flare = createFlareEnvelope(state, event, options), before = new Set(state.currentStream?.litUserIds ?? []);
      reduceEnvelope(state, event, options);
      if (event.metadata.subscription_type === "channel.chat.message" && state.currentStream) {
        const newlyLit = state.currentStream.litUserIds.find((userId) => !before.has(userId)); if (newlyLit) applyThreadReunion(state, newlyLit, event.metadata.message_timestamp);
        const promise = applyPromiseCommand(state, event, { ...options, enabled: true }); if (promise) reduceEnvelope(state, promise, options);
        for (const thread of applyThreadCommand(state, event, { ...options, enabled: true })) reduceEnvelope(state, thread, options);
      }
      if (flare) reduceEnvelope(state, flare, options);
    }
    const currentOnline = events.find((event) => event.metadata.subscription_type === "stream.online" && String(event.payload.event?.id) === "night-main")!;
    const currentStart = Date.parse(currentOnline.metadata.message_timestamp);
    const currentChat = events.filter((event) => event.metadata.subscription_type === "channel.chat.message" && Date.parse(event.metadata.message_timestamp) > currentStart);
    const uniqueLights = new Set(currentChat.filter((event) => ["!lamp", "!lurk", "✨", "🌙", "🔥", "🌿", "💫", "🌸", "🕯️", "LUL", "Kappa"].includes(String((event.payload.event?.message as { text?: unknown })?.text))).map((event) => String(event.payload.event?.chatter_user_id)));
    expect(uniqueLights.size).toBe(28);
    expect(events.filter((event) => String((event.payload.event?.message as { text?: unknown } | undefined)?.text ?? "").startsWith("!tie"))).toHaveLength(7);
    expect(state.skyFragments.map((fragment) => fragment.fragment)).toEqual(["A", "B", "C", "D", "E", "F"]);
    expect(Math.max(...state.threads.map((thread) => thread.bestStreak))).toBeGreaterThanOrEqual(4);
    expect(state.closingMoment).toMatchObject({ totalLamps: 28, promisedLamps: 6 });
    expect(Object.keys(state.flareAtByUserId).length).toBeGreaterThanOrEqual(5);
    const central = state.threads.filter((thread) => thread.userIds.includes("night-kira")); expect(central).toHaveLength(3);
  });
});
