/**
 * WebSocket pubblico Bybit v5 linear: topic tickers.{symbol} (IP browser → spesso non bloccato).
 * @see https://bybit-exchange.github.io/docs/v5/websocket/public/ticker
 */

const WS_URL = "wss://stream.bybit.com/v5/public/linear";
const PING_MS = 20_000;
const RECONNECT_MS = 2_500;
const SUB_BATCH = 10;
const SUB_BATCH_DELAY_MS = 80;

/** @type {WebSocket | null} */
let ws = null;
let pingTimer = null;
let reconnectTimer = null;

/** @type {Set<string>} */
let activeSyms = new Set();
/** @type {((symbol: string, data: object) => void) | null} */
let handler = null;

function send(obj) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(obj));
  }
}

function scheduleReconnect() {
  if (reconnectTimer || activeSyms.size === 0) return;
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

function subscribeBatches() {
  const args = [...activeSyms].map((s) => `tickers.${s}`);
  for (let i = 0; i < args.length; i += SUB_BATCH) {
    const chunk = args.slice(i, i + SUB_BATCH);
    const delay = (i / SUB_BATCH) * SUB_BATCH_DELAY_MS;
    setTimeout(() => send({ op: "subscribe", args: chunk }), delay);
  }
}

function connect() {
  if (typeof WebSocket === "undefined") return;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }
  if (activeSyms.size === 0 || !handler) return;

  const socket = new WebSocket(WS_URL);
  ws = socket;

  socket.onopen = () => {
    startPing();
    subscribeBatches();
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
    if (typeof topic !== "string" || !topic.startsWith("tickers.")) return;
    const sym = topic.slice("tickers.".length);
    const d = msg.data;
    const row = Array.isArray(d) ? d[0] : d;
    if (!row || typeof row !== "object" || !handler) return;
    try {
      handler(sym, row);
    } catch (e) {
      console.warn("[bybitLinearTickerWs]", e);
    }
  };

  socket.onerror = () => {};
  socket.onclose = () => {
    stopPing();
    const wasUs = ws === socket;
    if (wasUs) ws = null;
    if (activeSyms.size > 0 && handler) scheduleReconnect();
  };
}

function disconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  stopPing();
  if (ws) {
    ws.close();
    ws = null;
  }
}

export function mapBybitWsTickerToRow(sym, d) {
  function numOrNull(v) {
    if (v === undefined || v === null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return {
    symbol: sym,
    lastPrice: numOrNull(d.lastPrice),
    volume24h: numOrNull(d.turnover24h ?? d.volume24h),
    price24hPcnt: numOrNull(d.price24hPcnt),
    fundingRate: numOrNull(d.fundingRate),
    openInterest: numOrNull(d.openInterest),
    openInterestValue: numOrNull(d.openInterestValue),
    missing: false,
  };
}

/**
 * @param {string[]} symbols
 * @param {(symbol: string, data: object) => void} onTicker
 * @returns {() => void} cleanup
 */
export function subscribeLinearTickers(symbols, onTicker) {
  activeSyms = new Set(symbols.map((s) => s.toUpperCase()));
  handler = onTicker;
  connect();
  return () => {
    activeSyms = new Set();
    handler = null;
    disconnect();
  };
}
