export function openingCardFrame(card, currentStream, keptUserIds = [], threads = [], now = Date.now()) {
  if (!card || !currentStream) return { active: false, lampOpacity: 1 };
  const age = now - Date.parse(card.startedAt);
  if (age >= 0 && age < 10_000) {
    return {
      active: true,
      lampOpacity: 0,
      panelPulse: age < 1200 ? Math.sin(Math.PI * age / 1200) : 0,
      lines: [
        `${card.previousUserIds.length} lamps last time.`
      ]
    };
  }
  return { active: false, lampOpacity: Math.min(1, Math.max(0, (age - 10_000) / 1_000)) };
}

// Reconstruct the counts at the cutoff, not at render time. Late lights remain in
// the ledger/state for receipts and sky progress without changing this card.
export function returnCardFrame(state, delayMinutes = 10, now = Date.now(), promisesEnabled = true) {
  const card = state?.openingCard, stream = state?.currentStream;
  if (!card || !stream) return { active: false, lampOpacity: 1 };
  const firstFragment = (state.skyFragments ?? []).filter(fragment => fragment.streamId === stream.id)
    .reduce((first, fragment) => Math.min(first, Date.parse(fragment.earnedAt)), Infinity);
  const cutoff = Math.min(Date.parse(stream.startedAt) + (stream.returnCardDelayMinutes ?? delayMinutes) * 60_000, firstFragment);
  // Avoid replacing the initial card if a very fast threshold earns a piece.
  const startedAt = Math.max(cutoff, Date.parse(card.startedAt) + 11_000);
  const age = now - startedAt;
  if (age < 0 || age >= 10_000) return { active: false, lampOpacity: 1 };
  const arrived = id => stream.litUserIds.includes(id) && Date.parse(state.lamps[id]?.lastLitAt) <= cutoff;
  const back = card.previousUserIds.filter(arrived).length;
  const kept = promisesEnabled ? (state.promiseKeptUserIds ?? []).filter(id => arrived(id) && Date.parse(state.promiseKeptAtByUserId[id]) <= cutoff).length : 0;
  return { active: true, lampOpacity: 0, panelPulse: 0,
    lines: [`${back} ${back === 1 ? "is" : "are"} back.`, ...(promisesEnabled ? [`${kept} kept their promise.`] : [])] };
}

export function returnGreeting(lamp, currentStream, now = Date.now()) {
  if (!lamp || !currentStream || lamp.attendedStreamIds.length < 2 || lamp.lastStreamId !== currentStream.id || !currentStream.litUserIds.includes(lamp.userId)) return null;
  const age = now - Date.parse(lamp.lastLitAt);
  if (age < 0 || age >= 3_000) return null;
  return `back for stream ${lamp.attendedStreamIds.length}`;
}
