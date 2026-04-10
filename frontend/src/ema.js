import { chartTimeToUnixSec } from "./chartKlineUpdate.js";

/**
 * EMA standard: prima SMA su `period` chiusure, poi EMA con k = 2/(period+1).
 * @param {{time: number, close: number}[]} rows cronologici
 * @param {number} period
 * @returns {{time: number, value: number}[]}
 */
export function computeEmaSeries(rows, period) {
  if (!rows.length || period < 1) return [];
  if (rows.length < period) return [];

  const k = 2 / (period + 1);
  let ema = 0;
  for (let i = 0; i < period; i++) {
    ema += rows[i].close;
  }
  ema /= period;

  const out = [{ time: rows[period - 1].time, value: ema }];
  for (let i = period; i < rows.length; i++) {
    ema = rows[i].close * k + ema * (1 - k);
    out.push({ time: rows[i].time, value: ema });
  }
  return out;
}

/**
 * Estrae time (secondi UTC) e close dalla serie candlestick LW.
 */
export function candleRowsFromSeriesData(raw) {
  const rows = [];
  for (const bar of raw) {
    if (bar.open === undefined || bar.close === undefined) continue;
    const t = chartTimeToUnixSec(bar.time);
    if (!Number.isFinite(t)) continue;
    rows.push({ time: t, close: bar.close });
  }
  return rows;
}

/**
 * Aggiorna una line series EMA da una candlestick series; se !enabled svuota i dati.
 */
export function applyEmaToLineSeries(candlestickSeries, lineSeries, period, enabled) {
  if (!lineSeries || !candlestickSeries) return;
  if (!enabled) {
    lineSeries.setData([]);
    return;
  }
  const raw = candlestickSeries.data();
  if (!raw.length) {
    lineSeries.setData([]);
    return;
  }
  const rows = candleRowsFromSeriesData(raw);
  const data = computeEmaSeries(rows, period);
  lineSeries.setData(data);
}
