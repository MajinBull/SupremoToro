import { useMemo } from "react";
import {
  fmtFunding,
  fmtOpenInterest,
  fmtPrice,
  fmtPriceChange24h,
  fmtVolume,
} from "../formatters.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import FavoriteStar from "./FavoriteStar.jsx";

/**
 * Tabella perpetual con ordinamento su colonna e selezione riga.
 */
export default function CryptoTable({
  rows,
  sortKey,
  sortDir,
  onSort,
  selectedSymbol,
  onSelectSymbol,
}) {
  const { t } = useI18n();

  const columns = useMemo(
    () => [
      { key: "symbol", label: t("cryptoTable.symbol"), sortable: true },
      { key: "lastPrice", label: t("cryptoTable.price"), sortable: true },
      {
        key: "price24hPcnt",
        label: t("cryptoTable.pct24h"),
        sortable: true,
        title: t("cryptoTable.pct24hTitle"),
      },
      { key: "volume24h", label: t("cryptoTable.vol24h"), sortable: true },
      { key: "fundingRate", label: t("cryptoTable.funding"), sortable: true },
      { key: "openInterestValue", label: t("cryptoTable.oi"), sortable: true },
    ],
    [t],
  );

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                title={c.title}
                onClick={() => c.sortable && onSort(c.key)}
              >
                {c.label}
                {sortKey === c.key ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.symbol}
              className={row.symbol === selectedSymbol ? "selected" : ""}
              onClick={() => onSelectSymbol(row.symbol)}
            >
              <td>
                <span className="symbol-cell">
                  <span className="symbol-cell-name">{row.symbol}</span>
                  <FavoriteStar symbol={row.symbol} stopRowClick />
                </span>
              </td>
              <td>
                {row.missing ? (
                  <span className="cell-muted">—</span>
                ) : (
                  fmtPrice(row.lastPrice)
                )}
              </td>
              <td
                style={{
                  color:
                    row.price24hPcnt > 0
                      ? "var(--positive)"
                      : row.price24hPcnt < 0
                        ? "var(--negative)"
                        : undefined,
                }}
                title={t("cryptoTable.pct24hRowTitle")}
              >
                {row.missing ? (
                  <span className="cell-muted">—</span>
                ) : (
                  fmtPriceChange24h(row.price24hPcnt)
                )}
              </td>
              <td>{fmtVolume(row.volume24h)}</td>
              <td
                style={{
                  color:
                    row.fundingRate > 0
                      ? "var(--positive)"
                      : row.fundingRate < 0
                        ? "var(--negative)"
                        : undefined,
                }}
              >
                {fmtFunding(row.fundingRate)}
              </td>
              <td>{fmtOpenInterest(row.openInterestValue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
