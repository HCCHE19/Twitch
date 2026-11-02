export function igniteFrame(litAt,now=Date.now(),reducedMotion=false,level="normal"){
  const age=now-Date.parse(litAt);if(age<0||age>=1000)return {active:false,yOffset:0,scaleY:1,bloom:0,ripple:0,nudge:0};
  if(reducedMotion)return {active:true,yOffset:0,scaleY:1,bloom:age<500?.38:0,ripple:0,nudge:0};
  if(level==="quiet")return {active:true,yOffset:0,scaleY:1,bloom:0,ripple:Math.min(1,age/800),nudge:0};
  const landing=350,fall=Math.min(1,age/landing),easeIn=fall*fall;
  const after=Math.max(0,age-landing),bounceAge=Math.max(0,after-130),bounce=bounceAge<260?Math.sin(Math.PI*bounceAge/260)*(1-bounceAge/320):0;
  const yOffset=age<landing?-1.05*(1-easeIn):-.045*bounce;
  const scaleY=after<190?1-.075*Math.sin(Math.PI*after/190):1;
  const bloom=after<460?Math.sin(Math.PI*Math.min(1,after/460)):0,ripple=after<540?after/540:1,nudge=after<430?Math.sin(Math.PI*after/430):0;
  return {active:true,yOffset,scaleY,bloom,ripple,nudge};
}

export function fragmentMomentFrame(earnedAt,now=Date.now(),reducedMotion=false){
  const age=now-(typeof earnedAt==="number"?earnedAt:Date.parse(earnedAt));if(age<0||age>=1250)return {active:false,sweep:0,panelScale:1,pulse:0,settled:age>=1250};
  if(reducedMotion)return {active:true,sweep:0,panelScale:1,pulse:age<500?.25:0,settled:true};
  const sweep=Math.min(1,age/650),panelAge=Math.max(0,age-450),panelScale=1+.5*(1-Math.min(1,panelAge/500)),pulse=age>=850?Math.sin(Math.PI*Math.min(1,(age-850)/400)):0;
  return {active:true,sweep,panelScale,pulse,settled:age>=850};
}

export function resolveFragmentMomentStart(fragment,lamps={},queuedIds=new Set(),arrivalStarts=new Map(),now=Date.now()){
  if(!fragment)return null;const contributors=(fragment.litUserIds??[]).map(id=>lamps[id]).filter(Boolean).sort((a,b)=>Date.parse(b.lastLitAt)-Date.parse(a.lastLitAt)),thresholdLamp=contributors[0];
  if(!thresholdLamp)return Date.parse(fragment.earnedAt);if(queuedIds.has(thresholdLamp.userId))return null;
  const arrivalStart=arrivalStarts.get(thresholdLamp.userId);if(Number.isFinite(arrivalStart))return arrivalStart+1200;
  const earned=Date.parse(fragment.earnedAt);return now-earned<5000?Math.max(earned,Date.parse(thresholdLamp.lastLitAt))+1200:earned;
}

export function fragmentBandMoment(fragment,count,now=Date.now(),reducedMotion=false,startedAt=fragment?.earnedAt){
  if(!fragment||startedAt===null)return {active:false,alpha:0,pulse:0,text:"",litUserIds:[]};
  const age=now-(typeof startedAt==="number"?startedAt:Date.parse(startedAt));if(age<0||age>=3000)return {active:false,alpha:0,pulse:0,text:"",litUserIds:[]};
  const alpha=age<2300?1:Math.max(0,1-(age-2300)/700),pulse=reducedMotion?(age<1000?.25:0):Math.max(...[0,400,800].map(offset=>{const local=age-offset;return local>=0&&local<300?Math.sin(Math.PI*local/300):0}));
  return {active:true,alpha,pulse,text:`${fragment.constellation}, piece ${count} of 6`,litUserIds:Array.isArray(fragment.litUserIds)?fragment.litUserIds:[]};
}

export function completionMomentFrame(earnedAt,now=Date.now(),level="normal",reducedMotion=false){
  const age=now-Date.parse(earnedAt);if(level==="quiet"||reducedMotion)return {active:false,reveal:1,flare:0,shrink:1,maxHeight:0,settled:age>=0,panelPulse:age>=0&&age<500?Math.sin(Math.PI*age/500):0};
  const sequenceAge=age-650,panelPulse=age>=4050&&age<4550?Math.sin(Math.PI*(age-4050)/500):0;if(age<0||age>=4050)return {active:false,reveal:1,flare:0,shrink:1,crossfade:1,travelAlpha:0,maxHeight:level==="big"?.5:1/3,settled:age>=4050,panelPulse};
  const reveal=Math.max(0,Math.min(1,sequenceAge/2400)),flare=sequenceAge>=2350&&sequenceAge<2850?Math.sin(Math.PI*(sequenceAge-2350)/500):0,shrink=sequenceAge<2600?0:Math.min(1,(sequenceAge-2600)/800),crossfade=Math.max(0,Math.min(1,(shrink-.62)/.38));
  return {active:true,reveal,flare,shrink,crossfade,travelAlpha:1-crossfade,maxHeight:level==="big"?.5:1/3,settled:false,panelPulse:0};
}
