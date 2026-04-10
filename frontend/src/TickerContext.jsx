import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { fetchPerpetuals, fetchTickers } from "./api.js";

const TICKER_POLL_MS = 15_000;
const SYMBOL_META_POLL_MS = 60_000;

const TickerContext = createContext(null);

export function TickerProvider({ children }) {
  const [rows, setRows] = useState([]);
  const [symbolCount, setSymbolCount] = useState(0);
  const [lastTickerAt, setLastTickerAt] = useState(null);
  const [lastSymbolsAt, setLastSymbolsAt] = useState(null);
  const [tickerError, setTickerError] = useState(null);
  const [symbolsError, setSymbolsError] = useState(null);

  const loadTickers = useCallback(async () => {
    try {
      const data = await fetchTickers();
      setRows(data.rows || []);
      setLastTickerAt(data.updatedAt || new Date().toISOString());
      setTickerError(null);
    } catch (e) {
      setTickerError(e.message || "Aggiornamento ticker fallito");
    }
  }, []);

  const loadSymbolMeta = useCallback(async () => {
    try {
      const meta = await fetchPerpetuals();
      setSymbolCount(meta.count ?? meta.symbols?.length ?? 0);
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
    ]
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
