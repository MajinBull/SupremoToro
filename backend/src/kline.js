import { bybitGet } from "./bybit.js";

/**
 * Ritorna array { time, open, high, low, close } per Lightweight Charts.
 * time in secondi (UTC).
 */
export async function fetchKlines(symbol, interval, limit = "500") {
  const cap = Math.min(Number(limit) || 500, 1000);
  const result = await bybitGet("/v5/market/kline", {
    category: "linear",
    symbol,
    interval: String(interval),
    limit: String(cap),
  });

  const raw = result.list || [];
  // Bybit restituisce solitamente dal più recente; ordiniamo cronologicamente
  const sorted = [...raw].sort((a, b) => Number(a[0]) - Number(b[0]));

  return sorted.map((row) => ({
    time: Math.floor(Number(row[0]) / 1000),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
  }));
}
