import { describe,expect,it } from "vitest";
// @ts-expect-error Browser module intentionally has no declaration file.
import { animateRowLayout,arrivalStartTime,reconcileLampOrder,releaseArrivalBatch } from "../public/shared/row-motion.js";
// @ts-expect-error Browser module intentionally has no declaration file.
import { igniteFrame } from "../public/shared/moments.js";
import { generateLamp } from "../src/lamp-generator.js";

const lamp=(userId:string,lastLitAt:string)=>({userId,lastLitAt});
describe("stable row motion",()=>{
  it("keeps arrival order when hues allow it and inserts before the drop when required",()=>{
    const lamps=[lamp("a","2026-11-02T00:00:01Z"),lamp("b","2026-11-02T00:00:02Z"),lamp("c","2026-11-02T00:00:03Z")];
    expect(reconcileLampOrder([],lamps,(item:{userId:string})=>({a:10,b:100,c:200})[item.userId])).toEqual(["a","b","c"]);
    const withEarlierGap=[...lamps,lamp("d","2026-11-02T00:00:04Z")];
    expect(reconcileLampOrder(["a","b","c"],withEarlierGap,(item:{userId:string})=>({a:0,b:100,c:200,d:230})[item.userId])).toEqual(["a","d","b","c"]);
  });

  it("keeps the three moment-demo seeds in arrival order",()=>{
    const demo=[lamp("moment-viewer-1","2026-11-02T00:00:01Z"),lamp("moment-viewer-2","2026-11-02T00:00:02Z"),lamp("moment-viewer-4","2026-11-02T00:00:03Z")];
    expect(reconcileLampOrder([],demo,(item:{userId:string})=>generateLamp(item.userId).hue)).toEqual(demo.map(item=>item.userId));
  });

  it("lands a new lamp at exactly its final slot after neighbours finish opening the gap",()=>{
    const initial=[{lamp:{userId:"a"},x:80,y:950,size:176},{lamp:{userId:"b"},x:230,y:950,size:176}];
    let motion=animateRowLayout(new Map(),initial,0);
    const inserted=[{lamp:{userId:"a"},x:80,y:950,size:176},{lamp:{userId:"c"},x:230,y:950,size:176},{lamp:{userId:"b"},x:380,y:950,size:176}];
    motion=animateRowLayout(motion.tracker,inserted,0);expect(motion.movedExisting).toEqual(["b"]);
    const arrivalStart=arrivalStartTime(0,motion.movedExisting.length>0),landing=arrivalStart+350;
    motion=animateRowLayout(motion.tracker,inserted,landing);
    const landed=motion.items.find((item:{lamp:{userId:string}})=>item.lamp.userId==="c");
    expect(landed.x).toBe(230);expect(igniteFrame(new Date(arrivalStart).toISOString(),landing,false,"normal").yOffset).toBeCloseTo(0);
  });

  it("eases density-tier recomputations over 300ms without jumping",()=>{
    const before=[{lamp:{userId:"a"},x:80,y:950,size:176}],after=[{lamp:{userId:"a"},x:80,y:950,size:123.2}];
    let motion=animateRowLayout(new Map(),before,0);motion=animateRowLayout(motion.tracker,after,10);
    expect(motion.items[0].size).toBe(176);motion=animateRowLayout(motion.tracker,after,160);expect(motion.items[0].size).toBeGreaterThan(123.2);expect(motion.items[0].size).toBeLessThan(176);motion=animateRowLayout(motion.tracker,after,310);expect(motion.items[0].size).toBeCloseTo(123.2);
  });

  it("releases arrivals inside 1.5 seconds as one stable ordered batch",()=>{
    const queued=new Map([["b",{litAt:"2026-11-02T00:00:02Z"}],["a",{litAt:"2026-11-02T00:00:01Z"}],["c",{litAt:"2026-11-02T00:00:03Z"}]]);
    expect(releaseArrivalBatch(queued,1_000,2_499)).toEqual([]);
    expect(releaseArrivalBatch(queued,1_000,2_500).map(([id]:[string,unknown])=>id)).toEqual(["a","b","c"]);
  });
});
