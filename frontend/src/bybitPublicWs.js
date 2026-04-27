/**
 * WebSocket pubblico Bybit v5: publicTrade su linear e spot (connessioni separate).
 * @see https://bybit-exchange.github.io/docs/v5/websocket/public/trade
 */

const WS_URL_LINEAR = "wss://stream.bybit.com/v5/public/linear";
const WS_URL_SPOT = "wss://stream.bybit.com/v5/public/spot";
const PING_MS = 20_000;
const RECONNECT_MS = 2_500;
const DISCONNECT_DEFER_MS = 280;

/**
 * @param {string} wsUrl
 */
function createTradePool(wsUrl) {
  /** @type {Map<string, Set<(rows: object[]) => void>>} */
  const listeners = new Map();

  /** @type {WebSocket | null} */
  let ws = null;
  /** @type {ReturnType<typeof setInterval> | null} */
  let pingTimer = null;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let reconnectTimer = null;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let disconnectDeferTimer = null;

  function tradeTopic(sym) {
    return `publicTrade.${sym.toUpperCase()}`;
  }

  function send(obj) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj));
    }
  }

  function scheduleReconnect() {
    if (reconnectTimer || listeners.size === 0) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, RECONNECT_MS);
  }

  function startPing() {
    if (pingTimer) return;
    pingTimer = setInterval(() => send({ op: "ping" }), PING_MS);
  }

  function stopPing() {
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
    }
  }

  function subscribeAllTopics() {
    const args = [...listeners.keys()].map((sym) => tradeTopic(sym));
    if (args.length) {
      send({ op: "subscribe", args });
    }
  }

  function connect() {
    if (typeof WebSocket === "undefined") return;
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    if (listeners.size === 0) return;

    const socket = new WebSocket(wsUrl);
    ws = socket;

    socket.onopen = () => {
      startPing();
      subscribeAllTopics();
    };

    socket.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.op === "pong") return;
      if (msg.success && msg.op === "subscribe") return;
      if (msg.op === "ping") {
        send({ op: "pong" });
        return;
      }

      const topic = msg.topic;
      if (typeof topic !== "string" || !topic.startsWith("publicTrade.")) return;
      const arr = msg.data;
      if (!Array.isArray(arr)) return;

      const sym = topic.slice("publicTrade.".length);
      const set = listeners.get(sym);
      if (!set) return;
      for (const fn of set) {
        try {
          fn(arr);
        } catch (e) {
          console.warn("[bybitPublicWs] handler", e);
        }
      }
    };

    socket.onerror = () => {};

    socket.onclose = () => {
      stopPing();
      const wasUs = ws === socket;
      if (wasUs) ws = null;
      if (listeners.size > 0) {
        scheduleReconnect();
      }
    };
  }

  function clearDisconnectDefer() {
    if (disconnectDeferTimer) {
      clearTimeout(disconnectDeferTimer);
      disconnectDeferTimer = null;
    }
  }

  function performDisconnect() {
    if (listeners.size > 0) return;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    stopPing();
    if (!ws) return;
    const s = ws;
    if (s.readyState === WebSocket.OPEN) {
      s.close();
    } else if (s.readyState === WebSocket.CONNECTING) {
      s.addEventListener(
        "open",
        () => {
          if (listeners.size === 0) s.close();
        },
        { once: true },
      );
    } else if (s.readyState === WebSocket.CLOSED) {
      ws = null;
    }
  }

  function disconnectIfIdle() {
    if (listeners.size > 0) {
      clearDisconnectDefer();
      return;
    }
    if (disconnectDeferTimer) return;
    disconnectDeferTimer = setTimeout(() => {
      disconnectDeferTimer = null;
      if (listeners.size > 0) return;
      performDisconnect();
    }, DISCONNECT_DEFER_MS);
  }

  /**
   * @param {string} symbol
   * @param {(rows: object[]) => void} handler
   */
  function subscribe(symbol, handler) {
    const sym = symbol.toUpperCase();
    let set = listeners.get(sym);
    const firstForSymbol = !set || set.size === 0;
    if (!set) {
      set = new Set();
      listeners.set(sym, set);
    }
    set.add(handler);
    clearDisconnectDefer();

    if (firstForSymbol) {
      if (ws?.readyState === WebSocket.OPEN) {
        send({ op: "subscribe", args: [tradeTopic(sym)] });
      } else {
        connect();
      }
    }

    return () => {
      const s = listeners.get(sym);
      if (!s) return;
      s.delete(handler);
      if (s.size === 0) {
        listeners.delete(sym);
        send({ op: "unsubscribe", args: [tradeTopic(sym)] });
      }
      disconnectIfIdle();
    };
  }

  return { subscribe };
}

const poolLinear = createTradePool(WS_URL_LINEAR);
const poolSpot = createTradePool(WS_URL_SPOT);

/**
 * @param {string} symbol es. BTCUSDT
 * @param {(rows: object[]) => void} handler
 * @param {{ category?: 'linear' | 'spot' }} [options]
 */
export function subscribePublicTrade(symbol, handler, options = {}) {
  const cat = options.category === "spot" ? "spot" : "linear";
  const pool = cat === "spot" ? poolSpot : poolLinear;
  return pool.subscribe(symbol, handler);
}
