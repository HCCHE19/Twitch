export function closingHintVisible(state, now = Date.now()) {
  if (!state?.currentStream) return false;
  if (state.closingHintAt) return now >= Date.parse(state.closingHintAt);
  const durations = (state.completedStreamDurationsMs ?? []).filter((value) => Number.isFinite(value) && value >= 0);
  if (!durations.length) return false;
  const sorted = [...durations].sort((a, b) => a - b);
  const usual = sorted[Math.floor(sorted.length / 2)];
  const hintAt = Date.parse(state.currentStream.startedAt) + Math.max(0, usual - 10 * 60_000);
  return now >= hintAt;
}

export function promiseKnotFrame(promisedAt, now = Date.now(), reducedMotion = false) {
  if (!promisedAt) return { visible: false, progress: 0 };
  if (reducedMotion) return { visible: true, progress: 1 };
  return { visible: true, progress: Math.min(1, Math.max(0, (now - Date.parse(promisedAt)) / 400)) };
}

export function keptPromisePulse(keptAt, now = Date.now(), reducedMotion = false) {
  if (!keptAt || reducedMotion) return 0;
  const age = now - Date.parse(keptAt);
  return age < 0 || age > 850 ? 0 : Math.sin(Math.PI * age / 850);
}
