import { expect, it } from "vitest";
import { autoThreshold, resolveThreshold, thresholdEnvelope } from "../src/sky-threshold.js";
import { emptyState, reduceEnvelope } from "../src/presence.js";
import { makeLedgerEntry, rebuildState } from "../src/ledger.js";
import type { EventSubEnvelope, LedgerEntry } from "../src/types.js";
// @ts-expect-error Browser helper intentionally has no declaration file.
import { skyProgressFrame } from "../public/shared/sky-progress.js";

it("uses the last five attendance counts, their median, rounding, floor and no-history default", () => {
  expect(autoThreshold([])).toBe(10);
  expect(autoThreshold([0, 1, 2])).toBe(3);
  expect(autoThreshold([1000, 10, 20, 30, 40, 50])).toBe(12);
  expect(autoThreshold([10, 15])).toBe(5);
  expect(autoThreshold([19])).toBe(8);
});

it("locks the threshold for the stream and preserves it on ledger rebuild", () => {
  const state=emptyState(), entries: LedgerEntry[]=[], options={broadcasterLogin:"host"};
  const apply=(event:EventSubEnvelope)=>{ entries.push(makeLedgerEntry(event,entries.at(-1)?.hash??""));reduceEnvelope(state,event,options); };
  const online:EventSubEnvelope={metadata:{message_id:"online",message_type:"notification",subscription_type:"stream.online",message_timestamp:"2026-11-02T00:00:00Z"},payload:{event:{id:"s1"}}};
  apply(online);apply(thresholdEnvelope(state,3,online.metadata.message_timestamp)!);
  expect(state.currentStream?.thresholdN).toBe(3);
  expect(thresholdEnvelope(state,"auto",online.metadata.message_timestamp)).toBeNull();
  expect(thresholdEnvelope(state,20,online.metadata.message_timestamp)).toBeNull();
  apply({...online,metadata:{...online.metadata,message_id:"online-duplicate"}});
  expect(state.currentStream?.thresholdN).toBe(3);
  expect(rebuildState(entries,options).currentStream).toEqual(state.currentStream);
  apply({...online,metadata:{...online.metadata,message_id:"offline",subscription_type:"stream.offline"},payload:{event:{}}});
  expect(resolveThreshold(state,"auto")).toBe(3); // Empty completed streams count as zero.
  apply({...online,metadata:{...online.metadata,message_id:"online-2"},payload:{event:{id:"s2"}}});
  apply(thresholdEnvelope(state,20,online.metadata.message_timestamp)!);
  expect(state.currentStream?.thresholdN).toBe(20);
});

it("freezes the auto value even if attendance or settings change during the stream", () => {
  const state=emptyState(), options={broadcasterLogin:"host"};
  state.currentStream={id:"s",startedAt:"2026-11-02T00:00:00Z",litUserIds:[]};
  reduceEnvelope(state,thresholdEnvelope(state,"auto",state.currentStream.startedAt)!,options);
  expect(state.currentStream.thresholdN).toBe(10);
  state.completedStreamIds=["prior"];
  expect(resolveThreshold(state,"auto")).toBe(3);
  expect(thresholdEnvelope(state,"auto",state.currentStream.startedAt)).toBeNull();
  expect(thresholdEnvelope(state,30,state.currentStream.startedAt)).toBeNull();
  expect(state.currentStream.thresholdN).toBe(10);
});

it("counts only landed lamps, doubles kept promises once, fills then resets on earning", () => {
  const state={currentStream:{id:"s",litUserIds:["a","b"]},promiseKeptUserIds:["b"],skyFragments:[] as unknown[]};
  let frame=skyProgressFrame(null,state,[],3,0);expect(frame.count).toBe(0);
  frame=skyProgressFrame(frame.tracker,state,["a"],3,350);expect(frame.count).toBe(1);
  frame=skyProgressFrame(frame.tracker,state,["a","b"],3,700);expect(frame.count).toBe(3);expect(frame.bonus).toBe(1);
  frame=skyProgressFrame(frame.tracker,state,["a","b"],3,800);expect(frame.count).toBe(3);
  state.skyFragments=[{streamId:"s",litUserIds:["a","b"]}];
  frame=skyProgressFrame(frame.tracker,state,["a","b"],3,900);expect(frame.fill).toBe(1);
  frame=skyProgressFrame(frame.tracker,state,["a","b"],3,1500);expect(frame.flash).toBe(1);
  frame=skyProgressFrame(frame.tracker,state,["a","b"],3,2100);expect(frame.count).toBe(0);
  expect(skyProgressFrame(frame.tracker,state,["a","b"],3,2200,true).visible).toBe(false);
});

it("waits for fragment contributors to land and suppresses animation in reduced motion", () => {
  const state={currentStream:{id:"s",litUserIds:["a"]},promiseKeptUserIds:["a"],skyFragments:[{streamId:"s",litUserIds:["a"]}]};
  let frame=skyProgressFrame(null,state,[],3,0);expect(frame.count).toBe(0);expect(frame.tracker.earnedAt).toBeNull();
  frame=skyProgressFrame(frame.tracker,state,["a"],3,350,false,true);expect(frame.fill).toBe(1);expect(frame.bonus).toBe(0);expect(frame.flash).toBe(0);
  expect(skyProgressFrame(frame.tracker,{...state,currentStream:{id:"next",litUserIds:[]}},[],3,500).count).toBe(0);
});
