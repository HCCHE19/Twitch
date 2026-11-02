import { describe,expect,it } from "vitest";
// @ts-expect-error Browser module intentionally has no declaration file.
import { skyMomentTransition,skyPanelModel,updateSkyDisplayLock } from "../public/shared/sky.js";
import { momentDemo } from "../src/demo-events.js";

const fragment=(letter:string,index:number)=>({streamId:`s${index}`,constellation:"Leo",fragment:letter,earnedAt:`2026-11-02T00:00:0${index}Z`,litUserIds:[]});

describe("sky panel state fidelity",()=>{
  it("renders the exact server count after every fragment moment settles",()=>{
    const letters=["A","B","C","D","E","F"];
    for(let count=1;count<=6;count++){
      const state=letters.slice(0,count).map(fragment),transition=skyMomentTransition(state,true);
      expect(transition.rendered.counts.Leo).toBe(skyPanelModel(state).counts.Leo);
      expect(transition.rendered.counts.Leo).toBe(count);
    }
  });

  it("keeps a completed constellation fully focused with its completion ring",()=>{
    const state=["A","B","C","D","E","F"].map(fragment),settled=skyMomentTransition(state,true,"Leo").rendered;
    expect(settled.current).toBe("Leo");expect(settled.inventory.Leo).toEqual(["A","B","C","D","E","F"]);expect(settled.counts.Leo).toBe(6);expect(settled.ringed).toContain("Leo");expect(settled.caption).toBe("Leo, complete");
  });

  it("locks the completed constellation until a different stream comes online",()=>{
    const fragments=["A","B","C","D","E","F"].map((letter,index)=>({...fragment(letter,index),streamId:"stream-6"}));
    let lock=updateSkyDisplayLock(null,{currentStream:{id:"stream-6"},skyFragments:fragments});expect(lock).toEqual({streamId:"stream-6",constellation:"Leo"});
    lock=updateSkyDisplayLock(lock,{currentStream:null,skyFragments:fragments});expect(lock?.constellation).toBe("Leo");
    lock=updateSkyDisplayLock(lock,{currentStream:{id:"stream-7"},skyFragments:fragments});expect(lock).toBeNull();
  });

  it("transitions only between the real previous and current server arrays",()=>{
    const state=[fragment("A",1),fragment("B",2),fragment("C",3)];
    const pending=skyMomentTransition(state,false),settled=skyMomentTransition(state,true);
    expect(pending.rendered.counts.Leo).toBe(2);expect(settled.rendered.counts.Leo).toBe(3);
    expect(pending.before.fragments).toEqual(state.slice(0,-1));expect(settled.after.fragments).toEqual(state);
  });

  it("gives fragment demo one real fragment and completion demo five plus the sixth",()=>{
    const fragmentEvents=momentDemo("fragment").filter(event=>event.metadata.subscription_type==="lamplight.sky.fragment");
    expect(fragmentEvents.map(event=>(event.payload.event as Record<string,unknown>).fragment)).toEqual(["A"]);
    const completionEvents=momentDemo("complete").filter(event=>event.metadata.subscription_type==="lamplight.sky.fragment");
    expect(completionEvents.map(event=>(event.payload.event as Record<string,unknown>).fragment)).toEqual(["A","B","C","D","E","F"]);
  });
});
