import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "quota:marketSel:v1";

const DEFAULT_STATE = {
  exchange: "bybit",
  marketType: "derivatives",
};

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const p = JSON.parse(raw);
    const exchange = p.exchange === "binance" ? "binance" : "bybit";
    const marketType = p.marketType === "spot" ? "spot" : "derivatives";
    return { exchange, marketType };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

const MarketContext = createContext(null);

export function MarketProvider({ children }) {
  const [exchange, setExchangeState] = useState(() => loadStored().exchange);
  const [marketType, setMarketTypeState] = useState(
    () => loadStored().marketType,
  );

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ exchange, marketType }),
      );
    } catch {
      /* ignore */
    }
  }, [exchange, marketType]);

  const setExchange = useCallback((ex) => {
    setExchangeState(ex === "binance" ? "binance" : "bybit");
  }, []);

  const setMarketType = useCallback((mt) => {
    setMarketTypeState(mt === "spot" ? "spot" : "derivatives");
  }, []);

  /** Query backend: market = derivatives | spot */
  const marketQuery = useMemo(
    () => ({
      exchange,
      market: marketType === "spot" ? "spot" : "derivatives",
    }),
    [exchange, marketType],
  );

  const value = useMemo(
    () => ({
      exchange,
      setExchange,
      marketType,
      setMarketType,
      marketQuery,
    }),
    [exchange, setExchange, marketType, setMarketType, marketQuery],
  );

  return (
    <MarketContext.Provider value={value}>{children}</MarketContext.Provider>
  );
}

export function useMarket() {
  const ctx = useContext(MarketContext);
  if (!ctx) {
    throw new Error("useMarket must be used within MarketProvider");
  }
  return ctx;
}
