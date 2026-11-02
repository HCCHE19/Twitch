import { drawSkyProgress } from "./sky-progress.js";
// Numeric sky positions are selected from d3-celestial's constellation line data
// (BSD-3-Clause): https://github.com/ofrohn/d3-celestial/blob/master/data/constellations.lines.json
// Magnitude tiers use the matching d3-celestial star catalogue entries:
// https://github.com/ofrohn/d3-celestial/blob/master/data/stars.6.json
// Lamplight normalizes those real positions and generates its own six-region line style.
import { completionMomentFrame, fragmentMomentFrame } from "./moments.js";
export const SKY_NAMES = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpius","Sagittarius","Capricornus","Aquarius","Pisces"];
export const SKY_PANEL_SIZE = {width:520,height:200};
const LETTERS = ["A","B","C","D","E","F"];
const RAW = {
  Aries:[[42.496,27.2605],[31.7934,23.4624],[28.66,20.808],[28.3826,19.2939]],
  Taurus:[[84.4112,21.1425],[68.9802,16.5093],[64.9483,15.6276],[67.1542,19.1804],[81.573,28.6075],[60.1701,12.4903],[51.7923,9.7327],[54.2183,.4017]],
  Gemini:[[93.7194,22.5068],[100.983,25.1311],[107.7849,30.2452],[116.329,28.0262],[110.0307,21.9823],[99.4279,16.3993],[101.3224,12.8956],[109.5232,16.5404]],
  Cancer:[[134.6218,11.8577],[131.1712,18.1543],[130.8214,21.4685],[131.6666,28.7651],[124.1288,9.1855]],
  Leo:[[152.093,11.9672],[151.8331,16.7627],[154.9931,19.8415],[168.5271,20.5237],[177.2649,14.5721],[168.56,15.4296],[154.1726,23.4173],[146.4628,23.7743]],
  Virgo:[[176.4648,6.5294],[177.6738,1.7647],[184.9765,-.6668],[197.4875,-5.539],[214.0036,-6.0005],[220.7651,-5.6582],[195.5442,10.9592],[203.6733,-.5958],[221.5622,1.8929]],
  Libra:[[226.0176,-25.282],[222.7196,-16.0418],[229.2517,-9.3829],[233.8816,-14.7895],[234.256,-28.1351],[234.664,-29.7778]],
  Scorpius:[[239.713,-26.1141],[241.3593,-19.8055],[247.3519,-26.432],[252.5409,-34.2932],[253.6459,-42.3613],[264.3297,-42.9978],[266.8962,-40.127],[263.4022,-37.1038]],
  Sagittarius:[[274.4068,-36.7617],[275.2485,-29.8281],[273.4409,-21.0588],[290.9716,-40.6159],[281.4141,-26.9908],[298.8154,-41.8683],[298.9598,-26.2995],[286.171,-21.7415],[290.4182,-17.8472]],
  Capricornus:[[304.412,-12.5082],[307.2151,-17.8137],[312.9554,-26.9191],[321.6668,-22.4113],[326.7602,-16.1273],[320.5617,-16.8345],[316.4868,-17.2329]],
  Aquarius:[[311.919,-9.4958],[322.8897,-5.5712],[335.4141,-1.3873],[338.8391,-.1175],[349.4759,-9.1825],[347.3617,-21.1724],[331.6093,-13.8697],[336.3193,1.3774],[355.4409,-17.8165]],
  Pisces:[[18.4373,24.5837],[17.9152,30.0896],[22.8709,15.3458],[30.5118,2.7638],[18.4329,7.5754],[12.1706,7.5851],[359.8279,6.8633],[350.0858,5.3813],[349.2914,3.2823],[357.4543,3.4868]]
};
const MAGNITUDES = {
  Aries:[3.61,2.01,2.64,3.88],Taurus:[2.97,.87,3.65,3.53,1.65,3.41,3.73,4.29],Gemini:[3.31,3.06,4.41,1.16,3.5,1.93,3.35,3.58],
  Cancer:[4.26,3.94,4.66,4.03,3.53],Leo:[1.36,3.48,2.01,2.56,2.14,3.33,3.43,2.97],Virgo:[4.04,3.59,3.89,4.38,4.07,3.87,2.85,3.38,3.73],
  Libra:[3.25,2.75,2.61,3.91,3.6,3.66],Scorpius:[2.89,2.56,1.06,2.29,3.62,1.86,2.99,1.62],Sagittarius:[3.1,2.72,3.84,3.96,3.17,4.12,4.7,3.76,3.92],
  Capricornus:[4.3,4.77,4.12,3.77,2.85,4.28,4.08],Aquarius:[3.78,2.9,3.86,4.04,4.41,3.68,4.29,4.8,4.82],Pisces:[4.67,4.51,3.62,3.82,5.21,4.44,4.03,5.05,3.7,5.59]
};

