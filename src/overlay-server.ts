import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { extname, join, normalize } from "node:path";
import { WebSocket, WebSocketServer } from "ws";
import type { DerivedState } from "./types.js";
import type { OverlayLayout } from "./config.js";

const MIME: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".woff2": "font/woff2"
};

export interface OverlayServer {
  server: Server;
  broadcast: (state: DerivedState) => void;
  close: () => Promise<void>;
}

interface OverlayPreferences { compact: boolean; hidden: boolean; rollCall: boolean; rollCallCalled: string[]; rollCallStartedAt?: string }

export async function startOverlayServer(getState: () => DerivedState, port = 8787, layout: OverlayLayout = "bottom", thresholdN = 10, showNames = true, threadsEnabled = false, skyEnabled = false, windEnabled = false): Promise<OverlayServer> {
  const root = join(process.cwd(), "public");
  const sockets = new WebSocketServer({ noServer: true });
  const preferences: OverlayPreferences = { compact: false, hidden: false, rollCall: false, rollCallCalled: [] };
  const packet = (state: DerivedState): string => JSON.stringify({ type: "state", state, layout, thresholdN, showNames, threadsEnabled, skyEnabled, windEnabled, preferences });
  const sendState = (): void => { const message = packet(getState()); for (const client of sockets.clients) if (client.readyState === WebSocket.OPEN) client.send(message); };
  const server = createServer(async (request, response) => {
    const requestPath = new URL(request.url ?? "/", "http://localhost").pathname;
    const receiptRequest = requestPath.startsWith("/receipts/");
    const relative = requestPath === "/" || requestPath === "/overlay" || requestPath === "/overlay/"
      ? "overlay/index.html"
      : requestPath === "/control" || requestPath === "/control/"
        ? "control/index.html"
        : requestPath.replace(/^\/+/, "");
    const safe = normalize(relative);
    if (safe.startsWith("..")) { response.writeHead(403).end("Forbidden"); return; }
    const file = join(receiptRequest ? process.cwd() : root, safe);
    try {
      const info = await stat(file);
      if (!info.isFile()) throw new Error("not a file");
      response.writeHead(200, {
        "Content-Type": MIME[extname(file)] ?? "application/octet-stream",
        "Cache-Control": "no-store"
      });
      createReadStream(file).pipe(response);
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
    }
  });
  server.on("upgrade", (request, socket, head) => {
    if (request.url !== "/ws") { socket.destroy(); return; }
    sockets.handleUpgrade(request, socket, head, (ws) => sockets.emit("connection", ws, request));
  });
  sockets.on("connection", (socket) => {
    socket.send(packet(getState()));
    socket.on("message", (raw) => {
      try {
        const message = JSON.parse(raw.toString()) as { type?: unknown; compact?: unknown; hidden?: unknown; rollCall?: unknown };
        if (message.type === "roll-call-called") {
          const stream = getState().currentStream;
          if (preferences.rollCall && stream) {
            const remaining = stream.litUserIds.filter((userId) => !preferences.rollCallCalled.includes(userId));
            if (remaining.length) {
              const started = Date.parse(preferences.rollCallStartedAt ?? new Date().toISOString());
              const current = remaining[Math.floor(Math.max(0, Date.now() - started) / 4_000) % remaining.length];
              if (current) preferences.rollCallCalled.push(current);
              preferences.rollCallStartedAt = new Date().toISOString();
            }
            if (stream.litUserIds.every((userId) => preferences.rollCallCalled.includes(userId))) preferences.rollCall = false;
          }
          sendState(); return;
        }
        if (message.type !== "preferences") return;
        if (typeof message.compact === "boolean") preferences.compact = message.compact;
        if (typeof message.hidden === "boolean") preferences.hidden = message.hidden;
        if (typeof message.rollCall === "boolean" && message.rollCall !== preferences.rollCall) {
          preferences.rollCall = message.rollCall; preferences.rollCallCalled = []; preferences.rollCallStartedAt = new Date().toISOString();
        }
        sendState();
      } catch { /* Ignore malformed localhost control messages. */ }
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => { server.off("error", reject); resolve(); });
  });
  const broadcast = (state: DerivedState): void => {
    const message = packet(state);
    for (const client of sockets.clients) if (client.readyState === WebSocket.OPEN) client.send(message);
  };
  return {
    server,
    broadcast,
    close: () => new Promise((resolve, reject) => {
      for (const client of sockets.clients) client.close(1001, "Server stopping");
      sockets.close();
      server.close((error) => error ? reject(error) : resolve());
    })
  };
}
