import { useMemo } from "react";
import { useMarket } from "../MarketContext.jsx";
import { useTickers } from "../TickerContext.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";

function formatDt(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function formatLaunchDay(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      dateStyle: "medium",
    });
  } catch {
    return iso;
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

function openDaysInteger(iso) {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "—";
  return String(Math.floor(ms / DAY_MS));
}

function daysHoursUntil(iso, t) {
  if (!iso) return "—";
  const left = new Date(iso).getTime() - Date.now();
  if (left <= 0) return "—";
  const d = Math.floor(left / (24 * 60 * 60 * 1000));
  const h = Math.floor((left % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (d > 0) return t("listingsTime.dayHour", { d, h });
  const m = Math.floor((left % (60 * 60 * 1000)) / (60 * 1000));
  return t("listingsTime.hourMin", { h, m });
}

export default function ListingsPage() {
  const { t } = useI18n();
  const { exchange, marketType } = useMarket();
  const { recentListings, delisted } = useTickers();

  const marketContextLine = useMemo(() => {
    const segment =
      marketType === "spot"
        ? t("layout.spot")
        : t("layout.derivatives");
    const exchangeLabel =
      exchange === "binance" ? "Binance" : "Bybit";
    return t("listings.marketContext", {
      exchange: exchangeLabel,
      segment,
    });
  }, [exchange, marketType, t]);

  const recentSorted = useMemo(
    () =>
      [...recentListings].sort(
        (a, b) => new Date(b.listedAt) - new Date(a.listedAt),
      ),
    [recentListings],
  );

  const delistedSorted = useMemo(
    () =>
      [...delisted].sort((a, b) =>
        String(a.symbol).localeCompare(String(b.symbol)),
      ),
    [delisted],
  );

  return (
    <div className="listings-page">
      <p className="listings-market-context">{marketContextLine}</p>
      <div className="listings-grid">
        <section className="listings-panel" aria-labelledby="listings-new-h">
          <h2 id="listings-new-h" className="listings-panel-title">
            {t("listings.newTitle")}
          </h2>
          <div className="listings-table-wrap">
            <table className="listings-table listings-table--recent">
              <thead>
                <tr>
                  <th>{t("listings.pair")}</th>
                  <th>{t("listings.launchDay")}</th>
                  <th>{t("listings.openFor")}</th>
                </tr>
              </thead>
              <tbody>
                {recentSorted.map((row) => (
                  <tr key={row.symbol}>
                    <td className="listings-mono">{row.symbol}</td>
                    <td>{formatLaunchDay(row.listedAt)}</td>
                    <td className="listings-days-num">
                      {openDaysInteger(row.listedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section
          className="listings-panel"
          aria-labelledby="listings-delist-h"
        >
          <h2 id="listings-delist-h" className="listings-panel-title">
            {t("listings.delistTitle")}
          </h2>
          <div className="listings-table-wrap">
            <table className="listings-table">
              <thead>
                <tr>
                  <th>{t("listings.symbol")}</th>
                  <th>{t("listings.delistEst")}</th>
                  <th>{t("listings.visibleUntil")}</th>
                  <th>{t("listings.timeLeft")}</th>
                </tr>
              </thead>
              <tbody>
                {delistedSorted.map((row) => (
                  <tr key={row.symbol}>
                    <td className="listings-mono">{row.symbol}</td>
                    <td>{formatDt(row.delistedAt)}</td>
                    <td>{formatDt(row.visibleUntil)}</td>
                    <td>{daysHoursUntil(row.visibleUntil, t)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
