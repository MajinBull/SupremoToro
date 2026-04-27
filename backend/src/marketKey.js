/**
 * Mercati supportati: combinazioni exchange × spot/derivatives.
 */
export const MARKET_KEYS = {
  BYBIT_LINEAR: "bybit-linear",
  BYBIT_SPOT: "bybit-spot",
  BINANCE_FUTURES: "binance-futures",
  BINANCE_SPOT: "binance-spot",
};

const ALL_KEYS = Object.values(MARKET_KEYS);

export function listMarketKeys() {
  return [...ALL_KEYS];
}

/**
 * @param {string} [exchange]
 * @param {string} [market] derivatives | spot
 */
export function marketKeyFromQuery(exchange, market) {
  const ex = String(exchange || "bybit").toLowerCase().trim();
  const mk = String(market || "derivatives").toLowerCase().trim();
  if (ex === "bybit" && mk === "derivatives") return MARKET_KEYS.BYBIT_LINEAR;
  if (ex === "bybit" && mk === "spot") return MARKET_KEYS.BYBIT_SPOT;
  if (ex === "binance" && mk === "derivatives") return MARKET_KEYS.BINANCE_FUTURES;
  if (ex === "binance" && mk === "spot") return MARKET_KEYS.BINANCE_SPOT;
  return MARKET_KEYS.BYBIT_LINEAR;
}

/** @param {import('express').Request} req */
export function marketKeyFromRequestQuery(req) {
  return marketKeyFromQuery(req.query.exchange, req.query.market);
}
