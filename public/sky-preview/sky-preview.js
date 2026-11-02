import { drawSkyGlyph, SKY_NAMES } from "/shared/sky.js";

const all=["A","B","C","D","E","F"];

function canvasFor(name,collected,width,height,large=true){
  const canvas=document.createElement("canvas"),ratio=Math.min(2,devicePixelRatio||1);
  canvas.width=width*ratio;canvas.height=height*ratio;
  const context=canvas.getContext("2d");context.scale(ratio,ratio);
  const inset=large?12:2;
  drawSkyGlyph(context,name,collected,inset,large?3:1,width-inset*2,height-(large?6:2),{large});
  return canvas;
}

function card(name,canvas,className="glyph-card",label=name){
  const element=document.createElement("article");element.className=className;element.append(canvas);
  const caption=document.createElement("div");caption.className="name";caption.textContent=label;element.append(caption);return element;
}

for(const name of SKY_NAMES)document.querySelector("#receipt-grid").append(card(name,canvasFor(name,all,180,60)));
for(const name of SKY_NAMES)document.querySelector("#tiny-grid").append(card(name,canvasFor(name,all,22,16,false),"tiny-card"));
for(const state of [{label:"Untouched",fragments:[]},{label:"Three of six",fragments:["A","B","C"]},{label:"Complete",fragments:all}])document.querySelector("#states").append(card("Leo",canvasFor("Leo",state.fragments,180,70),"state-card",state.label));
