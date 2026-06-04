import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "./auth/AuthContext.jsx";
import { loadUserData, saveUserData } from "./firebase/userData.js";

const STORAGE_KEY = "quota:favoriteSymbols";

function normalizeFavorites(value) {
  if (!Array.isArray(value)) return new Set();
  return new Set(value.filter((s) => typeof s === "string"));
}

function serializeFavorites(favorites) {
  return [...favorites].sort((a, b) => a.localeCompare(b));
}

function loadInitial() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return normalizeFavorites(arr);
  } catch {
    return new Set();
  }
}

const FavoritesContext = createContext(null);

export function FavoritesProvider({ children }) {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState(() => loadInitial());
  const [cloudReadyUid, setCloudReadyUid] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeFavorites(favorites)));
    } catch {
      // ignore quota / private mode
    }
  }, [favorites]);

  useEffect(() => {
    let cancelled = false;
    const uid = user?.uid ?? null;
    setCloudReadyUid(null);
    if (!uid) return undefined;

    loadUserData(uid)
      .then((data) => {
        if (cancelled) return;
        const cloud = normalizeFavorites(data?.favorites);
        setFavorites((local) => {
          const merged = new Set([...local, ...cloud]);
          saveUserData(uid, { favorites: serializeFavorites(merged) }).catch(() => {
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
    saveUserData(uid, { favorites: serializeFavorites(favorites) }).catch(() => {
      /* keep local fallback */
    });
  }, [favorites, user?.uid, cloudReadyUid]);

  const isFavorite = useCallback(
    (symbol) => favorites.has(symbol),
    [favorites],
  );

  const toggleFavorite = useCallback((symbol) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ favorites, isFavorite, toggleFavorite }),
    [favorites, isFavorite, toggleFavorite],
  );

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx)
    throw new Error("useFavorites must be used within FavoritesProvider");
  return ctx;
}
