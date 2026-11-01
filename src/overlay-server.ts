import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { extname, join, normalize } from "node:path";
import { WebSocket, WebSocketServer } from "ws";
import type { DerivedState } from "./types.js";

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

export async function startOverlayServer(getState: () => DerivedState, port = 8787): Promise<OverlayServer> {
  const root = join(process.cwd(), "public");
  const sockets = new WebSocketServer({ noServer: true });
  const server = createServer(async (request, response) => {
    const requestPath = new URL(request.url ?? "/", "http://localhost").pathname;
    const relative = requestPath === "/" || requestPath === "/overlay" || requestPath === "/overlay/"
      ? "overlay/index.html"
      : requestPath.replace(/^\/+/, "");
    const safe = normalize(relative);
    if (safe.startsWith("..")) { response.writeHead(403).end("Forbidden"); return; }
    const file = join(root, safe);
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
  sockets.on("connection", (socket) => socket.send(JSON.stringify({ type: "state", state: getState() })));
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => { server.off("error", reject); resolve(); });
  });
  const broadcast = (state: DerivedState): void => {
    const message = JSON.stringify({ type: "state", state });
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
