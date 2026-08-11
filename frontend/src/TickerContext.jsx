import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { fetchPerpetuals, fetchTickers } from "./api.js";
import {
  mapBybitWsTickerToRow,
  subscribeLinearTickers,
} from "./bybitLinearTickerWs.js";
import { useMarket } from "./MarketContext.jsx";

const TICKER_POLL_MS = 15_000;
const SYMBOL_META_POLL_MS = 60_000;

/** Set when fetch fails; UI maps to translated message. */
export const SYMBOLS_ERROR_FALLBACK = "__symbols_meta_unavailable__";

const TickerContext = createContext(null);

export function TickerProvider({ children }) {
  const { marketQuery } = useMarket();
  const marketKey = `${marketQuery.exchange}:${marketQuery.market}`;
  const currentMarketKeyRef = useRef(marketKey);
  currentMarketKeyRef.current = marketKey;
  const [rows, setRows] = useState([]);
  const [symbolList, setSymbolList] = useState([]);
  const [symbolCount, setSymbolCount] = useState(0);
  const [recentListings, setRecentListings] = useState([]);
  const [delisted, setDelisted] = useState([]);
  const [lastTickerAt, setLastTickerAt] = useState(null);
  const [lastSymbolsAt, setLastSymbolsAt] = useState(null);
  const [tickerError, setTickerError] = useState(null);
  const [symbolsError, setSymbolsError] = useState(null);
  /** Solo Bybit perpetual linear: fallback WS dal browser se REST fallisce. */
  const [useWsTickers, setUseWsTickers] = useState(false);

  const allowsBybitLinearWsFallback =
    marketQuery.exchange === "bybit" && marketQuery.market === "derivatives";

  const loadTickers = useCallback(async () => {
    const requestMarketKey = `${marketQuery.exchange}:${marketQuery.market}`;
    try {
      const data = await fetchTickers(marketQuery);
      if (currentMarketKeyRef.current !== requestMarketKey) return;
      setRows(data.rows || []);
      setLastTickerAt(data.updatedAt || new Date().toISOString());
      setTickerError(null);
      setUseWsTickers(false);
    } catch {
      if (currentMarketKeyRef.current !== requestMarketKey) return;
      setTickerError(null);
      setUseWsTickers(allowsBybitLinearWsFallback);
      if (!allowsBybitLinearWsFallback) {
        setRows([]);
      }
    }
  }, [marketQuery, allowsBybitLinearWsFallback]);

  const loadSymbolMeta = useCallback(async () => {
    const requestMarketKey = `${marketQuery.exchange}:${marketQuery.market}`;
    try {
      const meta = await fetchPerpetuals(marketQuery);
      if (currentMarketKeyRef.current !== requestMarketKey) return;
      const list = meta.symbols || [];
      setSymbolList((prev) => {
        if (
          prev.length === list.length &&
          prev.every((s, i) => s === list[i])
        ) {
          return prev;
        }
        return list;
      });
      setSymbolCount(meta.count ?? list.length ?? 0);
      setRecentListings(
        Array.isArray(meta.recentListings) ? meta.recentListings : [],
      );
      setDelisted(Array.isArray(meta.delisted) ? meta.delisted : []);
      setLastSymbolsAt(meta.lastUpdated || null);
      setSymbolsError(meta.lastError || null);
    } catch (e) {
      if (currentMarketKeyRef.current !== requestMarketKey) return;
      setSymbolsError(e.message || SYMBOLS_ERROR_FALLBACK);
    }
  }, [marketQuery]);

  useEffect(() => {
    setUseWsTickers(false);
    setRows([]);
    setSymbolList([]);
    setSymbolCount(0);
    setRecentListings([]);
    setDelisted([]);
    setTickerError(null);
    setSymbolsError(null);
  }, [marketQuery.exchange, marketQuery.market]);

  useEffect(() => {
    loadTickers();
    loadSymbolMeta();
    const ti = setInterval(loadTickers, TICKER_POLL_MS);
    const si = setInterval(loadSymbolMeta, SYMBOL_META_POLL_MS);
    return () => {
      clearInterval(ti);
      clearInterval(si);
    };
  }, [loadTickers, loadSymbolMeta]);

  useEffect(() => {
    if (
      !useWsTickers ||
      !allowsBybitLinearWsFallback ||
      symbolList.length === 0
    ) {
      return undefined;
    }

    const placeholders = symbolList.map((sym) => ({
      symbol: sym,
      lastPrice: null,
      volume24h: null,
      price24hPcnt: null,
      fundingRate: null,
      openInterest: null,
      openInterestValue: null,
      missing: true,
    }));
    setRows(placeholders);
    setLastTickerAt(new Date().toISOString());

    return subscribeLinearTickers(symbolList, (sym, raw) => {
      const row = mapBybitWsTickerToRow(sym, raw);
      setRows((prev) => prev.map((r) => (r.symbol === sym ? row : r)));
    });
  }, [useWsTickers, allowsBybitLinearWsFallback, symbolList]);

  const value = useMemo(
    () => ({
      rows,
      symbolCount,
      recentListings,
      delisted,
      lastTickerAt,
      lastSymbolsAt,
      tickerError,
      symbolsError,
      reloadTickers: loadTickers,
      marketQuery,
    }),
    [
      rows,
      symbolCount,
      recentListings,
      delisted,
      lastTickerAt,
      lastSymbolsAt,
      tickerError,
      symbolsError,
      loadTickers,
      marketQuery,
    ],
  );

  return (
    <TickerContext.Provider value={value}>{children}</TickerContext.Provider>
  );
}

export function useTickers() {
  const ctx = useContext(TickerContext);
  if (!ctx) {
    throw new Error("useTickers must be used within TickerProvider");
  }
  return ctx;
}
