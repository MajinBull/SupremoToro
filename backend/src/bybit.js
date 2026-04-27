import { BYBIT_BASE } from "./config.js";

/**
 * Header minimali: un User-Agent "browser" finto può far rispondere 400 al WAF (TLS ≠ browser).
 * Il cursor Bybit è già percent-encoded: URLSearchParams lo ricodificherebbe → 400 sulle pagine successive.
 */
const BYBIT_FETCH_HEADERS = {
  Accept: "application/json",
};

function buildBybitUrl(path, query) {
  const { cursor, ...rest } = query;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(rest)) {
    if (v === undefined || v === null || v === "") continue;
    params.set(k, String(v));
  }
  const qs = params.toString();
  let url = `${BYBIT_BASE}${path}${qs ? `?${qs}` : ""}`;
  if (cursor) {
    url += `${qs ? "&" : "?"}cursor=${cursor}`;
  }
  return url;
}

/**
 * GET generico verso Bybit V5; in errore di rete/HTTP lancia Error con messaggio leggibile.
 */
export async function bybitGet(path, query = {}) {
  const url = buildBybitUrl(path, query);
  const res = await fetch(url, { headers: BYBIT_FETCH_HEADERS });
  if (!res.ok) {
    let hint = "";
    try {
      const t = await res.text();
      if (t && t.length < 400) hint = `: ${t.slice(0, 200)}`;
    } catch {
      /* ignore */
    }
    throw new Error(`Bybit HTTP ${res.status} per ${path}${hint}`);
  }
  const body = await res.json();
  if (body.retCode !== 0) {
    throw new Error(body.retMsg || `Bybit retCode ${body.retCode}`);
  }
  return body.result;
}

/**
 * Perpetual linear USDT in Trading con `launchTime` Bybit (ms UTC, inizio mercato / storia candele).
 */
export async function fetchTradingUsdtLinearPerpetualDetails() {
  const out = [];
  let cursor = undefined;

  do {
    const result = await bybitGet("/v5/market/instruments-info", {
      category: "linear",
      limit: "500",
      ...(cursor ? { cursor } : {}),
    });

    const list = result.list || [];
    for (const row of list) {
      if (
        row.contractType === "LinearPerpetual" &&
        row.status === "Trading" &&
        row.quoteCoin === "USDT"
      ) {
        const lt =
          row.launchTime != null && row.launchTime !== ""
            ? Number(row.launchTime)
            : null;
        out.push({
          symbol: row.symbol,
          launchTimeMs: Number.isFinite(lt) ? lt : null,
        });
      }
    }
    cursor = result.nextPageCursor || "";
  } while (cursor);

  out.sort((a, b) => a.symbol.localeCompare(b.symbol));
  return out;
}

/**
 * Solo elenco simboli (stesso universo di {@link fetchTradingUsdtLinearPerpetualDetails}).
 */
export async function fetchAllLinearPerpetualSymbols() {
  const d = await fetchTradingUsdtLinearPerpetualDetails();
  return d.map((x) => x.symbol);
}

/**
 * Snapshot ticker per category linear (tutti i simboli in una chiamata).
 */
export async function fetchLinearTickers() {
  const result = await bybitGet("/v5/market/tickers", {
    category: "linear",
  });
  const list = result.list || [];
  // category=linear include anche USDC/ecc.; allineiamo alla lista USDT-only
  return list.filter((t) => isUsdtLinearSymbol(t?.symbol));
}

/** Suffisso standard Bybit per perpetual linear USDT-margined */
export function isUsdtLinearSymbol(symbol) {
  return typeof symbol === "string" && symbol.endsWith("USDT");
}

/**
 * Spot USDT in Trading (launched time se presente da API).
 */
export async function fetchTradingUsdtSpotDetails() {
  const out = [];
  let cursor = undefined;

  do {
    const result = await bybitGet("/v5/market/instruments-info", {
      category: "spot",
      limit: "500",
      ...(cursor ? { cursor } : {}),
    });

    const list = result.list || [];
    for (const row of list) {
      if (
        row.status === "Trading" &&
        row.quoteCoin === "USDT" &&
        typeof row.symbol === "string"
      ) {
        const lt =
          row.launchTime != null && row.launchTime !== ""
            ? Number(row.launchTime)
            : null;
        out.push({
          symbol: row.symbol,
          launchTimeMs: Number.isFinite(lt) ? lt : null,
        });
      }
    }
    cursor = result.nextPageCursor || "";
  } while (cursor);

  out.sort((a, b) => a.symbol.localeCompare(b.symbol));
  return out;
}

/** Snapshot ticker spot (solo USDT dalla lista ticker). */
export async function fetchSpotTickers() {
  const result = await bybitGet("/v5/market/tickers", {
    category: "spot",
  });
  const list = result.list || [];
  return list.filter((t) => isUsdtLinearSymbol(t?.symbol));
}

/**
 * Candele spot (stessi codici interval della linear Bybit v5).
 */
export async function fetchSpotKlines(symbol, interval, limit = "500") {
  const cap = Math.min(Number(limit) || 500, 1000);
  const result = await bybitGet("/v5/market/kline", {
    category: "spot",
    symbol,
    interval: String(interval),
    limit: String(cap),
  });

  const raw = result.list || [];
  const sorted = [...raw].sort((a, b) => Number(a[0]) - Number(b[0]));

  return sorted.map((row) => ({
    time: Math.floor(Number(row[0]) / 1000),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
  }));
}
