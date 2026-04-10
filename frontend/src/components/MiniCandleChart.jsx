import { useEffect, useMemo, useRef, useState } from "react";
import { ColorType, LineStyle, createChart } from "lightweight-charts";
import { fetchKlines } from "../api.js";
import { subscribePublicTrade } from "../bybitPublicWs.js";
import {
  applyKlineCandles,
  CHART_RIGHT_OFFSET_BARS,
  priceFormatForCandles,
  safeCandlestickUpdate,
} from "../chartKlineUpdate.js";
import { candleFromTrade } from "../tradeBarUpdate.js";
import { applyEmaToLineSeries } from "../ema.js";
import { normalizeAlertSymbol } from "../priceAlertsLogic.js";
import { usePriceAlerts } from "../PriceAlertsContext.jsx";
import { unlockAlertAudio } from "../priceAlertSound.js";
import FavoriteStar from "./FavoriteStar.jsx";

/** Etichette tempo compatte con zeri espliciti (evita artefatti tipo "18:0"). */
function formatTimeScaleLabel(time) {
  let d;
  if (typeof time === "number") {
    d = new Date(time * 1000);
  } else if (typeof time === "string") {
    d = new Date(time);
  } else if (time && typeof time === "object" && "year" in time) {
    d = new Date(Date.UTC(time.year, time.month - 1, time.day));
  } else {
    return "";
  }
  if (Number.isNaN(d.getTime())) return "";
  const day = String(d.getUTCDate()).padStart(2, "0");
  const mon = d.toLocaleString("it-IT", { month: "short", timeZone: "UTC" });
  const h = String(d.getUTCHours()).padStart(2, "0");
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day} ${mon} ${h}:${m}`;
}

/**
 * Grafico candlestick compatto per griglia multi-grafico.
 */
export default function MiniCandleChart({
  symbol,
  interval,
  pollMs = 1000,
  liveTrades = true,
  ema10On = false,
  ema60On = false,
  ema223On = false,
  onRemove,
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const emaLineRefs = useRef({ s10: null, s60: null, s223: null });
  const klineMetaRef = useRef(null);
  /** Ultima candela (OHLC) per applicare eseguiti WebSocket senza ricalcolo completo */
  const formingBarRef = useRef(null);
  const emaOptsRef = useRef({ e10: false, e60: false, e223: false });
  emaOptsRef.current = { e10: ema10On, e60: ema60On, e223: ema223On };
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  /** Dopo tasto destro: posizione campanella conferma alert (coordinate dentro mini-chart-body). */
  const [pendingAlertUi, setPendingAlertUi] = useState(null);
  const pendingBellRef = useRef(null);

  const { alerts, addPriceAlert, processPriceUpdate } = usePriceAlerts();
  const addPriceAlertRef = useRef(addPriceAlert);
  addPriceAlertRef.current = addPriceAlert;
  const processPriceUpdateRef = useRef(processPriceUpdate);
  processPriceUpdateRef.current = processPriceUpdate;

  const chartAlerts = useMemo(
    () =>
      alerts.filter(
        (a) =>
          !a.triggeredAt &&
          normalizeAlertSymbol(a.symbol) === normalizeAlertSymbol(symbol)
      ),
    [alerts, symbol]
  );

  function refreshEmaLines() {
    const candle = seriesRef.current;
    const { s10, s60, s223 } = emaLineRefs.current;
    if (!candle) return;
    const o = emaOptsRef.current;
    applyEmaToLineSeries(candle, s10, 10, o.e10);
    applyEmaToLineSeries(candle, s60, 60, o.e60);
    applyEmaToLineSeries(candle, s223, 223, o.e223);
  }

  useEffect(() => {
    if (!symbol || !containerRef.current) return;
    const el = containerRef.current;

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "#12151c" },
        textColor: "#a8b0bd",
        fontSize: 11,
        fontFamily:
          "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "#252b36" },
        horzLines: { color: "#252b36" },
      },
      rightPriceScale: {
        borderColor: "#2a3140",
        scaleMargins: { top: 0.12, bottom: 0.22 },
        entireTextOnly: true,
        minimumWidth: 56,
      },
      timeScale: {
        borderColor: "#2a3140",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: CHART_RIGHT_OFFSET_BARS,
        barSpacing: 7,
        minBarSpacing: 0.75,
        fixRightEdge: false,
      },
      localization: {
        locale: "it-IT",
        timeFormatter: formatTimeScaleLabel,
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

    const lineOpts = {
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      title: "",
      /** Le EMA non devono espandere l'asse Y: priorità al prezzo (candele). */
      autoscaleInfoProvider: () => null,
    };
    const s10 = chart.addLineSeries({
      color: "#fbbf24",
      ...lineOpts,
    });
    const s60 = chart.addLineSeries({
      color: "#22d3ee",
      ...lineOpts,
    });
    const s223 = chart.addLineSeries({
      color: "#a78bfa",
      ...lineOpts,
    });
    emaLineRefs.current = { s10, s60, s223 };

    chartRef.current = chart;
    seriesRef.current = series;

    const chartEl = chart.chartElement();
    const onContextMenu = (ev) => {
      ev.preventDefault();
      if (!(ev.target instanceof Element)) return;
      const rect = ev.target.getBoundingClientRect();
      const y = ev.clientY - rect.top;
      const raw = series.coordinateToPrice(y);
      const level = raw == null ? null : Number(raw);
      if (!Number.isFinite(level)) return;

      let refPrice;
      const data = series.data();
      const last = data[data.length - 1];
      if (last && typeof last.close === "number") refPrice = last.close;

      const body = containerRef.current;
      if (!body) return;
      const br = body.getBoundingClientRect();
      setPendingAlertUi({
        left: ev.clientX - br.left,
        top: ev.clientY - br.top,
        price: level,
        refPrice,
      });
    };
    chartEl.addEventListener("contextmenu", onContextMenu);

    const resize = () => {
      if (!containerRef.current || !chartRef.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      const w = Math.max(0, clientWidth);
      const h = Math.max(0, clientHeight);
      chart.applyOptions({ width: w, height: h });
    };

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(resize);
    });
    ro.observe(el);
    requestAnimationFrame(resize);

    return () => {
      chartEl.removeEventListener("contextmenu", onContextMenu);
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      emaLineRefs.current = { s10: null, s60: null, s223: null };
    };
  }, [symbol]);

  useEffect(() => {
    setPendingAlertUi(null);
  }, [symbol]);

  useEffect(() => {
    if (!pendingAlertUi) return;
    const onKey = (e) => {
      if (e.key === "Escape") setPendingAlertUi(null);
    };
    const onDocMouseDown = (e) => {
      if (pendingBellRef.current?.contains(e.target)) return;
      setPendingAlertUi(null);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDocMouseDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDocMouseDown);
    };
  }, [pendingAlertUi]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    const lines = chartAlerts.map((a) =>
      series.createPriceLine({
        price: a.price,
        color: "#f59e0b",
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: "Alert",
      })
    );
    return () => {
      for (const line of lines) {
        series.removePriceLine(line);
      }
    };
  }, [symbol, chartAlerts]);

  useEffect(() => {
    klineMetaRef.current = null;
    formingBarRef.current = null;
    if (!symbol || !seriesRef.current) return;

    let cancelled = false;
    let firstLoad = true;

    async function load() {
      if (firstLoad) setLoading(true);
      setErr(null);
      try {
        const { candles } = await fetchKlines(symbol, interval);
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
          priceFormatForCandles
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
        refreshEmaLines();
        if (last && Number.isFinite(last.close)) {
          processPriceUpdateRef.current(symbol, last.close);
        }
      } catch (e) {
        if (!cancelled) setErr(e.message || "Errore kline");
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
          const c = candleFromTrade(state, row.p, row.T, interval);
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
        refreshEmaLines();
        if (Number.isFinite(state.close)) {
          processPriceUpdateRef.current(symbol, state.close);
        }
      });
    }

    return () => {
      cancelled = true;
      window.clearInterval(pollId);
      unsubTrade();
    };
  }, [symbol, interval, pollMs, liveTrades]);

  useEffect(() => {
    refreshEmaLines();
  }, [ema10On, ema60On, ema223On, symbol]);

  return (
    <div className="mini-chart-card">
      <div className="mini-chart-head">
        <span className="mini-chart-title">
          <span className="mini-chart-symbol">{symbol}</span>
          <FavoriteStar symbol={symbol} />
        </span>
        {onRemove && (
          <button
            type="button"
            className="mini-chart-remove"
            onClick={() => onRemove(symbol)}
            title="Rimuovi grafico"
            aria-label={`Rimuovi ${symbol}`}
          >
            ×
          </button>
        )}
      </div>
      {err && <div className="mini-chart-err">{err}</div>}
      <div
        className="mini-chart-body"
        ref={containerRef}
        title="Tasto destro sul grafico → clic sulla campanella per creare un alert a quel prezzo"
      >
        {loading && <div className="chart-loading">…</div>}
        {pendingAlertUi && (
          <div
            ref={pendingBellRef}
            className="mini-chart-pending-alert"
            style={{
              left: pendingAlertUi.left,
              top: pendingAlertUi.top,
            }}
          >
            <button
              type="button"
              className="mini-chart-pending-alert-bell"
              title={`Alert a ${pendingAlertUi.price}`}
              aria-label={`Conferma alert prezzo ${pendingAlertUi.price} per ${symbol}`}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                unlockAlertAudio();
                addPriceAlertRef.current(
                  symbol,
                  pendingAlertUi.price,
                  pendingAlertUi.refPrice
                );
                setPendingAlertUi(null);
              }}
            >
              🔔
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
