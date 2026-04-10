import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { fetchAllLinearPerpetualSymbols } from "../../backend/src/bybit.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadSnapshotSymbols() {
  try {
    const raw = readFileSync(
      join(__dirname, "../data/linear-usdt-symbols.json"),
      "utf8",
    );
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch (e) {
    console.warn("[api] snapshot simboli:", e.message);
    return [];
  }
}

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
    const msg = e.message || String(e);
    console.error("[api] Bybit instruments fallito:", msg);
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

/** Garantisce cache popolata (prima richiesta o lista vuota dopo errore). */
export async function ensureSymbolsLoaded() {
  if (symbols.length === 0 || lastError) {
    await refreshSymbols();
  }
  if (symbols.length === 0) {
    const snap = loadSnapshotSymbols();
    if (snap.length) {
      symbols = snap;
      lastUpdated = new Date().toISOString();
      lastError = null;
    }
  }
}
