import { useEffect, useState } from "react";
import { useI18n } from "../i18n/I18nContext.jsx";

const LEAVE_MS = 3200;
const UNMOUNT_MS = 3500;

function toastTitle(item, t) {
  if (item.kind === "checkin") return t("game.toastCheckin");
  if (item.kind === "mission" && item.missionId) {
    const missionTitle = t(`game.missions.${item.missionId}.title`);
    return t("game.toastMission", { name: missionTitle });
  }
  return "";
}

/**
 * @param {object} p
 * @param {string} p.id
 * @param {{ kind?: string, missionId?: string, xp: number, points: number }} p.item
 * @param {(id: string) => void} p.onRemove
 */
function GameRewardToast({ id, item, onRemove }) {
  const { t } = useI18n();
  const title = toastTitle(item, t);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const tLeave = setTimeout(() => setLeaving(true), LEAVE_MS);
    const tRemove = setTimeout(() => {
      onRemove(id);
    }, UNMOUNT_MS);
    return () => {
      clearTimeout(tLeave);
      clearTimeout(tRemove);
    };
  }, [id, onRemove]);

  const { xp, points } = item;

  return (
    <div
      className={`game-reward-toast${leaving ? " game-reward-toast--leaving" : ""}`}
      role="status"
      aria-live="polite"
    >
      <p className="game-reward-toast-title">{title}</p>
      <div className="game-reward-toast-body">
        {xp > 0 && (
          <div className="game-reward-toast-row game-reward-toast-row--xp">
            <span className="game-reward-toast-label">XP</span>
            <span className="game-reward-toast-value">+{xp}</span>
          </div>
        )}
        {points > 0 && (
          <div className="game-reward-toast-row game-reward-toast-row--points">
            <span className="game-reward-toast-label">{t("game.pointsLabel")}</span>
            <span className="game-reward-toast-value">+{points}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * @param {object} p
 * @param {{ id: string, kind?: string, missionId?: string, xp: number, points: number }[]} p.items
 * @param {(id: string) => void} p.onRemove
 */
export default function GameRewardToasts({ items, onRemove }) {
  const { t } = useI18n();

  if (items.length === 0) return null;

  return (
    <div className="game-reward-toast-host" aria-label={t("game.toastHost")}>
      {items.map((item) => (
        <GameRewardToast
          key={item.id}
          id={item.id}
          item={item}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}
