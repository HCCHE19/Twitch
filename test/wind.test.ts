import { describe, expect, it } from "vitest";
// @ts-expect-error Browser module intentionally has no declaration file.
import { updateWindTracker, windLean } from "../public/shared/wind.js";

const empty={streamId:null,startedAt:null,lastTriggeredAt:null,signature:"",direction:1};

describe("wind",()=>{
  it("does nothing while WIND is off",()=>{
    const flares=Object.fromEntries(["a","b","c","d","e"].map((id)=>[id,"2026-11-02T00:00:09Z"]));
    const tracker=updateWindTracker(empty,"s",flares,Date.parse("2026-11-02T00:00:10Z"),false);
    expect(tracker.startedAt).toBeNull();expect(windLean(tracker,Date.parse("2026-11-02T00:00:10.5Z"))).toBe(0);
  });

  it("requires five different recent viewers and respects the ten-second cooldown",()=>{
    const now=Date.parse("2026-11-02T00:00:10Z");
    const four=Object.fromEntries(["a","b","c","d"].map((id)=>[id,"2026-11-02T00:00:09Z"]));
    expect(updateWindTracker(empty,"s",four,now,true).startedAt).toBeNull();
    const five={...four,e:"2026-11-02T00:00:09.5Z"};const fired=updateWindTracker(empty,"s",five,now,true);
    expect(fired.startedAt).toBe(now);expect(Math.abs(windLean(fired,now+500))).toBeGreaterThan(.1);
    const six={...five,f:"2026-11-02T00:00:10.5Z"};expect(updateWindTracker(fired,"s",six,now+1000,true).startedAt).toBe(now);
  });
});
