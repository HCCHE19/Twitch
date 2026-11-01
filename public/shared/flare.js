export function flarePulse(lastFlareAt, now = Date.now(), reducedMotion = false) {
  if (!lastFlareAt) return { active: false, intensity: 0, scale: 1 };
  const age = now - Date.parse(lastFlareAt);
  if (age < 0 || age >= 600) return { active: false, intensity: 0, scale: 1 };
  const intensity = reducedMotion ? .5 : Math.sin(Math.PI * age / 600);
  return { active: true, intensity, scale: 1 + intensity * .12 };
}
