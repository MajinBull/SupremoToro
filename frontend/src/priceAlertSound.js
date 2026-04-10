/** Contesto audio riusato per evitare troppe istanze. */
let sharedCtx = null;

function getCtx() {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!sharedCtx) sharedCtx = new AC();
  return sharedCtx;
}

/**
 * Chiamare dopo un gesto utente (es. click sul grafico) per ridurre blocchi autoplay.
 */
export function unlockAlertAudio() {
  const ctx = getCtx();
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
}

/** Picco inviluppo per ogni impulso (più alto = volume maggiore). */
const PEAK = 0.32;
/** Volume master in uscita (0–1). */
const MASTER = 0.58;

/**
 * Sequenza tipo sirena / allarme: toni alternati più forti del vecchio beep singolo.
 */
export function playAlertSound() {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  const master = ctx.createGain();
  master.gain.setValueAtTime(MASTER, ctx.currentTime);
  master.connect(ctx.destination);

  const t0 = ctx.currentTime;
  /** { freq, startOffsetSec, durationSec } */
  const pulses = [
    { f: 1240, t: 0.0, d: 0.16 },
    { f: 780, t: 0.2, d: 0.16 },
    { f: 1240, t: 0.44, d: 0.16 },
    { f: 780, t: 0.64, d: 0.16 },
    { f: 1240, t: 0.88, d: 0.2 },
  ];

  for (const p of pulses) {
    const start = t0 + p.t;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const env = ctx.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(p.f, start);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(4200, start);
    filter.Q.setValueAtTime(0.7, start);

    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(PEAK, start + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, start + p.d);

    osc.connect(filter);
    filter.connect(env);
    env.connect(master);

    osc.start(start);
    osc.stop(start + p.d + 0.04);
  }
}
