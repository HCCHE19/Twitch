import { once } from "node:events";
import { mkdtemp } from "node:fs/promises";
import { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";
import { describe, expect, it } from "vitest";
import { startOverlayServer } from "../src/overlay-server.js";
import { emptyState } from "../src/presence.js";
import { createSettingsManager } from "../src/settings.js";

describe("overlay server", () => {
  it("serves connected controls in the requested order with the channel name", async () => {
    const overlay=await startOverlayServer(()=>emptyState(),0,"bottom",3,true,false,false,false,"normal",{connected:()=>true,channelLogin:"fictional_channel",createAuthorizationUrl:()=>"https://example.test/authorize"});
    try {
      const base=`http://127.0.0.1:${(overlay.server.address() as AddressInfo).port}`;
      expect(await (await fetch(`${base}/setup/status`)).json()).toMatchObject({connected:true,channelName:"fictional_channel"});
      const response=await fetch(`${base}/control`,{redirect:"manual"});expect(response.status).toBe(200);
      const html=await response.text(), headings=["Connection</h2>","Receipts</h2>","Settings <small","Roll call</h2>"].map(text=>html.indexOf(text));
      expect(headings.every(index=>index>=0)).toBe(true);expect(headings).toEqual([...headings].sort((a,b)=>a-b));
    } finally { await overlay.close(); }
  });
  it("serves the overlay and sends an initial state snapshot", async () => {
    const state = emptyState();
    const settingsDirectory = await mkdtemp(join(tmpdir(), "lamplight-overlay-settings-"));
    const settings = await createSettingsManager({ layout: "top", thresholdN: 10, showNames: true, threads: false, sky: false, wind: false, promises: true, moments: "normal" }, join(settingsDirectory, "settings.json"));
    const overlay = await startOverlayServer(() => state, 0, "top", 10, true, false, false, false, "normal", { createAuthorizationUrl: () => "https://id.twitch.tv/oauth2/authorize?test=1", connected: () => false }, true, settings);
    const port = (overlay.server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/overlay/`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Lamplight Overlay");
    const skyPreview = await fetch(`http://127.0.0.1:${port}/sky-preview/`);
    expect(skyPreview.status).toBe(200);
    expect(await skyPreview.text()).toContain("Twelve constellations");
    const setup = await fetch(`http://127.0.0.1:${port}/setup`); expect(setup.status).toBe(200); expect(await setup.text()).toContain("Connect Twitch");
    const status = await fetch(`http://127.0.0.1:${port}/setup/status`); expect(await status.json()).toMatchObject({ connected: false });
    const controlRedirect = await fetch(`http://127.0.0.1:${port}/control`, { redirect: "manual" });
    expect(controlRedirect.status).toBe(302);expect(controlRedirect.headers.get("location")).toBe("/setup");
    const authorize = await fetch(`http://127.0.0.1:${port}/auth/start`, { redirect: "manual" }); expect(authorize.status).toBe(302); expect(authorize.headers.get("location")).toContain("id.twitch.tv/oauth2/authorize");
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const [data] = await once(socket, "message") as [Buffer];
    expect(JSON.parse(data.toString())).toMatchObject({ type: "state", state: { schemaVersion: 1 }, layout: "top", threadsEnabled: false, moments: "normal", preferences: { compact: false, hidden: false } });
    socket.send(JSON.stringify({ type: "preferences", compact: true, hidden: true }));
    const [updated] = await once(socket, "message") as [Buffer];
    expect(JSON.parse(updated.toString())).toMatchObject({ preferences: { compact: true, hidden: true } });
    const saved = new Promise(resolve => socket.on("message", raw => { const packet=JSON.parse(raw.toString()); if(packet.type === "settings-saved") resolve(packet); }));
    socket.send(JSON.stringify({ type: "settings", settings: { sky: true, thresholdN: 3, layout: "bottom" } }));
    const [settingsUpdated] = await once(socket, "message") as [Buffer];
    expect(JSON.parse(settingsUpdated.toString())).toMatchObject({ settings: { sky: true, thresholdN: 3, layout: "bottom" }, skyEnabled: true, thresholdN: 3, layout: "bottom" });
    expect(await saved).toEqual({ type: "settings-saved" });
    socket.close();
    await once(socket, "close");
    await overlay.close();
  });
});
