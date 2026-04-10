import { useCallback, useEffect, useMemo, useState } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { LayoutChartsContext } from "../LayoutChartsContext.jsx";
import { PriceAlertsTickerSync } from "../PriceAlertsContext.jsx";
import MultiChartsPage from "../pages/MultiChartsPage.jsx";
import { useTickers } from "../TickerContext.jsx";

const SESSION_CHARTS_TOP = "bullweb:chartsTopOpen";

function loadChartsTopOpen() {
  try {
    return sessionStorage.getItem(SESSION_CHARTS_TOP) !== "0";
  } catch {
    return true;
  }
}

export default function Layout() {
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

  const {
    symbolCount,
    lastTickerAt,
    lastSymbolsAt,
    tickerError,
    symbolsError,
  } = useTickers();

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

  const headerMeta = (
    <div className="header-meta">
      <span className="badge" title="Simboli in cache backend">
        {symbolCount} perpetual
      </span>
      {lastTickerAt && (
        <span className="badge">
          Ticker: {new Date(lastTickerAt).toLocaleTimeString()}
        </span>
      )}
      {lastSymbolsAt && (
        <span className="badge">
          Lista simboli: {new Date(lastSymbolsAt).toLocaleString()}
        </span>
      )}
    </div>
  );

  const bybitSubtitle = (
    <p className="subtitle">
      Perpetual linear Bybit in USDT — dati pubblici, aggiornamento periodico.
    </p>
  );

  const subtitleAndMeta = (
    <>
      {bybitSubtitle}
      {headerMeta}
    </>
  );

  return (
    <div
      className={`app-shell${isCharts ? " app-shell--charts-fill" : " app-shell--dashboard-fill"}`}
    >
      <PriceAlertsTickerSync />
      <header className="app-header">
        <div className="header-top-row">
          <h1 className="header-site-title">SupremoToro</h1>
          {isCharts && (
            <div className="charts-header-actions">
              <button
                type="button"
                className="charts-top-toggle"
                onClick={() => setChartsTopOpen((v) => !v)}
                aria-expanded={chartsTopOpen}
                aria-controls="charts-top-panel charts-controls-panel"
                id="charts-top-toggle"
              >
                {chartsTopOpen ? "▲ Nascondi" : "▼ Mostra"}
                <span className="sr-only">
                  {" "}
                  barra strumenti sotto l’intestazione
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
                      ? "Riprendi il cambio automatico pagina griglia"
                      : "Metti in pausa la rotazione automatica della griglia"
                  }
                >
                  {chartsRotationPaused ? "▶ Rotazione" : "⏸ Pausa rotaz."}
                </button>
              )}
              {chartsPageNav && (
                <div
                  className="charts-page-nav"
                  role="group"
                  aria-label="Gruppo simboli precedente o successivo"
                >
                  <button
                    type="button"
                    className="charts-page-step"
                    onClick={chartsPageNav.goPrev}
                    title="Gruppo precedente"
                    aria-label="Gruppo precedente di simboli"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="charts-page-step"
                    onClick={chartsPageNav.goNext}
                    title="Gruppo successivo"
                    aria-label="Gruppo successivo di simboli"
                  >
                    ›
                  </button>
                </div>
              )}
            </div>
          )}
          <nav className="main-nav" aria-label="Sezioni">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `nav-link${isActive ? " nav-link-active" : ""}`
              }
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/charts"
              className={({ isActive }) =>
                `nav-link${isActive ? " nav-link-active" : ""}`
              }
            >
              Grafici multipli
            </NavLink>
          </nav>
        </div>
        {isCharts ? (
          chartsTopOpen && (
            <div id="charts-top-panel" className="charts-header-secondary">
              {bybitSubtitle}
              {headerMeta}
            </div>
          )
        ) : (
          subtitleAndMeta
        )}
      </header>

      {(tickerError || symbolsError) && (
        <div
          className={`error-banner${isCharts ? " error-banner--compact" : ""}`}
          role="alert"
        >
          {tickerError && <div>{tickerError}</div>}
          {symbolsError && <div>Simboli: {symbolsError}</div>}
        </div>
      )}

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
    </div>
  );
}
