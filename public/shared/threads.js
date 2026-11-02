export function preferThreadAdjacency(items, threads, litUserIds) {
  const row = [...items]; const lit = new Set(litUserIds ?? []);
  for (const thread of [...(threads ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    if (!thread.userIds.every((userId) => lit.has(userId))) continue;
    const first = row.findIndex((item) => item.lamp?.userId === thread.userIds[0]);
    const second = row.findIndex((item) => item.lamp?.userId === thread.userIds[1]);
    if (first < 0 || second < 0 || Math.abs(first - second) === 1) continue;
    const [partner] = row.splice(second, 1);
    const anchor = row.findIndex((item) => item.lamp?.userId === thread.userIds[0]);
    row.splice(anchor + 1, 0, partner);
  }
  return row;
}

export function threadVisuals(items, state) {
  const byId = new Map(items.filter((item) => item.lamp).map((item) => [item.lamp.userId, item]));
  const lit = new Set(state.currentStream?.litUserIds ?? []);
  const pending = (state.pendingThreads ?? []).flatMap((thread) => {
    const from = byId.get(thread.fromUserId); const to = byId.get(thread.toUserId);
    return from && to && lit.has(thread.fromUserId) && lit.has(thread.toUserId) ? [{ from, to }] : [];
  });
  const solid = []; const waiting = [];
  for (const thread of state.threads ?? []) {
    const [a, b] = thread.userIds; const aLit = lit.has(a); const bLit = lit.has(b);
    if (aLit && bLit) { const from = byId.get(a); const to = byId.get(b); if (from && to) solid.push({ from, to }); }
    else if (aLit !== bLit) { const userId = aLit ? a : b; const from = byId.get(userId); if (from) waiting.push({ from, direction: userId === a ? 1 : -1 }); }
  }
  return { pending, solid, waiting };
}
