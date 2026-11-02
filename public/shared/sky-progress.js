// Display-only progress. The server ledger still awards at most one fragment per stream.
export function skyProgressFrame(previous, state, landedIds, threshold, now, complete = false, reducedMotion = false) {
  const stream = state?.currentStream;
  if (!stream) return { tracker: null, visible: false };
  let tracker = previous?.streamId === stream.id ? previous : { streamId: stream.id, landed: [], count: 0, bonusAt: null, earnedAt: null };
  tracker = { ...tracker, landed: [...tracker.landed] };
  const kept = new Set(state.promiseKeptUserIds ?? []);
  for (const id of landedIds) {
    if (!stream.litUserIds.includes(id) || tracker.landed.includes(id)) continue;
    tracker.landed.push(id);
    if (tracker.earnedAt === null) tracker.count += kept.has(id) ? 2 : 1;
    if (kept.has(id)) tracker.bonusAt = now;
  }
  const fragment = state.skyFragments?.find(item => item.streamId === stream.id);
  if (fragment && tracker.earnedAt === null && fragment.litUserIds.every(id => tracker.landed.includes(id))) tracker.earnedAt = now;
  const age = tracker.earnedAt === null ? null : now - tracker.earnedAt;
  const count = age === null ? Math.min(threshold, tracker.count) : age < 1200 ? threshold : 0;
  const bonusAge = tracker.bonusAt === null ? Infinity : now - tracker.bonusAt;
  return { tracker, visible: !complete, count, threshold, fill: count / threshold,
    flash: age !== null && age >= 0 && age < 1200 && !reducedMotion ? Math.sin(Math.PI * age / 1200) : 0,
    bonus: bonusAge < 900 && !reducedMotion ? 1 - bonusAge / 900 : 0 };
}

export function drawSkyProgress(ctx, frame, x, y, width) {
  if (!frame?.visible) return;
  ctx.save();ctx.fillStyle="rgba(3,10,16,.48)";ctx.beginPath();ctx.roundRect(x,y-2,width,34,[0,0,14,14]);ctx.fill();
  ctx.font='500 9px "Space Grotesk",system-ui,sans-serif';ctx.textAlign="left";ctx.fillStyle="rgba(220,232,226,.30)";
  ctx.fillText(`next piece: ${frame.count} of ${frame.threshold} lamps`,x+12,y+11);
  ctx.fillStyle="rgba(220,232,226,.08)";ctx.fillRect(x+12,y+20,width-24,2);
  ctx.fillStyle=`rgba(231,227,208,${.23+frame.flash*.17})`;ctx.fillRect(x+12,y+20,(width-24)*frame.fill,2);
  if(frame.bonus>0){ctx.textAlign="right";ctx.fillStyle=`rgba(239,218,169,${frame.bonus*.42})`;ctx.fillText("+2",x+width-12,y+11-(1-frame.bonus)*4)}
  ctx.restore();
}
