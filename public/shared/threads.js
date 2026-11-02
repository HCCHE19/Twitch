export function drawThreadLines(ctx, lines) {
  for (const kind of ["pending", "solid", "waiting"]) for (const line of lines[kind]) {
    const x1 = line.from.x, y1 = line.from.y - line.from.size * .35;
    const x2 = line.to?.x ?? x1 + line.direction * line.from.size * .34;
    const y2 = line.to ? line.to.y - line.to.size * .35 : line.from.y + line.from.size * .08;
    const lift = line.arc ? Math.min(72, Math.abs(x2 - x1) * .18) : 0;
    ctx.save(); ctx.globalAlpha = kind === "solid" ? 1 : .6;
    ctx.lineWidth = threadLineWidth(line);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(219,107,91,.72)"; ctx.shadowColor = "rgba(219,107,91,.38)"; ctx.shadowBlur = 4;
    if (kind !== "solid") ctx.setLineDash([5, 7]);
    ctx.beginPath(); ctx.moveTo(x1, y1);
    if (kind === "waiting") ctx.bezierCurveTo(x1, y1 + line.from.size * .28, x2, y2 - line.from.size * .14, x2, y2);
    else if (line.arc) ctx.quadraticCurveTo((x1 + x2) / 2, Math.min(y1, y2) - lift, x2, y2);
    else ctx.lineTo(x2, y2);
    ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = "rgba(230,132,111,.8)";
    for (const [x,y] of [[x1,y1],[x2,y2]]) { ctx.beginPath();ctx.arc(x,y,kind === "waiting" ? 2 : 1.6,0,Math.PI*2);ctx.fill(); }
    if (line.streak >= 2) {
      const label=String(line.streak), x=(x1+x2)/2, y=(y1+y2)/2-lift/2-6;
      ctx.shadowBlur=0;ctx.font='600 11px "Space Grotesk",system-ui,sans-serif';ctx.textAlign="center";
      const width=ctx.measureText(label).width+10;
      ctx.fillStyle="rgba(5,12,17,.88)";ctx.beginPath();ctx.roundRect(x-width/2,y-11,width,16,5);ctx.fill();
      ctx.fillStyle="rgba(219,107,91,.85)";ctx.fillText(label,x,y+1);
    }
    ctx.restore();
  }
}

export function threadLineWidth(line) {
  return Math.max(line.from?.tier ?? 0,line.to?.tier ?? 0)>0?1.5:2;
}

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
