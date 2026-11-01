import type { DerivedState, EventSubEnvelope } from "./types.js";

export const DEFAULT_IGNORED_USERS = ["nightbot", "streamelements", "streamlabs", "fossabot", "moobot", "sery_bot"];

export function emptyState(demoReplay = false): DerivedState {
  return {
    schemaVersion: 1,
    lastHash: "",
    processedMessageIds: [],
    currentStream: null,
    completedStreamIds: [],
    lamps: {},
    demoReplay
  };
}

export function isPresenceMessage(event: Record<string, unknown>): boolean {
  const message = event.message as { text?: unknown; fragments?: unknown } | undefined;
  const text = typeof message?.text === "string" ? message.text.trim().toLowerCase() : "";
  if (text === "!lamp" || text === "!lurk") return true;
  if (!Array.isArray(message?.fragments) || message.fragments.length !== 1) return false;
  const fragment = message.fragments[0] as { type?: unknown; text?: unknown };
  return fragment.type === "emote" && typeof fragment.text === "string" && fragment.text.trim().length > 0;
}

export interface ReduceOptions {
  broadcasterLogin: string;
  ignoredUsers?: string[];
}

export function reduceEnvelope(state: DerivedState, envelope: EventSubEnvelope, options: ReduceOptions): DerivedState {
  if (state.processedMessageIds.includes(envelope.metadata.message_id)) return state;
  state.processedMessageIds.push(envelope.metadata.message_id);
  const type = envelope.metadata.subscription_type;
  const event = envelope.payload.event ?? {};

  if (type === "stream.online" || type === "lamplight.stream.recovered") {
    for (const lamp of Object.values(state.lamps)) lamp.streamsSinceLit += 1;
    const id = String(event.id ?? `recovered-${envelope.metadata.message_timestamp}`);
    state.currentStream = { id, startedAt: String(event.started_at ?? envelope.metadata.message_timestamp), litUserIds: [] };
    return state;
  }
  if (type === "stream.offline") {
    if (!state.currentStream) return state;
    const lit = new Set(state.currentStream.litUserIds);
    for (const lamp of Object.values(state.lamps)) {
      if (lit.has(lamp.userId)) lamp.streamsSinceLit = 0;
      else { lamp.streamsSinceLit += 1; lamp.streak = 0; }
    }
    state.completedStreamIds.push(state.currentStream.id);
    state.currentStream = null;
    return state;
  }
  if (type !== "channel.chat.message" || !state.currentStream || !isPresenceMessage(event)) return state;

  const login = String(event.chatter_user_login ?? "").toLowerCase();
  const ignored = new Set([options.broadcasterLogin.toLowerCase(), ...(options.ignoredUsers ?? DEFAULT_IGNORED_USERS)].map((item) => item.toLowerCase()));
  if (!login || ignored.has(login)) return state;
  const userId = String(event.chatter_user_id ?? "");
  if (!userId || state.currentStream.litUserIds.includes(userId)) return state;
  const timestamp = envelope.metadata.message_timestamp;
  const previous = state.lamps[userId];
  state.lamps[userId] = {
    userId,
    login,
    displayName: String(event.chatter_user_name ?? login),
    firstSeenAt: previous?.firstSeenAt ?? timestamp,
    lastLitAt: timestamp,
    lastStreamId: state.currentStream.id,
    streamsSinceLit: 0,
    attendedStreamIds: [...(previous?.attendedStreamIds ?? []), state.currentStream.id],
    streak: (previous?.streak ?? 0) + 1,
    lifetimeLights: (previous?.lifetimeLights ?? 0) + 1
  };
  state.currentStream.litUserIds.push(userId);
  return state;
}

export function historicalOpacity(streamsSinceLit: number): number {
  if (streamsSinceLit <= 0) return 1;
  if (streamsSinceLit === 1) return 0.45;
  if (streamsSinceLit === 2) return 0.30;
  return 0.18;
}

export function lampScale(lifetimeLights: number): number {
  return Math.min(1.32, 1 + Math.max(0, lifetimeLights - 1) * 0.025);
}
