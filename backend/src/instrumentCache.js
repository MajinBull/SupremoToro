import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { SYMBOL_REFRESH_MS } from "./config.js";
import { fetchTradingUsdtLinearPerpetualDetails } from "./bybit.js";
import { onTradingListRefreshed, getDelistedList } from "./listingTracker.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Allineato alla richiesta UI: perpetual con meno di 14 giorni da `launchTime` Bybit. */
const RECENT_BY_LAUNCH_MS = 14 * 24 * 60 * 60 * 1000;

const SNAPSHOT_PATH = join(
  __dirname,
  "../../api/data/linear-usdt-symbols.json",
);

function loadSnapshotSymbols() {
  try {
    const raw = readFileSync(SNAPSHOT_PATH, "utf8");
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch (e) {
    console.warn("[instrumentCache] snapshot:", e.message);
    return [];
  }
}

function recentListingsFromLaunchMap(launchTimeMsBySymbol) {
  const now = Date.now();
  return [...launchTimeMsBySymbol.entries()]
    .filter(
      ([, ms]) =>
        ms != null && Number.isFinite(ms) && now - ms <= RECENT_BY_LAUNCH_MS,
    )
    .map(([symbol, ms]) => ({
      symbol,
      /** Ufficiale Bybit: apertura trading (≈ inizio storico candele). */
      listedAt: new Date(ms).toISOString(),
      visibleUntil: new Date(ms + RECENT_BY_LAUNCH_MS).toISOString(),
    }))
    .sort((a, b) => new Date(b.listedAt) - new Date(a.listedAt));
}

let symbols = [];
let launchTimeMsBySymbol = new Map();
let lastUpdated = null;
let lastError = null;
let lastSuccessAt = 0;

export function getSymbolCacheState() {
  return {
    symbols: [...symbols],
    lastUpdated,
    lastError,
    count: symbols.length,
    recentListings: recentListingsFromLaunchMap(launchTimeMsBySymbol),
    delisted: getDelistedList(),
  };
}

export function getSymbolsSet() {
  return new Set(symbols);
}

export async function refreshInstruments() {
  try {
    const previous = [...symbols];
    const details = await fetchTradingUsdtLinearPerpetualDetails();
    symbols = details.map((d) => d.symbol);
    launchTimeMsBySymbol = new Map(
      details.map((d) => [d.symbol, d.launchTimeMs]),
    );
    onTradingListRefreshed(previous, symbols);
    lastUpdated = new Date().toISOString();
    lastError = null;
    lastSuccessAt = Date.now();
  } catch (e) {
    const msg = e.message || String(e);
    console.error("[instrumentCache] refresh fallito:", msg);
    const snap = loadSnapshotSymbols();
    if (snap.length) {
      symbols = snap;
      launchTimeMsBySymbol = new Map();
      lastUpdated = new Date().toISOString();
      lastError = null;
      lastSuccessAt = Date.now();
    } else {
      lastError = msg;
    }
  }
}

/**
 * Su server long-lived aggiorna a intervalli; su serverless evita refresh a ogni richiesta.
 */
export async function ensureInstrumentsFresh() {
  const stale =
    symbols.length === 0 ||
    !!lastError ||
    Date.now() - lastSuccessAt > SYMBOL_REFRESH_MS;
  if (stale) {
    await refreshInstruments();
  }
  if (symbols.length === 0) {
    const snap = loadSnapshotSymbols();
    if (snap.length) {
      symbols = snap;
      launchTimeMsBySymbol = new Map();
      lastUpdated = new Date().toISOString();
      lastError = null;
      lastSuccessAt = Date.now();
    }
  }
}
