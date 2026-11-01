import type { DerivedState, EventSubEnvelope } from "./types.js";

export const DEFAULT_IGNORED_USERS = ["nightbot", "streamelements", "streamlabs", "fossabot", "moobot", "sery_bot"];

export function emptyState(demoReplay = false): DerivedState {
  return {
    schemaVersion: 1,
    lastHash: "",
    processedMessageIds: [],
    currentStream: null,
    closingMoment: null,
    flareAtByUserId: {},
    completedStreamIds: [],
    lamps: {},
    demoReplay
  };
}

export function isPresenceMessage(event: Record<string, unknown>): boolean {
  const message = event.message as { text?: unknown; fragments?: unknown } | undefined;
  const text = typeof message?.text === "string" ? message.text.trim().toLowerCase() : "";
  if (text === "!lamp" || text === "!lurk") return true;
  return isSingleEmoteMessage(event);
}

export function isSingleEmoteMessage(event: Record<string, unknown>): boolean {
  const message = event.message as { fragments?: unknown } | undefined;
  if (!Array.isArray(message?.fragments) || message.fragments.length !== 1) return false;
  const fragment = message.fragments[0] as { type?: unknown; text?: unknown };
  return fragment.type === "emote" && typeof fragment.text === "string" && fragment.text.trim().length > 0;
}

export interface ReduceOptions {
  broadcasterLogin: string;
  ignoredUsers?: string[];
}

function ignoredLogin(login: string, options: ReduceOptions): boolean {
  const ignored = new Set([options.broadcasterLogin.toLowerCase(), ...(options.ignoredUsers ?? DEFAULT_IGNORED_USERS)].map((item) => item.toLowerCase()));
  return !login || ignored.has(login);
}

export function createFlareEnvelope(state: DerivedState, envelope: EventSubEnvelope, options: ReduceOptions): EventSubEnvelope | null {
  if (envelope.metadata.subscription_type !== "channel.chat.message" || !state.currentStream) return null;
  const event = envelope.payload.event ?? {};
  if (!isSingleEmoteMessage(event)) return null;
  const login = String(event.chatter_user_login ?? "").toLowerCase();
  const userId = String(event.chatter_user_id ?? "");
  if (!userId || ignoredLogin(login, options) || !state.currentStream.litUserIds.includes(userId)) return null;
  const timestamp = envelope.metadata.message_timestamp;
  const lastFlareAt = state.flareAtByUserId[userId];
  if (lastFlareAt && Date.parse(timestamp) - Date.parse(lastFlareAt) < 10_000) return null;
  return {
    metadata: {
      message_id: `flare:${envelope.metadata.message_id}`,
      message_type: "internal",
      message_timestamp: timestamp,
      subscription_type: "lamplight.flare"
    },
    payload: { event: { stream_id: state.currentStream.id, user_id: userId, source_message_id: envelope.metadata.message_id } }
  };
}

export function reduceEnvelope(state: DerivedState, envelope: EventSubEnvelope, options: ReduceOptions): DerivedState {
  if (state.processedMessageIds.includes(envelope.metadata.message_id)) return state;
  state.processedMessageIds.push(envelope.metadata.message_id);
  const type = envelope.metadata.subscription_type;
  const event = envelope.payload.event ?? {};

  if (type === "stream.online" || type === "lamplight.stream.recovered") {
    for (const lamp of Object.values(state.lamps)) lamp.streamsSinceLit += 1;
    const id = String(event.id ?? `recovered-${envelope.metadata.message_timestamp}`);
    state.closingMoment = null;
    state.flareAtByUserId = {};
    state.currentStream = { id, startedAt: String(event.started_at ?? envelope.metadata.message_timestamp), litUserIds: [] };
    return state;
  }
  if (type === "stream.offline" || type === "lamplight.stream.finalized") {
    if (!state.currentStream) return state;
    const lit = new Set(state.currentStream.litUserIds);
    state.closingMoment = {
      startedAt: envelope.metadata.message_timestamp,
      litUserIds: [...state.currentStream.litUserIds],
      totalLamps: state.currentStream.litUserIds.length,
      returningLamps: state.currentStream.litUserIds.filter((userId) => (state.lamps[userId]?.attendedStreamIds.length ?? 0) > 1).length
    };
    for (const lamp of Object.values(state.lamps)) {
      if (lit.has(lamp.userId)) lamp.streamsSinceLit = 0;
      else { lamp.streamsSinceLit += 1; lamp.streak = 0; }
    }
    state.completedStreamIds.push(state.currentStream.id);
    state.currentStream = null;
    return state;
  }
  if (type === "lamplight.flare") {
    const userId = String(event.user_id ?? "");
    if (userId && state.currentStream?.id === String(event.stream_id ?? "")) state.flareAtByUserId[userId] = envelope.metadata.message_timestamp;
    return state;
  }
  if (type !== "channel.chat.message" || !state.currentStream || !isPresenceMessage(event)) return state;

  const login = String(event.chatter_user_login ?? "").toLowerCase();
  if (ignoredLogin(login, options)) return state;
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
  return 0.20;
}

export function lampScale(lifetimeLights: number): number {
  return Math.min(1.32, 1 + Math.max(0, lifetimeLights - 1) * 0.025);
}
