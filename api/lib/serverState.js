import {
  ensureInstrumentsFresh,
  refreshInstruments,
  getSymbolCacheState as getSymbolCacheStateForKey,
  getSymbolsSet as getSymbolsSetForKey,
} from "../../backend/src/instrumentCache.js";
import { marketKeyFromQuery } from "../../backend/src/marketKey.js";

export function getSymbolCacheState(exchange, market) {
  return getSymbolCacheStateForKey(marketKeyFromQuery(exchange, market));
}

export function getSymbolsSet(exchange, market) {
  return getSymbolsSetForKey(marketKeyFromQuery(exchange, market));
}

export async function ensureSymbolsLoaded(exchange, market) {
  await ensureInstrumentsFresh(marketKeyFromQuery(exchange, market));
}

export async function refreshSymbols(exchange, market) {
  await refreshInstruments(marketKeyFromQuery(exchange, market));
}
