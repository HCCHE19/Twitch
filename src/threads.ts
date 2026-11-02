import type { DerivedState, EventSubEnvelope, ThreadState } from "./types.js";

export interface ThreadCommandOptions { enabled: boolean; broadcasterLogin: string; ignoredUsers?: string[] }
export interface ThreadCommandResult {
  command: "!tie" | "!untie";
  applied: boolean;
  reason: string;
  targetUserId?: string;
  events: EventSubEnvelope[];
}

function chatText(envelope: EventSubEnvelope): string {
  const message = envelope.payload.event?.message as { text?: unknown } | undefined;
  return typeof message?.text === "string" ? message.text.trim() : "";
}

function isModerator(event: Record<string, unknown>): boolean {
  const badges = Array.isArray(event.badges) ? event.badges as Array<{ set_id?: unknown }> : [];
  return badges.some((badge) => badge.set_id === "moderator" || badge.set_id === "broadcaster");
}

function resolveName(query: string, userIds: string[], state: DerivedState, envelope?: EventSubEnvelope): string | null {
  const normalized = query.trim().replace(/^@/u, "").toLocaleLowerCase();
  if (!normalized) return null;
  // Twitch channel.chat.message mention fragment fields:
  // https://dev.twitch.tv/docs/eventsub/eventsub-reference/#channel-chat-message-event
  const fragments = envelope?.payload.event?.message && (envelope.payload.event.message as { fragments?: unknown }).fragments;
  if (Array.isArray(fragments)) {
    const mentions = fragments.flatMap((fragment) => {
      const value = fragment as { type?: unknown; text?: unknown; mention?: { user_id?: unknown; user_login?: unknown; user_name?: unknown } };
      if (value.type !== "mention") return [];
      const name = String(value.mention?.user_name ?? value.mention?.user_login ?? value.text ?? "").replace(/^@/u, "").toLocaleLowerCase();
      const userId = String(value.mention?.user_id ?? "");
      return name === normalized && userIds.includes(userId) ? [userId] : [];
    });
    if (mentions.length === 1) return mentions[0]!;
  }
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

export function applyThreadCommandDetailed(state: DerivedState, envelope: EventSubEnvelope, options: ThreadCommandOptions): ThreadCommandResult | null {
  if (envelope.metadata.subscription_type !== "channel.chat.message") return null;
  const text = chatText(envelope);
  const tieMatch = /^!tie(?:\s+(.+))?$/iu.exec(text);
  const untieMatch = /^!untie(?:\s+(.+))?$/iu.exec(text);
  if (!tieMatch && !untieMatch) return null;
  const command = tieMatch ? "!tie" : "!untie";
  const ignoredResult = (reason: string, targetUserId?: string): ThreadCommandResult => ({ command, applied: false, reason, ...(targetUserId ? { targetUserId } : {}), events: [] });
  if (!options.enabled) return ignoredResult("threads are disabled");
  if (!state.currentStream) return ignoredResult("no stream is live");
  const event = envelope.payload.event ?? {};
  const actorId = String(event.chatter_user_id ?? "");
  const actorLogin = String(event.chatter_user_login ?? "").toLowerCase();
  const ignored = new Set([options.broadcasterLogin, ...(options.ignoredUsers ?? [])].map((value) => value.toLowerCase()));
  const moderator = isModerator(event);

  if (tieMatch) {
    if (!actorId) return ignoredResult("sender id is missing");
    if (ignored.has(actorLogin)) return ignoredResult("sender is the broadcaster or an ignored bot");
    if (!state.currentStream.litUserIds.includes(actorId)) return ignoredResult("sender's lamp is not lit tonight");
    if (state.threadOutgoingUserIds.includes(actorId)) return ignoredResult("sender already used their outgoing tie this stream");
    const actorIndex = state.currentStream.litUserIds.indexOf(actorId);
    const targetId = tieMatch[1]?.trim()
      ? resolveName(tieMatch[1], state.currentStream.litUserIds, state, envelope)
      : actorIndex > 0 ? state.currentStream.litUserIds[actorIndex - 1]! : null;
    if (!targetId) return ignoredResult(tieMatch[1]?.trim() ? "target is not one unique lit lamp" : "there is no lamp immediately left of the sender");
    if (targetId === actorId) return ignoredResult("a viewer cannot tie to themselves", targetId);
    if (state.threads.some((thread) => pairMatches(thread, actorId, targetId))) return ignoredResult("those lamps are already threaded", targetId);
    if ([actorId, targetId].some((userId) => state.threads.filter((thread) => thread.userIds.includes(userId)).length >= 3)) return ignoredResult("one lamp already has three threads", targetId);
    return { command, applied: true, reason: "solid thread tied", targetUserId: targetId, events: [internalEnvelope("tied", envelope, state.currentStream.id, actorId, targetId, { initiator_user_id: actorId })] };
  }

  let pair: [string, string] | null = null;
  const argument = untieMatch?.[1]?.trim() ?? "";
  if (moderator) {
    if (argument.includes("|")) {
      const [left, right] = argument.split("|", 2);
      const a = resolveName(left ?? "", Object.keys(state.lamps), state, envelope); const b = resolveName(right ?? "", Object.keys(state.lamps), state, envelope);
      if (a && b && a !== b && state.threads.some((thread) => pairMatches(thread, a, b))) pair = [a, b];
    } else if (argument) {
      const target = resolveName(argument, Object.keys(state.lamps), state, envelope);
      const matches = target ? state.threads.filter((thread) => thread.userIds.includes(target)) : [];
      if (matches.length === 1) pair = matches[0]!.userIds;
    }
  } else if (actorId) {
    const actorThreads = state.threads.filter((thread) => thread.userIds.includes(actorId));
    if (argument) {
      const counterpartIds = actorThreads.map((thread) => thread.userIds.find((userId) => userId !== actorId)!).filter(Boolean);
      const target = resolveName(argument, counterpartIds, state, envelope);
      if (target && actorThreads.some((thread) => pairMatches(thread, actorId, target))) pair = [actorId, target];
    } else {
      const actorIndex = state.currentStream.litUserIds.indexOf(actorId);
      const leftId = actorIndex > 0 ? state.currentStream.litUserIds[actorIndex - 1]! : null;
      if (leftId && actorThreads.some((thread) => pairMatches(thread, actorId, leftId))) pair = [actorId, leftId];
    }
  }
  if (!pair) return ignoredResult(moderator ? "no unique matching thread was found" : "sender has no matching thread");
  const targetUserId = pair.find((userId) => userId !== actorId);
  return { command, applied: true, reason: "thread removed", ...(targetUserId ? { targetUserId } : {}), events: [internalEnvelope("untied", envelope, state.currentStream.id, pair[0], pair[1], { actor_user_id: actorId, moderator })] };
}

export function applyThreadCommand(state: DerivedState, envelope: EventSubEnvelope, options: ThreadCommandOptions): EventSubEnvelope[] {
  return applyThreadCommandDetailed(state, envelope, options)?.events ?? [];
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
