import { fetchTickerRowsForMarket } from "../backend/src/marketTickers.js";
import { marketKeyFromQuery } from "../backend/src/marketKey.js";
import {
  ensureSymbolsLoaded,
  getSymbolsSet,
  refreshSymbols,
} from "./lib/serverState.js";

export default async function handler(req, res) {
  try {
    const { exchange = "bybit", market = "derivatives" } = req.query;
    await ensureSymbolsLoaded(exchange, market);
    let known = getSymbolsSet(exchange, market);
    if (known.size === 0) {
      await refreshSymbols(exchange, market);
      known = getSymbolsSet(exchange, market);
    }
    const marketKey = marketKeyFromQuery(exchange, market);
    const rows = await fetchTickerRowsForMarket(marketKey, known);
    res.status(200).json({
      updatedAt: new Date().toISOString(), rows, exchange, market, marketKey,
    });
  } catch (e) {
    console.error("[api/tickers]", e);
    res.status(502).json({
      error: e.message || "Ticker non disponibili",
      rows: [],
    });
  }
}
