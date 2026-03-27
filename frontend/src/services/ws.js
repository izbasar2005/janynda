import { token } from "./api";

// Minimal WS client with reconnect + pubsub.
// Server endpoint: /api/v1/ws?token=...

function wsUrl() {
  const t = token();
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  // In dev, the API is typically on :8080 while Vite runs on :5173.
  // Using :8080 directly avoids WS proxy/hijack issues.
  const host =
    window.location.port === "5173"
      ? `${window.location.hostname}:8080`
      : window.location.host;
  const qs = new URLSearchParams();
  if (t) qs.set("token", t);
  return `${proto}//${host}/api/v1/ws?${qs.toString()}`;
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

    const url = wsUrl();
    const ws = new WebSocket(url);
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

