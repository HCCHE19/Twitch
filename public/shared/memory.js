export function openingCardFrame(card, currentStream, keptUserIds = [], threads = [], now = Date.now()) {
  if (!card || !currentStream) return { active: false, lampOpacity: 1 };
  const age = now - Date.parse(card.startedAt);
  const back = card.previousUserIds.filter((userId) => currentStream.litUserIds.includes(userId)).length;
  if (age >= 0 && age < 10_000) {
    const lit = new Set(currentStream.litUserIds);
    const waiting = threads.filter((thread) => thread.userIds.filter((userId) => lit.has(userId)).length === 1).length;
    return {
      active: true,
      lampOpacity: 0,
      lines: [
        `Last stream: ${card.previousUserIds.length} lamp${card.previousUserIds.length === 1 ? "" : "s"}. ${back} of them ${back === 1 ? "is" : "are"} back tonight.`,
        ...(card.previousPromiseUserIds?.length ? [`${card.previousPromiseUserIds.length} promised, ${keptUserIds.length} kept it${keptUserIds.length ? " — the sky starts ahead tonight." : "."}`] : []),
        ...(waiting ? [`${waiting} thread${waiting === 1 ? "" : "s"} waiting for someone.`] : [])
      ].slice(0, 3)
    };
  }
  return { active: false, lampOpacity: Math.min(1, Math.max(0, (age - 10_000) / 1_000)) };
}

export function returnGreeting(lamp, currentStream, now = Date.now()) {
  if (!lamp || !currentStream || lamp.attendedStreamIds.length < 2 || lamp.lastStreamId !== currentStream.id || !currentStream.litUserIds.includes(lamp.userId)) return null;
  const age = now - Date.parse(lamp.lastLitAt);
  if (age < 0 || age >= 3_000) return null;
  return `back for stream ${lamp.attendedStreamIds.length}`;
}
