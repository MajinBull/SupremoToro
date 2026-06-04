import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "./auth/AuthContext.jsx";
import { useFavorites } from "./FavoritesContext.jsx";
import { loadUserData, saveUserData } from "./firebase/userData.js";
import {
  BADGES,
  isCheckInDoneToday,
  MISSIONS,
  badgeUnlocked,
  missionProgress,
} from "./game/gameMissions.js";
import {
  CHECKIN_POINTS,
  CHECKIN_XP,
  MISSION_POINTS,
  MISSION_XP,
  levelProgress,
} from "./game/gameXp.js";
import {
  GAME_STORAGE_KEY,
  getDefaultGameState,
  loadGameState,
  mergeGameStates,
  saveGameState,
  todayLocal,
} from "./game/gameStorage.js";
import GameRewardToasts from "./components/GameRewardToasts.jsx";
import { useI18n } from "./i18n/I18nContext.jsx";

const GameContext = createContext(null);

function useGameStateValue(t) {
  const { user } = useAuth();
  const { favorites } = useFavorites();
  const [game, setGame] = useState(() => loadGameState());
  const [cloudReadyUid, setCloudReadyUid] = useState(null);
  const [rewardToasts, setRewardToasts] = useState([]);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === GAME_STORAGE_KEY && e.newValue) {
        try {
          setGame(loadGameState());
        } catch {
          /* ignore */
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const uid = user?.uid ?? null;
    setCloudReadyUid(null);
    if (!uid) return undefined;

    loadUserData(uid)
      .then((data) => {
        if (cancelled) return;
        setGame((local) => {
          const merged = mergeGameStates(local, data?.game);
          saveGameState(merged);
          saveUserData(uid, { game: merged }).catch(() => {
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
    saveUserData(uid, { game }).catch(() => {
      /* keep local fallback */
    });
  }, [game, user?.uid, cloudReadyUid]);

  const persist = useCallback((updater) => {
    setGame((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveGameState(next);
      return next;
    });
  }, []);

  const enqueueRewardToast = useCallback((payload) => {
    const { xp, points } = payload;
    if (xp <= 0 && points <= 0) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setRewardToasts((prev) => [{ id, ...payload }, ...prev].slice(0, 5));
  }, []);

  const dismissRewardToast = useCallback((id) => {
    setRewardToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const favoritesCount = favorites.size;

  const claimMission = useCallback(
    (missionId) => {
      const mission = MISSIONS.find((m) => m.id === missionId);
      if (!mission) return;
      let grant = null;
      persist((prev) => {
        const claimed = new Set(
          Array.isArray(prev.missionsXpClaimed) ? prev.missionsXpClaimed : [],
        );
        if (claimed.has(missionId)) return prev;
        if (!missionProgress(mission, prev, favoritesCount).done) return prev;
        grant = {
          kind: "mission",
          missionId: missionId,
          xp: MISSION_XP,
          points: MISSION_POINTS,
        };
        return {
          ...prev,
          totalXp: (prev.totalXp ?? 0) + MISSION_XP,
          totalPoints: (prev.totalPoints ?? 0) + MISSION_POINTS,
          missionsXpClaimed: [...claimed, missionId],
        };
      });
      if (grant) {
        requestAnimationFrame(() => enqueueRewardToast(grant));
      }
    },
    [persist, enqueueRewardToast, favoritesCount],
  );

  const checkIn = useCallback(() => {
    const today = todayLocal();
    let grant = null;
    persist((prev) => {
      if (prev.checkInDates.includes(today)) return prev;
      grant = {
        kind: "checkin",
        xp: CHECKIN_XP,
        points: CHECKIN_POINTS,
      };
      const checkInDates = [...prev.checkInDates, today].sort();
      return {
        ...prev,
        checkInDates,
        totalXp: (prev.totalXp ?? 0) + CHECKIN_XP,
        totalPoints: (prev.totalPoints ?? 0) + CHECKIN_POINTS,
      };
    });
    if (grant) {
      requestAnimationFrame(() => enqueueRewardToast(grant));
    }
  }, [persist, enqueueRewardToast]);

  const setUsername = useCallback((name) => {
    const raw = typeof name === "string" ? name.trim().slice(0, 32) : "";
    persist((prev) => ({
      ...prev,
      username: raw,
    }));
  }, [persist]);

  const resetAllProgress = useCallback(() => {
    const next = getDefaultGameState();
    saveGameState(next);
    setGame(next);
    setRewardToasts([]);
  }, []);

  const recordListingsVisit = useCallback(() => {
    persist((prev) => ({
      ...prev,
      stats: {
        ...prev.stats,
        listingsVisits: prev.stats.listingsVisits + 1,
      },
    }));
  }, [persist]);

  const recordChartsSectionVisit = useCallback(() => {
    persist((prev) => ({
      ...prev,
      stats: {
        ...prev.stats,
        chartsSectionVisits: prev.stats.chartsSectionVisits + 1,
      },
    }));
  }, [persist]);

  const recordDashboardChartOpen = useCallback(() => {
    persist((prev) => ({
      ...prev,
      stats: {
        ...prev.stats,
        dashboardChartOpens: prev.stats.dashboardChartOpens + 1,
      },
    }));
  }, [persist]);

  /**
   * Bet: all’inizio del minuto 1m la puntata viene bloccata (scala i punti).
   * Ritorna true se il saldo consente l’addebito.
   */
  const lockBetStake = useCallback((amount) => {
    const n = Math.max(0, Math.floor(Number(amount) || 0));
    if (n < 1) return false;
    let ok = false;
    persist((prev) => {
      const pts = prev.totalPoints ?? 0;
      if (pts < n) return prev;
      ok = true;
      return { ...prev, totalPoints: pts - n };
    });
    return ok;
  }, [persist]);

  /**
   * Stake già sottratto con `lockBetStake`.
   * win: +2×stake (raddoppio) · refund: rimborsa stake (doji / errore) · lose: nessun movimento.
   */
  const applyBetOutcome = useCallback(
    (stake, kind) => {
      const n = Math.max(0, Math.floor(Number(stake) || 0));
      if (n < 1) return;
      persist((prev) => {
        const pts = prev.totalPoints ?? 0;
        if (kind === "win") return { ...prev, totalPoints: pts + 2 * n };
        if (kind === "refund") return { ...prev, totalPoints: pts + n };
        return prev;
      });
    },
    [persist],
  );

  const missionRows = useMemo(
    () =>
      MISSIONS.map((m) => {
        const prog = missionProgress(m, game, favoritesCount);
        const claimed = (
          Array.isArray(game.missionsXpClaimed) ? game.missionsXpClaimed : []
        ).includes(m.id);
        return { mission: m, ...prog, claimed };
      }),
    [game, favoritesCount],
  );

  const missionDoneMap = useMemo(() => {
    const o = {};
    for (const m of MISSIONS) {
      o[m.id] = missionProgress(m, game, favoritesCount).done;
    }
    return o;
  }, [game, favoritesCount]);

  const badgeRows = useMemo(
    () =>
      BADGES.map((b) => ({
        badge: b,
        unlocked: badgeUnlocked(b, game, favoritesCount, missionDoneMap),
      })),
    [game, favoritesCount, missionDoneMap],
  );

  const checkInToday = isCheckInDoneToday(game);

  const level = useMemo(() => levelProgress(game.totalXp ?? 0), [game.totalXp]);

  const profileName = useMemo(() => {
    const s = typeof game.username === "string" ? game.username.trim() : "";
    return s.length > 0 ? s.slice(0, 32) : t("game.defaultPlayer");
  }, [game.username, t]);

  const value = useMemo(
    () => ({
      game,
      profileName,
      level,
      checkInToday,
      checkIn,
      setUsername,
      resetAllProgress,
      recordListingsVisit,
      recordChartsSectionVisit,
      recordDashboardChartOpen,
      claimMission,
      lockBetStake,
      applyBetOutcome,
      missionRows,
      badgeRows,
      favoritesCount,
    }),
    [
      game,
      profileName,
      level,
      checkInToday,
      checkIn,
      setUsername,
      resetAllProgress,
      recordListingsVisit,
      recordChartsSectionVisit,
      recordDashboardChartOpen,
      claimMission,
      lockBetStake,
      applyBetOutcome,
      missionRows,
      badgeRows,
      favoritesCount,
    ],
  );

  return [value, rewardToasts, dismissRewardToast];
}

function GameProviderInner({ children }) {
  const { t } = useI18n();
  const [value, rewardToasts, dismissRewardToast] = useGameStateValue(t);
  return (
    <GameContext.Provider value={value}>
      {children}
      <GameRewardToasts items={rewardToasts} onRemove={dismissRewardToast} />
    </GameContext.Provider>
  );
}

export function GameProvider({ children }) {
  return <GameProviderInner>{children}</GameProviderInner>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error("useGame must be used within GameProvider");
  }
  return ctx;
}
