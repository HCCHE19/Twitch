import type { DerivedState, EventSubEnvelope } from "./types.js";
import { DEFAULT_IGNORED_USERS, type ReduceOptions } from "./presence.js";

export function applyPromiseCommand(state: DerivedState, envelope: EventSubEnvelope, options: ReduceOptions & { enabled: boolean }): EventSubEnvelope | null {
  if (!options.enabled || envelope.metadata.subscription_type !== "channel.chat.message" || !state.currentStream) return null;
  const event = envelope.payload.event ?? {};
  const text = String((event.message as { text?: unknown } | undefined)?.text ?? "").trim().toLowerCase();
  const login = String(event.chatter_user_login ?? "").toLowerCase();
  const userId = String(event.chatter_user_id ?? "");
  if (login === options.broadcasterLogin.toLowerCase() && text === "!closing") {
    return internal(envelope, "lamplight.promise.closing", { stream_id: state.currentStream.id, source_message_id: envelope.metadata.message_id });
  }
  const ignored = new Set([options.broadcasterLogin, ...(options.ignoredUsers ?? DEFAULT_IGNORED_USERS)].map((value) => value.toLowerCase()));
  if (text !== "!back" || !userId || ignored.has(login) || !state.currentStream.litUserIds.includes(userId)) return null;
  if (state.promises.some((promise) => promise.streamId === state.currentStream?.id && promise.userId === userId)) return null;
  return internal(envelope, "lamplight.promise.made", { stream_id: state.currentStream.id, user_id: userId, source_message_id: envelope.metadata.message_id });
}

function internal(source: EventSubEnvelope, type: string, event: Record<string, unknown>): EventSubEnvelope {
  return { metadata: { message_id: `${type}:${source.metadata.message_id}`, message_type: "internal", message_timestamp: source.metadata.message_timestamp, subscription_type: type }, payload: { event } };
}

export function weightedLampCount(state: DerivedState): number {
  return (state.currentStream?.litUserIds.length ?? 0) + state.promiseKeptUserIds.length;
}
