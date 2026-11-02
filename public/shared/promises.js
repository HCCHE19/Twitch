export function closingHintVisible(state, now = Date.now()) {
  if (!state?.currentStream) return false;
  if (state.closingHintAt) return now >= Date.parse(state.closingHintAt);
  const durations = (state.completedStreamDurationsMs ?? []).filter((value) => Number.isFinite(value) && value >= 0).slice(-5);
  if (!durations.length) return false;
  const sorted = [...durations].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const usual = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  if (usual < 30 * 60_000) return false;
  const hintAt = Date.parse(state.currentStream.startedAt) + usual * .9;
  return now >= hintAt;
}

export function closingHintPosition(tier, width, height, baseline, layout = "bottom") {
  const denseOffset = Math.max(72, height * .085);
  return { x: width - 28, y: tier >= 1 ? baseline + (layout === "top" ? denseOffset : -denseOffset) : baseline + (layout === "top" ? 32 : -28) };
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
