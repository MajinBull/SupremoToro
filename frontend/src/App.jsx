import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { FavoritesProvider } from "./FavoritesContext.jsx";
import { PriceAlertsProvider } from "./PriceAlertsContext.jsx";
import { TickerProvider } from "./TickerContext.jsx";
import Layout from "./components/Layout.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";

/** La pagina grafici è montata in Layout (keep-alive) così stato e filtri restano al cambio sezione. */
function ChartsRoutePlaceholder() {
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <TickerProvider>
        <PriceAlertsProvider>
          <FavoritesProvider>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<DashboardPage />} />
                <Route path="charts" element={<ChartsRoutePlaceholder />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </FavoritesProvider>
        </PriceAlertsProvider>
      </TickerProvider>
    </BrowserRouter>
  );
}
