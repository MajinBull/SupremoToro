import express from "express";
import cors from "cors";
import { PORT } from "./config.js";
import {
  startSymbolRefreshLoop,
  getSymbolCacheState,
  getSymbolsSet,
  refreshSymbols,
  ensureInstrumentsFresh,
} from "./symbolCache.js";
import { getAllMarketsCacheSummary } from "./instrumentCache.js";
import { marketKeyFromRequestQuery } from "./marketKey.js";
import { fetchTickerRowsForMarket } from "./marketTickers.js";
import { fetchKlinesForMarket } from "./marketKlines.js";

const app = express();

/** Sempre un array; slash finale sugli origin viene tolto (es. evita mismatch con il browser). */
const corsOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim().replace(/\/+$/, ""))
  .filter(Boolean);
app.use(
  cors(
    corsOrigins.length > 0
      ? { origin: corsOrigins, credentials: false }
      : { origin: true },
  ),
);
app.use(express.json());

function queryExchangeMarket(req) {
  const exchange = req.query.exchange || "bybit";
  const market = req.query.market || "derivatives";
  return { exchange, market };
}

/**
 * Lista strumenti (cache per exchange × spot/derivatives).
 * Query: exchange=bybit|binance, market=derivatives|spot
 */
app.get("/api/perpetuals", async (req, res) => {
  try {
    const mk = marketKeyFromRequestQuery(req);
    await ensureInstrumentsFresh(mk);
    const { exchange, market } = queryExchangeMarket(req);
    res.json({
      ...getSymbolCacheState(mk),
      exchange,
      market,
    });
  } catch (e) {
    res.status(500).json({ error: e.message || "Errore stato simboli" });
  }
});

/**
 * Forza refresh lista simboli (tutti i mercati o uno specifico via query).
 */
app.post("/api/perpetuals/refresh", async (req, res) => {
  try {
    const mk = req.query.exchange
      ? marketKeyFromRequestQuery(req)
      : null;
    await refreshSymbols(mk || undefined);
    if (mk) {
      await ensureInstrumentsFresh(mk);
      const { exchange, market } = queryExchangeMarket(req);
      res.json({
        ...getSymbolCacheState(mk),
        exchange,
        market,
      });
    } else {
      res.json({
        ok: true,
        markets: getAllMarketsCacheSummary(),
      });
    }
  } catch (e) {
    res.status(502).json({ error: e.message || "Refresh fallito" });
  }
});

/**
 * Snapshot ticker unificato per mercato selezionato.
 */
app.get("/api/tickers", async (req, res) => {
  try {
    const mk = marketKeyFromRequestQuery(req);
    let known = getSymbolsSet(mk);
    if (known.size === 0) {
      await ensureInstrumentsFresh(mk);
      known = getSymbolsSet(mk);
    }
    const rows = await fetchTickerRowsForMarket(mk, known);
    const { exchange, market } = queryExchangeMarket(req);
    res.json({
      updatedAt: new Date().toISOString(),
      rows,
      exchange,
      market,
      marketKey: mk,
    });
  } catch (e) {
    console.error("[GET /api/tickers]", e);
    res.status(502).json({
      error: e.message || "Ticker non disponibili",
      rows: [],
    });
  }
});

/**
 * Candele per il grafico (stesso schema interval Bybit v5: 1, 5, 15, 60, 240, D).
 */
app.get("/api/klines", async (req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.set("Pragma", "no-cache");
  const {
    symbol,
    interval = "15",
    limit = "500",
    exchange,
    market,
  } = req.query;
  if (!symbol || typeof symbol !== "string") {
    return res.status(400).json({ error: "Query symbol obbligatorio" });
  }
  const mk = marketKeyFromRequestQuery({
    query: { exchange, market },
  });
  try {
    const candles = await fetchKlinesForMarket(
      mk,
      symbol.toUpperCase(),
      interval,
      limit,
    );
    res.json({
      symbol: symbol.toUpperCase(),
      interval,
      candles,
      exchange: exchange || "bybit",
      market: market || "derivatives",
      marketKey: mk,
    });
  } catch (e) {
    console.error("[GET /api/klines]", e);
    res.status(502).json({
      error: e.message || "Kline non disponibili",
      candles: [],
    });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    markets: getAllMarketsCacheSummary(),
    ...getSymbolCacheState(),
  });
});

startSymbolRefreshLoop();

app.listen(PORT, () => {
  console.log(`Quota backend http://localhost:${PORT}`);
  console.log(
    "Endpoint: GET /api/perpetuals?exchange=&market=, /api/tickers, /api/klines",
  );
});
