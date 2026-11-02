import type { EventSubEnvelope } from "./types.js";

export function retimeDemoEnvelope(envelope: EventSubEnvelope, replayStart: number, sourceStart: number, speed = 1): EventSubEnvelope {
  const timestamp = new Date(replayStart + (Date.parse(envelope.metadata.message_timestamp) - sourceStart) / speed).toISOString();
  const event = { ...(envelope.payload.event ?? {}) };
  if (["stream.online", "lamplight.stream.recovered"].includes(envelope.metadata.subscription_type ?? "") && typeof event.started_at === "string") {
    const startedAt = Date.parse(event.started_at);
    if (Number.isFinite(startedAt)) event.started_at = new Date(replayStart + (startedAt - sourceStart) / speed).toISOString();
  }
  return { ...envelope, metadata: { ...envelope.metadata, message_timestamp: timestamp }, payload: { ...envelope.payload, event } };
}

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

export function nightDemo(): EventSubEnvelope[] {
  const envelopes: EventSubEnvelope[] = [], base = Date.UTC(2026, 10, 2, 0, 0, 0); let sequence = 0;
  const push = (second: number, type: string, event: Record<string, unknown>): void => { envelopes.push({ metadata: { message_id: `night-${sequence++}`, message_type: type.startsWith("lamplight.") ? "internal" : "notification", message_timestamp: new Date(base + second * 1_000).toISOString(), subscription_type: type }, payload: { event } }); };
  const identity = (name: string): { id: string; login: string; display: string } => ({ id: `night-${name.toLocaleLowerCase().replace(/[^a-z0-9]+/gu, "-")}`, login: name.toLocaleLowerCase().replace(/[^a-z0-9]+/gu, "_"), display: name });
  const chat = (second: number, name: string, text: string, kind: "text" | "emote" = "text"): void => { const person = identity(name); push(second, "channel.chat.message", { chatter_user_id: person.id, chatter_user_login: person.login, chatter_user_name: person.display, message: { text, fragments: [{ type: kind, text }] } }); };
  const online = (second: number, id: string): void => push(second, "stream.online", { id, started_at: new Date(base + second * 1_000).toISOString() });
  const offline = (second: number): void => push(second, "stream.offline", { broadcaster_user_login: "demo_broadcaster" });
  const fragment = (second: number, streamId: string, letter: string, names: string[]): void => push(second, "lamplight.sky.fragment", { stream_id: streamId, constellation: "Leo", fragment: letter, lit_user_ids: names.map((name) => identity(name).id) });
  const tied = (second: number, streamId: string, left: string, right: string): void => push(second, "lamplight.thread.tied", { stream_id: streamId, user_id_a: identity(left).id, user_id_b: identity(right).id });
  const priorStreams = [
    { id: "night-prior-1", start: 0, names: ["Kira", "Noor", "Avery"] }, { id: "night-prior-2", start: 8, names: ["Kira", "Mei", "Noor"] },
    { id: "night-prior-3", start: 16, names: ["Kira", "Mei", "Avery"] }, { id: "night-prior-4", start: 24, names: ["Kira", "Mei", "Noor"] },
    { id: "night-prior-5", start: 32, names: ["Kira", "Mei", "Alex", "Priya"] }
  ];
  for (const [index, stream] of priorStreams.entries()) {
    online(stream.start, stream.id); stream.names.forEach((name, offset) => chat(stream.start + 1 + offset, name, offset % 2 ? "LUL" : "!lamp", offset % 2 ? "emote" : "text"));
    if (index === 0) { tied(stream.start + 4, stream.id, "Kira", "Noor"); tied(stream.start + 4, stream.id, "Kira", "Avery"); }
    if (index === 1) tied(stream.start + 4, stream.id, "Kira", "Mei");
    fragment(stream.start + 5, stream.id, ["A", "B", "C", "D", "E"][index]!, stream.names);
    if (index === 4) { chat(stream.start + 5, "Kira", "!back"); chat(stream.start + 5, "Alex", "!back"); chat(stream.start + 5, "Priya", "!back"); }
    offline(stream.start + 7);
  }
  const currentId = "night-main"; online(42, currentId);
  const arrivals: Array<[number, string, string, "text" | "emote"]> = [
    [43,"Kira","!lamp","text"],[44,"Alex","!lurk","text"],[45,"Noor","✨","text"],[46,"Avery","LUL","emote"],[47,"Riley","!lamp","text"],[48,"Morgan","🌙","text"],[49,"Jun","!lurk","text"],[50,"Hana","Kappa","emote"],
    [58,"Sol","!lamp","text"],[64,"Cam","🔥","text"],[71,"Harper","!lurk","text"],[79,"Rowan","LUL","emote"],[87,"Diego","!lamp","text"],[94,"Amara","🌿","text"],[101,"Yusuf","!lurk","text"],[108,"Leila","Kappa","emote"],
    [116,"Kenji","!lamp","text"],[123,"Sasha","💫","text"],[131,"Nia","!lurk","text"],[138,"Theo","LUL","emote"],[146,"Mina","!lamp","text"],[153,"Luca","🌸","text"],[161,"Zuri","!lurk","text"],[168,"Elena","Kappa","emote"],
    [176,"Omar","!lamp","text"],[181,"Freya","🕯️","text"],[185,"Bao","!lurk","text"],[185,"Chika","LUL","emote"]
  ];
  for (const [second, name, text, kind] of arrivals) chat(second, name, text, kind);
  chat(100, "Riley", "!tie @Morgan"); chat(101, "Morgan", "!tie Riley"); chat(112, "Jun", "!tie"); chat(113, "Hana", "!tie Jun");
  chat(140, "Sol", "!tie Cam"); chat(141, "Cam", "!tie @Sol"); chat(185, "Harper", "!tie Rowan"); chat(155, "Riley", "!untie Morgan");
  fragment(185, currentId, "F", ["Kira", "Alex", "Noor", "Avery", "Bao", "Chika"]);
  for (const [offset, name] of ["Kira", "Alex", "Noor", "Avery", "Riley"].entries()) chat(195 + offset, name, "LUL", "emote");
  for (const [offset, name] of ["Kira", "Alex", "Noor", "Avery", "Morgan", "Jun"].entries()) chat(205 + offset * 2, name, "!back");
  chat(218, "demo_broadcaster", "!closing"); chat(229, "Alex", "Kappa", "emote"); offline(230);
  return envelopes.sort((left, right) => Date.parse(left.metadata.message_timestamp) - Date.parse(right.metadata.message_timestamp));
}
