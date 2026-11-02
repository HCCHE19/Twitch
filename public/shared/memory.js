export function openingCardFrame(card, currentStream, now = Date.now()) {
  if (!card || !currentStream) return { active: false, lampOpacity: 1 };
  const age = now - Date.parse(card.startedAt);
  const back = card.previousUserIds.filter((userId) => currentStream.litUserIds.includes(userId)).length;
  if (age >= 0 && age < 10_000) {
    return {
      active: true,
      lampOpacity: 0,
      text: `Last stream: ${card.previousUserIds.length} lamp${card.previousUserIds.length === 1 ? "" : "s"}. ${back} of them ${back === 1 ? "is" : "are"} back tonight.`
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
