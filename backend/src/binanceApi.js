const BINANCE_SPOT = "https://api.binance.com";
const BINANCE_FUTURES = "https://fapi.binance.com";

const JSON_HEADERS = { Accept: "application/json" };

/**
 * Data listato/onboarding da exchangeInfo (ms UTC). Binance può usare secondi o ms.
 * @param {Record<string, unknown>} s
 */
function listingTimeMsFromSymbol(s) {
  const raw =
    s.onboardDate ?? s.launchTime ?? s.listingTime ?? s.openingDate;
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n < 1e12) return Math.round(n * 1000);
  return n;
}

async function binanceJson(url) {
  const res = await fetch(url, { headers: JSON_HEADERS });
  if (!res.ok) {
    let hint = "";
    try {
      const t = await res.text();
      if (t && t.length < 400) hint = `: ${t.slice(0, 200)}`;
    } catch {
      /* ignore */
    }
    throw new Error(`Binance HTTP ${res.status}${hint}`);
  }
  return res.json();
}

/**
 * Coppie spot USDT in trading + tempo listato se disponibile.
 */
export async function fetchBinanceSpotUsdtInstrumentDetails() {
  const data = await binanceJson(`${BINANCE_SPOT}/api/v3/exchangeInfo`);
  const out = [];
  for (const s of data.symbols || []) {
    if (s.status !== "TRADING" || s.quoteAsset !== "USDT") continue;
    const ms = listingTimeMsFromSymbol(s);
    out.push({
      symbol: s.symbol,
      launchTimeMs: ms,
    });
  }
  out.sort((a, b) => a.symbol.localeCompare(b.symbol));
  return out;
}

/**
 * Perpetual USDT-M su futures Binance.
 */
export async function fetchBinanceUsdtPerpetualInstrumentDetails() {
  const data = await binanceJson(`${BINANCE_FUTURES}/fapi/v1/exchangeInfo`);
  const out = [];
  for (const s of data.symbols || []) {
    if (
      s.status !== "TRADING" ||
      s.contractType !== "PERPETUAL" ||
      s.quoteAsset !== "USDT"
    ) {
      continue;
    }
    const ms = listingTimeMsFromSymbol(s);
    out.push({
      symbol: s.symbol,
      launchTimeMs: ms,
    });
  }
  out.sort((a, b) => a.symbol.localeCompare(b.symbol));
  return out;
}

/** @returns {Map<string, object>} */
export async function fetchBinanceSpotTickerMap() {
  const arr = await binanceJson(`${BINANCE_SPOT}/api/v3/ticker/24hr`);
  const map = new Map();
  if (!Array.isArray(arr)) return map;
  for (const t of arr) {
    if (t?.symbol) map.set(String(t.symbol).toUpperCase(), t);
  }
  return map;
}

/** @returns {Map<string, object>} */
export async function fetchBinanceFuturesTickerMap() {
  const arr = await binanceJson(`${BINANCE_FUTURES}/fapi/v1/ticker/24hr`);
  const map = new Map();
  if (!Array.isArray(arr)) return map;
  for (const t of arr) {
    if (t?.symbol) map.set(String(t.symbol).toUpperCase(), t);
  }
  return map;
}

/** symbol -> lastFundingRate (decimale, es. 0.0001) */
export async function fetchBinanceFuturesFundingMap() {
  const arr = await binanceJson(`${BINANCE_FUTURES}/fapi/v1/premiumIndex`);
  const map = new Map();
  if (!Array.isArray(arr)) return map;
  for (const row of arr) {
    if (row?.symbol)
      map.set(String(row.symbol).toUpperCase(), row.lastFundingRate);
  }
  return map;
}

/** Bybit interval (1,5,15,60,240,D) → Binance kline interval */
export function binanceIntervalFromBybit(interval) {
  const i = String(interval);
  const map = {
    1: "1m",
    3: "3m",
    5: "5m",
    15: "15m",
    60: "1h",
    120: "2h",
    240: "4h",
    D: "1d",
    W: "1w",
  };
  return map[i] || "15m";
}

export async function fetchBinanceSpotKlines(symbol, interval, limit = 500) {
  const bi = binanceIntervalFromBybit(interval);
  const cap = Math.min(Number(limit) || 500, 1000);
  const q = new URLSearchParams({
    symbol: symbol.toUpperCase(),
    interval: bi,
    limit: String(cap),
  });
  const raw = await binanceJson(`${BINANCE_SPOT}/api/v3/klines?${q}`);
  if (!Array.isArray(raw)) return [];
  const sorted = [...raw].sort((a, b) => Number(a[0]) - Number(b[0]));
  return sorted.map((row) => ({
    time: Math.floor(Number(row[0]) / 1000),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
  }));
}

export async function fetchBinanceFuturesKlines(symbol, interval, limit = 500) {
  const bi = binanceIntervalFromBybit(interval);
  const cap = Math.min(Number(limit) || 500, 1500);
  const q = new URLSearchParams({
    symbol: symbol.toUpperCase(),
    interval: bi,
    limit: String(cap),
  });
  const raw = await binanceJson(`${BINANCE_FUTURES}/fapi/v1/klines?${q}`);
  if (!Array.isArray(raw)) return [];
  const sorted = [...raw].sort((a, b) => Number(a[0]) - Number(b[0]));
  return sorted.map((row) => ({
    time: Math.floor(Number(row[0]) / 1000),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
  }));
}
