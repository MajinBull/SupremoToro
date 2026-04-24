import { SYMBOL_REFRESH_MS } from "./config.js";
import {
  refreshInstruments,
  getSymbolCacheState,
  getSymbolsSet,
} from "./instrumentCache.js";

export { getSymbolCacheState, getSymbolsSet } from "./instrumentCache.js";

export async function refreshSymbols() {
  await refreshInstruments();
}

let refreshTimer = null;

export function startSymbolRefreshLoop() {
  refreshInstruments();
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(refreshInstruments, SYMBOL_REFRESH_MS);
}
