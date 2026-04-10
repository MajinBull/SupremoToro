import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLayoutChartsContext } from "../LayoutChartsContext.jsx";
import { useFavorites } from "../FavoritesContext.jsx";
import { useTickers } from "../TickerContext.jsx";
import { TIMEFRAMES } from "../timeframes.js";
import MiniCandleChart from "../components/MiniCandleChart.jsx";
import PriceAlertsPanel from "../components/PriceAlertsPanel.jsx";
import { usePriceAlerts } from "../PriceAlertsContext.jsx";

/** Celle della griglia: 2×2, 3×3 o 4×4 */
const GRID_OPTIONS = [
  { value: 4, label: "4 (2×2)" },
  { value: 9, label: "9 (3×3)" },
  { value: 16, label: "16 (4×4)" },
];

const SORT_OPTIONS = [
  { value: "favorites", label: "Preferiti (A→Z)" },
  { value: "alpha", label: "Alfabetico (A→Z)" },
  { value: "volume", label: "Volume 24h (↓)" },
  { value: "change24h", label: "Variazione % 24h (↓)" },
];

/** Secondi tra un refresh REST delle candele (allineamento; movimento live via WebSocket). */
const DATA_POLL_OPTIONS = [
  { value: 1, label: "1 s" },
  { value: 3, label: "3 s" },
  { value: 5, label: "5 s" },
  { value: 10, label: "10 s" },
  { value: 15, label: "15 s" },
  { value: 30, label: "30 s" },
  { value: 60, label: "60 s" },
];

/** Secondi prima di passare alla “pagina” successiva di simboli (stesso ordinamento). */
const ROTATE_OPTIONS = [
  { value: 0, label: "No rotazione" },
  { value: 15, label: "15 s" },
  { value: 30, label: "30 s" },
  { value: 45, label: "45 s" },
  { value: 60, label: "1 min" },
  { value: 120, label: "2 min" },
  { value: 300, label: "5 min" },
];

const STORAGE_GRID = "bullweb:multiChartGridCount";
const STORAGE_SORT = "bullweb:multiChartSort";
const STORAGE_DATA_POLL = "bullweb:chartsDataPollSec";
const STORAGE_ROTATE = "bullweb:chartsRotateSec";
const STORAGE_INTERVAL = "bullweb:multiChartInterval";
const STORAGE_EMA223 = "bullweb:multiChartEma223";
const STORAGE_EMA60 = "bullweb:multiChartEma60";
const STORAGE_EMA10 = "bullweb:multiChartEma10";
const STORAGE_MIN_VOL_24H = "bullweb:multiChartMinVol24h";

/**
 * Soglia minima volume 24h (USDT, come da ticker Bybit). 0 = disattivato.
 */
const MIN_VOL_24H_OPTIONS = [
  { value: 0, label: "Nessun minimo" },
  { value: 100_000, label: "≥ 100K" },
  { value: 500_000, label: "≥ 500K" },
  { value: 1_000_000, label: "≥ 1M" },
  { value: 5_000_000, label: "≥ 5M" },
  { value: 10_000_000, label: "≥ 10M" },
  { value: 50_000_000, label: "≥ 50M" },
  { value: 100_000_000, label: "≥ 100M" },
];

/** Default alla prima apertura (nessun valore salvato in localStorage). */
const DEFAULT_SORT = "change24h";
const DEFAULT_ROTATE_SEC = 15;
/** Intervallo Bybit v5 per 1h (vedi TIMEFRAMES). */
const DEFAULT_CHART_INTERVAL = "60";

function loadGridCount() {
  try {
    const raw = localStorage.getItem(STORAGE_GRID);
    const n = raw ? Number(raw) : 4;
    return [4, 9, 16].includes(n) ? n : 4;
  } catch {
    return 4;
  }
}

function loadSortMode() {
  try {
    const legacyFavOnly =
      localStorage.getItem("bullweb:multiChartFavoritesOnly") === "1";
    const raw = localStorage.getItem(STORAGE_SORT);
    const valid =
      raw === "favorites" ||
      raw === "alpha" ||
      raw === "volume" ||
      raw === "change24h";
    if (valid) {
      if (legacyFavOnly && raw !== "favorites") return "favorites";
      return raw;
    }
    if (legacyFavOnly) return "favorites";
    return DEFAULT_SORT;
  } catch {
    return DEFAULT_SORT;
  }
}

