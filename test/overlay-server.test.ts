import { once } from "node:events";
import { AddressInfo } from "node:net";
import WebSocket from "ws";
import { describe, expect, it } from "vitest";
import { startOverlayServer } from "../src/overlay-server.js";
import { emptyState } from "../src/presence.js";

describe("overlay server", () => {
  it("serves the overlay and sends an initial state snapshot", async () => {
    const state = emptyState();
    const overlay = await startOverlayServer(() => state, 0, "top", 10, true, false, false, false, "normal", { createAuthorizationUrl: () => "https://id.twitch.tv/oauth2/authorize?test=1", connected: () => false });
    const port = (overlay.server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/overlay/`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Lamplight Overlay");
    const skyPreview = await fetch(`http://127.0.0.1:${port}/sky-preview/`);
    expect(skyPreview.status).toBe(200);
    expect(await skyPreview.text()).toContain("Twelve constellations");
    const setup = await fetch(`http://127.0.0.1:${port}/setup`); expect(setup.status).toBe(200); expect(await setup.text()).toContain("Connect Twitch");
    const status = await fetch(`http://127.0.0.1:${port}/setup/status`); expect(await status.json()).toEqual({ connected: false });
    const authorize = await fetch(`http://127.0.0.1:${port}/auth/start`, { redirect: "manual" }); expect(authorize.status).toBe(302); expect(authorize.headers.get("location")).toContain("id.twitch.tv/oauth2/authorize");
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const [data] = await once(socket, "message") as [Buffer];
    expect(JSON.parse(data.toString())).toMatchObject({ type: "state", state: { schemaVersion: 1 }, layout: "top", threadsEnabled: false, moments: "normal", preferences: { compact: false, hidden: false } });
    socket.send(JSON.stringify({ type: "preferences", compact: true, hidden: true }));
    const [updated] = await once(socket, "message") as [Buffer];
    expect(JSON.parse(updated.toString())).toMatchObject({ preferences: { compact: true, hidden: true } });
    socket.close();
    await once(socket, "close");
    await overlay.close();
  });
});
