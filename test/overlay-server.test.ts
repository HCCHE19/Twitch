import { once } from "node:events";
import { AddressInfo } from "node:net";
import WebSocket from "ws";
import { describe, expect, it } from "vitest";
import { startOverlayServer } from "../src/overlay-server.js";
import { emptyState } from "../src/presence.js";

describe("overlay server", () => {
  it("serves the overlay and sends an initial state snapshot", async () => {
    const state = emptyState();
    const overlay = await startOverlayServer(() => state, 0);
    const port = (overlay.server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/overlay/`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Lamplight Overlay");
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const [data] = await once(socket, "message") as [Buffer];
    expect(JSON.parse(data.toString())).toMatchObject({ type: "state", state: { schemaVersion: 1 } });
    socket.close();
    await once(socket, "close");
    await overlay.close();
  });
});
