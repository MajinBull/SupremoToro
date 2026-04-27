import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { MARKET_KEYS, listMarketKeys } from "./marketKey.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Stato delisting per mercato (evita collisioni BTCUSDT tra exchange). */
const STATE_PATH = join(__dirname, "../../api/data/listing-state.json");

const DELIST_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/** @type {Map<string, Map<string, string>>} marketKey -> symbol -> delistedAt ISO */
const delistedByMarket = new Map();

function getDelistedMap(marketKey) {
  if (!delistedByMarket.has(marketKey)) {
    delistedByMarket.set(marketKey, new Map());
  }
  return delistedByMarket.get(marketKey);
}

function pruneDelistedMap(map, now = Date.now()) {
  for (const [sym, iso] of [...map.entries()]) {
    if (now - new Date(iso).getTime() > DELIST_TTL_MS) {
      map.delete(sym);
    }
  }
}

function pruneAll(now = Date.now()) {
  for (const mk of listMarketKeys()) {
    pruneDelistedMap(getDelistedMap(mk), now);
  }
}

function persist() {
  try {
    pruneAll();
    const markets = {};
    for (const mk of listMarketKeys()) {
      const m = getDelistedMap(mk);
      markets[mk] = Object.fromEntries(m);
    }
    writeFileSync(
      STATE_PATH,
      JSON.stringify(
        {
          version: 2,
          markets,
          updatedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
  } catch (e) {
    console.warn("[listingTracker] persist:", e.message);
  }
}

function loadPersisted() {
  try {
    const raw = readFileSync(STATE_PATH, "utf8");
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }

    /* Migrazione v1: un solo oggetto delisted → bybit-linear */
    if (
      data.delisted &&
      typeof data.delisted === "object" &&
      !data.markets &&
      data.version !== 2
    ) {
      const m = getDelistedMap(MARKET_KEYS.BYBIT_LINEAR);
      for (const [k, v] of Object.entries(data.delisted)) {
        if (typeof v === "string") m.set(k, v);
      }
      pruneAll();
      persist();
      return;
    }

    if (data.markets && typeof data.markets === "object") {
      for (const mk of listMarketKeys()) {
        const obj = data.markets[mk];
        if (!obj || typeof obj !== "object") continue;
        const m = getDelistedMap(mk);
        for (const [k, v] of Object.entries(obj)) {
          if (typeof v === "string") m.set(k, v);
        }
      }
    }

    pruneAll();
  } catch {
    /* file assente */
  }
}

loadPersisted();

/**
 * Confronta lista strumenti in Trading prima/dopo refresh (per mercato).
 * I simboli usciti restano in elenco delist fino a 14 giorni.
 * @param {string} marketKey es. bybit-linear, binance-spot
 */
export function onTradingListRefreshed(marketKey, previousList, newTradingList) {
  const delisted = getDelistedMap(marketKey);
  const prev = new Set(previousList);
  const next = new Set(newTradingList);
  const now = Date.now();

  for (const sym of prev) {
    if (!next.has(sym) && !delisted.has(sym)) {
      delisted.set(sym, new Date().toISOString());
    }
  }
  for (const sym of next) {
    delisted.delete(sym);
  }

  pruneDelistedMap(delisted, now);
  persist();
}

/**
 * @param {string} marketKey
 */
export function getDelistedList(marketKey = MARKET_KEYS.BYBIT_LINEAR) {
  const delisted = getDelistedMap(marketKey);
  pruneDelistedMap(delisted);
  const now = Date.now();
  return [...delisted.entries()]
    .filter(([_, iso]) => now - new Date(iso).getTime() <= DELIST_TTL_MS)
    .map(([symbol, delistedAt]) => ({
      symbol,
      delistedAt,
      visibleUntil: new Date(
        new Date(delistedAt).getTime() + DELIST_TTL_MS,
      ).toISOString(),
    }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
}
