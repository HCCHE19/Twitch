import type { EventSubEnvelope } from "./types.js";

export function momentDemo(kind: "ignite" | "fragment" | "complete"): EventSubEnvelope[] {
  const envelopes: EventSubEnvelope[]=[];let sequence=0;
  const push=(type:string,event:Record<string,unknown>,second:number):void=>{envelopes.push({metadata:{message_id:`moment-${kind}-${sequence++}`,message_type:type.startsWith("lamplight.")?"internal":"notification",message_timestamp:new Date(Date.UTC(2026,10,2,0,0,second)).toISOString(),subscription_type:type},payload:{event}})};
  if(kind==="complete")for(const letter of ["A","B","C","D","E"])push("lamplight.sky.fragment",{stream_id:`prior-${letter}`,constellation:"Leo",fragment:letter,lit_user_ids:[]},0);
  push("stream.online",{id:`moment-${kind}-stream`,started_at:new Date(Date.UTC(2026,10,2,0,0,0)).toISOString()},0);
  const demoIds=["moment-viewer-1","moment-viewer-2","moment-viewer-4"];
  for(let index=1;index<=3;index++)push("channel.chat.message",{chatter_user_id:demoIds[index-1],chatter_user_login:`moment_${index}`,chatter_user_name:`Moment ${index}`,message:{text:"!lamp",fragments:[{type:"text",text:"!lamp"}]}},index);
  if(kind!=="ignite")push("lamplight.sky.fragment",{stream_id:`moment-${kind}-stream`,constellation:"Leo",fragment:kind==="complete"?"F":"A",lit_user_ids:demoIds},4);
  return envelopes;
}
