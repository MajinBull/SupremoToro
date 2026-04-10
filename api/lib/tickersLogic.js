import { isUsdtLinearSymbol } from "../../backend/src/bybit.js";

export function isLinearPerpTicker(t) {
  return isUsdtLinearSymbol(t?.symbol);
}

export function normalizeTickerRow(symbol, t) {
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

function numOrNull(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
