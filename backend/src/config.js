/**
 * Config centralizzata: intervalli polling e base URL API Bybit (pubbliche).
 * Override con env se serve (es. test rete): BYBIT_BASE=https://api.bybit.com
 */
const rawBase = (process.env.BYBIT_BASE || "https://api.bybit.com").trim();
export const BYBIT_BASE = rawBase.replace(/\/+$/, "");

/** Quanto spesso aggiornare la lista strumenti perpetual (nuove listature) */
export const SYMBOL_REFRESH_MS = 3 * 60 * 1000; // 3 minuti

/** Porta server Express */
export const PORT = Number(process.env.PORT) || 3001;
