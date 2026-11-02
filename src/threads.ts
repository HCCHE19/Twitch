import type { DerivedState, EventSubEnvelope, ThreadState } from "./types.js";

export interface ThreadCommandOptions { enabled: boolean; broadcasterLogin: string; ignoredUsers?: string[] }

function chatText(envelope: EventSubEnvelope): string {
  const message = envelope.payload.event?.message as { text?: unknown } | undefined;
  return typeof message?.text === "string" ? message.text.trim() : "";
}

function isModerator(event: Record<string, unknown>): boolean {
  const badges = Array.isArray(event.badges) ? event.badges as Array<{ set_id?: unknown }> : [];
  return badges.some((badge) => badge.set_id === "moderator" || badge.set_id === "broadcaster");
}

function resolveName(query: string, userIds: string[], state: DerivedState): string | null {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return null;
  const candidates = userIds.flatMap((userId) => state.lamps[userId] ? [{ userId, name: state.lamps[userId].displayName.toLocaleLowerCase() }] : []);
  const exact = candidates.filter((candidate) => candidate.name === normalized);
  if (exact.length === 1) return exact[0]!.userId;
  const prefix = candidates.filter((candidate) => candidate.name.startsWith(normalized));
  return prefix.length === 1 ? prefix[0]!.userId : null;
}

function pairMatches(thread: ThreadState, a: string, b: string): boolean {
  return thread.userIds.includes(a) && thread.userIds.includes(b);
}

function internalEnvelope(type: "tied" | "untied", source: EventSubEnvelope, streamId: string, a: string, b: string, extra: Record<string, unknown> = {}): EventSubEnvelope {
  const userIds = [a, b].sort();
  return {
    metadata: {
      message_id: `thread-${type}:${source.metadata.message_id}`,
      message_type: "internal",
      message_timestamp: source.metadata.message_timestamp,
      subscription_type: `lamplight.thread.${type}`
    },
    payload: { event: { stream_id: streamId, user_id_a: userIds[0], user_id_b: userIds[1], source_message_id: source.metadata.message_id, ...extra } }
  };
}

export function applyThreadCommand(state: DerivedState, envelope: EventSubEnvelope, options: ThreadCommandOptions): EventSubEnvelope[] {
  if (!options.enabled || envelope.metadata.subscription_type !== "channel.chat.message" || !state.currentStream) return [];
  const text = chatText(envelope);
  const tieMatch = /^!tie\s+(.+)$/iu.exec(text);
  const untieMatch = /^!untie(?:\s+(.+))?$/iu.exec(text);
  if (!tieMatch && !untieMatch) return [];
  const event = envelope.payload.event ?? {};
  const actorId = String(event.chatter_user_id ?? "");
  const actorLogin = String(event.chatter_user_login ?? "").toLowerCase();
  const ignored = new Set([options.broadcasterLogin, ...(options.ignoredUsers ?? [])].map((value) => value.toLowerCase()));
  const moderator = isModerator(event);

  if (tieMatch) {
    if (!actorId || ignored.has(actorLogin) || !state.currentStream.litUserIds.includes(actorId) || state.threadOutgoingUserIds.includes(actorId)) return [];
    const targetId = resolveName(tieMatch[1]!, state.currentStream.litUserIds, state);
    if (!targetId || targetId === actorId || state.threads.some((thread) => pairMatches(thread, actorId, targetId))) return [];
    const reciprocal = state.pendingThreads.find((pending) => pending.fromUserId === targetId && pending.toUserId === actorId);
    if (reciprocal) {
      if ([actorId, targetId].some((userId) => state.threads.filter((thread) => thread.userIds.includes(userId)).length >= 3)) return [];
      return [internalEnvelope("tied", envelope, state.currentStream.id, actorId, targetId)];
    }
    state.pendingThreads.push({ fromUserId: actorId, toUserId: targetId, createdAt: envelope.metadata.message_timestamp });
    state.threadOutgoingUserIds.push(actorId);
    return [];
  }

  let pair: [string, string] | null = null;
  const argument = untieMatch?.[1]?.trim() ?? "";
  if (moderator) {
    if (argument.includes("|")) {
      const [left, right] = argument.split("|", 2);
      const a = resolveName(left ?? "", Object.keys(state.lamps), state); const b = resolveName(right ?? "", Object.keys(state.lamps), state);
      if (a && b && a !== b && state.threads.some((thread) => pairMatches(thread, a, b))) pair = [a, b];
    } else if (argument) {
      const target = resolveName(argument, Object.keys(state.lamps), state);
      const matches = target ? state.threads.filter((thread) => thread.userIds.includes(target)) : [];
      if (matches.length === 1) pair = matches[0]!.userIds;
    }
  } else if (actorId) {
    const actorThreads = state.threads.filter((thread) => thread.userIds.includes(actorId));
    if (argument) {
      const counterpartIds = actorThreads.map((thread) => thread.userIds.find((userId) => userId !== actorId)!).filter(Boolean);
      const target = resolveName(argument, counterpartIds, state);
      if (target && actorThreads.some((thread) => pairMatches(thread, actorId, target))) pair = [actorId, target];
    } else if (actorThreads.length === 1) pair = actorThreads[0]!.userIds;
  }
  return pair ? [internalEnvelope("untied", envelope, state.currentStream.id, pair[0], pair[1], { actor_user_id: actorId, moderator })] : [];
}

export function applyThreadReunion(state: DerivedState, newlyLitUserId: string, timestamp: string): string[] {
  if (!state.currentStream?.litUserIds.includes(newlyLitUserId)) return [];
  const flared = new Set<string>();
  for (const thread of state.threads.filter((item) => item.userIds.includes(newlyLitUserId))) {
    const other = thread.userIds.find((userId) => userId !== newlyLitUserId)!;
    if (!state.currentStream.litUserIds.includes(other)) continue;
    state.threadReunionAtByUserId[newlyLitUserId] = timestamp;
    state.threadReunionAtByUserId[other] = timestamp;
    flared.add(newlyLitUserId); flared.add(other);
  }
  return [...flared];
}
