/**
 * Chiamate al backend.
 * - In dev: path relativi `/api` → proxy Vite → :3001.
 * - In produzione: imposta `VITE_API_BASE` (es. https://quota-api.onrender.com).
 */

const JSON_HEADERS = { Accept: "application/json" };

const API_BASE = String(import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");

function apiUrl(path) {
  if (!path.startsWith("/")) path = `/${path}`;
  if (!API_BASE) return path;
  return `${API_BASE}${path}`;
}

/** @param {{ exchange?: string, market?: string }} [params] */
export async function fetchPerpetuals(params = {}) {
  const exchange = params.exchange ?? "bybit";
  const market = params.market ?? "derivatives";
  const q = new URLSearchParams({ exchange, market });
  const res = await fetch(apiUrl(`/api/perpetuals?${q}`), {
    headers: JSON_HEADERS,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`perpetuals ${res.status}`);
  return res.json();
}

/** @param {{ exchange?: string, market?: string }} [params] */
export async function fetchTickers(params = {}) {
  const exchange = params.exchange ?? "bybit";
  const market = params.market ?? "derivatives";
  const q = new URLSearchParams({ exchange, market });
  const res = await fetch(apiUrl(`/api/tickers?${q}`), {
    headers: JSON_HEADERS,
    cache: "no-store",
  });
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
async function fetchKlinesViaAllOrigins(symbol, interval, limit = 500) {
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

/**
 * @param {string} symbol
 * @param {string} interval
 * @param {{ exchange?: string, market?: string }} [options]
 */
export async function fetchKlines(symbol, interval, options = {}) {
  const exchange = options.exchange ?? "bybit";
  const market = options.market ?? "derivatives";
  const limit = Math.min(Math.max(Number(options.limit) || 500, 1), 500);
  const q = new URLSearchParams({
    symbol,
    interval,
    limit: String(limit),
    exchange,
    market,
  });
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
    if (exchange === "bybit" && market === "derivatives") {
      try {
        return await fetchKlinesViaAllOrigins(symbol, interval, limit);
      } catch {
        throw e;
      }
    }
    throw e;
  }
}
