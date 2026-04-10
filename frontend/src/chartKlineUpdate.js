/**
 * precision/minMove in base al range prezzi (mini grafici e drawer).
 */
export function priceFormatForCandles(candles) {
  if (!candles.length) {
    return { type: "price", precision: 6, minMove: 0.000001 };
  }
  let maxAbs = 0;
  for (const c of candles) {
    maxAbs = Math.max(maxAbs, c.high, c.low, c.open, c.close);
  }
  if (!Number.isFinite(maxAbs) || maxAbs <= 0) {
    return { type: "price", precision: 8, minMove: 1e-8 };
  }
  if (maxAbs >= 1000) return { type: "price", precision: 2, minMove: 0.01 };
  if (maxAbs >= 1) return { type: "price", precision: 4, minMove: 0.0001 };
  if (maxAbs >= 0.1) return { type: "price", precision: 5, minMove: 0.00001 };
  if (maxAbs >= 0.01) return { type: "price", precision: 6, minMove: 0.000001 };
  if (maxAbs >= 0.001) return { type: "price", precision: 7, minMove: 1e-7 };
  return { type: "price", precision: 8, minMove: 1e-8 };
}

/** Ultime N candele visibili (~24h su 15m, vista “ingrandita” vs tutto lo storico). */
export const DEFAULT_ZOOM_VISIBLE_BARS = 96;

/** Margine a destra in “barre vuote” tra ultima candela e scala prezzi (LW `timeScale.rightOffset`). */
export const CHART_RIGHT_OFFSET_BARS = 8;

/** Converte il campo `time` restituito da Lightweight Charts in secondi UTC (numero / stringa / BusinessDay). */
export function chartTimeToUnixSec(t) {
  if (typeof t === "number" && Number.isFinite(t)) return t;
  if (typeof t === "string") {
    const ms = Date.parse(t);
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : NaN;
  }
  if (t && typeof t === "object" && "year" in t) {
    return Math.floor(Date.UTC(t.year, t.month - 1, t.day) / 1000);
  }
  return NaN;
}

/** Timestamp UTC (secondi) dell’ultima barra nella serie LW (dopo setData / update). */
export function getSeriesLastBarTimeSec(series) {
  if (!series || typeof series.data !== "function") return NaN;
  const d = series.data();
  if (!d.length) return NaN;
  return chartTimeToUnixSec(d[d.length - 1].time);
}

export function safeCandlestickUpdate(series, bar) {
  try {
    series.update(bar);
    return true;
  } catch (e) {
    if (e?.message?.includes("Cannot update oldest")) return false;
    throw e;
  }
}

/**
 * Riapplica il margine destro: dopo setVisibleLogicalRange / update LW lo azzera spesso per un frame.
 */
export function applyTimeScaleRightOffset(chart, bars = CHART_RIGHT_OFFSET_BARS) {
  if (!chart) return;
  chart.applyOptions({
    timeScale: { rightOffset: bars },
  });
}

function patchRightOffsetNextFrames(chart, bars = CHART_RIGHT_OFFSET_BARS) {
  applyTimeScaleRightOffset(chart, bars);
  requestAnimationFrame(() => {
    applyTimeScaleRightOffset(chart, bars);
    requestAnimationFrame(() => applyTimeScaleRightOffset(chart, bars));
  });
}

/**
 * Con `autoScale: true` (default LW) lo scroll verticale sul pannello è ignorato.
 * Dopo un fit orizzontale, si riallinea la scala al dato visibile poi si imposta
 * `autoScale: false` così click+drag sposta il prezzo su/giù (e in diagonale col tempo).
 */
export function finalizePriceScaleForUserPan(chart, priceScaleId = "right") {
  if (!chart) return;
  try {
    const ps = chart.priceScale(priceScaleId);
    ps.applyOptions({ autoScale: true });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          ps.applyOptions({ autoScale: false });
        } catch {
          /* chart smontato */
        }
      });
    });
  } catch {
    /* chart smontato */
  }
}

/**
 * Mostra solo le ultime `visibleBars` candele (indici logici 0 … length-1).
 */
export function zoomToRecentBars(
  chart,
  barCount,
  visibleBars = DEFAULT_ZOOM_VISIBLE_BARS,
  rightOffsetBars = CHART_RIGHT_OFFSET_BARS
) {
  if (!chart || barCount < 1) return;
  const n = Math.min(visibleBars, barCount);
  const lastIdx = barCount - 1;
  const from = Math.max(0, lastIdx - (n - 1));
  requestAnimationFrame(() => {
    try {
      chart.timeScale().setVisibleLogicalRange({ from, to: lastIdx + 0.25 });
    } catch {
      chart.timeScale().fitContent();
    }
    patchRightOffsetNextFrames(chart, rightOffsetBars);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => finalizePriceScaleForUserPan(chart));
    });
  });
}

