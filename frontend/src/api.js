/**
 * Chiamate al backend.
 * - In dev: path relativi `/api` → proxy Vite → :3001.
 * - In produzione: imposta `VITE_API_BASE` (es. https://bullweb-api.onrender.com).
 */

const JSON_HEADERS = { Accept: "application/json" };

const API_BASE = String(import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");

function apiUrl(path) {
  if (!path.startsWith("/")) path = `/${path}`;
  if (!API_BASE) return path;
  return `${API_BASE}${path}`;
}

export async function fetchPerpetuals() {
  const res = await fetch(apiUrl("/api/perpetuals"), { headers: JSON_HEADERS });
  if (!res.ok) throw new Error(`perpetuals ${res.status}`);
  return res.json();
}

export async function fetchTickers() {
  const res = await fetch(apiUrl("/api/tickers"), { headers: JSON_HEADERS });
  const data = await res.json();
  if (!res.ok) {
    const msg = data.error || `tickers ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

function parseBybitKlineBody(body, symbol, interval) {
  if (body.retCode !== 0) {
    throw new Error(body.retMsg || `Bybit retCode ${body.retCode}`);
  }
  const result = body.result;
  const raw = result.list || [];
  const sorted = [...raw].sort((a, b) => Number(a[0]) - Number(b[0]));
  const candles = sorted.map((row) => ({
    time: Math.floor(Number(row[0]) / 1000),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
  }));
  return {
    symbol: String(result.symbol || symbol).toUpperCase(),
    interval: String(result.interval || interval),
    candles,
  };
}

/** Fallback: proxy CORS (IP del proxy; può fallire se anche lì Bybit blocca). */
async function fetchKlinesViaAllOrigins(symbol, interval) {
  const limit = 500;
  const q = new URLSearchParams({
    category: "linear",
    symbol: symbol.toUpperCase(),
    interval: String(interval),
    limit: String(limit),
  });
  const target = `https://api.bybit.com/v5/market/kline?${q}`;
  const proxied = `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`;
  const res = await fetch(proxied, { cache: "no-store" });
  if (!res.ok) throw new Error(`proxy klines ${res.status}`);
  const body = await res.json();
  return parseBybitKlineBody(body, symbol, interval);
}

export async function fetchKlines(symbol, interval) {
  const q = new URLSearchParams({ symbol, interval, limit: "500" });
  try {
    const res = await fetch(apiUrl(`/api/klines?${q}`), {
      headers: JSON_HEADERS,
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = data.error || `klines ${res.status}`;
      throw new Error(msg);
    }
    return data;
  } catch (e) {
    try {
      return await fetchKlinesViaAllOrigins(symbol, interval);
    } catch {
      throw e;
    }
  }
}