function loadDataPollSec() {
  try {
    const stored = localStorage.getItem(STORAGE_DATA_POLL);
    if (stored === null || stored === "") return 1;
    const raw = Number(stored);
    return DATA_POLL_OPTIONS.some((o) => o.value === raw) ? raw : 1;
  } catch {
    return 1;
  }
}

function loadRotateSec() {
  try {
    const stored = localStorage.getItem(STORAGE_ROTATE);
    if (stored === null || stored === "") return DEFAULT_ROTATE_SEC;
    const raw = Number(stored);
    return ROTATE_OPTIONS.some((o) => o.value === raw) ? raw : DEFAULT_ROTATE_SEC;
  } catch {
    return DEFAULT_ROTATE_SEC;
  }
}

function loadChartInterval() {
  try {
    const raw = localStorage.getItem(STORAGE_INTERVAL);
    if (raw === null || raw === "") return DEFAULT_CHART_INTERVAL;
    return TIMEFRAMES.some((t) => t.api === raw) ? raw : DEFAULT_CHART_INTERVAL;
  } catch {
    return DEFAULT_CHART_INTERVAL;
  }
}

function loadMinVol24h() {
  try {
    const raw = localStorage.getItem(STORAGE_MIN_VOL_24H);
    if (raw === null || raw === "") return 0;
    const n = Number(raw);
    return MIN_VOL_24H_OPTIONS.some((o) => o.value === n) ? n : 0;
  } catch {
    return 0;
  }
}

function loadEmaOn(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw === null || raw === "") return true;
    return raw === "1";
  } catch {
    return true;
  }
}

function colsForCount(n) {
  if (n === 4) return 2;
  if (n === 9) return 3;
  if (n === 16) return 4;
  return 2;
}

/**
 * Schermata grafici multipli: griglia fissa 4 / 9 / 16, simboli dall’elenco ticker
 * ordinato; refresh candele e rotazione pagine a intervalli configurabili.
 */
