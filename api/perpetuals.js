import {
  ensureSymbolsLoaded,
  getSymbolCacheState,
} from "./lib/serverState.js";

export default async function handler(req, res) {
  try {
    const { exchange = "bybit", market = "derivatives" } = req.query;
    await ensureSymbolsLoaded(exchange, market);
    res.status(200).json(getSymbolCacheState(exchange, market));
  } catch (e) {
    res.status(500).json({ error: e.message || "Errore stato simboli" });
  }
}
