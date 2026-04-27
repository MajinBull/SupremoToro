import {
  fetchLinearTickers,
  fetchSpotTickers,
  isUsdtLinearSymbol,
} from "./bybit.js";
import {
  fetchBinanceFuturesFundingMap,
  fetchBinanceFuturesTickerMap,
  fetchBinanceSpotTickerMap,
} from "./binanceApi.js";
import { MARKET_KEYS } from "./marketKey.js";

function numOrNull(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeBybitTickerRow(symbol, t) {
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
    volume24h: numOrNull(t.turnover24h ?? t.volume24h),
    price24hPcnt: numOrNull(t.price24hPcnt),
    fundingRate: numOrNull(t.fundingRate),
    openInterest: numOrNull(t.openInterest),
    openInterestValue: numOrNull(t.openInterestValue),
    missing: false,
  };
}

function normalizeBinanceRow(sym, t, fundingRate) {
  if (!t) {
    return {
      symbol: sym,
      lastPrice: null,
      volume24h: null,
      price24hPcnt: null,
      fundingRate: fundingRate != null ? numOrNull(fundingRate) : null,
      openInterest: null,
      openInterestValue: null,
      missing: true,
    };
  }
  const pctRaw = t.priceChangePercent;
  const pct =
    pctRaw != null && pctRaw !== ""
      ? Number(pctRaw) / 100
      : null;
  return {
    symbol: sym,
    lastPrice: numOrNull(t.lastPrice),
    volume24h: numOrNull(t.quoteVolume),
    price24hPcnt: pct != null && Number.isFinite(pct) ? pct : null,
    fundingRate: fundingRate != null ? numOrNull(fundingRate) : null,
    openInterest: null,
    openInterestValue: null,
    missing: false,
  };
}

function isLinearPerpTickerBybit(t) {
  return isUsdtLinearSymbol(t?.symbol);
}

/**
 * Righe ticker allineate alla dashboard per ogni mercato.
 * @param {Set<string>} known
 */
export async function fetchTickerRowsForMarket(marketKey, known) {
  switch (marketKey) {
    case MARKET_KEYS.BYBIT_LINEAR: {
      const list = await fetchLinearTickers();
      const bySymbol = new Map(list.map((t) => [t.symbol, t]));
      const rows = [];
      for (const sym of known) {
        rows.push(normalizeBybitTickerRow(sym, bySymbol.get(sym)));
      }
      for (const t of list) {
        if (!known.has(t.symbol) && isLinearPerpTickerBybit(t)) {
          rows.push(normalizeBybitTickerRow(t.symbol, t));
        }
      }
      rows.sort((a, b) => a.symbol.localeCompare(b.symbol));
      return rows;
    }
    case MARKET_KEYS.BYBIT_SPOT: {
      const list = await fetchSpotTickers();
      const bySymbol = new Map(list.map((t) => [t.symbol, t]));
      const rows = [];
      for (const sym of known) {
        rows.push(normalizeBybitTickerRow(sym, bySymbol.get(sym)));
      }
      for (const t of list) {
        if (!known.has(t.symbol) && isUsdtLinearSymbol(t.symbol)) {
          rows.push(normalizeBybitTickerRow(t.symbol, t));
        }
      }
      rows.sort((a, b) => a.symbol.localeCompare(b.symbol));
      return rows;
    }
    case MARKET_KEYS.BINANCE_SPOT: {
      const bySymbol = await fetchBinanceSpotTickerMap();
      const rows = [];
      for (const sym of known) {
        const u = sym.toUpperCase();
        rows.push(normalizeBinanceRow(u, bySymbol.get(u), null));
      }
      for (const [s, t] of bySymbol) {
        if (!known.has(s) && s.endsWith("USDT")) {
          rows.push(normalizeBinanceRow(s, t, null));
        }
      }
      rows.sort((a, b) => a.symbol.localeCompare(b.symbol));
      return rows;
    }
    case MARKET_KEYS.BINANCE_FUTURES: {
      const [bySymbol, fundingMap] = await Promise.all([
        fetchBinanceFuturesTickerMap(),
        fetchBinanceFuturesFundingMap(),
      ]);
      const rows = [];
      for (const sym of known) {
        const u = sym.toUpperCase();
        rows.push(
          normalizeBinanceRow(u, bySymbol.get(u), fundingMap.get(u) ?? null),
        );
      }
      for (const [s, t] of bySymbol) {
        if (!known.has(s) && s.endsWith("USDT")) {
          rows.push(
            normalizeBinanceRow(s, t, fundingMap.get(s) ?? null),
          );
        }
      }
      rows.sort((a, b) => a.symbol.localeCompare(b.symbol));
      return rows;
    }
    default:
      return [];
  }
}