export default function MultiChartsPage() {
  const {
    chartsTopOpen = true,
    chartsRotationPaused = false,
    reportChartsRotationSchedule,
    registerChartsPageNav,
  } = useLayoutChartsContext();
  const { rows } = useTickers();
  const { favorites } = useFavorites();

  /** Evita griglia vuota e remount se un poll ticker fallisce o ritarda (mantiene ultimo snapshot valido). */
  const lastRowsRef = useRef([]);
  if (rows.length > 0) {
    lastRowsRef.current = rows;
  }
  const rowsForCharts = rows.length > 0 ? rows : lastRowsRef.current;
  const [gridCount, setGridCount] = useState(loadGridCount);
  const [sortMode, setSortMode] = useState(loadSortMode);
  const [chartInterval, setChartInterval] = useState(loadChartInterval);
  const [dataPollSec, setDataPollSec] = useState(loadDataPollSec);
  const [rotateSec, setRotateSec] = useState(loadRotateSec);
  const [pageIndex, setPageIndex] = useState(0);
  const [ema223On, setEma223On] = useState(() => loadEmaOn(STORAGE_EMA223));
  const [ema60On, setEma60On] = useState(() => loadEmaOn(STORAGE_EMA60));
  const [ema10On, setEma10On] = useState(() => loadEmaOn(STORAGE_EMA10));
  const [minVol24hUSDT, setMinVol24hUSDT] = useState(loadMinVol24h);
  const [alertsPanelOpen, setAlertsPanelOpen] = useState(false);
  const { alerts: priceAlerts } = usePriceAlerts();

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_GRID, String(gridCount));
    } catch {
      /* ignore */
    }
  }, [gridCount]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SORT, sortMode);
    } catch {
      /* ignore */
    }
  }, [sortMode]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_DATA_POLL, String(dataPollSec));
    } catch {
      /* ignore */
    }
  }, [dataPollSec]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_ROTATE, String(rotateSec));
    } catch {
      /* ignore */
    }
  }, [rotateSec]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_INTERVAL, chartInterval);
    } catch {
      /* ignore */
    }
  }, [chartInterval]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_EMA223, ema223On ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [ema223On]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_EMA60, ema60On ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [ema60On]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_EMA10, ema10On ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [ema10On]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_MIN_VOL_24H, String(minVol24hUSDT));
    } catch {
      /* ignore */
    }
  }, [minVol24hUSDT]);

  const sortedSymbols = useMemo(() => {
    let usable = rowsForCharts.filter((r) => !r.missing && r.symbol);
    if (minVol24hUSDT > 0) {
      usable = usable.filter((r) => {
        const v = r.volume24h;
        return Number.isFinite(v) && v >= minVol24hUSDT;
      });
    }
    let sorted = [...usable];

    if (sortMode === "favorites") {
      sorted = sorted.filter((r) => favorites.has(r.symbol));
      sorted.sort((a, b) => a.symbol.localeCompare(b.symbol));
    } else if (sortMode === "alpha") {
      sorted.sort((a, b) => a.symbol.localeCompare(b.symbol));
    } else if (sortMode === "volume") {
      sorted.sort((a, b) => (b.volume24h ?? -1) - (a.volume24h ?? -1));
    } else {
      sorted.sort(
        (a, b) => (b.price24hPcnt ?? -Infinity) - (a.price24hPcnt ?? -Infinity)
      );
    }

    return sorted.map((r) => r.symbol);
  }, [rowsForCharts, sortMode, favorites, minVol24hUSDT]);

  const sortedSymbolsRef = useRef(sortedSymbols);
  sortedSymbolsRef.current = sortedSymbols;

  /**
   * Con rotazione attiva: elenco “congelato” per tutto un giro completo di pagine, così
   * ogni asset compare 1 sola volta anche se volume/% cambiano tra un passaggio e l’altro.
   * Alla fine del ciclo (torno a pagina 0) si prende un nuovo snapshot dall’ordinamento live.
   */
  const [rotateCycleSymbols, setRotateCycleSymbols] = useState([]);

  /* Reset ciclo rotazione solo se cambiano griglia, ordinamento, durata rotazione, filtro volume
   * o lunghezza elenco — non su ogni toggle preferiti se l’elenco filtrato resta uguale. */
  useEffect(() => {
    setPageIndex(0);
    if (rotateSec <= 0) {
      setRotateCycleSymbols([]);
      return;
    }
    if (sortedSymbols.length > 0) {
      setRotateCycleSymbols(sortedSymbols.slice());
    } else {
      setRotateCycleSymbols([]);
    }
  }, [sortMode, gridCount, sortedSymbols.length, rotateSec, minVol24hUSDT]);

  const pageCount = useMemo(() => {
    const n =
      rotateSec > 0 && rotateCycleSymbols.length > 0
        ? rotateCycleSymbols.length
        : sortedSymbols.length;
    if (n === 0) return 1;
    return Math.max(1, Math.ceil(n / gridCount));
  }, [
    sortedSymbols.length,
    rotateCycleSymbols.length,
    gridCount,
    rotateSec,
  ]);

  const rotationIntervalActive = rotateSec > 0 && pageCount > 1;

  useEffect(() => {
    reportChartsRotationSchedule?.(rotationIntervalActive);
  }, [rotationIntervalActive, reportChartsRotationSchedule]);

  useEffect(() => {
    return () => reportChartsRotationSchedule?.(false);
  }, [reportChartsRotationSchedule]);

  const goToPrevGroup = useCallback(() => {
    setPageIndex((i) => (i - 1 + pageCount) % pageCount);
  }, [pageCount]);

  const goToNextGroup = useCallback(() => {
    setPageIndex((i) => {
      const next = (i + 1) % pageCount;
      if (next === 0) {
        const live = sortedSymbolsRef.current;
        if (live.length > 0) {
          setRotateCycleSymbols(live.slice());
        }
      }
      return next;
    });
  }, [pageCount]);

  useEffect(() => {
    if (!registerChartsPageNav) return undefined;
    if (!rotationIntervalActive) {
      registerChartsPageNav(null);
      return undefined;
    }
    registerChartsPageNav({
      goPrev: goToPrevGroup,
      goNext: goToNextGroup,
    });
    return () => registerChartsPageNav(null);
  }, [
    registerChartsPageNav,
    rotationIntervalActive,
    goToPrevGroup,
    goToNextGroup,
  ]);

  useEffect(() => {
    if (!rotationIntervalActive || chartsRotationPaused) return undefined;
    const id = window.setInterval(() => {
      setPageIndex((i) => {
        const next = (i + 1) % pageCount;
        if (next === 0) {
          const live = sortedSymbolsRef.current;
          if (live.length > 0) {
            setRotateCycleSymbols(live.slice());
          }
        }
        return next;
      });
    }, rotateSec * 1000);
    return () => window.clearInterval(id);
  }, [
    rotateSec,
    pageCount,
    rotationIntervalActive,
    chartsRotationPaused,
  ]);

  /**
   * Senza rotazione: slice fissa dall’elenco live ma stabile tra poll (ref, stesso length).
   * Con rotazione: slice dalla snapshot `rotateCycleSymbols`.
   */
  const slotSymbols = useMemo(() => {
    const list =
      rotateSec <= 0
        ? sortedSymbolsRef.current
        : rotateCycleSymbols.length > 0
          ? rotateCycleSymbols
          : sortedSymbolsRef.current;
    if (list.length === 0) return [];
    const start = rotateSec <= 0 ? 0 : pageIndex * gridCount;
    return list.slice(start, start + gridCount);
  }, [
    pageIndex,
    gridCount,
    rotateSec,
    sortMode,
    sortedSymbols.length,
    rotateCycleSymbols,
  ]);

  useEffect(() => {
    setPageIndex((i) => (i >= pageCount ? 0 : i));
  }, [pageCount]);

  const gridCols = colsForCount(gridCount);
  const gridRows = gridCols;
  const pollMs = dataPollSec * 1000;

  return (
    <div className="charts-page-fill">
      {chartsTopOpen && (
        <div className="charts-page-toolbar" id="charts-controls-panel">
          <div className="toolbar toolbar--charts">
            <div className="charts-toolbar-cluster">
              <span className="charts-toolbar-cluster-label">Griglia</span>
              <div className="chart-toolbar tf-row-inline tf-row-inline--dense">
                {GRID_OPTIONS.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    className={`tf-btn ${gridCount === g.value ? "active" : ""}`}
                    onClick={() => setGridCount(g.value)}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="charts-toolbar-cluster charts-toolbar-cluster--stretch">
              <span className="charts-toolbar-cluster-label">Timeframe</span>
              <div className="chart-toolbar tf-row-inline tf-row-inline--dense">
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
            </div>
            <div className="filter-group">
              <label htmlFor="charts-sort-mode">Ordina / filtra</label>
              <select
                id="charts-sort-mode"
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value)}
                aria-label="Ordinamento e filtro simboli"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label htmlFor="charts-min-vol-24h">Vol. 24h min</label>
              <select
                id="charts-min-vol-24h"
                value={minVol24hUSDT}
                onChange={(e) => setMinVol24hUSDT(Number(e.target.value))}
                aria-label="Volume minimo ultime 24 ore in USDT"
                title="Esclude dalla griglia i perpetual con volume 24h sotto la soglia (USDT)"
              >
                {MIN_VOL_24H_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.value === 0 ? o.label : `${o.label} USDT`}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label htmlFor="charts-poll-sec">Sync REST</label>
              <select
                id="charts-poll-sec"
                value={dataPollSec}
                onChange={(e) => setDataPollSec(Number(e.target.value))}
                aria-label="Intervallo sincronizzazione REST candele"
              >
                {DATA_POLL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label htmlFor="charts-rotate-sec">Ruota griglia</label>
              <select
                id="charts-rotate-sec"
                value={rotateSec}
                onChange={(e) => setRotateSec(Number(e.target.value))}
                aria-label="Intervallo rotazione simboli"
              >
                {ROTATE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-group charts-toolbar-alert">
              <button
                type="button"
                className={`charts-alerts-round-btn${priceAlerts.some((a) => !a.triggeredAt) ? " charts-alerts-round-btn--active" : ""}`}
                onClick={() => setAlertsPanelOpen(true)}
                aria-expanded={alertsPanelOpen}
                aria-controls="price-alerts-dialog"
                aria-label="Alert prezzo"
                title="Gestisci gli alert prezzo"
              >
                <svg
                  className="charts-alerts-round-icon"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden
                >
                  <path
                    d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M13.73 21a2 2 0 0 1-3.46 0"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {priceAlerts.some((a) => !a.triggeredAt) && (
                  <span className="charts-alerts-round-count" aria-hidden>
                    {priceAlerts.filter((a) => !a.triggeredAt).length}
                  </span>
                )}
              </button>
            </div>
            <div className="charts-toolbar-cluster">
              <span className="charts-toolbar-cluster-label">Medie EMA</span>
              <div className="chart-toolbar tf-row-inline tf-row-inline--dense">
                <button
                  type="button"
                  className={`tf-btn ${ema223On ? "active" : ""}`}
                  onClick={() => setEma223On((v) => !v)}
                  aria-pressed={ema223On}
                  aria-label="Attiva o disattiva EMA 223"
                >
                  EMA 223
                </button>
                <button
                  type="button"
                  className={`tf-btn ${ema60On ? "active" : ""}`}
                  onClick={() => setEma60On((v) => !v)}
                  aria-pressed={ema60On}
                  aria-label="Attiva o disattiva EMA 60"
                >
                  EMA 60
                </button>
                <button
                  type="button"
                  className={`tf-btn ${ema10On ? "active" : ""}`}
                  onClick={() => setEma10On((v) => !v)}
                  aria-pressed={ema10On}
                  aria-label="Attiva o disattiva EMA 10"
                >
                  EMA 10
                </button>
              </div>
            </div>
            <span
              className="count-pill charts-toolbar-summary"
              title="Simboli nell’elenco dopo filtro volume 24h min, ordinamento e altri filtri attivi"
            >
              {sortedSymbols.length} simboli · {gridCount} in griglia
            </span>
          </div>

          {rotateSec > 0 && pageCount > 1 && (
            <p className="charts-rotate-status">
              Gruppo simboli <strong>{pageIndex + 1}</strong> / <strong>{pageCount}</strong>
              {chartsRotationPaused ? (
                <>
                  {" — "}
                  <strong>Rotazione in pausa</strong>
                  {" "}(riparti dal tasto in alto)
                </>
              ) : (
                <>
                  {" — "}
                  prossimo cambio tra <strong>{rotateSec}</strong> s
                </>
              )}
            </p>
          )}
        </div>
      )}

      <main className="charts-grid-main">
        {sortedSymbols.length === 0 && rows.length === 0 ? (
          <div className="empty-state">Caricamento ticker…</div>
        ) : sortedSymbols.length === 0 ? (
          <div className="empty-state">
            {sortMode === "favorites" && favorites.size === 0
              ? "Nessun preferito: aggiungi le stelline dalla dashboard o dall’intestazione dei grafici."
              : sortMode === "favorites"
                ? "Nessun preferito con dati ticker nell’elenco. Riprova tra poco o aggiungi altri preferiti."
                : minVol24hUSDT > 0 && rowsForCharts.length > 0
                  ? "Nessun perpetual sopra la soglia di volume 24h. Abbassa «Vol. 24h min» o imposta «Nessun minimo»."
                  : "Nessun simbolo disponibile con dati ticker. Riprova tra poco."}
          </div>
        ) : slotSymbols.length === 0 ? (
          <div className="empty-state">Caricamento ticker…</div>
        ) : (
          <div
            className="charts-grid charts-grid--fixed"
            style={{
              gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${gridRows}, minmax(0, 1fr))`,
            }}
          >
            {slotSymbols.map((sym, cellIdx) => (
              <MiniCandleChart
                key={`${pageIndex}-${cellIdx}-${sym}`}
                symbol={sym}
                interval={chartInterval}
                pollMs={pollMs}
                ema223On={ema223On}
                ema60On={ema60On}
                ema10On={ema10On}
              />
            ))}
          </div>
        )}
      </main>

      <PriceAlertsPanel
        open={alertsPanelOpen}
        onClose={() => setAlertsPanelOpen(false)}
      />
    </div>
  );
}
