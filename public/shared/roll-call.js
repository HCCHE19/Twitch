export function rollCallFrame(preferences, currentStream, now = Date.now()) {
  if (!preferences?.rollCall || !currentStream) return { active: false };
  const called = new Set(preferences.rollCallCalled ?? []);
  const remaining = currentStream.litUserIds.filter((userId) => !called.has(userId));
  if (!remaining.length) return { active: false, complete: true };
  const startedAt = Date.parse(preferences.rollCallStartedAt ?? new Date(now).toISOString());
  const index = Math.floor(Math.max(0, now - startedAt) / 4_000) % remaining.length;
  return { active: true, currentUserId: remaining[index], remaining };
}
