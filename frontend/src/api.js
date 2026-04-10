/**
 * Chiamate al backend.
 * - In dev: path relativi `/api` → proxy Vite → :3001.
 * - In produzione: imposta `VITE_API_BASE` (es. https://bullweb-api.onrender.com).
 */

const JSON_HEADERS = { Accept: "application/json" };

const API_BASE = String(import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");

function apiUrl(path) {
  if (!path.startsWith("/")) path = `/${path}`;
  if (!API_BASE) return path;
  return `${API_BASE}${path}`;
}

export async function fetchPerpetuals() {
  const res = await fetch(apiUrl("/api/perpetuals"), { headers: JSON_HEADERS });
  if (!res.ok) throw new Error(`perpetuals ${res.status}`);
  return res.json();
}

export async function fetchTickers() {
  const res = await fetch(apiUrl("/api/tickers"), { headers: JSON_HEADERS });
  const data = await res.json();
  if (!res.ok) {
    const msg = data.error || `tickers ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export async function fetchKlines(symbol, interval) {
  const q = new URLSearchParams({ symbol, interval, limit: "500" });
  const res = await fetch(apiUrl(`/api/klines?${q}`), {
    headers: JSON_HEADERS,
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data.error || `klines ${res.status}`;
    throw new Error(msg);
  }
  return data;
}
