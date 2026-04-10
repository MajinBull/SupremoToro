import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { fetchPerpetuals, fetchTickers } from "./api.js";
import {
  mapBybitWsTickerToRow,
  subscribeLinearTickers,
} from "./bybitLinearTickerWs.js";

const TICKER_POLL_MS = 15_000;
const SYMBOL_META_POLL_MS = 60_000;

const TickerContext = createContext(null);

export function TickerProvider({ children }) {
  const [rows, setRows] = useState([]);
  const [symbolList, setSymbolList] = useState([]);
  const [symbolCount, setSymbolCount] = useState(0);
  const [lastTickerAt, setLastTickerAt] = useState(null);
  const [lastSymbolsAt, setLastSymbolsAt] = useState(null);
  const [tickerError, setTickerError] = useState(null);
  const [symbolsError, setSymbolsError] = useState(null);
  /** true se /api/tickers fallisce: usiamo WS dal browser (IP utente). */
  const [useWsTickers, setUseWsTickers] = useState(false);

  const loadTickers = useCallback(async () => {
    try {
      const data = await fetchTickers();
      setRows(data.rows || []);
      setLastTickerAt(data.updatedAt || new Date().toISOString());
      setTickerError(null);
      setUseWsTickers(false);
    } catch {
      setTickerError(null);
      setUseWsTickers(true);
    }
  }, []);

  const loadSymbolMeta = useCallback(async () => {
    try {
      const meta = await fetchPerpetuals();
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
      setLastSymbolsAt(meta.lastUpdated || null);
      setSymbolsError(meta.lastError || null);
    } catch (e) {
      setSymbolsError(e.message || "Metadati simboli non disponibili");
    }
  }, []);

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
    if (!useWsTickers || symbolList.length === 0) {
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
  }, [useWsTickers, symbolList]);

  const value = useMemo(
    () => ({
      rows,
      symbolCount,
      lastTickerAt,
      lastSymbolsAt,
      tickerError,
      symbolsError,
      reloadTickers: loadTickers,
    }),
    [
      rows,
      symbolCount,
      lastTickerAt,
      lastSymbolsAt,
      tickerError,
      symbolsError,
      loadTickers,
    ],
  );

  return (
    <TickerContext.Provider value={value}>{children}</TickerContext.Provider>
  );
}

export function useTickers() {
  const ctx = useContext(TickerContext);
  if (!ctx) {
    throw new Error("useTickers deve essere usato dentro TickerProvider");
  }
  return ctx;
}
