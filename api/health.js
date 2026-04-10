import {
  ensureSymbolsLoaded,
  getSymbolCacheState,
} from "./lib/serverState.js";

export default async function handler(req, res) {
  await ensureSymbolsLoaded();
  res.status(200).json({ ok: true, ...getSymbolCacheState() });
}
