import {
  ensureInstrumentsFresh,
  refreshInstruments,
  getSymbolCacheState,
  getSymbolsSet,
} from "../../backend/src/instrumentCache.js";

export { getSymbolCacheState, getSymbolsSet };

export async function ensureSymbolsLoaded() {
  await ensureInstrumentsFresh();
}

export async function refreshSymbols() {
  await refreshInstruments();
}
