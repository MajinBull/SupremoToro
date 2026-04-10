import { SYMBOL_REFRESH_MS } from "./config.js";
import { fetchAllLinearPerpetualSymbols } from "./bybit.js";

let symbols = [];
let lastUpdated = null;
let lastError = null;
let refreshTimer = null;

export function getSymbolCacheState() {
  return {
    symbols: [...symbols],
    lastUpdated,
    lastError,
    count: symbols.length,
  };
}

/**
 * Aggiorna la lista da Bybit; errori non propagati al crash dell'app.
 */
export async function refreshSymbols() {
  try {
    symbols = await fetchAllLinearPerpetualSymbols();
    lastUpdated = new Date().toISOString();
    lastError = null;
  } catch (e) {
    lastError = e.message || String(e);
    console.error("[symbolCache] refresh fallito:", lastError);
  }
}

export function startSymbolRefreshLoop() {
  refreshSymbols();
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(refreshSymbols, SYMBOL_REFRESH_MS);
}

export function getSymbolsSet() {
  return new Set(symbols);
}
