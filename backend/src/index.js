import express from "express";
import cors from "cors";
import { PORT } from "./config.js";
import {
  startSymbolRefreshLoop,
  getSymbolCacheState,
  getSymbolsSet,
  refreshSymbols,
} from "./symbolCache.js";
import { fetchLinearTickers, isUsdtLinearSymbol } from "./bybit.js";
import { fetchKlines } from "./kline.js";

const app = express();

/** Sempre un array: se CORS_ORIGINS manca, lista vuota → cors usa origin: true */
const corsOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors(
    corsOrigins.length > 0
      ? { origin: corsOrigins, credentials: false }
      : { origin: true },
  ),
);
app.use(express.json());

/**
 * Lista perpetual linear USDT-margined in Trading (cache aggiornata periodicamente).
 */
app.get("/api/perpetuals", (_req, res) => {
  try {
    res.json(getSymbolCacheState());
  } catch (e) {
    res.status(500).json({ error: e.message || "Errore stato simboli" });
  }
});

/**
 * Forza refresh lista simboli (utile dopo annunci di listature).
 */
app.post("/api/perpetuals/refresh", async (_req, res) => {
  try {
    await refreshSymbols();
    res.json(getSymbolCacheState());
  } catch (e) {
    res.status(502).json({ error: e.message || "Refresh fallito" });
  }
});

/**
 * Ticker linear: unisce snapshot Bybit con elenco simboli noti.
 * Include anche simboli presenti nei ticker ma non ancora in cache (nuove listature).
 */
app.get("/api/tickers", async (_req, res) => {
  try {
    let known = getSymbolsSet();
    // Primo avvio: la cache potrebbe non essere ancora pronta
    if (known.size === 0) {
      await refreshSymbols();
      known = getSymbolsSet();
    }
    const list = await fetchLinearTickers();
    const bySymbol = new Map(list.map((t) => [t.symbol, t]));

    const rows = [];
    for (const sym of known) {
      const t = bySymbol.get(sym);
      rows.push(normalizeTickerRow(sym, t));
    }

    for (const t of list) {
      if (!known.has(t.symbol) && isLinearPerpTicker(t)) {
        rows.push(normalizeTickerRow(t.symbol, t));
      }
    }

    rows.sort((a, b) => a.symbol.localeCompare(b.symbol));
    res.json({ updatedAt: new Date().toISOString(), rows });
  } catch (e) {
    console.error("[GET /api/tickers]", e);
    res.status(502).json({
      error: e.message || "Ticker Bybit non disponibili",
      rows: [],
    });
  }
});

/**
 * Kline / candele per il grafico.
 * interval: 1, 5, 15, 60, 240, D (come da API Bybit v5)
 */
app.get("/api/klines", async (req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.set("Pragma", "no-cache");
  const { symbol, interval = "15", limit = "500" } = req.query;
  if (!symbol || typeof symbol !== "string") {
    return res.status(400).json({ error: "Query symbol obbligatorio" });
  }
  try {
    const candles = await fetchKlines(symbol.toUpperCase(), interval, limit);
    res.json({ symbol: symbol.toUpperCase(), interval, candles });
  } catch (e) {
    console.error("[GET /api/klines]", e);
    res.status(502).json({
      error: e.message || "Kline non disponibili",
      candles: [],
    });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, ...getSymbolCacheState() });
});

function isLinearPerpTicker(t) {
  return isUsdtLinearSymbol(t?.symbol);
}

function normalizeTickerRow(symbol, t) {
  if (!t) {
    return {
      symbol,
      lastPrice: null,
      volume24h: null,
      price24hPcnt: null,
      fundingRate: null,
      openInterest: null,
      openInterestValue: null,
      missing: true,
    };
  }
  return {
    symbol: t.symbol,
    lastPrice: numOrNull(t.lastPrice),
    /**
     * Allineato alla colonna Volume Bybit (USDT): `turnover24h` = turnover 24h in quote.
     * `volume24h` nell’API è il volume in base/contratti, non va confuso con il volume USDT in UI.
     */
    volume24h: numOrNull(t.turnover24h ?? t.volume24h),
    /** Variazione % prezzo ultime 24h (decimale Bybit, es. 0.025 = +2.5%) */
    price24hPcnt: numOrNull(t.price24hPcnt),
    fundingRate: numOrNull(t.fundingRate),
    openInterest: numOrNull(t.openInterest),
    openInterestValue: numOrNull(t.openInterestValue),
    missing: false,
  };
}

function numOrNull(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

startSymbolRefreshLoop();

app.listen(PORT, () => {
  console.log(`Bullweb backend http://localhost:${PORT}`);
  console.log("Endpoint: GET /api/perpetuals, /api/tickers, /api/klines");
});
