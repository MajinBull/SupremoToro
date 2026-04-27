import { useGame } from "../../GameContext.jsx";
import { CHECKIN_POINTS, CHECKIN_XP } from "../../game/gameXp.js";
import {
  currentStreak,
  nextDayYMD,
  prevDayYMD,
  todayLocal,
} from "../../game/gameStorage.js";
import { useI18n } from "../../i18n/I18nContext.jsx";

/** Oggi al centro: 3 giorni prima, oggi, 3 giorni dopo (fuso locale). */
function checkinStripDates() {
  const today = todayLocal();
  let start = today;
  for (let i = 0; i < 3; i++) {
    start = prevDayYMD(start);
  }
  const days = [];
  let d = start;
  for (let i = 0; i < 7; i++) {
    days.push(d);
    d = nextDayYMD(d);
  }
  return days;
}

function shortLabel(ymd) {
  const [, m, day] = ymd.split("-");
  return `${m}/${day}`;
}

function weekdayShort(ymd, locale) {
  const [y, mo, da] = ymd.split("-").map(Number);
  const dt = new Date(y, mo - 1, da);
  const raw = dt.toLocaleDateString(locale === "en" ? "en-US" : "it-IT", {
    weekday: "short",
  });
  const s = raw.replace(/\.$/, "").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function GameCheckInSection() {
  const { t, locale } = useI18n();
  const { game, checkIn } = useGame();

  const streak = currentStreak(game.checkInDates);
  const strip = checkinStripDates();
  const setDates = new Set(game.checkInDates);
  const today = todayLocal();

  return (
    <div className="game-panel">
      <div className="game-checkin-board">
        <div className="game-checkin-row">
          <div className="game-streak-pill" title={t("game.streakTitle")}>
            <span className="game-streak-num">{streak}</span>
            <span className="game-streak-label">{t("game.streakDays")}</span>
          </div>
          <div className="game-checkin-meta">
            <p className="game-checkin-count">
              {t("game.checkinTotals")}{" "}
              <strong>{game.checkInDates.length}</strong>
            </p>
          </div>
        </div>

        <div className="game-checkin-cards-wrap">
          <p className="game-checkin-cards-label">{t("game.weekLabel")}</p>
          <ul className="game-checkin-cards" aria-label={t("game.daysAria")}>
            {strip.map((ymd) => {
              const done = setDates.has(ymd);
              const isToday = ymd === today;
              const isFuture = ymd > today;
              const wday = weekdayShort(ymd, locale);

              const cardBody = (
                <>
                  <span className="game-checkin-card-wday">{wday}</span>
                  <span className="game-checkin-card-date">{shortLabel(ymd)}</span>
                  {isFuture ? (
                    <span className="game-checkin-card-status">
                      {t("game.unavailable")}
                    </span>
                  ) : isToday ? (
                    done ? (
                      <span className="game-checkin-card-status game-checkin-card-status--ok">
                        {t("game.todayDoneRewards", {
                          xp: CHECKIN_XP,
                          pts: CHECKIN_POINTS,
                        })}
                      </span>
                    ) : (
                      <span className="game-checkin-card-status game-checkin-card-status--cta">
                        {t("game.clickToClaim")}
                      </span>
                    )
                  ) : done ? (
                    <span className="game-checkin-card-status game-checkin-card-status--ok">
                      {t("game.checkinDone")}
                    </span>
                  ) : (
                    <span className="game-checkin-card-status">
                      {t("game.noCheckin")}
                    </span>
                  )}
                </>
              );

              if (isToday && !done) {
                return (
                  <li key={ymd} className="game-checkin-cards-item">
                    <button
                      type="button"
                      className="game-checkin-card game-checkin-card--action"
                      onClick={checkIn}
                      aria-label={t("game.redeemAria", {
                        date: ymd,
                        xp: CHECKIN_XP,
                        pts: CHECKIN_POINTS,
                      })}
                    >
                      {cardBody}
                    </button>
                  </li>
                );
              }

              const mods = [
                "game-checkin-card",
                done && "game-checkin-card--done",
                isToday && done && "game-checkin-card--today-done",
                isFuture && "game-checkin-card--future",
                !isFuture && !isToday && !done && "game-checkin-card--missed",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <li key={ymd} className="game-checkin-cards-item">
                  <div
                    className={mods}
                    role="group"
                    aria-label={`${wday} ${shortLabel(ymd)}${
                      isToday ? t("game.cardAriaToday") : ""
                    }${done ? t("game.cardAriaDone") : ""}`}
                  >
                    {cardBody}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
