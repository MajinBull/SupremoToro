import { useEffect, useState } from "react";
import { useGame } from "../../GameContext.jsx";
import {
  CHECKIN_POINTS,
  CHECKIN_XP,
  MISSION_POINTS,
  MISSION_XP,
  XP_PER_LEVEL,
} from "../../game/gameXp.js";
import { MISSIONS } from "../../game/gameMissions.js";
import { useI18n } from "../../i18n/I18nContext.jsx";

export default function GameProfileSection() {
  const { t } = useI18n();
  const { profileName, level, setUsername, game, resetAllProgress } = useGame();
  const [draft, setDraft] = useState(() => game.username ?? "");

  useEffect(() => {
    setDraft(game.username ?? "");
  }, [game.username]);

  return (
    <div className="game-panel">
      <div className="game-profile-card">
        <div className="game-profile-split">
          <div className="game-profile-col">
            <label className="game-profile-label" htmlFor="game-username">
              {t("game.username")}
            </label>
            <div className="game-profile-name-row">
              <input
                id="game-username"
                type="text"
                className="game-profile-input"
                maxLength={32}
                placeholder={t("game.usernamePh")}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                autoComplete="off"
              />
              <button
                type="button"
                className="game-profile-save"
                onClick={() => setUsername(draft)}
              >
                {t("game.save")}
              </button>
            </div>
          </div>

          <div className="game-profile-col game-profile-col--level">
            <div className="game-profile-level-block">
              <div className="game-profile-level-row">
                <span className="game-profile-name-display">{profileName}</span>
              </div>
              <div className="game-profile-top-stats" aria-label={t("game.levelXpAria")}>
                <section
                  className="game-side-block game-side-block--xp"
                  aria-label={t("game.xpSection")}
                >
                  <p className="game-side-block-label">XP</p>
                  <div className="game-side-stats-top">
                    <span className="game-side-level-pill">
                      {t("game.levelPill", { n: level.level })}
                    </span>
                    <span
                      className="game-side-xp-frac"
                      title={t("game.xpToward")}
                    >
                      {level.xpInto}/{XP_PER_LEVEL} XP
                    </span>
                  </div>
                  <div
                    className="game-progress game-progress--side"
                    role="progressbar"
                    aria-valuenow={level.xpInto}
                    aria-valuemin={0}
                    aria-valuemax={XP_PER_LEVEL}
                    aria-label={t("game.xpProgressAria", {
                      into: level.xpInto,
                      per: XP_PER_LEVEL,
                      next: level.level + 1,
                    })}
                  >
                    <div
                      className="game-progress-bar"
                      style={{ width: `${level.pctToNext}%` }}
                    />
                  </div>
                </section>
                <section
                  className="game-side-block game-side-block--points"
                  aria-label={t("game.pointsSection")}
                >
                  <p className="game-side-block-label">{t("game.pointsLabel")}</p>
                  <p
                    className="game-side-points"
                    aria-label={t("game.pointsTotalAria", {
                      n: game.totalPoints ?? 0,
                    })}
                  >
                    <span className="game-side-points-value">
                      {game.totalPoints ?? 0}
                    </span>{" "}
                    {t("game.pointsWord")}
                  </p>
                </section>
              </div>
              <p className="game-profile-xp-total">
                {t("game.xpTotalLine", { total: level.totalXp })}
                <span className="game-profile-xp-sub">
                  {" "}
                  {t("game.towardLevel", { n: level.level + 1 })}
                </span>
              </p>
            </div>
          </div>
        </div>

        <div className="game-profile-xp-rules">
          <p className="game-profile-xp-rules-title">{t("game.rewardsTitle")}</p>
          <ul className="game-profile-xp-rules-list">
            <li>
              {t("game.rewardRuleCheckin", {
                xp: CHECKIN_XP,
                pts: CHECKIN_POINTS,
              })}
            </li>
            <li>
              {t("game.rewardRuleMissions", {
                count: MISSIONS.length,
                mxp: MISSION_XP,
                mpts: MISSION_POINTS,
              })}
            </li>
            <li>
              {t("game.rewardRuleLevel", { per: XP_PER_LEVEL })}
            </li>
            <li>{t("game.rewardRuleFuture")}</li>
          </ul>
        </div>

        <div className="game-profile-dev">
          <p className="game-profile-dev-label">{t("game.devLabel")}</p>
          <button
            type="button"
            className="game-profile-reset"
            onClick={() => {
              if (window.confirm(t("game.resetConfirm"))) {
                resetAllProgress();
                setDraft("");
              }
            }}
          >
            {t("game.resetBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}
