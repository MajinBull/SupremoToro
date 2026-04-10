import { fetchAllLinearPerpetualSymbols } from "../../backend/src/bybit.js";

let symbols = [];
let lastUpdated = null;
let lastError = null;

export function getSymbolCacheState() {
  return {
    symbols: [...symbols],
    lastUpdated,
    lastError,
    count: symbols.length,
  };
}

export function getSymbolsSet() {
  return new Set(symbols);
}

export async function refreshSymbols() {
  try {
    symbols = await fetchAllLinearPerpetualSymbols();
    lastUpdated = new Date().toISOString();
    lastError = null;
  } catch (e) {
    lastError = e.message || String(e);
    console.error("[api] refresh simboli:", lastError);
  }
}

/** Garantisce cache popolata (prima richiesta o lista vuota dopo errore). */
export async function ensureSymbolsLoaded() {
  if (symbols.length === 0 || lastError) {
    await refreshSymbols();
  }
}
