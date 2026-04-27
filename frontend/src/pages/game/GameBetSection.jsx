import { useCallback, useEffect, useRef, useState } from "react";
import { ColorType, CrosshairMode, createChart } from "lightweight-charts";
import { fetchKlines } from "../../api.js";
import { useGame } from "../../GameContext.jsx";
import { useI18n } from "../../i18n/I18nContext.jsx";
import { subscribePublicTrade } from "../../bybitPublicWs.js";
import {
  CHART_RIGHT_OFFSET_BARS,
  priceFormatForCandles,
  safeCandlestickUpdate,
  zoomToRecentBars,
} from "../../chartKlineUpdate.js";

const SYMBOL = "BTCUSDT";
/** Un turno = 1 minuto, allineato al minuto kline 1m (stesso time Unix dell’apertura candle Bybit). */
const ROUND_MS = 60_000;
const MAX_PAST = 32;
/** Candele 1m di contesto (mercato) a sinistra della manche */
const CONTEXT_1M_BARS = 40;

/** Inizio del prossimo minuto (secondi UTC), coerente con time delle kline 1m. */
function nextMinuteStartSec(s) {
  return Math.ceil(s / 60) * 60;
}

/**
 * Scommessa su candela 1m: time = `nextMinuteStartSec`, chiusura da eseguiti nello stesso intervallo.
 * Verde = chiusura > apertura, rossa = chiusura < apertura.
 */
function applyTrade(candle, price) {
  const p = Number(price);
  if (!Number.isFinite(p)) return candle;
  if (!candle) {
    return { open: p, high: p, low: p, close: p };
  }
  return {
    open: candle.open,
    high: Math.max(candle.high, p),
    low: Math.min(candle.low, p),
    close: p,
  };
}

function outcomeColor(c) {
  if (c.close > c.open) return "green";
  if (c.close < c.open) return "red";
  return "doji";
}

/**
 * Contesto 1m + manche: non va concatenato come [context, past] (le manche iniziano dal più
 * vecchio e l’ultima barra “mercato” è spesso più recente → ordine per timestamp non crescente).
 * Ordina per `time` e, stesso minuto, la manche sovrascrive l’1m importato (stesso time della Bybit).
 */
