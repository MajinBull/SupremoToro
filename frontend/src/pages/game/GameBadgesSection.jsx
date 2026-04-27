import { useMemo } from "react";
import { useGame } from "../../GameContext.jsx";
import { useI18n } from "../../i18n/I18nContext.jsx";

export default function GameBadgesSection() {
  const { t } = useI18n();
  const { badgeRows } = useGame();

  const { unlocked, total } = useMemo(() => {
    const u = badgeRows.filter((r) => r.unlocked).length;
    return { unlocked: u, total: badgeRows.length };
  }, [badgeRows]);

  return (
    <div className="game-panel">
      <div className="game-panel-heading-row">
        <span
          className="game-badge-total"
          title={t("game.badgesUnlockedTitle")}
          aria-label={t("game.badgesUnlockedAria", { u: unlocked, total })}
        >
          {unlocked}/{total}
        </span>
      </div>
      <ul className="game-badge-grid">
        {badgeRows.map(({ badge, unlocked: u }) => (
          <li
            key={badge.id}
            className={`game-badge${u ? " game-badge--unlocked" : ""}`}
          >
            <span className="game-badge-icon" aria-hidden>
              {u ? "★" : "○"}
            </span>
            <span className="game-badge-title">
              {t(`game.badges.${badge.id}.title`)}
            </span>
            <span className="game-badge-desc">
              {t(`game.badges.${badge.id}.description`)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
