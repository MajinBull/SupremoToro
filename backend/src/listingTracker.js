import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Stato delisting: stesso path degli snapshot in `api/data`. */
const STATE_PATH = join(__dirname, "../../api/data/listing-state.json");

const DELIST_TTL_MS = 14 * 24 * 60 * 60 * 1000;

const delisted = new Map();

function pruneDelisted(now = Date.now()) {
  for (const [sym, iso] of [...delisted.entries()]) {
    if (now - new Date(iso).getTime() > DELIST_TTL_MS) {
      delisted.delete(sym);
    }
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
    if (data.delisted && typeof data.delisted === "object") {
      for (const [k, v] of Object.entries(data.delisted)) {
        if (typeof v === "string") delisted.set(k, v);
      }
    }
    pruneDelisted();
  } catch {
    /* file assente */
  }
}

function persist() {
  try {
    pruneDelisted();
    writeFileSync(
      STATE_PATH,
      JSON.stringify(
        {
          delisted: Object.fromEntries(delisted),
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

loadPersisted();

/**
 * Confronta la lista perpetual USDT in Trading prima/dopo un refresh.
 * I simboli usciti restano in elenco delist fino a 14 giorni.
 */
export function onTradingListRefreshed(previousList, newTradingList) {
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

  pruneDelisted(now);
  persist();
}

export function getDelistedList() {
  pruneDelisted();
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
