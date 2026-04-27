import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { I18nProvider } from "./i18n/I18nContext.jsx";
import { FavoritesProvider } from "./FavoritesContext.jsx";
import { GameProvider } from "./GameContext.jsx";
import { PriceAlertsProvider } from "./PriceAlertsContext.jsx";
import { TickerProvider } from "./TickerContext.jsx";
import Layout from "./components/Layout.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import GamePage from "./pages/GamePage.jsx";
import GameBadgesSection from "./pages/game/GameBadgesSection.jsx";
import GameCheckInSection from "./pages/game/GameCheckInSection.jsx";
import GameBetSection from "./pages/game/GameBetSection.jsx";
import GameMissionsSection from "./pages/game/GameMissionsSection.jsx";
import GameProfileSection from "./pages/game/GameProfileSection.jsx";
import ListingsPage from "./pages/ListingsPage.jsx";

/** La pagina grafici è montata in Layout (keep-alive) così stato e filtri restano al cambio sezione. */
function ChartsRoutePlaceholder() {
  return null;
}

export default function App() {
  return (
    <I18nProvider>
      <BrowserRouter>
        <TickerProvider>
          <PriceAlertsProvider>
            <FavoritesProvider>
              <GameProvider>
                <Routes>
                  <Route element={<Layout />}>
                    <Route index element={<DashboardPage />} />
                    <Route path="listings" element={<ListingsPage />} />
                    <Route path="game" element={<GamePage />}>
                      <Route
                        index
                        element={<Navigate to="checkin" replace />}
                      />
                      <Route path="checkin" element={<GameCheckInSection />} />
                      <Route path="missions" element={<GameMissionsSection />} />
                      <Route path="badges" element={<GameBadgesSection />} />
                      <Route path="bet" element={<GameBetSection />} />
                      <Route path="profile" element={<GameProfileSection />} />
                    </Route>
                    <Route path="charts" element={<ChartsRoutePlaceholder />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Route>
                </Routes>
              </GameProvider>
            </FavoritesProvider>
          </PriceAlertsProvider>
        </TickerProvider>
      </BrowserRouter>
    </I18nProvider>
  );
}
