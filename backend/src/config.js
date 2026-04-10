/**
 * Config centralizzata: intervalli polling e base URL API Bybit (pubbliche).
 */
export const BYBIT_BASE = "https://api.bybit.com";

/** Quanto spesso aggiornare la lista strumenti perpetual (nuove listature) */
export const SYMBOL_REFRESH_MS = 3 * 60 * 1000; // 3 minuti

/** Porta server Express */
export const PORT = Number(process.env.PORT) || 3001;
