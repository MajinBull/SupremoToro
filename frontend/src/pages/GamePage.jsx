import { useMemo } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useI18n } from "../i18n/I18nContext.jsx";

export default function GamePage() {
  const { t } = useI18n();

  const SIDE_LINKS = useMemo(
    () => [
      { to: "checkin", label: t("game.navCheckin") },
      { to: "missions", label: t("game.navMissions") },
      { to: "badges", label: t("game.navBadges") },
      { to: "bet", label: t("game.navBet") },
      { to: "profile", label: t("game.navProfile") },
    ],
    [t],
  );

  return (
    <div className="game-shell">
      <aside className="game-side" aria-label={t("game.sideMenu")}>
        <nav className="game-side-nav">
          {SIDE_LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `game-side-link${isActive ? " game-side-link--active" : ""}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="game-outlet">
        <Outlet />
      </div>
    </div>
  );
}
