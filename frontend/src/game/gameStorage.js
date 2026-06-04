/** Persistenza locale gioco / missioni (solo browser). */
export const GAME_STORAGE_KEY = "quota:game:v1";

export function todayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseYMD(ymd) {
  const [y, mo, da] = ymd.split("-").map(Number);
  return new Date(y, mo - 1, da);
}

export function prevDayYMD(ymd) {
  const dt = parseYMD(ymd);
  dt.setDate(dt.getDate() - 1);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function nextDayYMD(ymd) {
  const dt = parseYMD(ymd);
  dt.setDate(dt.getDate() + 1);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Streak “vivo”: ultimo check-in oggi o ieri, poi giorni consecutivi all’indietro. */
export function currentStreak(checkInDatesSorted) {
  if (!checkInDatesSorted?.length) return 0;
  const set = new Set(checkInDatesSorted);
  const today = todayLocal();
  const yesterday = prevDayYMD(today);
  const last = checkInDatesSorted[checkInDatesSorted.length - 1];
  if (last !== today && last !== yesterday) return 0;
  let s = 0;
  let d = last;
  while (set.has(d)) {
    s += 1;
    d = prevDayYMD(d);
  }
  return s;
}

function defaultGameState() {
  return {
    checkInDates: [],
    stats: {
      listingsVisits: 0,
      chartsSectionVisits: 0,
      dashboardChartOpens: 0,
    },
    totalXp: 0,
    totalPoints: 0,
    username: "",
    missionsXpClaimed: [],
  };
}

/** Stato iniziale (reset progressi) — stesso shape di `loadGameState` vuoto. */
export function getDefaultGameState() {
  return defaultGameState();
}

export function normalizeGameState(p) {
  const base = defaultGameState();
  if (!p || typeof p !== "object") return base;
  const dates = Array.isArray(p.checkInDates)
    ? [...new Set(p.checkInDates.filter((x) => typeof x === "string"))].sort()
    : base.checkInDates;
  const stats = {
    ...base.stats,
    ...(p.stats && typeof p.stats === "object" ? p.stats : {}),
  };
  for (const k of Object.keys(base.stats)) {
    stats[k] = Math.max(0, Math.floor(Number(stats[k]) || 0));
  }
  const totalXp = Math.max(0, Math.floor(Number(p.totalXp) || 0));
  const totalPoints = Math.max(0, Math.floor(Number(p.totalPoints) || 0));
  const username = typeof p.username === "string" ? p.username : "";
  const missionsXpClaimed = Array.isArray(p.missionsXpClaimed)
    ? [...new Set(p.missionsXpClaimed.filter((x) => typeof x === "string"))]
    : [];
  return {
    checkInDates: dates,
    stats,
    totalXp,
    totalPoints,
    username,
    missionsXpClaimed,
  };
}

export function loadGameState() {
  try {
    const raw = localStorage.getItem(GAME_STORAGE_KEY);
    if (!raw) return defaultGameState();
    return normalizeGameState(JSON.parse(raw));
  } catch {
    return defaultGameState();
  }
}

export function saveGameState(state) {
  try {
    localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota / private mode */
  }
}

export function mergeGameStates(local, cloud) {
  const a = normalizeGameState(local);
  const b = normalizeGameState(cloud);
  const checkInDates = [...new Set([...a.checkInDates, ...b.checkInDates])].sort();
  const missionsXpClaimed = [
    ...new Set([...a.missionsXpClaimed, ...b.missionsXpClaimed]),
  ];
  const stats = {};
  for (const k of Object.keys(defaultGameState().stats)) {
    stats[k] = Math.max(a.stats[k] ?? 0, b.stats[k] ?? 0);
  }
  return {
    checkInDates,
    stats,
    totalXp: Math.max(a.totalXp ?? 0, b.totalXp ?? 0),
    totalPoints: Math.max(a.totalPoints ?? 0, b.totalPoints ?? 0),
    username: b.username || a.username || "",
    missionsXpClaimed,
  };
}