function projected(name) {
  const points=RAW[name]; let xs=points.map(p=>p[0]);
  if(Math.max(...xs)-Math.min(...xs)>180)xs=xs.map(x=>x<180?x+360:x);
  const meanY=points.reduce((sum,p)=>sum+p[1],0)/points.length,cos=Math.cos(meanY*Math.PI/180);
  return points.map((p,i)=>[xs[i]*cos,-p[1]]);
}

function routePoint(points,t) {
  const lengths=points.slice(1).map((p,i)=>Math.hypot(p[0]-points[i][0],p[1]-points[i][1]));
  const total=lengths.reduce((a,b)=>a+b,0); let target=t*total;
  for(let i=0;i<lengths.length;i++){if(target<=lengths[i]){const u=lengths[i]?target/lengths[i]:0;return [points[i][0]+(points[i+1][0]-points[i][0])*u,points[i][1]+(points[i+1][1]-points[i][1])*u]}target-=lengths[i]}
  return points.at(-1);
}

function seeded(name,suffix="") {let value=2166136261;for(const character of `${name}:${suffix}`){value^=character.charCodeAt(0);value=Math.imul(value,16777619)}return()=>{value+=0x6d2b79f5;let result=Math.imul(value^(value>>>15),1|value);result^=result+Math.imul(result^(result>>>7),61|result);return((result^(result>>>14))>>>0)/4294967296}}

function cardPoints(name,x,y,w,h) {
  const source=projected(name),xs=source.map(p=>p[0]),ys=source.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const rangeX=maxX-minX||1,rangeY=maxY-minY||1,scale=Math.min(w*.70/rangeX,h*.82/rangeY),usedW=rangeX*scale,usedH=rangeY*scale,left=x+(w-usedW)/2,top=y+(h-usedH)/2;
  return source.map(([px,py])=>[left+(px-minX)*scale,top+(py-minY)*scale]);
}

function drawBackgroundStars(ctx,name,x,y,w,h) {
  const random=seeded(name,"background"),count=20+Math.floor(random()*11);ctx.save();
  for(let index=0;index<count;index++){const px=x+random()*w,py=y+random()*h,radius=random()>.88?.7:.38;ctx.fillStyle=`rgba(199,225,226,${.025+random()*.07})`;ctx.beginPath();ctx.arc(px,py,radius,0,Math.PI*2);ctx.fill()}
  ctx.restore();
}

function magnitudeTiers(name) {
  const ordered=MAGNITUDES[name].map((magnitude,index)=>({magnitude,index})).sort((a,b)=>a.magnitude-b.magnitude),bright=Math.max(1,Math.ceil(ordered.length*.24)),mid=Math.max(1,Math.ceil(ordered.length*.44));
  return Object.fromEntries(ordered.map((item,rank)=>[item.index,rank<bright?"bright":rank<bright+mid?"mid":"faint"]));
}

