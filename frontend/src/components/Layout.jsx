import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { LayoutChartsContext } from "../LayoutChartsContext.jsx";
import { PriceAlertsTickerSync } from "../PriceAlertsContext.jsx";
import MultiChartsPage from "../pages/MultiChartsPage.jsx";
import { SYMBOLS_ERROR_FALLBACK, useTickers } from "../TickerContext.jsx";
import AdSenseUnit from "./AdSenseUnit.jsx";
import AuthBar from "./AuthBar.jsx";
import LanguageSwitcher from "./LanguageSwitcher.jsx";
import PrivacyModal from "./PrivacyModal.jsx";
import SeoHead from "./SeoHead.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";
import { useMarket } from "../MarketContext.jsx";

const SESSION_CHARTS_TOP = "quota:chartsTopOpen";

function loadChartsTopOpen() {
  try {
    return sessionStorage.getItem(SESSION_CHARTS_TOP) !== "0";
  } catch {
    return true;
  }
}

export default function Layout() {
  const { t } = useI18n();
  const { exchange, setExchange, marketType, setMarketType } = useMarket();

  const marketPresetValue = `${exchange}-${
    marketType === "spot" ? "spot" : "derivatives"
  }`;

  function applyMarketPreset(value) {
    const i = value.indexOf("-");
    if (i <= 0) return;
    const ex = value.slice(0, i);
    const mt = value.slice(i + 1);
    if (ex !== "bybit" && ex !== "binance") return;
    setExchange(ex);
    setMarketType(mt === "spot" ? "spot" : "derivatives");
  }

  /** Toglie il focus dal native select dopo la scelta così non restano bordo/glow (:focus-visible). */
  function handleMarketPresetChange(e) {
    applyMarketPreset(e.target.value);
    const el = e.currentTarget;
    queueMicrotask(() => {
      try {
        el.blur();
      } catch {
        /* ignore */
      }
    });
  }

  function renderMarketPresetSelect(selectId, className, omitSrLabel = false) {
    return (
      <>
        {!omitSrLabel && (
          <label htmlFor={selectId} className="sr-only">
            {t("layout.marketPresetLabel")}
          </label>
        )}
        <select
          id={selectId}
          className={className}
          value={marketPresetValue}
          onChange={handleMarketPresetChange}
        >
          <option value="bybit-derivatives">
            {t("layout.marketPresetBybitDerivatives")}
          </option>
          <option value="bybit-spot">
            {t("layout.marketPresetBybitSpot")}
          </option>
          <option value="binance-derivatives">
            {t("layout.marketPresetBinanceDerivatives")}
          </option>
          <option value="binance-spot">
            {t("layout.marketPresetBinanceSpot")}
          </option>
        </select>
      </>
    );
  }
  const location = useLocation();
  const isCharts = location.pathname === "/charts";
  const [chartsTopOpen, setChartsTopOpen] = useState(loadChartsTopOpen);
  const [chartsRotationPaused, setChartsRotationPaused] = useState(false);
  const [chartsRotationScheduleActive, setChartsRotationScheduleActive] =
    useState(false);
  const [chartsPageNav, setChartsPageNav] = useState(null);
  const [chartsEverVisited, setChartsEverVisited] = useState(
    () => location.pathname === "/charts"
  );
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const [footerVisible, setFooterVisible] = useState(true);

  const { tickerError, symbolsError } = useTickers();

  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_CHARTS_TOP, chartsTopOpen ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [chartsTopOpen]);

  useEffect(() => {
    if (location.pathname === "/charts") setChartsEverVisited(true);
  }, [location.pathname]);

  useEffect(() => {
    setSideMenuOpen(false);
  }, [location.pathname]);


  const reportChartsRotationSchedule = useCallback((active) => {
    setChartsRotationScheduleActive(!!active);
  }, []);

  const chartsOutletContext = useMemo(
    () => ({
      chartsTopOpen,
      setChartsTopOpen,
      chartsRotationPaused,
      reportChartsRotationSchedule,
      registerChartsPageNav: setChartsPageNav,
    }),
    [
      chartsTopOpen,
      chartsRotationPaused,
      reportChartsRotationSchedule,
    ]
  );

  return (
    <div
      className={`app-shell${isCharts ? " app-shell--charts-fill" : " app-shell--dashboard-fill"}`}
    >
      <SeoHead />
      <PriceAlertsTickerSync />
      <header className="app-header">
        <div className="header-top-row">
          <h1 className="header-site-title">Quota</h1>
          <div className="header-actions-right">
            <AuthBar />
            {isCharts && (
              <div className="charts-header-actions">
                <button
                  type="button"
                  className="charts-top-toggle"
                  onClick={() => setChartsTopOpen((v) => !v)}
                  aria-expanded={chartsTopOpen}
                  aria-controls="charts-controls-panel"
                  id="charts-top-toggle"
                >
                  {chartsTopOpen ? t("layout.hideChartsPanel") : t("layout.showChartsSettings")}
                  <span className="sr-only">
                    {" "}
                    {t("layout.chartsPanelSr")}
                  </span>
                </button>
                {chartsRotationScheduleActive && (
                  <button
                    type="button"
                    className={`charts-rotation-pause${chartsRotationPaused ? " charts-rotation-pause--active" : ""}`}
                    onClick={() => setChartsRotationPaused((p) => !p)}
                    aria-pressed={chartsRotationPaused}
                    title={
                      chartsRotationPaused
                        ? t("layout.rotationResumeTitle")
                        : t("layout.rotationPauseTitle")
                    }
                  >
                    {chartsRotationPaused ? t("layout.rotationResume") : t("layout.rotationPause")}
                  </button>
                )}
                {chartsPageNav && (
                  <div
                    className="charts-page-nav"
                    role="group"
                    aria-label={t("layout.chartsNavGroup")}
                  >
                    <button
                      type="button"
                      className="charts-page-step"
                      onClick={chartsPageNav.goPrev}
                      title={t("layout.prevGroup")}
                      aria-label={t("layout.prevGroupAria")}
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      className="charts-page-step"
                      onClick={chartsPageNav.goNext}
                      title={t("layout.nextGroup")}
                      aria-label={t("layout.nextGroupAria")}
                    >
                      ›
                    </button>
                  </div>
                )}
              </div>
            )}
            <button
              type="button"
              className={`app-menu-toggle${sideMenuOpen ? " app-menu-toggle--active" : ""}`}
              onClick={() => setSideMenuOpen((v) => !v)}
              aria-expanded={sideMenuOpen}
              aria-controls="app-side-menu"
              aria-label={t("layout.menuOpen")}
              title={t("layout.menuOpenTitle")}
            >
              <span className="app-menu-toggle-icon" aria-hidden="true">
                <span className="app-menu-toggle-line" />
                <span className="app-menu-toggle-line" />
                <span className="app-menu-toggle-line" />
              </span>
            </button>
          </div>
          <nav className="main-nav" aria-label={t("layout.mainNav")}>
            <div className="main-nav__market">
              {renderMarketPresetSelect(
                "quota-market-preset-desktop",
                "header-market-select",
              )}
            </div>
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `nav-link${isActive ? " nav-link-active" : ""}`
              }
            >
              {t("nav.dashboard")}
            </NavLink>
            <NavLink
              to="/listings"
              className={({ isActive }) =>
                `nav-link${isActive ? " nav-link-active" : ""}`
              }
            >
              {t("nav.listings")}
            </NavLink>
            <NavLink
              to="/charts"
              className={({ isActive }) =>
                `nav-link${isActive ? " nav-link-active" : ""}`
              }
            >
              {t("nav.charts")}
            </NavLink>
            <NavLink
              to="/signals"
              className={({ isActive }) =>
                `nav-link${isActive ? " nav-link-active" : ""}`
              }
            >
              {t("nav.signals")}
            </NavLink>
          </nav>
        </div>
      </header>
      <div
        className={`app-side-menu-backdrop${sideMenuOpen ? " open" : ""}`}
        onClick={() => setSideMenuOpen(false)}
        aria-hidden
      />
      <aside
        id="app-side-menu"
        className={`app-side-menu${sideMenuOpen ? " open" : ""}`}
        aria-hidden={!sideMenuOpen}
        aria-label={t("layout.sideMenuTitle")}
      >
        <div className="app-side-menu-head">
          <h2 className="app-side-menu-title">{t("layout.menuHeading")}</h2>
          <button
            type="button"
            className="app-side-menu-close"
            onClick={() => setSideMenuOpen(false)}
            aria-label={t("layout.closeMenu")}
          >
            ×
          </button>
        </div>
        <nav className="app-side-menu-links" aria-label={t("layout.sideNav")}>
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `app-side-menu-link${isActive ? " app-side-menu-link--active" : ""}`
            }
          >
            {t("nav.dashboard")}
          </NavLink>
          <NavLink
            to="/listings"
            className={({ isActive }) =>
              `app-side-menu-link${isActive ? " app-side-menu-link--active" : ""}`
            }
          >
            {t("nav.listings")}
          </NavLink>
          <NavLink
            to="/charts"
            className={({ isActive }) =>
              `app-side-menu-link${isActive ? " app-side-menu-link--active" : ""}`
            }
          >
            {t("nav.charts")}
          </NavLink>
          <NavLink
            to="/signals"
            className={({ isActive }) =>
              `app-side-menu-link${isActive ? " app-side-menu-link--active" : ""}`
            }
          >
            {t("nav.signals")}
          </NavLink>
        </nav>
        <div
          className="app-side-menu-market app-side-menu-market-mobile-only"
          aria-label={t("layout.marketDataAria")}
        >
          <div className="app-side-menu-field">
            <label
              className="app-side-menu-field-label"
              htmlFor="quota-market-preset-drawer"
            >
              {t("layout.marketPresetLabel")}
            </label>
            {renderMarketPresetSelect(
              "quota-market-preset-drawer",
              "app-side-menu-select",
              true,
            )}
          </div>
        </div>
        <div className="app-side-menu-footer">
          <LanguageSwitcher />
        </div>
      </aside>

      {(tickerError || symbolsError) && (
        <div
          className={`error-banner${isCharts ? " error-banner--compact" : ""}`}
          role="alert"
        >
          {tickerError && <div>{tickerError}</div>}
          {symbolsError && (
            <div>
              {t("layout.symbolsPrefix")}:{" "}
              {symbolsError === SYMBOLS_ERROR_FALLBACK
                ? t("errors.symbolsUnavailable")
                : symbolsError}
            </div>
          )}
        </div>
      )}

      <AdSenseUnit />

      <div
        className={`app-outlet${isCharts ? " app-outlet--charts" : " app-outlet--dashboard"}`}
      >
        <LayoutChartsContext.Provider value={chartsOutletContext}>
          <div
            className="app-outlet-branch"
            style={{
              display: isCharts ? "none" : "flex",
              flexDirection: "column",
              flex: 1,
              minHeight: 0,
              overflow: "hidden",
            }}
            hidden={isCharts}
            aria-hidden={isCharts}
          >
            <Outlet context={chartsOutletContext} />
          </div>
          {chartsEverVisited && (
            <div
              className="app-outlet-branch"
              style={{
                display: isCharts ? "flex" : "none",
                flexDirection: "column",
                flex: 1,
                minHeight: 0,
                overflow: "hidden",
              }}
              hidden={!isCharts}
              aria-hidden={!isCharts}
            >
              <MultiChartsPage />
            </div>
          )}
        </LayoutChartsContext.Provider>
      </div>

      {footerVisible && (
        <footer className="app-footer app-footer--dismissible">
          <button
            type="button"
            className="footer-link footer-link-button"
            onClick={() => setPrivacyOpen(true)}
          >
            {t("layout.footerPrivacy")}
          </button>
          <span className="footer-sep" aria-hidden="true">
            ·
          </span>
          <span className="footer-note">{t("layout.footerAds")}</span>
          <button
            type="button"
            className="footer-close"
            aria-label={t("layout.closeFooter")}
            onClick={() => setFooterVisible(false)}
          >
            ×
          </button>
        </footer>
      )}

      <PrivacyModal open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
    </div>
  );
}
