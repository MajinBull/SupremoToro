import { BYBIT_BASE } from "./config.js";

/** Bybit risponde spesso 403 da IP datacenter se mancano header "da browser". */
const BYBIT_FETCH_HEADERS = {
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

/**
 * GET generico verso Bybit V5; in errore di rete/HTTP lancia Error con messaggio leggibile.
 */
export async function bybitGet(path, query = {}) {
  const params = new URLSearchParams(query);
  const url = `${BYBIT_BASE}${path}?${params}`;
  const res = await fetch(url, { headers: BYBIT_FETCH_HEADERS });
  if (!res.ok) {
    throw new Error(`Bybit HTTP ${res.status} per ${path}`);
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
    const result = await bybitGet("/v5/market/instruments-info", {
      category: "linear",
      status: "Trading",
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