export function drawSkyGlyph(ctx,name,collected,x,y,w,h,options={}) {
  const points=cardPoints(name,x,y,w,h),owned=new Set(collected),complete=owned.size===6,untouched=owned.size===0,large=options.large!==false,panel=options.panel===true,reveal=options.revealProgress??1;
  if(options.background!==false)drawBackgroundStars(ctx,name,x,y,w,h);
  ctx.save();ctx.lineCap="round";ctx.lineJoin="round";ctx.lineWidth=panel?2.5:large?1.5:.9;
  if(complete){const halo=ctx.createRadialGradient(x+w/2,y+h/2,0,x+w/2,y+h/2,Math.max(w,h)*.48);halo.addColorStop(0,"rgba(218,190,139,.055)");halo.addColorStop(.55,"rgba(132,190,193,.035)");halo.addColorStop(1,"rgba(80,130,140,0)");ctx.fillStyle=halo;ctx.fillRect(x,y,w,h)}
  if(!untouched)for(let index=0;index<6;index++){
    if(index/6>reveal)continue;
    const a=routePoint(points,index/6),b=routePoint(points,(index+1)/6),has=owned.has(LETTERS[index]);ctx.setLineDash(has?[]:(panel?[2.5,6]:large?[2,5]:[1,3]));
    ctx.strokeStyle=has?`rgba(255,242,218,${panel?1:complete?.78:.68})`:`rgba(188,215,215,${panel?.30:.25})`;ctx.shadowColor=has?(panel?"rgba(255,226,173,.62)":"rgba(239,218,177,.24)"):"transparent";ctx.shadowBlur=has?(panel?9:large?5:2):0;
    ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();
  }
  ctx.setLineDash([]);ctx.shadowBlur=0;const tiers=magnitudeTiers(name);
  for(const [index,[px,py]] of points.entries()){
    if(index/Math.max(1,points.length-1)>reveal)continue;
    const tier=tiers[index],alpha=untouched?.28:complete?.92:.78;
    if(tier==="bright"){
      const glowRadius=panel?10:large?7:3,starRadius=panel?3:large?2.05:1.05,glow=ctx.createRadialGradient(px,py,0,px,py,glowRadius);glow.addColorStop(0,`rgba(255,243,218,${panel?.72:alpha*.48})`);glow.addColorStop(.25,`rgba(235,241,231,${panel?.34:alpha*.22})`);glow.addColorStop(1,"rgba(190,220,222,0)");ctx.fillStyle=glow;ctx.beginPath();ctx.arc(px,py,glowRadius,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=`rgba(255,248,230,${panel?1:alpha})`;ctx.beginPath();ctx.arc(px,py,starRadius,0,Math.PI*2);ctx.fill();
      if(large){ctx.strokeStyle=`rgba(248,239,218,${alpha*.28})`;ctx.lineWidth=.65;ctx.beginPath();ctx.moveTo(px-4,py);ctx.lineTo(px+4,py);ctx.moveTo(px,py-4);ctx.lineTo(px,py+4);ctx.stroke()}
    } else if(tier==="mid"){
      ctx.shadowColor=panel?"rgba(255,235,200,.42)":"rgba(207,231,231,.24)";ctx.shadowBlur=panel?4:large?2.5:1;ctx.fillStyle=`rgba(239,244,232,${panel?.94:alpha*.82})`;ctx.beginPath();ctx.arc(px,py,panel?2:large?1.25:.7,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    } else if(panel){ctx.fillStyle="rgba(226,237,229,.78)";ctx.beginPath();ctx.arc(px,py,2,0,Math.PI*2);ctx.fill()}else{ctx.fillStyle=`rgba(216,232,232,${alpha*.68})`;ctx.fillRect(Math.round(px),Math.round(py),1,1)}
  }
  ctx.restore();
}

export function skyInventory(fragments=[]) {
  return Object.fromEntries(SKY_NAMES.map(name=>[name,fragments.filter(item=>item.constellation===name).map(item=>item.fragment)]));
}

export function skyPanelModel(fragments=[],lockedConstellation=null) {
  const inventory=skyInventory(fragments),counts=Object.fromEntries(SKY_NAMES.map(name=>[name,inventory[name].length])),latestIncomplete=[...fragments].reverse().find(item=>counts[item.constellation]>0&&counts[item.constellation]<6)?.constellation??null,current=lockedConstellation&&counts[lockedConstellation]===6?lockedConstellation:latestIncomplete;
  return {fragments,inventory,current,counts,ringed:SKY_NAMES.filter(name=>counts[name]===6),caption:current?(counts[current]===6?`${current}, complete`:`${current}, ${counts[current]} of 6`):null};
}

export function skyMomentTransition(fragments=[],settled=true,lockedConstellation=null) {
  const before=skyPanelModel(fragments.slice(0,-1),lockedConstellation),after=skyPanelModel(fragments,lockedConstellation);
  return {before,after,rendered:settled?after:before};
}

export function updateSkyDisplayLock(lock,state) {
  const streamId=state?.currentStream?.id??null;
  if(lock&&streamId&&lock.streamId!==streamId)lock=null;
  if(!lock&&streamId){const recent=state?.skyFragments?.at(-1),count=recent?state.skyFragments.filter(item=>item.constellation===recent.constellation).length:0;if(recent?.streamId===streamId&&count===6)lock={streamId,constellation:recent.constellation}}
  return lock;
}

export function drawSkyPanel(ctx,fragmentsOrModel,x,y,w,h,enlarged=false) {
  const model=Array.isArray(fragmentsOrModel)?skyPanelModel(fragmentsOrModel):fragmentsOrModel,inventory=model.inventory,current=model.current;
  ctx.save();const backingX=x+w*.50,backingY=y+h*.48,backingRadius=w*.70,backing=ctx.createRadialGradient(backingX,backingY,w*.06,backingX,backingY,backingRadius);backing.addColorStop(0,"rgba(1,7,12,.94)");backing.addColorStop(.62,"rgba(1,7,12,.58)");backing.addColorStop(.88,"rgba(1,7,12,.16)");backing.addColorStop(1,"rgba(1,7,12,0)");ctx.fillStyle=backing;ctx.fillRect(backingX-backingRadius,backingY-backingRadius,backingRadius*2,backingRadius*2);ctx.fillStyle="rgba(2,9,15,.72)";ctx.beginPath();ctx.roundRect(x,y,w,h,18);ctx.fill();ctx.strokeStyle="rgba(225,235,226,.10)";ctx.lineWidth=1;ctx.stroke();
  const arcLeft=current?x+w*.60:x+w*.12,arcWidth=current?w*.32:w*.76,centerX=arcLeft+arcWidth/2,centerY=y+h*.70,radiusX=arcWidth/2,radiusY=h*.34;
  for(const [index,name] of SKY_NAMES.entries()){
    const count=inventory[name].length,angle=Math.PI+(index/(SKY_NAMES.length-1))*Math.PI,px=centerX+Math.cos(angle)*radiusX,py=centerY+Math.sin(angle)*radiusY;
    ctx.fillStyle=count===6?"rgba(255,241,215,.92)":count>0?"rgba(224,238,232,.62)":"rgba(190,215,214,.22)";
    ctx.shadowColor=count===6?"rgba(255,224,172,.48)":"transparent";ctx.shadowBlur=count===6?7:0;ctx.beginPath();ctx.arc(px,py,count===6?3.5:count>0?3:2,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    if(count===6){ctx.strokeStyle="rgba(248,228,192,.58)";ctx.lineWidth=1;ctx.beginPath();ctx.arc(px,py,6,0,Math.PI*2);ctx.stroke()}
  }
  if(current){const glyphX=x+12,glyphY=y+8,glyphW=w*.57,glyphH=h-40;drawSkyGlyph(ctx,current,inventory[current],glyphX,glyphY,glyphW,glyphH,{large:true,panel:true,background:false});ctx.fillStyle="rgba(246,241,226,.92)";ctx.font='600 16px "Space Grotesk",system-ui,sans-serif';ctx.textAlign="center";ctx.fillText(model.caption,glyphX+glyphW/2,y+h-10)}
  ctx.restore();
}

export function skyPanelTransitionAt(fragments=[],now=Date.now(),moments="normal",reducedMotion=false,displayLock=null,completionDelay=1250,recentMomentAt=undefined) {
  const recent=fragments.at(-1),rawMomentAt=recentMomentAt===null?"9999-12-31T23:59:59Z":recentMomentAt??recent?.earnedAt,momentAt=typeof rawMomentAt==="number"?new Date(rawMomentAt).toISOString():rawMomentAt,finalCount=recent?fragments.filter(item=>item.constellation===recent.constellation).length:0,isComplete=finalCount===6,fragmentFrame=recent?fragmentMomentFrame(momentAt,now,reducedMotion):null,completionAt=recent?new Date(Date.parse(momentAt)+completionDelay).toISOString():null,completionFrame=recent&&isComplete?completionMomentFrame(completionAt,now,moments,reducedMotion):null;
  const holdRecent=isComplete&&moments!=="quiet"&&!reducedMotion?!completionFrame?.settled:!fragmentFrame?.settled;
  return {recent,isComplete,fragmentFrame,completionFrame,transition:skyMomentTransition(fragments,!holdRecent,displayLock?.constellation??null)};
}

export function drawSkyOverlay(ctx,state,width,height,openingActive,now,layout="bottom",moments="normal",reducedMotion=false,displayLock=null,completionDelay=1250,openingPulse=0,progress=null,recentMomentAt=undefined) {
  const fragments=state?.skyFragments??[],{recent,isComplete,fragmentFrame,completionFrame,transition}=skyPanelTransitionAt(fragments,now,moments,reducedMotion,displayLock,completionDelay,recentMomentAt);
  const enlarged=Boolean(openingActive&&recent),panelW=enlarged?620:SKY_PANEL_SIZE.width,panelH=enlarged?220:SKY_PANEL_SIZE.height-50,x=width-panelW-28,y=22;
  drawSkyPanel(ctx,transition.rendered,x,y,panelW,panelH,enlarged);
  drawSkyProgress(ctx,progress,x,y+panelH,panelW);
  if(openingPulse>0){ctx.save();ctx.strokeStyle=`rgba(239,222,188,${openingPulse*.22})`;ctx.lineWidth=1.5;ctx.shadowColor="rgba(239,222,188,.25)";ctx.shadowBlur=12*openingPulse;ctx.beginPath();ctx.roundRect(x,y,panelW,panelH,14);ctx.stroke();ctx.restore()}
  if(completionFrame?.active&&completionFrame.crossfade>0&&!completionFrame.settled){ctx.save();ctx.globalAlpha=completionFrame.crossfade;drawSkyPanel(ctx,transition.after,x,y,panelW,panelH,enlarged);ctx.restore()}
  if(completionFrame?.panelPulse>0){ctx.save();const pulse=completionFrame.panelPulse,glow=ctx.createRadialGradient(x+panelW*.28,y+panelH*.45,0,x+panelW*.28,y+panelH*.45,panelW*.42);glow.addColorStop(0,`rgba(248,231,196,${pulse*.16})`);glow.addColorStop(.55,`rgba(151,203,203,${pulse*.08})`);glow.addColorStop(1,"rgba(120,180,185,0)");ctx.fillStyle=glow;ctx.beginPath();ctx.roundRect(x,y,panelW,panelH,14);ctx.fill();ctx.restore()}
  const panelOnly=isComplete&&(moments==="quiet"||reducedMotion);if(recent&&fragmentFrame?.active&&(!isComplete||panelOnly)){
    const baseW=panelW*.57,baseH=panelH-40,scale=fragmentFrame.panelScale,cx=x+12+baseW/2,cy=y+8+baseH/2,collected=transition.after.inventory[recent.constellation];
    ctx.save();ctx.globalAlpha=Math.min(1,.82+fragmentFrame.pulse*.18);ctx.shadowColor="rgba(245,224,184,.42)";ctx.shadowBlur=fragmentFrame.pulse*11;drawSkyGlyph(ctx,recent.constellation,collected,cx-baseW*scale/2,cy-baseH*scale/2,baseW*scale,baseH*scale,{large:true,panel:true,background:false});ctx.restore();
  }
}

export function drawReceiptSky(canvas,collected) {
  if(!canvas)return;const ctx=canvas.getContext("2d"),inventory=skyInventory(collected),w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);
  for(const [i,name] of SKY_NAMES.entries()){const col=i%4,row=Math.floor(i/4),x=col*w/4+12,y=row*h/3+8;drawSkyGlyph(ctx,name,inventory[name],x,y,w/4-24,h/3-26,{large:true});ctx.fillStyle="rgba(235,241,240,.48)";ctx.font="12px system-ui,sans-serif";ctx.textAlign="center";ctx.fillText(`${name} ${inventory[name].length}/6`,x+(w/4-24)/2,y+h/3-12)}
}
