export function flareInteractions(items, flareAtByUserId, now = Date.now()) {
  const recent = Object.entries(flareAtByUserId ?? {}).map(([userId, at]) => ({ userId, at: Date.parse(at) })).filter((item) => Number.isFinite(item.at)).sort((a, b) => b.at - a.at);
  const latest = recent[0]; const ripples = {};
  if (latest) {
    const age = now - latest.at - 200;
    if (age >= 0 && age < 600) {
      const intensity = Math.sin(Math.PI * age / 600) / 3;
      const index = items.findIndex((item) => item.lamp?.userId === latest.userId);
      for (const neighbour of [items[index - 1], items[index + 1]]) if (neighbour?.lamp) ripples[neighbour.lamp.userId] = intensity;
    }
  }
  let spark = null;
  const previous = recent.find((item) => item.userId !== latest?.userId);
  if (latest && previous && latest.at - previous.at <= 5_000) {
    const age = now - latest.at;
    if (age >= 0 && age < 400) spark = { fromUserId: previous.userId, toUserId: latest.userId, intensity: Math.sin(Math.PI * age / 400) };
  }
  return { ripples, spark };
}
