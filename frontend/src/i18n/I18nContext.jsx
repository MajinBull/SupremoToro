import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { TRANSLATIONS } from "./translations.js";

const STORAGE_KEY = "quota:locale";

/** @typedef {'it' | 'en'} Locale */

function getByPath(obj, path) {
  const parts = path.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[p];
  }
  return cur;
}

function interpolate(str, params) {
  if (typeof str !== "string" || !params) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) =>
    params[k] !== undefined && params[k] !== null ? String(params[k]) : `{${k}}`,
  );
}

function readStoredLocale() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "en" || raw === "it") return raw;
  } catch {
    /* ignore */
  }
  return "en";
}

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(() => readStoredLocale());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = locale === "en" ? "en" : "it";
  }, [locale]);

  const setLocale = useCallback((next) => {
    setLocaleState(next === "en" ? "en" : "it");
  }, []);

  const dict = TRANSLATIONS[locale] ?? TRANSLATIONS.it;

  const t = useCallback(
    (key, params) => {
      const raw = getByPath(dict, key);
      if (typeof raw === "string") return interpolate(raw, params);
      if (raw !== undefined) return String(raw);
      const fallback = getByPath(TRANSLATIONS.it, key);
      if (typeof fallback === "string") return interpolate(fallback, params);
      return key;
    },
    [dict],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return (
    <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}
