import { describe,expect,it } from "vitest";
import { emptyState,reduceEnvelope } from "../src/presence.js";
// @ts-expect-error Browser module intentionally has no declaration file.
import { completionMomentFrame,fragmentMomentFrame,igniteFrame } from "../public/shared/moments.js";

const start="2026-11-02T00:00:00Z",at=(ms:number)=>Date.parse(start)+ms;
describe("overlay moments",()=>{
  it("finishes ignite within one second and provides a reduced-motion fallback",()=>{
    expect(igniteFrame(start,at(0),false).yOffset).toBeCloseTo(-1.05);expect(igniteFrame(start,at(175),false).yOffset).toBeLessThan(-.7);expect(igniteFrame(start,at(350),false).yOffset).toBeCloseTo(0);
    expect(igniteFrame(start,at(430),false).scaleY).toBeLessThan(.94);expect(igniteFrame(start,at(600),false).bloom).toBeGreaterThan(0);expect(igniteFrame(start,at(1000),false).active).toBe(false);
    expect(igniteFrame(start,at(200),true)).toMatchObject({yOffset:0,scaleY:1,ripple:0,nudge:0});
    expect(igniteFrame(start,at(400),false,"quiet")).toMatchObject({yOffset:0,scaleY:1,bloom:0,nudge:0});
  });
  it("uses the same last-lit timestamp after a replayed or real chat event",()=>{
    const state=emptyState(true),online={metadata:{message_id:"online",message_type:"notification",message_timestamp:start,subscription_type:"stream.online"},payload:{event:{id:"s",started_at:start}}},chat={metadata:{message_id:"chat",message_type:"notification",message_timestamp:new Date(at(1000)).toISOString(),subscription_type:"channel.chat.message"},payload:{event:{chatter_user_id:"viewer",chatter_user_login:"viewer",chatter_user_name:"Viewer",message:{text:"!lamp",fragments:[{type:"text",text:"!lamp"}]}}}};
    reduceEnvelope(state,online,{broadcasterLogin:"owner"});reduceEnvelope(state,chat,{broadcasterLogin:"owner"});
    const litAt=state.lamps.viewer?.lastLitAt;expect(litAt).toBe(chat.metadata.message_timestamp);expect(igniteFrame(litAt!,at(1000),false,"normal").yOffset).toBeCloseTo(-1.05);
  });
  it("settles a fragment in the panel without a frame-level animation",()=>{
    expect(fragmentMomentFrame(start,at(300),false).sweep).toBeGreaterThan(0);expect(fragmentMomentFrame(start,at(450),false).panelScale).toBe(1.5);expect(fragmentMomentFrame(start,at(1250),false).active).toBe(false);
  });
  it("keeps quiet completion out of the frame and caps normal/big height",()=>{
    expect(completionMomentFrame(start,at(1000),"quiet",false).active).toBe(false);expect(completionMomentFrame(start,at(1000),"normal",false).maxHeight).toBeCloseTo(1/3);expect(completionMomentFrame(start,at(1000),"big",false).maxHeight).toBe(.5);
    expect(completionMomentFrame(start,at(3050),"normal",false).reveal).toBe(1);const handoff=completionMomentFrame(start,at(3900),"normal",false);expect(handoff.crossfade).toBeGreaterThan(0);expect(handoff.travelAlpha).toBeGreaterThan(0);expect(handoff.crossfade+handoff.travelAlpha).toBeCloseTo(1);expect(completionMomentFrame(start,at(4050),"normal",false).active).toBe(false);expect(completionMomentFrame(start,at(4300),"normal",false).panelPulse).toBeCloseTo(1);expect(completionMomentFrame(start,at(4300),"big",false).panelPulse).toBeCloseTo(1);
  });
});
