import { useEffect, useRef, useState } from "react";
import { ColorType, LineStyle, createChart } from "lightweight-charts";
import { fetchKlines } from "../api.js";
import { priceFormatForCandles } from "../chartKlineUpdate.js";
import { useI18n } from "../i18n/I18nContext.jsx";

const SIGNAL_CHART_RIGHT_OFFSET = 48;
const SIGNAL_CHART_BARS = {
  "1": 500,
  "5": 500,
  "30": 320,
  "60": 240,
  "240": 180,
  D: 90,
};

function intervalSeconds(interval) {
  if (interval === "D") return 86400;
  const minutes = Number(interval);
  return Number.isFinite(minutes) && minutes > 0 ? minutes * 60 : 900;
}

function nearestCandleTime(candles, triggeredAt, interval) {
  const target = Date.parse(triggeredAt) / 1000;
  if (!Number.isFinite(target) || candles.length === 0) return null;
  let nearest = candles[0];
  for (const candle of candles) {
    if (Math.abs(candle.time - target) < Math.abs(nearest.time - target)) {
      nearest = candle;
    }
  }
  const first = candles[0].time;
  const last = candles[candles.length - 1].time;
  const tolerance = intervalSeconds(interval);
  return target >= first - tolerance && target < last + tolerance
    ? nearest.time
    : null;
}

export default function SignalEventChart({ signal, marketQuery, interval }) {
  const { t } = useI18n();
  const lazyRef = useRef(null);
  const chartContainerRef = useRef(null);
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    const element = lazyRef.current;
    if (!element || active) return undefined;
    if (typeof IntersectionObserver === "undefined") {
      setActive(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setActive(true);
          observer.disconnect();
        }
      },
      { rootMargin: "320px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [active]);

  useEffect(() => {
    if (!active || !chartContainerRef.current) return undefined;
    const element = chartContainerRef.current;
    let cancelled = false;
    let rightOffsetFrame = 0;

    const chart = createChart(element, {
      layout: {
        background: { type: ColorType.Solid, color: "#12151c" },
        textColor: "#9ba6b7",
        fontSize: 10,
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "#242a35" },
        horzLines: { color: "#242a35" },
      },
      rightPriceScale: {
        borderColor: "#2a3140",
        scaleMargins: { top: 0.12, bottom: 0.12 },
        minimumWidth: 62,
      },
      timeScale: {
        borderColor: "#2a3140",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 4,
        barSpacing: 5,
        minBarSpacing: 1,
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

    series.createPriceLine({
      price: signal.previousHigh,
      color: "#f59e0b",
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: t("signals.chartPreviousHigh"),
    });
    series.createPriceLine({
      price: signal.triggerPrice,
      color: "#3b82f6",
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      axisLabelVisible: true,
      title: t("signals.chartSignal"),
    });

    const resize = () => {
      if (!chartContainerRef.current) return;
      chart.applyOptions({
        width: chartContainerRef.current.clientWidth,
        height: chartContainerRef.current.clientHeight,
      });
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(element);
    resize();

    async function load() {
      setStatus("loading");
      try {
        const { candles = [] } = await fetchKlines(
          signal.symbol,
          interval,
          { ...marketQuery, limit: SIGNAL_CHART_BARS[interval] ?? 320 },
        );
        if (cancelled) return;
        const data = candles.map((candle) => ({
          time: candle.time,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
        }));
        if (data.length === 0) throw new Error("No candles");
        series.applyOptions({ priceFormat: priceFormatForCandles(data) });
        series.setData(data);
        const markerTime = nearestCandleTime(data, signal.triggeredAt, interval);
        if (markerTime != null) {
          series.setMarkers([{
            time: markerTime,
            position: "belowBar",
            color: "#3b82f6",
            shape: "arrowUp",
            text: t("signals.chartSignal"),
          }]);
        }
        chart.timeScale().fitContent();
        chart.timeScale().applyOptions({ rightOffset: SIGNAL_CHART_RIGHT_OFFSET });
        rightOffsetFrame = requestAnimationFrame(() => {
          if (!cancelled) {
            chart.timeScale().applyOptions({ rightOffset: SIGNAL_CHART_RIGHT_OFFSET });
          }
        });
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    load();
    return () => {
      cancelled = true;
      cancelAnimationFrame(rightOffsetFrame);
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [active, interval, marketQuery.exchange, marketQuery.market, signal, t]);

  return (
    <div
      ref={lazyRef}
      className="signal-event-chart"
      role="img"
      aria-label={t("signals.chartAria", { symbol: signal.symbol })}
    >
      <div ref={chartContainerRef} className="signal-event-chart-canvas" />
      {(!active || status === "loading") && (
        <span className="signal-event-chart-status">{t("signals.chartLoading")}</span>
      )}
      {status === "error" && (
        <span className="signal-event-chart-status signal-event-chart-status--error">
          {t("signals.chartError")}
        </span>
      )}
    </div>
  );
}
