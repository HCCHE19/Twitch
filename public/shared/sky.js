// Numeric sky positions are selected from d3-celestial's constellation line data
// (BSD-3-Clause): https://github.com/ofrohn/d3-celestial/blob/master/data/constellations.lines.json
// Lamplight normalizes those real positions and generates its own six-region line style.
export const SKY_NAMES = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpius","Sagittarius","Capricornus","Aquarius","Pisces"];
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

function normalized(name) {
  const points=RAW[name]; let xs=points.map(p=>p[0]);
  if(Math.max(...xs)-Math.min(...xs)>180)xs=xs.map(x=>x<180?x+360:x);
  const ys=points.map(p=>p[1]), minX=Math.min(...xs), maxX=Math.max(...xs), minY=Math.min(...ys), maxY=Math.max(...ys);
  return points.map((p,i)=>[(xs[i]-minX)/(maxX-minX||1),(maxY-p[1])/(maxY-minY||1)]);
}

function routePoint(points,t) {
  const lengths=points.slice(1).map((p,i)=>Math.hypot(p[0]-points[i][0],p[1]-points[i][1]));
  const total=lengths.reduce((a,b)=>a+b,0); let target=t*total;
  for(let i=0;i<lengths.length;i++){if(target<=lengths[i]){const u=lengths[i]?target/lengths[i]:0;return [points[i][0]+(points[i+1][0]-points[i][0])*u,points[i][1]+(points[i+1][1]-points[i][1])*u]}target-=lengths[i]}
  return points.at(-1);
}

function drawGlyph(ctx,name,collected,x,y,w,h,options={}) {
  const points=normalized(name), owned=new Set(collected), complete=owned.size===6, untouched=owned.size===0;
  const map=([px,py])=>[x+5+px*(w-10),y+5+py*(h-10)];
  ctx.save(); ctx.lineCap="round"; ctx.lineWidth=options.large?1.5:1;
  for(let index=0;index<6;index++){
    const a=map(routePoint(points,index/6)),b=map(routePoint(points,(index+1)/6)),has=owned.has(LETTERS[index]);
    ctx.setLineDash(has?[]:[2,3]); ctx.strokeStyle=`rgba(230,240,242,${has?(complete?.2:.17):.045})`;
    ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();
  }
  ctx.setLineDash([]); ctx.fillStyle=`rgba(240,246,245,${untouched?.07:.14})`;
  for(const point of points){const [px,py]=map(point);ctx.beginPath();ctx.arc(px,py,options.large?1.7:1,0,Math.PI*2);ctx.fill()}
  ctx.restore();
}

export function skyInventory(fragments=[]) {
  return Object.fromEntries(SKY_NAMES.map(name=>[name,fragments.filter(item=>item.constellation===name).map(item=>item.fragment)]));
}

export function drawSkyOverlay(ctx,state,width,height,openingActive,now,layout="bottom") {
  const fragments=state?.skyFragments??[], recent=fragments.at(-1),age=recent?now-Date.parse(recent.earnedAt):Infinity;
  const animating=age>=0&&age<2000, inventory=skyInventory(animating?fragments.slice(0,-1):fragments);
  const enlarged=openingActive&&recent; const panelW=enlarged?260:180,panelH=enlarged?150:80,x=width-panelW-22,y=18;
  ctx.save();ctx.fillStyle="rgba(3,8,12,.24)";ctx.beginPath();ctx.roundRect(x,y,panelW,panelH,12);ctx.fill();
  if(enlarged){drawGlyph(ctx,recent.constellation,inventory[recent.constellation],x+25,y+18,panelW-50,panelH-48,{large:true});ctx.fillStyle="rgba(235,241,240,.65)";ctx.font='500 13px "Space Grotesk",system-ui,sans-serif';ctx.textAlign="center";ctx.fillText(`${recent.constellation}, ${inventory[recent.constellation].length} of 6`,x+panelW/2,y+panelH-13)}
  else for(const [i,name] of SKY_NAMES.entries()){const angle=Math.PI+(i/(SKY_NAMES.length-1))*Math.PI,gx=x+panelW/2+Math.cos(angle)*panelW*.41,gy=y+panelH*.69+Math.sin(angle)*panelH*.42;drawGlyph(ctx,name,inventory[name],gx-11,gy-8,22,16)}
  if(recent&&animating){const finalCount=fragments.filter(item=>item.constellation===recent.constellation).length,complete=finalCount===6,t=Math.max(0,Math.min(1,(age-1200)/800)),ease=t*t*(3-2*t);const sx=width*.22,sy=layout==="top"?height*.18:height*.76,sw=width*.56,sh=Math.min(120,height*.12),tx=x+panelW*.42,ty=y+panelH*.32,tw=panelW*.16,th=panelH*.22;const lerp=(a,b)=>a+(b-a)*ease;ctx.globalAlpha=(complete?.2:.15)/.2;drawGlyph(ctx,recent.constellation,complete?LETTERS:[recent.fragment],lerp(sx,tx),lerp(sy,ty),lerp(sw,tw),lerp(sh,th),{large:true});ctx.globalAlpha=1}
  ctx.restore();
}

export function drawReceiptSky(canvas,collected) {
  if(!canvas)return;const ctx=canvas.getContext("2d"),inventory=skyInventory(collected),w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);
  for(const [i,name] of SKY_NAMES.entries()){const col=i%4,row=Math.floor(i/4),x=col*w/4+12,y=row*h/3+8;drawGlyph(ctx,name,inventory[name],x,y,w/4-24,h/3-26,{large:true});ctx.fillStyle="rgba(235,241,240,.48)";ctx.font="12px system-ui,sans-serif";ctx.textAlign="center";ctx.fillText(`${name} ${inventory[name].length}/6`,x+(w/4-24)/2,y+h/3-12)}
}
