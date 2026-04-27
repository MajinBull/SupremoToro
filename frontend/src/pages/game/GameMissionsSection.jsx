import { useGame } from "../../GameContext.jsx";
import { MISSION_POINTS, MISSION_XP } from "../../game/gameXp.js";
import { useI18n } from "../../i18n/I18nContext.jsx";

function missionMods(done, claimed) {
  const mods = ["game-mission"];
  if (done && !claimed) mods.push("game-mission--redeem");
  if (done && claimed) mods.push("game-mission--done");
  return mods.join(" ");
}

export default function GameMissionsSection() {
  const { t } = useI18n();
  const { missionRows, claimMission } = useGame();

  return (
    <div className="game-panel">
      <ul className="game-mission-list">
        {missionRows.map(
          ({ mission, value, target, done, claimed, pct }) => {
            const redeemable = done && !claimed;
            const title = t(`game.missions.${mission.id}.title`);
            const description = t(`game.missions.${mission.id}.description`);
            return (
              <li key={mission.id} className={missionMods(done, claimed)}>
                <div className="game-mission-head">
                  <span className="game-mission-title">{title}</span>
                  {done && claimed ? (
                    <span className="game-mission-reward-wrap">
                      <span className="game-mission-badge">{t("game.redeemed")}</span>
                      <span className="game-mission-xp">+{MISSION_XP} XP</span>
                      <span className="game-mission-points">+{MISSION_POINTS} pt</span>
                    </span>
                  ) : redeemable ? (
                    <span className="game-mission-badge game-mission-badge--ready">
                      {t("game.completed")}
                    </span>
                  ) : (
                    <span className="game-mission-count">
                      {value} / {target}
                    </span>
                  )}
                </div>
                <p className="game-mission-desc">{description}</p>
                {!done && (
                  <>
                    <p className="game-mission-xp-pending">
                      {t("game.rewardPending", {
                        xp: MISSION_XP,
                        pts: MISSION_POINTS,
                      })}
                    </p>
                    <div
                      className="game-progress"
                      role="progressbar"
                      aria-valuenow={value}
                      aria-valuemin={0}
                      aria-valuemax={target}
                    >
                      <div
                        className="game-progress-bar"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </>
                )}
                {redeemable && (
                  <div className="game-mission-redeem-block">
                    <p className="game-mission-xp-pending game-mission-xp-pending--redeem">
                      {t("game.rewardPending", {
                        xp: MISSION_XP,
                        pts: MISSION_POINTS,
                      })}
                    </p>
                    <div
                      className="game-progress"
                      role="progressbar"
                      aria-valuenow={target}
                      aria-valuemin={0}
                      aria-valuemax={target}
                    >
                      <div
                        className="game-progress-bar"
                        style={{ width: "100%" }}
                      />
                    </div>
                    <button
                      type="button"
                      className="game-mission-claim"
                      onClick={() => claimMission(mission.id)}
                    >
                      {t("game.redeem")}
                    </button>
                  </div>
                )}
              </li>
            );
          },
        )}
      </ul>
    </div>
  );
}
