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
  ctx.save();ctx.fillStyle="rgba(2,9,15,.72)";ctx.beginPath();ctx.roundRect(x,y-2,width,50,[0,0,16,16]);ctx.fill();
  ctx.font='500 16px "Space Grotesk",system-ui,sans-serif';ctx.textAlign="left";ctx.fillStyle="rgba(235,240,226,.72)";
  ctx.fillText(`next piece: ${frame.count} of ${frame.threshold} lamps`,x+16,y+19);
  ctx.fillStyle="rgba(226,237,229,.18)";ctx.fillRect(x+16,y+31,width-32,3);
  ctx.fillStyle=`rgba(247,232,202,${.52+frame.flash*.28})`;ctx.fillRect(x+16,y+31,(width-32)*frame.fill,3);
  if(frame.bonus>0){ctx.textAlign="right";ctx.fillStyle=`rgba(249,222,168,${frame.bonus*.72})`;ctx.fillText("+2",x+width-16,y+19-(1-frame.bonus)*4)}
  ctx.restore();
}
