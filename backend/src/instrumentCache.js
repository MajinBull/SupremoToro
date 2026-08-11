import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { SYMBOL_REFRESH_MS } from "./config.js";
import {
  fetchTradingUsdtLinearPerpetualDetails,
  fetchTradingUsdtSpotDetails,
  fetchRecentlyClosedUsdtLinearPerpetuals,
} from "./bybit.js";
import {
  fetchBinanceSpotUsdtInstrumentDetails,
  fetchBinanceUsdtPerpetualInstrumentDetails,
  fetchRecentlyClosedBinanceUsdtPerpetuals,
} from "./binanceApi.js";
import { onTradingListRefreshed, getDelistedList } from "./listingTracker.js";
import { MARKET_KEYS, listMarketKeys } from "./marketKey.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Allineato alla richiesta UI: meno di 14 giorni da launch / onboard. */
const RECENT_BY_LAUNCH_MS = 14 * 24 * 60 * 60 * 1000;

const SNAPSHOT_PATH = join(
  __dirname,
  "../../api/data/linear-usdt-symbols.json",
);

const FETCH_DETAILS = {
  [MARKET_KEYS.BYBIT_LINEAR]: fetchTradingUsdtLinearPerpetualDetails,
  [MARKET_KEYS.BYBIT_SPOT]: fetchTradingUsdtSpotDetails,
  [MARKET_KEYS.BINANCE_SPOT]: fetchBinanceSpotUsdtInstrumentDetails,
  [MARKET_KEYS.BINANCE_FUTURES]: fetchBinanceUsdtPerpetualInstrumentDetails,
};

const FETCH_DELISTED = {
  [MARKET_KEYS.BYBIT_LINEAR]: fetchRecentlyClosedUsdtLinearPerpetuals,
  [MARKET_KEYS.BINANCE_FUTURES]: fetchRecentlyClosedBinanceUsdtPerpetuals,
};

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
      listedAt: new Date(ms).toISOString(),
      visibleUntil: new Date(ms + RECENT_BY_LAUNCH_MS).toISOString(),
    }))
    .sort((a, b) => new Date(b.listedAt) - new Date(a.listedAt));
}

function emptyState() {
  return {
    symbols: [],
    launchTimeMsBySymbol: new Map(),
    lastUpdated: null,
    lastError: null,
    lastSuccessAt: 0,
    detectedDelisted: [],
  };
}

/** @type {Map<string, ReturnType<typeof emptyState>>} */
const caches = new Map();

function getCache(marketKey) {
  if (!caches.has(marketKey)) {
    caches.set(marketKey, emptyState());
  }
  return caches.get(marketKey);
}

export function getSymbolCacheState(marketKey = MARKET_KEYS.BYBIT_LINEAR) {
  const c = getCache(marketKey);
  const trackedDelisted = getDelistedList(marketKey);
  const bySymbol = new Map(
    [...trackedDelisted, ...c.detectedDelisted].map((item) => [item.symbol, item]),
  );
  const delisted = [...bySymbol.values()].sort((a, b) =>
    a.symbol.localeCompare(b.symbol),
  );
  return {
    symbols: [...c.symbols],
    lastUpdated: c.lastUpdated,
    lastError: c.lastError,
    count: c.symbols.length,
    recentListings: recentListingsFromLaunchMap(c.launchTimeMsBySymbol),
    delisted,
    marketKey,
  };
}

/** Stato compatto per /api/health (tutti i mercati). */
export function getAllMarketsCacheSummary() {
  const out = {};
  for (const key of listMarketKeys()) {
    const c = getCache(key);
    out[key] = {
      count: c.symbols.length,
      lastUpdated: c.lastUpdated,
      lastError: c.lastError,
    };
  }
  return out;
}

export function getSymbolsSet(marketKey = MARKET_KEYS.BYBIT_LINEAR) {
  return new Set(getCache(marketKey).symbols);
}

export async function refreshInstruments(marketKey = MARKET_KEYS.BYBIT_LINEAR) {
  const fetcher = FETCH_DETAILS[marketKey];
  if (!fetcher) return;
  const c = getCache(marketKey);
  try {
    const previous = [...c.symbols];
    const details = await fetcher();
    c.symbols = details.map((d) => d.symbol);
    c.launchTimeMsBySymbol = new Map(
      details.map((d) => [d.symbol, d.launchTimeMs]),
    );
    onTradingListRefreshed(marketKey, previous, c.symbols);
    const delistedFetcher = FETCH_DELISTED[marketKey];
    if (delistedFetcher) {
      try {
        const cutoff = Date.now() - RECENT_BY_LAUNCH_MS;
        const detected = await delistedFetcher();
        c.detectedDelisted = detected
          .filter((item) => item.delistedAtMs >= cutoff && item.delistedAtMs <= Date.now())
          .map((item) => ({
            symbol: item.symbol,
            delistedAt: new Date(item.delistedAtMs).toISOString(),
            visibleUntil: new Date(item.delistedAtMs + RECENT_BY_LAUNCH_MS).toISOString(),
          }));
      } catch (e) {
        console.warn(`[instrumentCache] delisted (${marketKey}):`, e.message);
      }
    } else {
      c.detectedDelisted = [];
    }
    c.lastUpdated = new Date().toISOString();
    c.lastError = null;
    c.lastSuccessAt = Date.now();
  } catch (e) {
    const msg = e.message || String(e);
    console.error(`[instrumentCache] refresh fallito (${marketKey}):`, msg);
    if (marketKey === MARKET_KEYS.BYBIT_LINEAR) {
      const snap = loadSnapshotSymbols();
      if (snap.length) {
        c.symbols = snap;
        c.launchTimeMsBySymbol = new Map();
        c.lastUpdated = new Date().toISOString();
        c.lastError = null;
        c.lastSuccessAt = Date.now();
      } else {
        c.lastError = msg;
      }
    } else {
      c.lastError = msg;
    }
  }
}

export async function refreshAllInstruments() {
  await Promise.all(listMarketKeys().map((k) => refreshInstruments(k)));
}

export async function ensureInstrumentsFresh(marketKey = MARKET_KEYS.BYBIT_LINEAR) {
  const c = getCache(marketKey);
  const stale =
    c.symbols.length === 0 ||
    !!c.lastError ||
    Date.now() - c.lastSuccessAt > SYMBOL_REFRESH_MS;
  if (stale) {
    await refreshInstruments(marketKey);
  }
  if (c.symbols.length === 0 && marketKey === MARKET_KEYS.BYBIT_LINEAR) {
    const snap = loadSnapshotSymbols();
    if (snap.length) {
      c.symbols = snap;
      c.launchTimeMsBySymbol = new Map();
      c.lastUpdated = new Date().toISOString();
      c.lastError = null;
      c.lastSuccessAt = Date.now();
    }
  }
}
