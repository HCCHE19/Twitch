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
  const age=now-Date.parse(earnedAt);if(age<0||age>=1250)return {active:false,sweep:0,panelScale:1,pulse:0,settled:age>=1250};
  if(reducedMotion)return {active:true,sweep:0,panelScale:1,pulse:age<500?.25:0,settled:true};
  const sweep=Math.min(1,age/650),panelAge=Math.max(0,age-450),panelScale=1+.5*(1-Math.min(1,panelAge/500)),pulse=age>=850?Math.sin(Math.PI*Math.min(1,(age-850)/400)):0;
  return {active:true,sweep,panelScale,pulse,settled:age>=850};
}

export function completionMomentFrame(earnedAt,now=Date.now(),level="normal",reducedMotion=false){
  const age=now-Date.parse(earnedAt);if(level==="quiet"||reducedMotion)return {active:false,reveal:1,flare:0,shrink:1,maxHeight:0,settled:age>=0,panelPulse:age>=0&&age<500?Math.sin(Math.PI*age/500):0};
  const sequenceAge=age-650,panelPulse=age>=4050&&age<4550?Math.sin(Math.PI*(age-4050)/500):0;if(age<0||age>=4050)return {active:false,reveal:1,flare:0,shrink:1,maxHeight:level==="big"?.5:1/3,settled:age>=4050,panelPulse};
  const reveal=Math.max(0,Math.min(1,sequenceAge/2400)),flare=sequenceAge>=2350&&sequenceAge<2850?Math.sin(Math.PI*(sequenceAge-2350)/500):0,shrink=sequenceAge<2600?0:Math.min(1,(sequenceAge-2600)/800);
  return {active:true,reveal,flare,shrink,maxHeight:level==="big"?.5:1/3,settled:false,panelPulse:0};
}
