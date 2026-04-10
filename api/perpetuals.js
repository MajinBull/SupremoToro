import {
  ensureSymbolsLoaded,
  getSymbolCacheState,
} from "./lib/serverState.js";

export default async function handler(req, res) {
  try {
    await ensureSymbolsLoaded();
    res.status(200).json(getSymbolCacheState());
  } catch (e) {
    res.status(500).json({ error: e.message || "Errore stato simboli" });
  }
}
