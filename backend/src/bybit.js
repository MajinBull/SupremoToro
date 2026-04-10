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
 * Tutti i linear perpetual in Trading (paginazione cursor).
 */
export async function fetchAllLinearPerpetualSymbols() {
  const symbols = [];
  let cursor = undefined;

  do {
    // Nessuno status: per linear la doc Bybit dice che di default sono solo Trading.
    const result = await bybitGet("/v5/market/instruments-info", {
      category: "linear",
      limit: "500",
      ...(cursor ? { cursor } : {}),
    });

    const list = result.list || [];
    for (const row of list) {
      // Solo perpetual linear margine USDT (esclude USDC, EUR, ecc.)
      if (
        row.contractType === "LinearPerpetual" &&
        row.status === "Trading" &&
        row.quoteCoin === "USDT"
      ) {
        symbols.push(row.symbol);
      }
    }
    cursor = result.nextPageCursor || "";
  } while (cursor);

  return [...new Set(symbols)].sort();
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
