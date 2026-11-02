import type { DerivedState, EventSubEnvelope } from "./types.js";
import { DEFAULT_IGNORED_USERS, type ReduceOptions } from "./presence.js";

export function applyPromiseCommand(state: DerivedState, envelope: EventSubEnvelope, options: ReduceOptions & { enabled: boolean }): EventSubEnvelope | null {
  return applyPromiseCommandDetailed(state, envelope, options)?.event ?? null;
}

export interface PromiseCommandResult { command: "!back" | "!closing"; applied: boolean; reason: string; event: EventSubEnvelope | null }

export function applyPromiseCommandDetailed(state: DerivedState, envelope: EventSubEnvelope, options: ReduceOptions & { enabled: boolean }): PromiseCommandResult | null {
  if (envelope.metadata.subscription_type !== "channel.chat.message") return null;
  const event = envelope.payload.event ?? {};
  const text = String((event.message as { text?: unknown } | undefined)?.text ?? "").trim().toLowerCase();
  if (text !== "!back" && text !== "!closing") return null;
  const command = text as "!back" | "!closing";
  if (!options.enabled) return { command, applied: false, reason: "promises are disabled", event: null };
  if (!state.currentStream) return { command, applied: false, reason: "no stream is live", event: null };
  const login = String(event.chatter_user_login ?? "").toLowerCase();
  const userId = String(event.chatter_user_id ?? "");
  if (command === "!closing") {
    if (login !== options.broadcasterLogin.toLowerCase()) return { command, applied: false, reason: "only the broadcaster can start closing", event: null };
    return { command, applied: true, reason: "closing hint enabled", event: internal(envelope, "lamplight.promise.closing", { stream_id: state.currentStream.id, source_message_id: envelope.metadata.message_id }) };
  }
  const ignored = new Set([options.broadcasterLogin, ...(options.ignoredUsers ?? DEFAULT_IGNORED_USERS)].map((value) => value.toLowerCase()));
  if (!userId) return { command, applied: false, reason: "sender id is missing", event: null };
  if (ignored.has(login)) return { command, applied: false, reason: "sender is the broadcaster or an ignored bot", event: null };
  if (!state.currentStream.litUserIds.includes(userId)) return { command, applied: false, reason: "sender's lamp is not lit tonight", event: null };
  if (state.promises.some((promise) => promise.streamId === state.currentStream?.id && promise.userId === userId)) return { command, applied: false, reason: "sender already promised this stream", event: null };
  return { command, applied: true, reason: "promise recorded", event: internal(envelope, "lamplight.promise.made", { stream_id: state.currentStream.id, user_id: userId, source_message_id: envelope.metadata.message_id }) };
}

function internal(source: EventSubEnvelope, type: string, event: Record<string, unknown>): EventSubEnvelope {
  return { metadata: { message_id: `${type}:${source.metadata.message_id}`, message_type: "internal", message_timestamp: source.metadata.message_timestamp, subscription_type: type }, payload: { event } };
}

export function weightedLampCount(state: DerivedState): number {
  return (state.currentStream?.litUserIds.length ?? 0) + state.promiseKeptUserIds.length;
}
