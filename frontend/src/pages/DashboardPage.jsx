import { useMemo, useState } from "react";
import { useFavorites } from "../FavoritesContext.jsx";
import { useTickers } from "../TickerContext.jsx";
import CryptoTable from "../components/CryptoTable.jsx";
import ChartPanel from "../components/ChartPanel.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";

function sortRows(rows, key, dir) {
  const mult = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = a[key];
    const vb = b[key];
    if (va == null && vb == null) return a.symbol.localeCompare(b.symbol);
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === "string" && typeof vb === "string") {
      return mult * va.localeCompare(vb);
    }
    if (va !== vb) return mult * (va < vb ? -1 : 1);
    return a.symbol.localeCompare(b.symbol);
  });
}

export default function DashboardPage() {
  const { t } = useI18n();
  const { rows, tickerError } = useTickers();
  const { favorites } = useFavorites();

  const [search, setSearch] = useState("");
  const [minVolFilter, setMinVolFilter] = useState("any");
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const [sortKey, setSortKey] = useState("volume24h");
  const [sortDir, setSortDir] = useState("desc");

  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "symbol" ? "asc" : "desc");
    }
  };

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = rows;
    if (q) {
      out = out.filter((r) => r.symbol.toLowerCase().includes(q));
    }
    const thresholds = { any: 0, "1m": 1e6, "10m": 1e7, "100m": 1e8 };
    const thresh = thresholds[minVolFilter] ?? 0;
    if (thresh > 0) {
      out = out.filter((r) => (r.volume24h ?? 0) >= thresh);
    }
    if (favoritesOnly) {
      out = out.filter((r) => favorites.has(r.symbol));
    }
    return sortRows(out, sortKey, sortDir);
  }, [rows, search, minVolFilter, favoritesOnly, favorites, sortKey, sortDir]);

  const openChart = (symbol) => {
    setSelectedSymbol(symbol);
    setPanelOpen(true);
  };

  const countExtra =
    search || minVolFilter !== "any" || favoritesOnly
      ? t("dashboard.countFiltered", { total: rows.length })
      : "";

  return (
    <>
      <div className="dashboard-page">
        <div className="toolbar">
          <div className="search-wrap">
            <input
              type="search"
              placeholder={t("dashboard.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={t("dashboard.searchAria")}
            />
          </div>
          <div className="filter-group">
            <label htmlFor="vol-filter">{t("dashboard.volMinLabel")}</label>
            <select
              id="vol-filter"
              value={minVolFilter}
              onChange={(e) => setMinVolFilter(e.target.value)}
            >
              <option value="any">{t("dashboard.volAny")}</option>
              <option value="1m">≥ 1M</option>
              <option value="10m">≥ 10M</option>
              <option value="100m">≥ 100M</option>
            </select>
          </div>
          <div className="filter-group">
            <button
              type="button"
              className={`toolbar-filter-toggle ${favoritesOnly ? "toolbar-filter-toggle--on" : ""}`}
              onClick={() => setFavoritesOnly((v) => !v)}
              aria-pressed={favoritesOnly}
              title={
                favoritesOnly
                  ? t("dashboard.favoritesOnTitle")
                  : t("dashboard.favoritesOffTitle")
              }
            >
              {t("dashboard.favoritesToggle")}
            </button>
          </div>
          <span className="count-pill">
            {t("dashboard.countPill", { n: filteredSorted.length })}
            {countExtra}
          </span>
        </div>

        <main className="main-area">
          {rows.length === 0 && !tickerError ? (
            <div className="empty-state">{t("dashboard.loading")}</div>
          ) : filteredSorted.length === 0 ? (
            <div className="empty-state">
              {favoritesOnly && favorites.size === 0
                ? t("dashboard.emptyNoFavorites")
                : t("dashboard.emptyFiltered")}
            </div>
          ) : (
            <CryptoTable
              rows={filteredSorted}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
              selectedSymbol={panelOpen ? selectedSymbol : null}
              onSelectSymbol={openChart}
            />
          )}
        </main>
      </div>

      <ChartPanel
        symbol={selectedSymbol}
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
      />
    </>
  );
}
