import { currentStreak, todayLocal } from "./gameStorage.js";

/** @typedef {{ id: string, kind: string, target: number }} MissionDef */

/** @type {MissionDef[]} */
export const MISSIONS = [
  {
    id: "checkins_3",
    kind: "checkinCount",
    target: 3,
  },
  {
    id: "streak_3",
    kind: "streak",
    target: 3,
  },
  {
    id: "listings_5",
    kind: "listingsVisits",
    target: 5,
  },
  {
    id: "charts_section_3",
    kind: "chartsSectionVisits",
    target: 3,
  },
  {
    id: "dashboard_charts_8",
    kind: "dashboardChartOpens",
    target: 8,
  },
  {
    id: "favorites_3",
    kind: "favoritesCount",
    target: 3,
  },
];

/** @typedef {{ id: string, missionIds: string[] }} BadgeDef */

/** @type {BadgeDef[]} */
export const BADGES = [
  {
    id: "badge_first_checkin",
    missionIds: [],
  },
  {
    id: "badge_streak_3",
    missionIds: ["streak_3"],
  },
  {
    id: "badge_explorer",
    missionIds: ["listings_5"],
  },
  {
    id: "badge_grid",
    missionIds: ["charts_section_3"],
  },
  {
    id: "badge_analyst",
    missionIds: ["dashboard_charts_8"],
  },
  {
    id: "badge_collector",
    missionIds: ["favorites_3"],
  },
  {
    id: "badge_regular",
    missionIds: [],
  },
];

export function missionProgress(mission, game, favoritesCount) {
  const { kind, target } = mission;
  let value = 0;
  switch (kind) {
    case "checkinCount":
      value = game.checkInDates.length;
      break;
    case "streak":
      value = currentStreak(game.checkInDates);
      break;
    case "listingsVisits":
      value = game.stats.listingsVisits;
      break;
    case "chartsSectionVisits":
      value = game.stats.chartsSectionVisits;
      break;
    case "dashboardChartOpens":
      value = game.stats.dashboardChartOpens;
      break;
    case "favoritesCount":
      value = favoritesCount;
      break;
    default:
      value = 0;
  }
  const done = value >= target;
  const pct = target > 0 ? Math.min(100, Math.round((100 * value) / target)) : 0;
  return { value, target, done, pct };
}

export function isCheckInDoneToday(game) {
  const today = todayLocal();
  return game.checkInDates.includes(today);
}

export function badgeUnlocked(badge, game, favoritesCount, missionDone) {
  if (badge.id === "badge_first_checkin") {
    return game.checkInDates.length >= 1;
  }
  if (badge.id === "badge_regular") {
    return game.checkInDates.length >= 5;
  }
  return badge.missionIds.every((id) => missionDone[id]);
}
