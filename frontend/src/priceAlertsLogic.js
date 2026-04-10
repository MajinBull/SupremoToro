/**
 * Segmento [prev, curr] intercetta il livello (include tocco agli estremi).
 */
export function priceSegmentHitsLevel(prev, curr, level) {
  if (!Number.isFinite(prev) || !Number.isFinite(curr) || !Number.isFinite(level)) {
    return false;
  }
  const lo = Math.min(prev, curr);
  const hi = Math.max(prev, curr);
  return lo <= level && hi >= level;
}

export function normalizeAlertSymbol(symbol) {
  return String(symbol || "").trim().toUpperCase();
}
