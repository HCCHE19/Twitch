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

export function placeThreadArrival(orderIds, arrivingUserId, threads, litUserIds, now = Date.now(), lastSlideAt = null) {
  const row = [...orderIds], lit = new Set(litUserIds ?? []), index = row.indexOf(arrivingUserId);
  if (index < 0 || row.length > 30) return { orderIds: row, slid: false, lastSlideAt };
  const candidates = [...(threads ?? [])].filter((thread) => thread.userIds.includes(arrivingUserId))
    .filter((thread) => thread.userIds.every((userId) => lit.has(userId))).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const thread of candidates) {
    const partnerId = thread.userIds.find((userId) => userId !== arrivingUserId), partnerIndex = row.indexOf(partnerId);
    if (partnerIndex < 0 || Math.abs(partnerIndex - index) === 1) return { orderIds: row, slid: false, lastSlideAt };
    const adjacentTied = (candidateId) => candidateId && (threads ?? []).some((item) => item.userIds.includes(partnerId) && item.userIds.includes(candidateId) && item.userIds.every((userId) => lit.has(userId)));
    if (adjacentTied(row[partnerIndex - 1]) && adjacentTied(row[partnerIndex + 1])) continue;
    if (lastSlideAt !== null && now - lastSlideAt < 5_000) return { orderIds: row, slid: false, lastSlideAt };
    const destination = partnerIndex + (adjacentTied(row[partnerIndex + 1]) ? 0 : 1);
    const movedExisting = Math.max(0, Math.abs(index - destination));
    if (movedExisting > 2) return { orderIds: row, slid: false, lastSlideAt };
    const [arrival] = row.splice(index, 1); let adjusted = destination;
    if (index < destination) adjusted -= 1;
    row.splice(adjusted, 0, arrival);
    return { orderIds: row, slid: true, lastSlideAt: now };
  }
  return { orderIds: row, slid: false, lastSlideAt };
}

export function displayedThreadStreak(thread, currentStream) {
  if (!currentStream || !thread.userIds.every((userId) => currentStream.litUserIds.includes(userId))) return 0;
  return (thread.currentStreak ?? 0) + (thread.lastCountedStreamId === currentStream.id ? 0 : 1);
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
    if (aLit && bLit) {
      const from = byId.get(a), to = byId.get(b);
      if (from && to) {
        const gap = Math.abs(items.indexOf(from) - items.indexOf(to)) - 1;
        if (gap <= 3) solid.push({ from, to, arc: gap > 0, gap, streak: displayedThreadStreak(thread, state.currentStream) });
      }
    }
    else if (aLit !== bLit) { const userId = aLit ? a : b; const from = byId.get(userId); if (from) waiting.push({ from, direction: userId === a ? 1 : -1 }); }
  }
  return { pending, solid, waiting };
}
