import { useEffect, useRef, useState } from "react";
import { createChart, ColorType } from "lightweight-charts";
import { fetchKlines } from "../api.js";
import { subscribePublicTrade } from "../bybitPublicWs.js";
import { TIMEFRAMES } from "../timeframes.js";
import {
  applyKlineCandles,
  CHART_RIGHT_OFFSET_BARS,
  priceFormatForCandles,
  safeCandlestickUpdate,
} from "../chartKlineUpdate.js";
import { candleFromTrade } from "../tradeBarUpdate.js";

/**
 * Pannello laterale: grafico candlestick con refresh al cambio simbolo/intervallo.
 */
export default function ChartPanel({
  symbol,
  open,
  onClose,
  pollMs = 1000,
  liveTrades = true,
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const klineMetaRef = useRef(null);
  const formingBarRef = useRef(null);
  const [chartInterval, setChartInterval] = useState(TIMEFRAMES[2].api);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!open || !symbol || !containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#161a22" },
        textColor: "#94a3b8",
      },
      grid: {
        vertLines: { color: "#2a3140" },
        horzLines: { color: "#2a3140" },
      },
      rightPriceScale: { borderColor: "#2a3140" },
      timeScale: {
        borderColor: "#2a3140",
        rightOffset: CHART_RIGHT_OFFSET_BARS,
      },
      crosshair: { mode: 0 },
    });

    const series = chart.addCandlestickSeries({
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      if (!containerRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      chart.applyOptions({ width, height });
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [open, symbol]);

  useEffect(() => {
    klineMetaRef.current = null;
    formingBarRef.current = null;
    if (!open || !symbol || !seriesRef.current) return;

    let cancelled = false;
    let firstLoad = true;

    async function load() {
      if (firstLoad) setLoading(true);
      setErr(null);
      try {
        const { candles } = await fetchKlines(symbol, chartInterval);
        if (cancelled || !seriesRef.current) return;
        const data = candles.map((c) => ({
          time: c.time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));
        applyKlineCandles(
          seriesRef.current,
          chartRef.current,
          data,
          klineMetaRef,
          priceFormatForCandles,
          120
        );
        const last = data[data.length - 1];
        if (last) {
          formingBarRef.current = {
            time: last.time,
            open: last.open,
            high: last.high,
            low: last.low,
            close: last.close,
          };
        }
      } catch (e) {
        if (!cancelled) setErr(e.message || "Errore caricamento kline");
      } finally {
        if (!cancelled && firstLoad) {
          firstLoad = false;
          setLoading(false);
        }
      }
    }

    load();
    const pollId = window.setInterval(load, pollMs);

    let unsubTrade = () => {};
    if (liveTrades && typeof WebSocket !== "undefined") {
      const sym = symbol.toUpperCase();
      unsubTrade = subscribePublicTrade(symbol, (rows) => {
        if (cancelled || !seriesRef.current) return;
        let state = formingBarRef.current;
        if (!state) return;
        const sorted = [...rows].sort(
          (a, b) => Number(a.T ?? 0) - Number(b.T ?? 0)
        );
        for (const row of sorted) {
          if (row.s && String(row.s).toUpperCase() !== sym) continue;
          const c = candleFromTrade(state, row.p, row.T, chartInterval);
          if (!c) continue;
          const next = {
            time: c.time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          };
          if (!safeCandlestickUpdate(seriesRef.current, c)) continue;
          state = next;
        }
        formingBarRef.current = state;
        if (klineMetaRef.current) {
          klineMetaRef.current = {
            firstT: klineMetaRef.current.firstT,
            lastT: state.time,
          };
        }
      });
    }

    return () => {
      cancelled = true;
      window.clearInterval(pollId);
      unsubTrade();
    };
  }, [open, symbol, chartInterval, pollMs, liveTrades]);

  if (!open || !symbol) return null;

  return (
    <>
      <div
        className={`drawer-backdrop ${open ? "open" : ""}`}
        onClick={onClose}
        aria-hidden
      />
      <aside className={`drawer ${open ? "open" : ""}`} role="dialog" aria-label="Grafico">
        <div className="drawer-header">
          <h2 className="drawer-title">{symbol}</h2>
          <button type="button" className="drawer-close" onClick={onClose}>
            Chiudi
          </button>
        </div>
        <div className="chart-toolbar">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.api}
              type="button"
              className={`tf-btn ${chartInterval === tf.api ? "active" : ""}`}
              onClick={() => setChartInterval(tf.api)}
            >
              {tf.label}
            </button>
          ))}
        </div>
        {err && (
          <div className="error-banner" style={{ margin: "0.5rem 1rem 0" }}>
            {err}
          </div>
        )}
        <div className="chart-container" ref={containerRef}>
          {loading && <div className="chart-loading">Caricamento…</div>}
        </div>
      </aside>
    </>
  );
}
