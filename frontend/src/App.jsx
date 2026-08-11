import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext.jsx";
import { I18nProvider } from "./i18n/I18nContext.jsx";
import { FavoritesProvider } from "./FavoritesContext.jsx";
import { PriceAlertsProvider } from "./PriceAlertsContext.jsx";
import { MarketProvider } from "./MarketContext.jsx";
import { TickerProvider } from "./TickerContext.jsx";
import Layout from "./components/Layout.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import ListingsPage from "./pages/ListingsPage.jsx";
import SignalsPage from "./pages/SignalsPage.jsx";

/** La pagina grafici è montata in Layout (keep-alive) così stato e filtri restano al cambio sezione. */
function ChartsRoutePlaceholder() {
  return null;
}

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
      <BrowserRouter>
        <MarketProvider>
        <TickerProvider>
          <PriceAlertsProvider>
            <FavoritesProvider>
                <Routes>
                  <Route element={<Layout />}>
                    <Route index element={<DashboardPage />} />
                    <Route path="listings" element={<ListingsPage />} />
                    <Route path="signals" element={<SignalsPage />} />
                    <Route path="charts" element={<ChartsRoutePlaceholder />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Route>
                </Routes>
            </FavoritesProvider>
          </PriceAlertsProvider>
        </TickerProvider>
        </MarketProvider>
      </BrowserRouter>
      </AuthProvider>
    </I18nProvider>
  );
}
