import { SYMBOL_REFRESH_MS } from "./config.js";
import {
  refreshInstruments,
  refreshAllInstruments,
  getSymbolCacheState,
  getSymbolsSet,
  ensureInstrumentsFresh,
} from "./instrumentCache.js";
import { listMarketKeys } from "./marketKey.js";

export {
  getSymbolCacheState,
  getSymbolsSet,
  ensureInstrumentsFresh,
} from "./instrumentCache.js";

export async function refreshSymbols(marketKey) {
  if (marketKey) {
    await refreshInstruments(marketKey);
  } else {
    await refreshAllInstruments();
  }
}

let refreshTimer = null;

export function startSymbolRefreshLoop() {
  refreshAllInstruments();
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(refreshAllInstruments, SYMBOL_REFRESH_MS);
}
