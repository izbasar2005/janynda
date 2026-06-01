import { token } from "./api";

// Must match internal/handler/ws_handler.go (Sec-WebSocket-Protocol).
const WS_JWT_SUBPROTOCOL = "janymda.jwt";

// Minimal WS client with reconnect + pubsub.
// JWT is sent via Sec-WebSocket-Protocol (not ?token=) to avoid URL/referrer/proxy logs.
// Same host as the SPA so Vite's /api proxy and Origin checks stay consistent.

function wsUrl() {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/api/v1/ws`;
}

class WSClient {
  constructor() {
    this.ws = null;
    this.handlers = new Set();
    this.subs = new Set(); // `${channel}:${id}`
    this.backoffMs = 400;
    this.maxBackoffMs = 8000;
    this.connecting = false;
    this.closedByUser = false;
  }

  on(fn) {
    this.handlers.add(fn);
    return () => this.handlers.delete(fn);
  }

  emit(evt) {
    for (const fn of this.handlers) {
      try { fn(evt); } catch { /* ignore */ }
    }
  }

  ensureConnected() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    if (this.connecting) return;
    this.connecting = true;
    this.closedByUser = false;

    const t = token();
    if (!t) {
      this.connecting = false;
      return;
    }
    const url = wsUrl();
    const ws = new WebSocket(url, [WS_JWT_SUBPROTOCOL, t]);
    this.ws = ws;

    ws.onopen = () => {
      this.connecting = false;
      this.backoffMs = 400;
      // re-subscribe
      for (const key of this.subs) {
        const [channel, idStr] = key.split(":");
        const id = Number(idStr);
        if (channel && id) this.send({ type: "subscribe", channel, id });
      }
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        this.emit(data);
      } catch {
        // ignore
      }
    };

    ws.onclose = () => {
      this.connecting = false;
      if (this.closedByUser) return;
      const wait = this.backoffMs;
      this.backoffMs = Math.min(this.backoffMs * 2, this.maxBackoffMs);
      setTimeout(() => this.ensureConnected(), wait);
    };

    ws.onerror = () => {
      // close triggers reconnect
      try { ws.close(); } catch { /* ignore */ }
    };
  }

  close() {
    this.closedByUser = true;
    try { this.ws?.close(); } catch { /* ignore */ }
    this.ws = null;
  }

  send(obj) {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try { ws.send(JSON.stringify(obj)); } catch { /* ignore */ }
  }

  subscribe(channel, id) {
    const cid = Number(id);
    if (!channel || !cid) return;
    const key = `${channel}:${cid}`;
    this.subs.add(key);
    this.ensureConnected();
    this.send({ type: "subscribe", channel, id: cid });
  }

  unsubscribe(channel, id) {
    const cid = Number(id);
    if (!channel || !cid) return;
    const key = `${channel}:${cid}`;
    this.subs.delete(key);
    this.send({ type: "unsubscribe", channel, id: cid });
  }
}

export const wsClient = new WSClient();

