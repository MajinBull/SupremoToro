import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "./auth/AuthContext.jsx";
import { loadUserData, saveUserData } from "./firebase/userData.js";
import { useTickers } from "./TickerContext.jsx";
import { playAlertSound } from "./priceAlertSound.js";
import { normalizeAlertSymbol, priceSegmentHitsLevel } from "./priceAlertsLogic.js";

const STORAGE_KEY = "quota:priceAlerts:v1";

/**
 * @typedef {{ id: string, symbol: string, price: number, createdAt: string, triggeredAt: string | null }} PriceAlert
 */

function normalizeAlerts(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (a) =>
        a &&
        typeof a.id === "string" &&
        typeof a.symbol === "string" &&
        Number.isFinite(Number(a.price))
    )
    .map((a) => ({
      id: a.id,
      symbol: normalizeAlertSymbol(a.symbol),
      price: Number(a.price),
      createdAt: typeof a.createdAt === "string" ? a.createdAt : new Date().toISOString(),
      triggeredAt: typeof a.triggeredAt === "string" ? a.triggeredAt : null,
    }));
}

function mergeAlerts(local, cloud) {
  const byId = new Map();
  for (const a of [...cloud, ...local]) {
    byId.set(a.id, a);
  }
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function loadAlerts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return normalizeAlerts(JSON.parse(raw));
  } catch {
    return [];
  }
}

const PriceAlertsContext = createContext(null);

export function PriceAlertsProvider({ children }) {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState(loadAlerts);
  const [cloudReadyUid, setCloudReadyUid] = useState(null);
  const alertsRef = useRef(alerts);
  alertsRef.current = alerts;

  /** Ultimo prezzo usato per rilevare attraversamenti, per simbolo. */
  const prevBySymbolRef = useRef({});

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
    } catch {
      /* ignore */
    }
  }, [alerts]);

  useEffect(() => {
    let cancelled = false;
    const uid = user?.uid ?? null;
    setCloudReadyUid(null);
    if (!uid) return undefined;

    loadUserData(uid)
      .then((data) => {
        if (cancelled) return;
        const cloud = normalizeAlerts(data?.priceAlerts);
        setAlerts((local) => {
          const merged = mergeAlerts(local, cloud);
          saveUserData(uid, { priceAlerts: merged }).catch(() => {
            /* keep local fallback */
          });
          return merged;
        });
        setCloudReadyUid(uid);
      })
      .catch(() => {
        if (!cancelled) setCloudReadyUid(uid);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  useEffect(() => {
    const uid = user?.uid ?? null;
    if (!uid || cloudReadyUid !== uid) return;
    saveUserData(uid, { priceAlerts: alerts }).catch(() => {
      /* keep local fallback */
    });
  }, [alerts, user?.uid, cloudReadyUid]);

  const processPriceUpdate = useCallback((symbol, price) => {
    const sym = normalizeAlertSymbol(symbol);
    if (!sym || !Number.isFinite(price)) return;

    const prev = prevBySymbolRef.current[sym];
    prevBySymbolRef.current[sym] = price;
    if (prev == null || !Number.isFinite(prev)) return;

    const list = alertsRef.current;
    let fired = false;
    const next = list.map((a) => {
      if (a.triggeredAt || normalizeAlertSymbol(a.symbol) !== sym) return a;
      if (priceSegmentHitsLevel(prev, price, a.price)) {
        fired = true;
        return { ...a, triggeredAt: new Date().toISOString() };
      }
      return a;
    });

    if (fired) {
      playAlertSound();
      setAlerts(next);
    }
  }, []);

  /**
   * @param {string} symbol
   * @param {number} levelPrice prezzo della linea (click sul grafico)
   * @param {number} [referencePrice] ultimo prezzo “di riferimento” per non far scattare subito alert già oltrepassati
   */
  const addPriceAlert = useCallback((symbol, levelPrice, referencePrice) => {
    const sym = normalizeAlertSymbol(symbol);
    if (!sym || !Number.isFinite(levelPrice)) return;

    const ref =
      Number.isFinite(referencePrice) ? referencePrice : prevBySymbolRef.current[sym];
    if (Number.isFinite(ref)) {
      prevBySymbolRef.current[sym] = ref;
    }

    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    setAlerts((prev) => [
      ...prev,
      {
        id,
        symbol: sym,
        price: levelPrice,
        createdAt: new Date().toISOString(),
        triggeredAt: null,
      },
    ]);
  }, []);

  const removePriceAlert = useCallback((id) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const clearTriggeredAlerts = useCallback(() => {
    setAlerts((prev) => prev.filter((a) => !a.triggeredAt));
  }, []);

  const value = useMemo(
    () => ({
      alerts,
      addPriceAlert,
      removePriceAlert,
      clearTriggeredAlerts,
      processPriceUpdate,
    }),
    [alerts, addPriceAlert, removePriceAlert, clearTriggeredAlerts, processPriceUpdate]
  );

  return (
    <PriceAlertsContext.Provider value={value}>{children}</PriceAlertsContext.Provider>
  );
}

export function usePriceAlerts() {
  const ctx = useContext(PriceAlertsContext);
  if (!ctx) {
    throw new Error("usePriceAlerts richiede PriceAlertsProvider");
  }
  return ctx;
}

/** Per componenti opzionalmente fuori provider (non usato qui). */
export function usePriceAlertsOptional() {
  return useContext(PriceAlertsContext);
}

/** Aggiorna i prezzi di riferimento dai ticker REST (simboli non in griglia / fallback). */
export function PriceAlertsTickerSync() {
  const { rows } = useTickers();
  const { processPriceUpdate } = usePriceAlerts();

  useEffect(() => {
    if (!rows.length) return;
    for (const r of rows) {
      if (r.lastPrice != null && Number.isFinite(r.lastPrice)) {
        processPriceUpdate(r.symbol, r.lastPrice);
      }
    }
  }, [rows, processPriceUpdate]);

  return null;
}
