import type { DerivedState, EventSubEnvelope } from "./types.js";

import { resolveThreshold } from "./sky-threshold.js";

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
    promises: [],
    promiseAtByUserId: {},
    promiseKeptUserIds: [],
    promiseKeptAtByUserId: {},
    closingHintAt: null,
    completedStreamDurationsMs: [],
    completedStreamIds: [],
    lamps: {},
    demoReplay
  };
}

export function isPresenceMessage(event: Record<string, unknown>): boolean {
  const message = event.message as { text?: unknown; fragments?: unknown; lamplight_presence?: unknown } | undefined;
  if (message?.lamplight_presence === true) return true;
  const text = typeof message?.text === "string" ? message.text.trim().toLowerCase() : "";
  if (text === "!lamp" || text === "!lurk") return true;
  return isSingleEmoteMessage(event) || isSingleUnicodeEmojiMessage(event);
}

const EMOJI_GRAPHEME = /^(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:\uFE0E|\uFE0F)?(?:\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0E|\uFE0F)?(?:\p{Emoji_Modifier})?)*)$/u;

export function isSingleUnicodeEmojiMessage(event: Record<string, unknown>): boolean {
  const message = event.message as { text?: unknown } | undefined;
  if (typeof message?.text !== "string") return false;
  const text = message.text.trim();
  if (!text) return false;
  const graphemes = [...new Intl.Segmenter("en", { granularity: "grapheme" }).segment(text)];
  return graphemes.length === 1 && EMOJI_GRAPHEME.test(graphemes[0]!.segment);
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
    if (state.currentStream && state.currentStream.id === event.id) return state;
    const previousStreamId = state.completedStreamIds.at(-1);
    const previousPromiseUserIds = previousStreamId ? state.promises.filter((promise) => promise.streamId === previousStreamId).map((promise) => promise.userId) : [];
    state.openingCard = previousStreamId ? {
      startedAt: envelope.metadata.message_timestamp,
      previousStreamId,
      previousUserIds: Object.values(state.lamps).filter((lamp) => lamp.attendedStreamIds.includes(previousStreamId)).map((lamp) => lamp.userId),
      previousPromiseUserIds
    } : null;
    for (const lamp of Object.values(state.lamps)) lamp.streamsSinceLit += 1;
    const id = String(event.id ?? `recovered-${envelope.metadata.message_timestamp}`);
    state.closingMoment = null;
    state.flareAtByUserId = {};
    state.threadReunionAtByUserId = {};
    state.pendingThreads = [];
    state.threadOutgoingUserIds = [];
    state.promiseAtByUserId = {};
    state.promiseKeptUserIds = [];
    state.promiseKeptAtByUserId = {};
    state.closingHintAt = null;
    state.currentStream = { id, startedAt: String(event.started_at ?? envelope.metadata.message_timestamp), litUserIds: [], thresholdN: resolveThreshold(state, "auto") };
    return state;
  }
  if (type === "lamplight.sky.threshold") {
    if (state.currentStream && state.currentStream.id === event.stream_id && state.currentStream.thresholdMode === undefined && Number.isInteger(event.threshold) && Number(event.threshold) > 0) {
      state.currentStream.thresholdN = Number(event.threshold);
      state.currentStream.returnCardDelayMinutes = Number(event.return_card_delay_minutes) >= 1 ? Number(event.return_card_delay_minutes) : 10;
      state.currentStream.thresholdMode = event.mode === "auto" ? "auto" : "manual";
    }
    return state;
  }
  if (type === "stream.offline" || type === "lamplight.stream.finalized") {
    if (!state.currentStream) return state;
    const lit = new Set(state.currentStream.litUserIds);
    state.closingMoment = {
      startedAt: envelope.metadata.message_timestamp,
      litUserIds: [...state.currentStream.litUserIds],
      totalLamps: state.currentStream.litUserIds.length,
      returningLamps: state.currentStream.litUserIds.filter((userId) => (state.lamps[userId]?.attendedStreamIds.length ?? 0) > 1).length,
      promisedLamps: state.promises.filter((promise) => promise.streamId === state.currentStream?.id).length
    };
    state.pendingThreads = [];
    state.threadOutgoingUserIds = [];
    for (const thread of state.threads) {
      const together = thread.userIds.every((userId) => lit.has(userId));
      if (together && thread.lastCountedStreamId !== state.currentStream.id) {
        thread.streamsTogether = (thread.streamsTogether ?? 0) + 1;
        thread.currentStreak = (thread.currentStreak ?? 0) + 1;
        thread.bestStreak = Math.max(thread.bestStreak ?? 0, thread.currentStreak);
        thread.lastCountedStreamId = state.currentStream.id;
      } else if (!together) thread.currentStreak = 0;
    }
    for (const lamp of Object.values(state.lamps)) {
      if (lit.has(lamp.userId)) lamp.streamsSinceLit = 0;
      else { lamp.streamsSinceLit += 1; lamp.streak = 0; }
    }
    const duration = Date.parse(envelope.metadata.message_timestamp) - Date.parse(state.currentStream.startedAt);
    if (Number.isFinite(duration) && duration >= 0) state.completedStreamDurationsMs.push(duration);
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
  if (type === "lamplight.promise.made") {
    const streamId = String(event.stream_id ?? ""), userId = String(event.user_id ?? "");
    if (!streamId || !userId || state.promises.some((promise) => promise.streamId === streamId && promise.userId === userId)) return state;
    state.promises.push({ streamId, userId, madeAt: envelope.metadata.message_timestamp });
    if (state.currentStream?.id === streamId) state.promiseAtByUserId[userId] = envelope.metadata.message_timestamp;
    return state;
  }
  if (type === "lamplight.promise.closing") {
    if (state.currentStream?.id === String(event.stream_id ?? "")) state.closingHintAt = envelope.metadata.message_timestamp;
    return state;
  }
  if (type === "lamplight.thread.tied") {
    const userIds = [String(event.user_id_a ?? ""), String(event.user_id_b ?? "")].sort() as [string, string];
    const streamId = String(event.stream_id ?? "");
    if (!userIds[0] || !userIds[1] || userIds[0] === userIds[1] || !streamId) return state;
    if (state.threads.some((thread) => thread.userIds[0] === userIds[0] && thread.userIds[1] === userIds[1])) return state;
    if (userIds.some((userId) => state.threads.filter((thread) => thread.userIds.includes(userId)).length >= 3)) return state;
    state.threads.push({ userIds, createdAt: envelope.metadata.message_timestamp, createdStreamId: streamId, streamsTogether: 0, currentStreak: 0, bestStreak: 0, lastCountedStreamId: null });
    state.pendingThreads = state.pendingThreads.filter((pending) => !(userIds.includes(pending.fromUserId) && userIds.includes(pending.toUserId)));
    if (state.currentStream?.id === streamId) {
      const initiator = String(event.initiator_user_id ?? "");
      const outgoingIds = initiator && userIds.includes(initiator) ? [initiator] : userIds;
      for (const userId of outgoingIds) if (!state.threadOutgoingUserIds.includes(userId)) state.threadOutgoingUserIds.push(userId);
    }
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
  const keptPromise = state.openingCard?.previousPromiseUserIds.includes(userId) === true;
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
    lifetimeLights: (previous?.lifetimeLights ?? 0) + 1,
    lifetimePromisesKept: (previous?.lifetimePromisesKept ?? 0) + (keptPromise ? 1 : 0)
  };
  state.currentStream.litUserIds.push(userId);
  if (keptPromise) {
    state.promiseKeptUserIds.push(userId);
    state.promiseKeptAtByUserId[userId] = timestamp;
  }
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
