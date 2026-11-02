export function updateWindTracker(tracker,streamId,flareAtByUserId,now,enabled=true){
  if(!enabled||!streamId)return {streamId:streamId??null,startedAt:null,lastTriggeredAt:null,signature:"",direction:1};
  if(tracker.streamId!==streamId)tracker={streamId,startedAt:null,lastTriggeredAt:null,signature:"",direction:1};
  const recent=Object.entries(flareAtByUserId).filter(([,at])=>{const age=now-Date.parse(at);return age>=0&&age<=10000}).sort((a,b)=>a[1].localeCompare(b[1]));
  if(recent.length<5)return tracker;
  const signature=recent.map(([id,at])=>`${id}:${at}`).join("|");
  if(signature===tracker.signature||tracker.lastTriggeredAt&&now-tracker.lastTriggeredAt<10000)return tracker;
  const direction=[...signature].reduce((sum,char)=>sum+char.charCodeAt(0),0)%2?1:-1;
  return {streamId,startedAt:now,lastTriggeredAt:now,signature,direction};
}

export function windLean(tracker,now){
  if(!tracker.startedAt)return 0;const age=now-tracker.startedAt;if(age<0||age>=1000)return 0;
  return tracker.direction*Math.sin(Math.PI*age/1000)*.18;
}
