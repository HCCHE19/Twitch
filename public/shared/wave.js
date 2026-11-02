export function updateWaveTracker(tracker, streamId, litCount, threshold, now = Date.now()) {
  if (!streamId) return { streamId: null, fired: false, startedAt: null };
  const current = tracker?.streamId === streamId ? tracker : { streamId, fired: false, startedAt: null };
  if (!current.fired && litCount >= threshold) return { streamId, fired: true, startedAt: now };
  return current;
}

export function waveIntensity(startedAt, index, now = Date.now()) {
  if (startedAt === null) return 0;
  const age = now - startedAt - index * 100;
  if (age < 0 || age >= 300) return 0;
  return Math.sin(Math.PI * age / 300);
}
