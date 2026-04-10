import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { SYMBOL_REFRESH_MS } from "./config.js";
import { fetchAllLinearPerpetualSymbols } from "./bybit.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadSnapshotSymbols() {
  try {
    const raw = readFileSync(
      join(__dirname, "../../api/data/linear-usdt-symbols.json"),
      "utf8",
    );
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch (e) {
    console.warn("[symbolCache] snapshot:", e.message);
    return [];
  }
}

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
    const msg = e.message || String(e);
    console.error("[symbolCache] refresh fallito:", msg);
    const snap = loadSnapshotSymbols();
    if (snap.length) {
      symbols = snap;
      lastUpdated = new Date().toISOString();
      lastError = null;
    } else {
      lastError = msg;
    }
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
