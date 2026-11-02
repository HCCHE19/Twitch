export function neighbourWelcome(items, currentStream, now = Date.now()) {
  if (!currentStream) return {};
  const candidates = items.map((item, index) => ({ item, index })).filter(({ item }) => {
    if (!item.lamp || item.lamp.attendedStreamIds.length !== 1 || !currentStream.litUserIds.includes(item.lamp.userId)) return false;
    const age = now - Date.parse(item.lamp.lastLitAt);
    return age >= 0 && age < 2_000;
  }).sort((a, b) => b.item.lamp.lastLitAt.localeCompare(a.item.lamp.lastLitAt));
  const newcomer = candidates[0];
  if (!newcomer) return {};
  const age = now - Date.parse(newcomer.item.lamp.lastLitAt);
  const intensity = Math.sin(Math.PI * age / 2_000);
  const effects = {};
  const left = items[newcomer.index - 1]?.lamp; const right = items[newcomer.index + 1]?.lamp;
  if (left) effects[left.userId] = { tilt: 4 * intensity, intensity };
  if (right) effects[right.userId] = { tilt: -4 * intensity, intensity };
  return effects;
}
