/**
 * Allinea timestamp trade (ms) all'inizio candela Bybit / Lightweight Charts (secondi UTC).
 * `interval` come API REST: minuti ("1","5",…,"240") o "D".
 */
export function barStartSecFromTradeMs(tradeMs, interval) {
  if (interval === "D") {
    const d = new Date(tradeMs);
    const start = Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate()
    );
    return Math.floor(start / 1000);
  }
  const n = Number(interval);
  const intervalMs =
    Number.isFinite(n) && n > 0 ? n * 60 * 1000 : 15 * 60 * 1000;
  const startMs = Math.floor(tradeMs / intervalMs) * intervalMs;
  return Math.floor(startMs / 1000);
}

/**
 * Aggiorna OHLC della candela in formazione da un eseguito unico.
 * @param {{ time: number, open: number, high: number, low: number, close: number } | null} prev
 * @param {string|number} price — campo Bybit `p`
 * @param {number} tradeMs — campo Bybit `T`
 * @returns {{ time: number, open: number, high: number, low: number, close: number } | null}
 */
export function candleFromTrade(prev, price, tradeMs, interval) {
  const p = Number(price);
  if (!Number.isFinite(p) || !Number.isFinite(tradeMs)) return null;

  const barSec = barStartSecFromTradeMs(tradeMs, interval);

  if (!prev) {
    return { time: barSec, open: p, high: p, low: p, close: p };
  }

  if (barSec > prev.time) {
    return { time: barSec, open: p, high: p, low: p, close: p };
  }
  if (barSec < prev.time) return null;

  return {
    time: barSec,
    open: prev.open,
    high: Math.max(prev.high, p),
    low: Math.min(prev.low, p),
    close: p,
  };
}
