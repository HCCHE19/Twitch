import WebSocket, { type RawData } from "ws";
import type { Config } from "./config.js";
import { createSubscription } from "./twitch-api.js";

const EVENTSUB_URL = "wss://eventsub.wss.twitch.tv/ws?keepalive_timeout_seconds=30";
const SUBSCRIPTIONS = ["channel.chat.message", "stream.online", "stream.offline"] as const;

interface Envelope {
  metadata?: { message_id?: string; message_type?: string; subscription_type?: string };
  payload?: Record<string, unknown>;
}

export interface EventSubOptions {
  config: Config;
  broadcasterUserId: string;
  onReady?: () => void;
  onChat?: (displayName: string, text: string) => void;
  onStream?: (type: "stream.online" | "stream.offline", event: Record<string, unknown>) => void;
}

// WebSocket lifecycle follows Twitch's Example Chatbot and EventSub handling docs:
// https://dev.twitch.tv/docs/chat/chatbot-guide/
// https://dev.twitch.tv/docs/eventsub/handling-websocket-events/
export class EventSubClient {
  private socket: WebSocket | undefined;
  private reconnectSocket: WebSocket | undefined;
  private keepaliveTimer: NodeJS.Timeout | undefined;
  private stopped = false;
  private lastMessageAt = Date.now();
  private readonly seen = new Set<string>();

  constructor(private readonly options: EventSubOptions) {}

  start(): void {
    this.stopped = false;
    this.connect(EVENTSUB_URL, true);
  }

  stop(): void {
    this.stopped = true;
    if (this.keepaliveTimer) clearInterval(this.keepaliveTimer);
    this.socket?.close(1000, "Lamplight stopping");
    this.reconnectSocket?.close(1000, "Lamplight stopping");
  }

  private connect(url: string, subscribeOnWelcome: boolean): void {
    const ws = new WebSocket(url);
    if (subscribeOnWelcome) this.socket = ws;
    else this.reconnectSocket = ws;
    ws.on("message", (data) => void this.handleMessage(ws, data, subscribeOnWelcome));
    ws.on("error", (error) => console.error(`[eventsub] socket error: ${error.message}`));
    ws.on("close", (code, reason) => {
      if (this.stopped || ws !== this.socket) return;
      console.error(`[eventsub] disconnected (${code} ${reason.toString() || "no reason"}); reconnecting fresh`);
      setTimeout(() => { if (!this.stopped) this.connect(EVENTSUB_URL, true); }, 1_000);
    });
  }

  private async handleMessage(ws: WebSocket, data: RawData, subscribeOnWelcome: boolean): Promise<void> {
    this.lastMessageAt = Date.now();
    let envelope: Envelope;
    try { envelope = JSON.parse(data.toString()) as Envelope; }
    catch { console.error("[eventsub] ignored malformed JSON"); return; }

    const id = envelope.metadata?.message_id;
    if (id && this.seen.has(id)) return;
    if (id) {
      this.seen.add(id);
      if (this.seen.size > 10_000) this.seen.delete(this.seen.values().next().value as string);
    }

    const messageType = envelope.metadata?.message_type;
    if (messageType === "session_welcome") {
      const session = envelope.payload?.session as { id?: string; keepalive_timeout_seconds?: number } | undefined;
      if (!session?.id) throw new Error("EventSub welcome did not contain a session ID.");
      if (subscribeOnWelcome) {
        await Promise.all(SUBSCRIPTIONS.map((type) => createSubscription(
          this.options.config, session.id as string, type, this.options.broadcasterUserId
        )));
        console.log(`[eventsub] subscribed: ${SUBSCRIPTIONS.join(", ")}`);
        this.startKeepaliveWatch(session.keepalive_timeout_seconds ?? 30);
        this.options.onReady?.();
      } else {
        const old = this.socket;
        this.socket = ws;
        this.reconnectSocket = undefined;
        old?.close(1000, "EventSub reconnect handover complete");
        console.log("[eventsub] reconnect handover complete");
      }
      return;
    }
    if (messageType === "session_reconnect") {
      const session = envelope.payload?.session as { reconnect_url?: string } | undefined;
      if (session?.reconnect_url && !this.reconnectSocket) this.connect(session.reconnect_url, false);
      return;
    }
    if (messageType === "revocation") {
      console.error(`[eventsub] subscription revoked: ${JSON.stringify(envelope.payload?.subscription ?? {})}`);
      return;
    }
    if (messageType !== "notification") return;

    const event = envelope.payload?.event as Record<string, unknown> | undefined;
    if (!event) return;
    const subscriptionType = envelope.metadata?.subscription_type;
    if (subscriptionType === "channel.chat.message") {
      const message = event.message as { text?: string } | undefined;
      this.options.onChat?.(String(event.chatter_user_name ?? event.chatter_user_login ?? "unknown"), message?.text ?? "");
    } else if (subscriptionType === "stream.online" || subscriptionType === "stream.offline") {
      this.options.onStream?.(subscriptionType, event);
    }
  }

  private startKeepaliveWatch(seconds: number): void {
    if (this.keepaliveTimer) clearInterval(this.keepaliveTimer);
    this.lastMessageAt = Date.now();
    this.keepaliveTimer = setInterval(() => {
      if (Date.now() - this.lastMessageAt > (seconds + 10) * 1_000) {
        console.error("[eventsub] keepalive overdue; reconnecting fresh");
        this.socket?.terminate();
      }
    }, 5_000);
  }
}
