import { describe,expect,it } from "vitest";
// @ts-expect-error Browser module intentionally has no declaration file.
import { completionMomentFrame,fragmentMomentFrame,igniteFrame } from "../public/shared/moments.js";

const start="2026-11-02T00:00:00Z",at=(ms:number)=>Date.parse(start)+ms;
describe("overlay moments",()=>{
  it("finishes ignite within one second and provides a reduced-motion fallback",()=>{
    expect(igniteFrame(start,at(0),false).yOffset).toBeLessThan(0);expect(igniteFrame(start,at(600),false).bloom).toBeGreaterThan(0);expect(igniteFrame(start,at(1000),false).active).toBe(false);
    expect(igniteFrame(start,at(200),true)).toMatchObject({yOffset:0,ripple:0,nudge:0});
    expect(igniteFrame(start,at(400),false,"quiet")).toMatchObject({yOffset:0,bloom:0,nudge:0});
  });
  it("settles a fragment in the panel without a frame-level animation",()=>{
    expect(fragmentMomentFrame(start,at(300),false).sweep).toBeGreaterThan(0);expect(fragmentMomentFrame(start,at(450),false).panelScale).toBe(1.5);expect(fragmentMomentFrame(start,at(1250),false).active).toBe(false);
  });
  it("keeps quiet completion out of the frame and caps normal/big height",()=>{
    expect(completionMomentFrame(start,at(1000),"quiet",false).active).toBe(false);expect(completionMomentFrame(start,at(1000),"normal",false).maxHeight).toBeCloseTo(1/3);expect(completionMomentFrame(start,at(1000),"big",false).maxHeight).toBe(.5);
    expect(completionMomentFrame(start,at(3050),"normal",false).reveal).toBe(1);expect(completionMomentFrame(start,at(4050),"normal",false).active).toBe(false);
  });
});
