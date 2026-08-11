import { useEffect, useMemo, useRef, useState } from "react";
import { fetchKlines } from "../api.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import { useTickers } from "../TickerContext.jsx";

const THRESHOLD_PCT = 5;
const SCAN_CONCURRENCY = 6;

function previousUtcDayKey() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1))
    .toISOString()
    .slice(0, 10);
}

function cacheKey(marketQuery) {
  return `quota:previousHigh:v1:${marketQuery.exchange}:${marketQuery.market}:${previousUtcDayKey()}`;
}

function loadCachedHighs(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "{}");
    return new Map(
      Object.entries(value).filter(([, high]) => Number.isFinite(high) && high > 0),
    );
  } catch {
    return new Map();
  }
}

function saveCachedHighs(key, highs) {
  try {
    localStorage.setItem(key, JSON.stringify(Object.fromEntries(highs)));
  } catch {
    /* ignore storage errors */
  }
}

function previousDayHigh(candles) {
  const now = new Date();
  const todayStartSec = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  ) / 1000;
  const previous = (candles || [])
    .filter((candle) => Number(candle.time) < todayStartSec)
    .sort((a, b) => Number(b.time) - Number(a.time))[0];
  const high = Number(previous?.high);
  return Number.isFinite(high) && high > 0 ? high : null;
}

function formatPrice(value) {
  if (!Number.isFinite(value)) return "-";
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: value >= 1000 ? 2 : value >= 1 ? 5 : 8,
  }).format(value);
}

export default function SignalsPage() {
  const { t } = useI18n();
  const { rows, marketQuery } = useTickers();
  const marketKey = `${marketQuery.exchange}:${marketQuery.market}`;
  const availableRows = useMemo(
    () => rows.filter((row) => row.symbol && Number.isFinite(row.lastPrice)),
    [rows],
  );
  const symbolSignature = useMemo(
    () => availableRows.map((row) => row.symbol).sort().join(","),
    [availableRows],
  );
  const [highs, setHighs] = useState(() => new Map());
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: 0 });
  const [scanning, setScanning] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const scanIdRef = useRef(0);

  useEffect(() => {
    if (!symbolSignature) {
      setHighs(new Map());
      setProgress({ done: 0, total: 0, failed: 0 });
      return undefined;
    }

    const scanId = ++scanIdRef.current;
    const key = cacheKey(marketQuery);
    const cached = loadCachedHighs(key);
    const symbols = symbolSignature.split(",");
    const missing = symbols.filter((symbol) => !cached.has(symbol));
    setHighs(new Map(cached));
    setProgress({ done: symbols.length - missing.length, total: symbols.length, failed: 0 });
    if (missing.length === 0) {
      setScanning(false);
      return undefined;
    }
    setScanning(true);

    let cursor = 0;
    let completed = symbols.length - missing.length;
    let failed = 0;
    const working = new Map(cached);

    async function worker() {
      while (scanIdRef.current === scanId) {
        const index = cursor++;
        if (index >= missing.length) return;
        const symbol = missing[index];
        try {
          const data = await fetchKlines(symbol, "D", { ...marketQuery, limit: 3 });
          const high = previousDayHigh(data.candles);
          if (high != null) working.set(symbol, high);
          else failed += 1;
        } catch {
          failed += 1;
        }
        completed += 1;
        if (scanIdRef.current === scanId) {
          setHighs(new Map(working));
          setProgress({ done: completed, total: symbols.length, failed });
        }
      }
    }

    Promise.all(
      Array.from({ length: Math.min(SCAN_CONCURRENCY, missing.length) }, worker),
    ).then(() => {
      if (scanIdRef.current !== scanId) return;
      saveCachedHighs(key, working);
      setScanning(false);
    });

    return () => {
      if (scanIdRef.current === scanId) scanIdRef.current += 1;
    };
  }, [marketKey, marketQuery, symbolSignature, refreshVersion]);

  const signals = useMemo(() => {
    const matches = [];
    for (const row of availableRows) {
      const previousHigh = highs.get(row.symbol);
      if (!Number.isFinite(previousHigh) || previousHigh <= 0) continue;
      const distancePct = ((previousHigh - row.lastPrice) / previousHigh) * 100;
      if (distancePct < 0 || distancePct > THRESHOLD_PCT) continue;
      matches.push({ ...row, previousHigh, distancePct });
    }
    return matches.sort((a, b) => a.distancePct - b.distancePct);
  }, [availableRows, highs]);

  function refreshScan() {
    try {
      localStorage.removeItem(cacheKey(marketQuery));
    } catch {
      /* ignore */
    }
    setRefreshVersion((value) => value + 1);
  }

  return (
    <main className="signals-page">
      <div className="signals-toolbar">
        <div>
          <h2 className="signals-title">{t("signals.title")}</h2>
          <p className="signals-market">
            {marketQuery.exchange === "binance" ? "Binance" : "Bybit"} ·{" "}
            {marketQuery.market === "spot" ? t("layout.spot") : t("layout.derivatives")}
          </p>
        </div>
        <button type="button" className="signals-refresh" onClick={refreshScan} disabled={scanning}>
          {t("signals.refresh")}
        </button>
      </div>

      <section className="signals-panel" aria-labelledby="previous-high-signal">
        <div className="signals-panel-head">
          <div>
            <h3 id="previous-high-signal">{t("signals.previousHighTitle")}</h3>
            <p>{t("signals.previousHighRule", { pct: THRESHOLD_PCT })}</p>
          </div>
          <span className="signals-count">{signals.length}</span>
        </div>

        <div className="signals-progress" aria-live="polite">
          {scanning
            ? t("signals.scanning", { done: progress.done, total: progress.total })
            : t("signals.scanned", { done: progress.done, failed: progress.failed })}
        </div>

        <div className="signals-table-wrap">
          <table className="signals-table">
            <thead>
              <tr>
                <th>{t("signals.symbol")}</th>
                <th>{t("signals.currentPrice")}</th>
                <th>{t("signals.previousHigh")}</th>
                <th>{t("signals.distance")}</th>
              </tr>
            </thead>
            <tbody>
              {signals.length === 0 && (
                <tr>
                  <td className="signals-empty" colSpan={4}>
                    {scanning ? t("signals.waiting") : t("signals.empty")}
                  </td>
                </tr>
              )}
              {signals.map((signal) => (
                <tr key={signal.symbol}>
                  <td className="signals-symbol">{signal.symbol}</td>
                  <td>{formatPrice(signal.lastPrice)}</td>
                  <td>{formatPrice(signal.previousHigh)}</td>
                  <td className="signals-distance">{signal.distancePct.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