/** mm:ss a partire dai secondi totali (es. 90 → 01:30). */
function formatMmSsTotal(totalSec) {
  const s = Math.max(0, totalSec | 0);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Secondi al prossimo bordo minuto 1m (stesso giro del grafico). */
function secondsToNextMinuteBoundary() {
  const now = Date.now();
  const s0 = Math.floor(now / 1000);
  let S = nextMinuteStartSec(s0);
  if (S * 1000 <= now) S += 60;
  return Math.max(0, Math.ceil((S * 1000 - now) / 1000));
}

/** Punti da bloccare all’inizio del 1m (valore all’ultimo momento, prima del lock). */
function stakeToLockAtBoundary(rawStake, totalPoints) {
  const t = Math.max(0, Math.floor(Number(totalPoints) || 0));
  if (t < 1) return 0;
  const n = Math.max(0, Math.floor(Number(rawStake) || 0));
  return Math.max(1, Math.min(n || 1, t));
}

function betOutcomeLabel(kind, t) {
  switch (kind) {
    case "refund_missing":
      return t("game.bet.outcomeRefund");
    case "refund_doji":
      return t("game.bet.outcomeDoji");
    case "refund_nopick":
      return t("game.bet.outcomeNoPick");
    case "win":
      return t("game.bet.outcomeWin");
    case "lose":
      return t("game.bet.outcomeLose");
    default:
      return "";
  }
}

function betPointsLine(kind, stakeN, t) {
  switch (kind) {
    case "refund_missing":
    case "refund_nopick":
      return t("game.bet.pointsRefund");
    case "refund_doji":
      return t("game.bet.pointsStakeRefund", { n: stakeN });
    case "win":
      return t("game.bet.pointsWin", { gain: 2 * stakeN, stake: stakeN });
    case "lose":
      return t("game.bet.pointsLose", { stake: stakeN });
    default:
      return "";
  }
}

function buildOrderedChartRows(context, past, extra) {
  const map = new Map();
  for (const b of context) {
    const t = Number(b.time);
    if (Number.isFinite(t)) map.set(t, b);
  }
  for (const b of past) {
    const t = Number(b.time);
    if (Number.isFinite(t)) map.set(t, b);
  }
  if (extra) {
    const t = Number(extra.time);
    if (Number.isFinite(t)) map.set(t, extra);
  }
  return Array.from(map.keys())
    .sort((a, b) => a - b)
    .map((k) => map.get(k));
}

export default function GameBetSection() {
  const { t, locale } = useI18n();
  const chartLocale = locale === "en" ? "en-US" : "it-IT";
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const phaseRef = useRef("idle");
  const roundCandleRef = useRef(null);
  const roundTimeRef = useRef(0);
  const pastBarsRef = useRef([]);
  /** Ultime candele 1m (Bybit) mostrate prima delle manche della sessione */
  const context1mRef = useRef([]);
  const settledThisRoundRef = useRef(false);
  const pickRef = useRef(null);
  /** Inizio manche 1m (sec Unix) in attesa durante aligning */
  const alignStartSecRef = useRef(0);
  const alignOpenRef = useRef(null);
  const startBusyRef = useRef(false);
  /** rAF: un singolo update della candela in formazione (contesto o manche) per frame */
  const chartLiveRafRef = useRef(0);
  /** Punti in gioco (validati all’avvio manche) */
  const roundStakeRef = useRef(1);
  const stakeInputRef = useRef(1);
  const totalPtsRef = useRef(0);

  const { game, lockBetStake, applyBetOutcome } = useGame();
  const totalPts = game.totalPoints ?? 0;

  const [phase, setPhase] = useState("idle");
  const [isStarting, setIsStarting] = useState(false);
  const [roundT0, setRoundT0] = useState(null);
  const [pick, setPick] = useState(null);
  const [outcome, setOutcome] = useState(null);
  const [err, setErr] = useState(null);
  const [tick, setTick] = useState(0);
  const [stake, setStake] = useState(1);

  phaseRef.current = phase;
  pickRef.current = pick;
  stakeInputRef.current = stake;
  totalPtsRef.current = totalPts;

  useEffect(() => {
    if (totalPts < 1) return;
    setStake((s) => {
      const n = Math.max(0, Math.floor(Number(s) || 0));
      return Math.max(1, Math.min(n || 1, totalPts));
    });
  }, [totalPts]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

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
        scaleMargins: { top: 0.1, bottom: 0.12 },
        entireTextOnly: true,
        minimumWidth: 52,
      },
      timeScale: {
        borderColor: "#2a3140",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: CHART_RIGHT_OFFSET_BARS,
        barSpacing: 6,
      },
      localization: { locale: chartLocale },
      /** Nessuna linea al hover (evita tratteggi bianchi a grafico vuoto / fuori dalle candele) */
      crosshair: { mode: CrosshairMode.Hidden },
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
      const { clientWidth, clientHeight } = el;
      chart.applyOptions({
        width: Math.max(0, clientWidth),
        height: Math.max(0, clientHeight),
      });
    });
    ro.observe(el);
    requestAnimationFrame(() => {
      const { clientWidth, clientHeight } = el;
      chart.applyOptions({
        width: Math.max(0, clientWidth),
        height: Math.max(0, clientHeight),
      });
    });

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [chartLocale]);

  const setChartBars = useCallback((bars) => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart || !bars.length) {
      if (series) {
        try {
          series.setData([]);
        } catch {
          /* ignore */
        }
      }
      return;
    }
    series.applyOptions({ priceFormat: priceFormatForCandles(bars) });
    series.setData(
      bars.map((b) => ({
        time: b.time,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      })),
    );
    zoomToRecentBars(chart, bars.length, 22);
  }, []);

  /** Anteprima mercato 1m prima del primo turno (o in idle) — stesso simbolo/contesto delle manche. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { candles } = await fetchKlines(SYMBOL, "1");
        if (cancelled) return;
        if (phaseRef.current !== "idle") return;
        if (startBusyRef.current) return;
        if (!candles?.length) return;
        const bars = candles
          .map((c) => ({
            time: c.time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }))
          .slice(-CONTEXT_1M_BARS);
        if (!bars.length) return;
        context1mRef.current = bars;
        setChartBars(buildOrderedChartRows(bars, pastBarsRef.current));
      } catch (e) {
        if (cancelled) return;
        if (phaseRef.current === "idle") {
          setErr(e.message || t("game.bet.loadChart"));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setChartBars, t]);

  const startRound = useCallback(async (side) => {
    if (startBusyRef.current) return;
    if (phaseRef.current !== "idle" && phaseRef.current !== "settled") return;
    const tPts = game.totalPoints ?? 0;
    const st = Math.max(0, Math.floor(Number(stake) || 0));
    const s = tPts < 1 ? 0 : Math.max(1, Math.min(st || 1, tPts));
    if (s < 1) {
      setErr(t("game.bet.notEnoughPoints"));
      return;
    }
    startBusyRef.current = true;
    setIsStarting(true);
    setErr(null);
    setOutcome(null);
    setPhase("idle");
    setPick(side);
    settledThisRoundRef.current = false;
    try {
      const { candles } = await fetchKlines(SYMBOL, "1");
      const last = candles && candles.length ? candles[candles.length - 1] : null;
      const open = last && Number.isFinite(last.close) ? last.close : null;
      if (open == null) throw new Error(t("game.bet.noInitialPrice"));
      const now = Date.now();
      const s0 = Math.floor(now / 1000);
      let S = nextMinuteStartSec(s0);
      if (roundTimeRef.current > 0) {
        while (S <= roundTimeRef.current) S += 60;
      }
      const timeSec = S;

      const history1m = candles
        .map((c) => ({
          time: c.time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }))
        .filter((b) => Number(b.time) < timeSec)
        .slice(-CONTEXT_1M_BARS);
      context1mRef.current = history1m;

      const initial = {
        open,
        high: open,
        low: open,
        close: open,
      };
      pastBarsRef.current = [...pastBarsRef.current].slice(-(MAX_PAST - 1));

      const allIdle = buildOrderedChartRows(context1mRef.current, pastBarsRef.current);

      if (now < S * 1000) {
        alignStartSecRef.current = S;
        alignOpenRef.current = open;
        roundCandleRef.current = null;
        roundTimeRef.current = 0;
        setRoundT0(null);
        setPhase("aligning");
        setChartBars(allIdle);
        return;
      }

      const lockAmt = stakeToLockAtBoundary(
        stakeInputRef.current,
        totalPtsRef.current,
      );
      if (lockAmt < 1) {
        setErr(t("game.bet.insufficient"));
        setPick(null);
        return;
      }
      roundStakeRef.current = lockAmt;
      if (!lockBetStake(lockAmt)) {
        setErr(t("game.bet.insufficient"));
        setPick(null);
        return;
      }
      roundTimeRef.current = timeSec;
      roundCandleRef.current = initial;
      setRoundT0(S * 1000);
      setPhase("betting");

      setChartBars(
        buildOrderedChartRows(context1mRef.current, pastBarsRef.current, {
          time: timeSec,
          ...initial,
        }),
      );
    } catch (e) {
      setErr(e.message || t("game.bet.startError"));
      setPick(null);
    } finally {
      startBusyRef.current = false;
      setIsStarting(false);
    }
  }, [setChartBars, game.totalPoints, stake, lockBetStake, t]);

  useEffect(() => {
    if (phase !== "aligning") return;
    const S = alignStartSecRef.current;
    const open0 = alignOpenRef.current;
    if (!S || open0 == null) return;

    let didStart = false;
    const goBetting = () => {
      if (didStart) return;
      didStart = true;
      const lockAmt = stakeToLockAtBoundary(
        stakeInputRef.current,
        totalPtsRef.current,
      );
      if (lockAmt < 1) {
        setErr(t("game.bet.insufficient"));
        setPhase("idle");
        setPick(null);
        alignStartSecRef.current = 0;
        alignOpenRef.current = null;
        roundCandleRef.current = null;
        roundTimeRef.current = 0;
        setRoundT0(null);
        setChartBars(
          buildOrderedChartRows(context1mRef.current, pastBarsRef.current),
        );
        return;
      }
      roundStakeRef.current = lockAmt;
      if (!lockBetStake(lockAmt)) {
        setErr(t("game.bet.insufficient"));
        setPhase("idle");
        setPick(null);
        alignStartSecRef.current = 0;
        alignOpenRef.current = null;
        roundCandleRef.current = null;
        roundTimeRef.current = 0;
        setRoundT0(null);
        setChartBars(
          buildOrderedChartRows(context1mRef.current, pastBarsRef.current),
        );
        return;
      }
      const initial = {
        open: open0,
        high: open0,
        low: open0,
        close: open0,
      };
      roundTimeRef.current = S;
      roundCandleRef.current = initial;
      setRoundT0(S * 1000);
      setPhase("betting");
      setChartBars(
        buildOrderedChartRows(context1mRef.current, pastBarsRef.current, {
          time: S,
          ...initial,
        }),
      );
    };

    const tickFn = () => {
      setTick((x) => x + 1);
      if (Date.now() < S * 1000) return;
      goBetting();
    };

    const id = setInterval(tickFn, 100);
    tickFn();
    return () => clearInterval(id);
  }, [phase, setChartBars, lockBetStake, t]);

  const settle = useCallback(() => {
    if (settledThisRoundRef.current) return;
    const stakeN = roundStakeRef.current;
    const c = roundCandleRef.current;
    const roundSec = roundTimeRef.current;
    if (!c || !roundSec) {
      settledThisRoundRef.current = true;
      applyBetOutcome(stakeN, "refund");
      setOutcome({
        color: "doji",
        kind: "refund_missing",
        yourPick: pickRef.current,
        stake: stakeN,
      });
      setPhase("settled");
      return;
    }
    settledThisRoundRef.current = true;
    const color = outcomeColor(c);
    const finalBar = { time: roundSec, ...c };
    const nextPast = [...pastBarsRef.current, finalBar].slice(-MAX_PAST);
    pastBarsRef.current = nextPast;

    const p = pickRef.current;
    let kind;
    if (color === "doji") {
      applyBetOutcome(stakeN, "refund");
      kind = "refund_doji";
    } else if (p == null) {
      applyBetOutcome(stakeN, "refund");
      kind = "refund_nopick";
    } else if (p === color) {
      applyBetOutcome(stakeN, "win");
      kind = "win";
    } else {
      kind = "lose";
    }

    setOutcome({
      color,
      kind,
      yourPick: p,
      stake: stakeN,
    });
    setChartBars(buildOrderedChartRows(context1mRef.current, nextPast));
    roundCandleRef.current = null;
    setPhase("settled");
  }, [setChartBars, applyBetOutcome]);

  useEffect(() => {
    if (phase !== "betting") return;
    if (roundT0 == null) return;

    const id = setInterval(() => {
      const el = Date.now() - roundT0;
      if (el >= ROUND_MS) {
        settle();
      }
    }, 100);
    return () => clearInterval(id);
  }, [phase, roundT0, settle]);

  useEffect(() => {
    if (phase === "aligning") return;
    const needTick =
      phase === "idle" ||
      phase === "settled" ||
      (phase === "betting" && roundT0 != null);
    if (!needTick) return;
    const id = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [phase, roundT0]);

  useEffect(() => {
    const sym = SYMBOL.toUpperCase();
    const scheduleChartFlush = () => {
      if (chartLiveRafRef.current) return;
      chartLiveRafRef.current = requestAnimationFrame(() => {
        chartLiveRafRef.current = 0;
        const series = seriesRef.current;
        if (!series) return;
        if (phaseRef.current === "betting") {
          const S = roundTimeRef.current;
          const c = roundCandleRef.current;
          if (!S || !c) return;
          const bar = {
            time: S,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          };
          if (
            !safeCandlestickUpdate(series, {
              time: bar.time,
              open: bar.open,
              high: bar.high,
              low: bar.low,
              close: bar.close,
            })
          ) {
            setChartBars(
              buildOrderedChartRows(
                context1mRef.current,
                pastBarsRef.current,
                bar,
              ),
            );
          }
          return;
        }
        const merged = buildOrderedChartRows(
          context1mRef.current,
          pastBarsRef.current,
        );
        if (!merged.length) return;
        const b = merged[merged.length - 1];
        if (
          !safeCandlestickUpdate(series, {
            time: b.time,
            open: b.open,
            high: b.high,
            low: b.low,
            close: b.close,
          })
        ) {
          setChartBars(merged);
        }
      });
    };

    const unsub = subscribePublicTrade(SYMBOL, (rows) => {
      const series = seriesRef.current;
      if (!series) return;
      const ph = phaseRef.current;
      const sorted = [...rows].sort(
        (a, b) => Number(a.T ?? 0) - Number(b.T ?? 0),
      );

      if (ph === "betting") {
        const S = roundTimeRef.current;
        if (!S) return;
        const S2 = S + 60;
        let did = false;
        for (const row of sorted) {
          if (row.s && String(row.s).toUpperCase() !== sym) continue;
          const tms = Number(row.T ?? 0);
          if (!Number.isFinite(tms)) continue;
          const tsec = Math.floor(tms / 1000);
          if (tsec < S || tsec >= S2) continue;
          const next = applyTrade(roundCandleRef.current, row.p);
          roundCandleRef.current = next;
          did = true;
        }
        if (did) scheduleChartFlush();
        return;
      }

      const ctx = context1mRef.current;
      if (ctx.length === 0) return;
      const last = ctx[ctx.length - 1];
      const T = Number(last.time);
      for (const pb of pastBarsRef.current) {
        if (Number(pb.time) === T) return;
      }
      const T2 = T + 60;
      let acc = {
        open: last.open,
        high: last.high,
        low: last.low,
        close: last.close,
      };
      let did = false;
      for (const row of sorted) {
        if (row.s && String(row.s).toUpperCase() !== sym) continue;
        const tms = Number(row.T ?? 0);
        if (!Number.isFinite(tms)) continue;
        const tsec = Math.floor(tms / 1000);
        if (tsec < T || tsec >= T2) continue;
        acc = applyTrade(acc, row.p);
        did = true;
      }
      if (!did) return;
      last.open = acc.open;
      last.high = acc.high;
      last.low = acc.low;
      last.close = acc.close;
      scheduleChartFlush();
    });

    return () => {
      if (chartLiveRafRef.current) {
        cancelAnimationFrame(chartLiveRafRef.current);
        chartLiveRafRef.current = 0;
      }
      unsub();
    };
  }, [setChartBars]);

  /** idle/settled: avvia turno; aligning: cambia direzione fino all’inizio del minuto 1m. */
  const onPick = (side) => {
    const ph = phaseRef.current;
    if (ph === "idle" || ph === "settled") {
      startRound(side);
      return;
    }
    if (ph === "aligning") {
      setPick(side);
    }
  };

  const cancelAligning = useCallback(() => {
    if (phaseRef.current !== "aligning") return;
    setErr(null);
    setPhase("idle");
    setPick(null);
    alignStartSecRef.current = 0;
    alignOpenRef.current = null;
    roundCandleRef.current = null;
    roundTimeRef.current = 0;
    setRoundT0(null);
    setChartBars(
      buildOrderedChartRows(context1mRef.current, pastBarsRef.current),
    );
  }, [setChartBars]);

  void tick;
  let countdown = null;
  if (phase === "betting" && roundT0 != null) {
    const el = Date.now() - roundT0;
    countdown = Math.max(0, Math.ceil((ROUND_MS - el) / 1000));
  }
  let alignToStartSec = null;
  if (phase === "aligning" && alignStartSecRef.current) {
    const remMs = alignStartSecRef.current * 1000 - Date.now();
    alignToStartSec = Math.max(0, Math.ceil(remMs / 1000));
  }
  const idleToNextMinSec =
    phase === "idle" || phase === "settled"
      ? secondsToNextMinuteBoundary()
      : null;

  return (
    <div className="game-panel">
      {err && <p className="game-bet-err">{err}</p>}

      <div className="game-bet-arena">
        <div className="game-bet-wrap">
          <div className="game-bet-chart-wrap" ref={containerRef} />
          {phase === "aligning" && alignToStartSec != null && (
            <div
              className="game-bet-countdown game-bet-countdown--aligning"
              role="status"
              aria-live="polite"
              aria-label={t("game.bet.countdownAria", {
                time: formatMmSsTotal(alignToStartSec),
              })}
            >
              <p className="game-bet-countdown-kicker">{t("game.bet.alignKicker")}</p>
              <p className="game-bet-countdown-digits">
                {formatMmSsTotal(alignToStartSec)}
              </p>
              <p className="game-bet-countdown-sub">{t("game.bet.alignSub")}</p>
              <div className="game-bet-countdown-actions">
                <button
                  type="button"
                  className="game-bet-cancel"
                  onClick={cancelAligning}
                >
                  {t("game.bet.cancelBet")}
                </button>
              </div>
            </div>
          )}
          {(phase === "idle" || phase === "settled") && idleToNextMinSec != null && (
            <div
              className="game-bet-countdown game-bet-countdown--bar"
              role="status"
              aria-live="polite"
            >
              <span className="game-bet-countdown-bar-label">
                {t("game.bet.nextMinLabel")}
              </span>
              <span className="game-bet-countdown-bar-digits">
                {formatMmSsTotal(idleToNextMinSec)}
              </span>
            </div>
          )}
          {phase === "betting" && countdown != null && (
            <div
              className="game-bet-countdown game-bet-countdown--bar game-bet-countdown--bar-active"
              role="status"
              aria-live="polite"
            >
              <span className="game-bet-countdown-bar-label">
                {t("game.bet.turnLabel")}
              </span>
              <span className="game-bet-countdown-bar-digits">
                {formatMmSsTotal(countdown)}
              </span>
            </div>
          )}
        </div>

        <aside className="game-bet-rail" aria-label={t("game.bet.railAria")}>
          <div className="game-bet-bar">
            <span className="game-bet-pair">{SYMBOL}</span>
            <span className="game-bet-phase-pill game-bet-phase-pill--countdown">
              {(phase === "idle" || phase === "settled") && (
                <>
                  {t("game.bet.phaseIdle", {
                    time: formatMmSsTotal(idleToNextMinSec ?? 0),
                  })}
                </>
              )}
              {phase === "aligning" && (
                <>
                  {t("game.bet.phaseAlign", {
                    time: formatMmSsTotal(alignToStartSec ?? 0),
                  })}
                  <span className="game-bet-phase-sub">{t("game.bet.phaseAlignSub")}</span>
                </>
              )}
              {phase === "betting" && (
                <>
                  {t("game.bet.phaseBet", {
                    time: formatMmSsTotal(countdown ?? 0),
                  })}
                  <span className="game-bet-phase-sub">{t("game.bet.phaseBetSub")}</span>
                </>
              )}
            </span>
          </div>

          <div className="game-bet-funds">
            <div className="game-bet-funds-card game-bet-funds-card--balance">
              <p className="game-bet-funds-heading">{t("game.bet.balance")}</p>
              <p className="game-bet-funds-balance-value" aria-live="polite">
                {totalPts}
              </p>
            </div>

            <div className="game-bet-funds-card game-bet-funds-card--stake">
              <label
                className="game-bet-funds-heading"
                htmlFor="game-bet-stake-input"
              >
                {t("game.bet.stake")}
              </label>
              <div className="game-bet-stake-row">
                <input
                  id="game-bet-stake-input"
                  className="game-bet-stake-input"
                  type="number"
                  min={1}
                  max={Math.max(1, totalPts)}
                  value={stake}
                  onChange={(e) => {
                    const v = Math.max(0, Math.floor(Number(e.target.value) || 0));
                    if (totalPts < 1) return;
                    setStake(v < 1 ? 1 : Math.min(v, totalPts));
                  }}
                  disabled={
                    isStarting || phase === "betting" || totalPts < 1
                  }
                  aria-describedby="game-bet-stake-hint"
                />
                <div
                  className="game-bet-stake-quick"
                  role="group"
                  aria-label={t("game.bet.quickAria")}
                >
                  {totalPts >= 1 && (
                    <>
                      <button
                        type="button"
                        className="game-bet-stake-chip"
                        disabled={isStarting || phase === "betting"}
                        onClick={() => setStake(Math.max(1, Math.min(10, totalPts)))}
                      >
                        10
                      </button>
                      <button
                        type="button"
                        className="game-bet-stake-chip"
                        disabled={isStarting || phase === "betting"}
                        onClick={() =>
                          setStake(Math.max(1, Math.floor(totalPts / 2)))
                        }
                      >
                        ½
                      </button>
                      <button
                        type="button"
                        className="game-bet-stake-chip"
                        disabled={isStarting || phase === "betting"}
                        onClick={() => setStake(Math.max(1, totalPts))}
                      >
                        Max
                      </button>
                    </>
                  )}
                </div>
              </div>
              <p id="game-bet-stake-hint" className="game-bet-stake-hint">
                {t("game.bet.stakeHint")}
              </p>
            </div>
          </div>

          <div className="game-bet-picks" role="group" aria-label={t("game.bet.picksAria")}>
            <button
              type="button"
              className={
                "game-bet-pick game-bet-pick--green" +
                (pick === "green" ? " game-bet-pick--on" : "")
              }
              onClick={() => onPick("green")}
              disabled={isStarting || phase === "betting" || totalPts < 1}
            >
              {t("game.bet.green")}
            </button>
            <button
              type="button"
              className={
                "game-bet-pick game-bet-pick--red" +
                (pick === "red" ? " game-bet-pick--on" : "")
              }
              onClick={() => onPick("red")}
              disabled={isStarting || phase === "betting" || totalPts < 1}
            >
              {t("game.bet.red")}
            </button>
          </div>

          {outcome && (
            <div
              className={
                "game-bet-outcome" +
                (outcome.color === "green"
                  ? " game-bet-outcome--green"
                  : outcome.color === "red"
                    ? " game-bet-outcome--red"
                    : " game-bet-outcome--doji")
              }
            >
              <p className="game-bet-outcome-line">
                {t("game.bet.closeLabel")}{" "}
                <strong>
                  {outcome.color === "green"
                    ? t("game.bet.closeGreen")
                    : outcome.color === "red"
                      ? t("game.bet.closeRed")
                      : t("game.bet.closeDoji")}
                </strong>{" "}
                · {betOutcomeLabel(outcome.kind, t)}
              </p>
              <p className="game-bet-outcome-points">
                {betPointsLine(outcome.kind, outcome.stake, t)}
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
