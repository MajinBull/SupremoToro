import { fetchLinearTickers } from "../backend/src/bybit.js";
import {
  ensureSymbolsLoaded,
  getSymbolsSet,
  refreshSymbols,
} from "./lib/serverState.js";
import { isLinearPerpTicker, normalizeTickerRow } from "./lib/tickersLogic.js";

export default async function handler(req, res) {
  try {
    await ensureSymbolsLoaded();
    let known = getSymbolsSet();
    if (known.size === 0) {
      await refreshSymbols();
      known = getSymbolsSet();
    }
    const list = await fetchLinearTickers();
    const bySymbol = new Map(list.map((t) => [t.symbol, t]));

    const rows = [];
    for (const sym of known) {
      const t = bySymbol.get(sym);
      rows.push(normalizeTickerRow(sym, t));
    }
    for (const t of list) {
      if (!known.has(t.symbol) && isLinearPerpTicker(t)) {
        rows.push(normalizeTickerRow(t.symbol, t));
      }
    }
    rows.sort((a, b) => a.symbol.localeCompare(b.symbol));
    res.status(200).json({ updatedAt: new Date().toISOString(), rows });
  } catch (e) {
    console.error("[api/tickers]", e);
    res.status(502).json({
      error: e.message || "Ticker Bybit non disponibili",
      rows: [],
    });
  }
}
