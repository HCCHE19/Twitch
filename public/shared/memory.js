export function openingCardFrame(card, currentStream, keptUserIds = [], threads = [], now = Date.now()) {
  if (!card || !currentStream) return { active: false, lampOpacity: 1 };
  const age = now - Date.parse(card.startedAt);
  const back = card.previousUserIds.filter((userId) => currentStream.litUserIds.includes(userId)).length;
  if (age >= 0 && age < 10_000) {
    return {
      active: true,
      lampOpacity: 0,
      panelPulse: age < 1200 ? Math.sin(Math.PI * age / 1200) : 0,
      lines: [
        `${card.previousUserIds.length} lamps last time. ${back} ${back === 1 ? "is" : "are"} back.`,
        ...(keptUserIds.length ? [`${keptUserIds.length} kept their promise.`] : [])
      ]
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
