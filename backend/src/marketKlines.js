import { fetchKlines as fetchBybitLinearKlines } from "./kline.js";
import { fetchSpotKlines } from "./bybit.js";
import {
  fetchBinanceFuturesKlines,
  fetchBinanceSpotKlines,
} from "./binanceApi.js";
import { MARKET_KEYS } from "./marketKey.js";

export async function fetchKlinesForMarket(marketKey, symbol, interval, limit) {
  switch (marketKey) {
    case MARKET_KEYS.BYBIT_LINEAR:
      return fetchBybitLinearKlines(symbol, interval, limit);
    case MARKET_KEYS.BYBIT_SPOT:
      return fetchSpotKlines(symbol, interval, limit);
    case MARKET_KEYS.BINANCE_SPOT:
      return fetchBinanceSpotKlines(symbol, interval, limit);
    case MARKET_KEYS.BINANCE_FUTURES:
      return fetchBinanceFuturesKlines(symbol, interval, limit);
    default:
      return fetchBybitLinearKlines(symbol, interval, limit);
  }
}
