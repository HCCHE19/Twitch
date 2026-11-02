import { separateAdjacentHues } from "./layout.js";

const keyFor = (item) => item.lamp ? item.lamp.userId : "__cluster__";
const ease = (value) => value * value * (3 - 2 * value);

export function reconcileLampOrder(previousIds,lamps,hueFor,onImpossible=()=>{}){
  const byId=new Map(lamps.map(lamp=>[lamp.userId,lamp]));
  const retained=previousIds.filter(id=>byId.has(id));
  const newcomers=lamps.filter(lamp=>!retained.includes(lamp.userId)).sort((a,b)=>a.lastLitAt.localeCompare(b.lastLitAt)||a.userId.localeCompare(b.userId));
  let row=retained.map(id=>({lamp:byId.get(id)}));
  for(const lamp of newcomers)row=separateAdjacentHues([...row,{lamp}],item=>hueFor(item.lamp),onImpossible);
  return row.map(item=>item.lamp.userId);
}

function currentValue(entry,now,duration){
  const progress=Math.max(0,Math.min(1,(now-entry.startedAt)/duration)),amount=ease(progress);
  return {x:entry.from.x+(entry.to.x-entry.from.x)*amount,y:entry.from.y+(entry.to.y-entry.from.y)*amount,size:entry.from.size+(entry.to.size-entry.from.size)*amount,done:progress>=1};
}

export function animateRowLayout(tracker,targetItems,now=Date.now(),duration=300){
  const next=new Map(),movedExisting=[];
  for(const item of targetItems){
    const key=keyFor(item),target={x:item.x,y:item.y,size:item.size},previous=tracker.get(key);
    if(!previous){next.set(key,{from:target,to:target,startedAt:now-duration});continue}
    const current=currentValue(previous,now,duration),changed=Math.abs(previous.to.x-target.x)>.01||Math.abs(previous.to.y-target.y)>.01||Math.abs(previous.to.size-target.size)>.01;
    if(changed){next.set(key,{from:{x:current.x,y:current.y,size:current.size},to:target,startedAt:now});movedExisting.push(key)}
    else next.set(key,previous);
  }
  const items=targetItems.map(item=>{const value=currentValue(next.get(keyFor(item)),now,duration);return {...item,x:value.x,y:value.y,size:value.size}});
  return {tracker:next,items,movedExisting};
}

export function arrivalStartTime(now,gapOpened,duration=300){return now+(gapOpened?duration:0)}
