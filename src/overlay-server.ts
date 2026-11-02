import { receiptIndex } from "./receipt-index.js";
import { randomBytes } from "node:crypto";
import { resolveThreshold } from "./sky-threshold.js";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { extname, join, normalize } from "node:path";
import { WebSocket, WebSocketServer } from "ws";
import type { DerivedState } from "./types.js";
import type { MomentLevel, OverlayLayout } from "./config.js";
import type { SettingsManager } from "./settings.js";

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
interface SetupAuth { channelLogin?: string; createAuthorizationUrl: () => string; connected: () => boolean; disconnect?: () => Promise<void> }

export async function startOverlayServer(getState: () => DerivedState, port = 8787, layout: OverlayLayout = "bottom", thresholdN: number | "auto" = "auto", showNames = true, threadsEnabled = false, skyEnabled = false, windEnabled = false, moments: MomentLevel = "normal", setupAuth?: SetupAuth, promisesEnabled = true, settingsManager?: SettingsManager): Promise<OverlayServer> {
  const root = join(process.cwd(), "public");
  const sockets = new WebSocketServer({ noServer: true });
  const controlToken = randomBytes(24).toString("hex");
  const preferences: OverlayPreferences = { compact: false, hidden: false, rollCall: false, rollCallCalled: [] };
  const runtime = () => settingsManager?.get() ?? { layout, thresholdN, showNames, threads: threadsEnabled, sky: skyEnabled, wind: windEnabled, promises: promisesEnabled, moments };
  const packet = (state: DerivedState): string => { const settings = runtime(); return JSON.stringify({ type: "state", state, layout: settings.layout, thresholdN: state.currentStream?.thresholdN ?? resolveThreshold(state, settings.thresholdN), autoThresholdN: resolveThreshold(state, "auto"), showNames: settings.showNames, threadsEnabled: settings.threads, skyEnabled: settings.sky, windEnabled: settings.wind, promisesEnabled: settings.promises, moments: settings.moments, settings, preferences }); };
  const sendState = (): void => { const message = packet(getState()); for (const client of sockets.clients) if (client.readyState === WebSocket.OPEN) client.send(message); };
  const server = createServer(async (request, response) => {
    const requestPath = new URL(request.url ?? "/", "http://localhost").pathname;
    if (["/control", "/control/"].includes(requestPath) && !setupAuth?.connected() && !getState().demoReplay) {
      response.writeHead(302, { Location: "/setup", "Cache-Control": "no-store" }).end(); return;
    }
    if (requestPath === "/auth/start") {
      try { response.writeHead(302, { Location: setupAuth?.createAuthorizationUrl() ?? "/setup?error=unavailable", "Cache-Control": "no-store" }).end(); }
      catch { response.writeHead(302, { Location: "/setup?error=config", "Cache-Control": "no-store" }).end(); }
      return;
    }
    if (requestPath === "/auth/disconnect" && request.method === "POST") {
      if (!setupAuth?.disconnect || request.headers["x-lamplight-control"] !== controlToken) { response.writeHead(403).end("Forbidden"); return; }
      try { await setupAuth.disconnect(); response.writeHead(204, { "Cache-Control": "no-store" }).end(); }
      catch { response.writeHead(502, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }).end("Twitch could not be disconnected. Try again."); }
      return;
    }
    if (requestPath === "/setup/status") { response.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify({ connected: setupAuth?.connected() ?? false, channelName: setupAuth?.connected() ? setupAuth.channelLogin ?? "" : "", demo: getState().demoReplay, controlToken })); return; }
    if (requestPath === "/control/receipts") {
      try { response.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(await receiptIndex())); }
      catch { response.writeHead(500).end("Could not load receipts"); }
      return;
    }
    const receiptRequest = requestPath.startsWith("/receipts/");
    const relative = requestPath === "/" || requestPath === "/overlay" || requestPath === "/overlay/"
      ? "overlay/index.html"
      : requestPath === "/control" || requestPath === "/control/"
        ? "control/index.html"
        : requestPath === "/sky-preview" || requestPath === "/sky-preview/"
          ? "sky-preview/index.html"
        : requestPath === "/setup" || requestPath === "/setup/"
          ? "setup/index.html"
        : requestPath.replace(/^\/+/, "");
    const safe = normalize(relative);
    if (safe.startsWith("..")) { response.writeHead(403).end("Forbidden"); return; }
    const file = join(receiptRequest ? process.cwd() : root, safe);
    try {
      const info = await stat(file);
      if (!info.isFile()) throw new Error("not a file");
      if (receiptRequest && extname(file) === ".html") {
        const source = await readFile(file, "utf8");
        const html = source.includes('class="back-to-controls"') ? source : source.replace("<body>", '<body><a class="back-to-controls" href="/control">Back to controls</a>');
        response.writeHead(200, { "Content-Type": MIME[".html"], "Cache-Control": "no-store" }).end(html); return;
      }
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
    socket.on("message", async (raw) => {
      try {
        const message = JSON.parse(raw.toString()) as { type?: unknown; compact?: unknown; hidden?: unknown; rollCall?: unknown; settings?: unknown };
        if (message.type === "settings" && settingsManager && message.settings && typeof message.settings === "object") {
          const saved = await settingsManager.update(message.settings as Parameters<SettingsManager["update"]>[0]);
          socket.send(JSON.stringify({ type: "settings-saved", settings: saved })); sendState(); return;
        }
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
