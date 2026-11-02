import type { DerivedState, EventSubEnvelope } from "./types.js";

export function demoSpeed(events: EventSubEnvelope[], minutes: number): number {
  if (!Number.isFinite(minutes) || minutes <= 0) throw new Error("--minutes must be a positive number");
  const span = Date.parse(events.at(-1)!.metadata.message_timestamp) - Date.parse(events[0]!.metadata.message_timestamp);
  return span > 0 ? span / (minutes * 60_000) : 1;
}

export function demoNotices(before: DerivedState, after: DerivedState): string[] {
  const lines: string[] = [];
  const name = (id: string): string => after.lamps[id]?.displayName ?? before.lamps[id]?.displayName ?? "viewer";
  if (after.currentStream?.id !== before.currentStream?.id) lines.push(after.currentStream ? "stream online" : "stream offline — closing moment");
  for (const id of after.currentStream?.litUserIds ?? []) if (!before.currentStream?.litUserIds.includes(id) || before.currentStream.id !== after.currentStream?.id) lines.push(`${name(id)} lights a lamp`);
  for (const pending of after.pendingThreads) if (!before.pendingThreads.some(item => item.fromUserId === pending.fromUserId && item.toUserId === pending.toUserId)) lines.push(`tie ${name(pending.fromUserId)} to ${name(pending.toUserId)} (pending)`);
  const key = (ids: string[]): string => [...ids].sort().join("|");
  for (const thread of after.threads) if (!before.threads.some(item => key(item.userIds) === key(thread.userIds))) lines.push(`tie ${thread.userIds.map(name).join(" to ")} (mutual)`);
  for (const thread of before.threads) if (!after.threads.some(item => key(item.userIds) === key(thread.userIds))) lines.push(`untie ${thread.userIds.map(name).join(" and ")}`);
  for (const promise of after.promises.slice(before.promises.length)) lines.push(`promise — ${name(promise.userId)}`);
  for (const fragment of after.skyFragments.slice(before.skyFragments.length)) {
    const count = after.skyFragments.filter(item => item.constellation === fragment.constellation).length;
    lines.push(`fragment earned — ${fragment.constellation} ${count} of 6`);
    if (count === 6) lines.push(`constellation complete — ${fragment.constellation}`);
  }
  if (after.closingHintAt && after.closingHintAt !== before.closingHintAt) lines.push("closing hint");
  for (const [id, at] of Object.entries(after.flareAtByUserId)) if (before.flareAtByUserId[id] !== at) lines.push(`flare — ${name(id)}`);
  return lines;
}