/**
 * Aggiorna la serie candlestick con i dati Bybit senza ridisegnare tutto ogni volta:
 * - prima load / cambio finestra → setData + zoom sulle ultime candele
 * - stessa candela (stesso time) → update() così LW ridisegna OHLC in tempo reale
 * - nuova candela (time maggiore) → update() append
 */

/**
 * @param {*} series ISeriesApi candlestick
 * @param {*} chart IChartApi
 * @param {Array<{time, open, high, low, close}>} bars
 * @param {{ current: { firstT: number, lastT: number } | null }} metaRef
 * @param {(bars: Array) => object | undefined} applyPriceFormat optional
 * @param {number} [zoomVisibleBars] candele visibili inizialmente (default {@link DEFAULT_ZOOM_VISIBLE_BARS})
 */
export function applyKlineCandles(
  series,
  chart,
  bars,
  metaRef,
  applyPriceFormat,
  zoomVisibleBars = DEFAULT_ZOOM_VISIBLE_BARS
) {
  if (!series || !bars.length) return;

  const firstT = Number(bars[0].time);
  const lastBar = bars[bars.length - 1];
  const lastT = Number(lastBar.time);
  const prev = metaRef.current;

  const fullReload = (doZoom) => {
    if (applyPriceFormat) {
      series.applyOptions({ priceFormat: applyPriceFormat(bars) });
    }
    series.setData(bars);
    if (doZoom && chart) {
      zoomToRecentBars(chart, bars.length, zoomVisibleBars);
    }
    metaRef.current = { firstT, lastT };
  };

  if (!prev) {
    fullReload(true);
    return;
  }

  const prevLastT = Number(prev.lastT);
  if (!Number.isFinite(lastT) || !Number.isFinite(prevLastT)) {
    fullReload(true);
    return;
  }

  const seriesLast = getSeriesLastBarTimeSec(series);

  // Snapshot REST ancora sulla candela precedente mentre il WS ha già aggiunto barre:
  // update() indietro nel tempo fa throw ("Cannot update oldest data").
  if (Number.isFinite(seriesLast) && lastT < seriesLast) {
    metaRef.current = {
      firstT: prev.firstT ?? firstT,
      lastT: Math.max(prevLastT, seriesLast),
    };
    return;
  }

  // lastT < prevLastT: REST “indietro” rispetto al meta o clock strano
  if (lastT < prevLastT) {
    if (Number.isFinite(seriesLast) && seriesLast > lastT) {
      metaRef.current = {
        firstT: prev.firstT ?? firstT,
        lastT: Math.max(prevLastT, seriesLast),
      };
      return;
    }
    fullReload(true);
    return;
  }

  // Stessa candela: solo OHLC (non usare setData se cambia solo la prima candela
  // della finestra API — altrimenti tutti i grafici lampeggiano a ogni poll).
  if (lastT === prevLastT) {
    if (!safeCandlestickUpdate(series, lastBar)) {
      metaRef.current = {
        firstT: prev.firstT ?? firstT,
        lastT: Number.isFinite(seriesLast) ? seriesLast : lastT,
      };
      return;
    }
    metaRef.current = { firstT, lastT };
    patchRightOffsetNextFrames(chart);
    return;
  }

  // Nuova/e candela/e: chiudi la precedente se ancora nel payload, poi append
  const prevLastBar = bars.find((b) => Number(b.time) === prevLastT);
  if (prevLastBar && !safeCandlestickUpdate(series, prevLastBar)) {
    metaRef.current = {
      firstT: prev.firstT ?? firstT,
      lastT: Number.isFinite(seriesLast) ? seriesLast : prevLastT,
    };
    return;
  }
  for (const b of bars) {
    const t = Number(b.time);
    if (t > prevLastT && !safeCandlestickUpdate(series, b)) {
      const sl = getSeriesLastBarTimeSec(series);
      metaRef.current = {
        firstT: prev.firstT ?? firstT,
        lastT: Number.isFinite(sl) ? sl : prevLastT,
      };
      return;
    }
  }
  metaRef.current = { firstT, lastT };
  patchRightOffsetNextFrames(chart);
}
