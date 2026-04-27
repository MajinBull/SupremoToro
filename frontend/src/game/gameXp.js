/** Ricompense e progressione livello (solo client). */
export const CHECKIN_XP = 25;
export const MISSION_XP = 50;
/** Punti (seconda valuta; in futuro potranno essere convertiti). */
export const CHECKIN_POINTS = 10;
export const MISSION_POINTS = 30;
export const XP_PER_LEVEL = 100;

const DEFAULT_NAME = "Giocatore";

export function levelProgress(totalXp) {
  const xp = Math.max(0, Math.floor(Number(totalXp) || 0));
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const xpInto = xp % XP_PER_LEVEL;
  const pctToNext =
    XP_PER_LEVEL > 0 ? Math.round((100 * xpInto) / XP_PER_LEVEL) : 0;
  return {
    totalXp: xp,
    level,
    xpInto,
    xpToNext: XP_PER_LEVEL - xpInto,
    pctToNext,
  };
}

export function displayUsername(raw) {
  const s = typeof raw === "string" ? raw.trim() : "";
  return s.length > 0 ? s.slice(0, 32) : DEFAULT_NAME;
}
