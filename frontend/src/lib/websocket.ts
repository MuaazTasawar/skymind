import type { WSMessage, FleetSnapshot, FaultEvent, ReassignEvent } from "@/types";

type WSHandler = (msg: WSMessage) => void;

class SkyMindWebSocket {
  private ws: WebSocket | null = null;
  private handlers: Set<WSHandler> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 3000;
  private shouldConnect = false;
  private url: string;

  constructor() {
    this.url = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8080/ws";
  }

  connect() {
    this.shouldConnect = true;
    this._connect();
  }

  private _connect() {
    if (!this.shouldConnect) return;
    if (typeof window === "undefined") return;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log("[ws] connected");
        this.reconnectDelay = 3000;
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as WSMessage;
          this.handlers.forEach(h => h(msg));
        } catch (e) {
          console.warn("[ws] parse error:", e);
        }
      };

      this.ws.onclose = () => {
        console.log("[ws] disconnected — reconnecting in", this.reconnectDelay, "ms");
        if (this.shouldConnect) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 30000);
            this._connect();
          }, this.reconnectDelay);
        }
      };

      this.ws.onerror = (e) => {
        console.warn("[ws] error:", e);
        this.ws?.close();
      };

    } catch (e) {
      console.error("[ws] connect error:", e);
    }
  }

  disconnect() {
    this.shouldConnect = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }

  subscribe(handler: WSHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Singleton — one WS connection for the whole app
export const skyMindWS = new SkyMindWebSocket();

export type { WSHandler };
export type { FleetSnapshot, FaultEvent, ReassignEvent };