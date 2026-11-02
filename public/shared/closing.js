export function closingFrame(moment, now = Date.now(), reducedMotion = false) {
  if (!moment) return { kind: "none" };
  const elapsed = Math.max(0, now - Date.parse(moment.startedAt));
  const extinguishDuration = reducedMotion ? 0 : moment.litUserIds.length * 150;
  if (elapsed >= extinguishDuration + 10_000) return { kind: "clear" };
  if (elapsed >= extinguishDuration) {
    return {
      kind: "summary",
      lines: [
        `${moment.totalLamps} lamp${moment.totalLamps === 1 ? "" : "s"} tonight, ${moment.returningLamps} returning`,
        `${moment.promisedLamps ?? 0} of ${moment.totalLamps} promised to come back`
      ]
    };
  }
  const extinguished = Math.floor(elapsed / 150);
  return { kind: "lamps", visibleUserIds: moment.litUserIds.slice(extinguished) };
}
