import type { DerivedState, EventSubEnvelope } from "./types.js";

export const DEFAULT_IGNORED_USERS = ["nightbot", "streamelements", "streamlabs", "fossabot", "moobot", "sery_bot"];

export function emptyState(demoReplay = false): DerivedState {
  return {
    schemaVersion: 1,
    lastHash: "",
    processedMessageIds: [],
    currentStream: null,
    closingMoment: null,
    openingCard: null,
    flareAtByUserId: {},
    threadReunionAtByUserId: {},
    threads: [],
    pendingThreads: [],
    threadOutgoingUserIds: [],
    skyFragments: [],
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
    const previousStreamId = state.completedStreamIds.at(-1);
    state.openingCard = previousStreamId ? {
      startedAt: envelope.metadata.message_timestamp,
      previousStreamId,
      previousUserIds: Object.values(state.lamps).filter((lamp) => lamp.attendedStreamIds.includes(previousStreamId)).map((lamp) => lamp.userId)
    } : null;
    for (const lamp of Object.values(state.lamps)) lamp.streamsSinceLit += 1;
    const id = String(event.id ?? `recovered-${envelope.metadata.message_timestamp}`);
    state.closingMoment = null;
    state.flareAtByUserId = {};
    state.threadReunionAtByUserId = {};
    state.pendingThreads = [];
    state.threadOutgoingUserIds = [];
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
    state.pendingThreads = [];
    state.threadOutgoingUserIds = [];
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
  if (type === "lamplight.sky.fragment") {
    const streamId = String(event.stream_id ?? "");
    const constellation = String(event.constellation ?? "");
    const fragment = String(event.fragment ?? "");
    const litUserIds = Array.isArray(event.lit_user_ids) ? event.lit_user_ids.filter((value): value is string => typeof value === "string") : [];
    if (!streamId || !constellation || !fragment || state.skyFragments.some((item) => item.streamId === streamId || (item.constellation === constellation && item.fragment === fragment))) return state;
    state.skyFragments.push({ streamId, constellation, fragment, earnedAt: envelope.metadata.message_timestamp, litUserIds });
    return state;
  }
  if (type === "lamplight.thread.tied") {
    const userIds = [String(event.user_id_a ?? ""), String(event.user_id_b ?? "")].sort() as [string, string];
    const streamId = String(event.stream_id ?? "");
    if (!userIds[0] || !userIds[1] || userIds[0] === userIds[1] || !streamId) return state;
    if (state.threads.some((thread) => thread.userIds[0] === userIds[0] && thread.userIds[1] === userIds[1])) return state;
    if (userIds.some((userId) => state.threads.filter((thread) => thread.userIds.includes(userId)).length >= 3)) return state;
    state.threads.push({ userIds, createdAt: envelope.metadata.message_timestamp, createdStreamId: streamId });
    state.pendingThreads = state.pendingThreads.filter((pending) => !(userIds.includes(pending.fromUserId) && userIds.includes(pending.toUserId)));
    if (state.currentStream?.id === streamId) for (const userId of userIds) if (!state.threadOutgoingUserIds.includes(userId)) state.threadOutgoingUserIds.push(userId);
    return state;
  }
  if (type === "lamplight.thread.untied") {
    const userIds = [String(event.user_id_a ?? ""), String(event.user_id_b ?? "")].sort();
    state.threads = state.threads.filter((thread) => !(thread.userIds[0] === userIds[0] && thread.userIds[1] === userIds[1]));
    state.pendingThreads = state.pendingThreads.filter((pending) => !(userIds.includes(pending.fromUserId) && userIds.includes(pending.toUserId)));
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
