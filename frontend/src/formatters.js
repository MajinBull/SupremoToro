const priceFmt = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 8,
  minimumFractionDigits: 2,
});

const volFmt = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

const oiFmt = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

export function fmtPrice(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return priceFmt.format(n);
}

export function fmtVolume(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return volFmt.format(n);
}

/** Funding come percentuale (Bybit invia decimali, es. 0.0001 = 0.01%) */
export function fmtFunding(n) {
  if (n == null || Number.isNaN(n)) return "—";
  const pct = n * 100;
  const digits = Math.abs(pct) < 0.01 ? 4 : 3;
  return `${pct.toFixed(digits)}%`;
}

export function fmtOpenInterest(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return oiFmt.format(n);
}

/**
 * Variazione % rolling 24h (Bybit `price24hPcnt` come frazione, es. -0.0281 → -2.81%).
 */
export function fmtPriceChange24h(pcntFraction) {
  if (pcntFraction == null || Number.isNaN(pcntFraction)) return "—";
  const pct = pcntFraction * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}
