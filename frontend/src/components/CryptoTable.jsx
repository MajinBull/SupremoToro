import {
  fmtFunding,
  fmtOpenInterest,
  fmtPrice,
  fmtPriceChange24h,
  fmtVolume,
} from "../formatters.js";
import FavoriteStar from "./FavoriteStar.jsx";

const COLUMNS = [
  { key: "symbol", label: "Simbolo", sortable: true },
  { key: "lastPrice", label: "Prezzo", sortable: true },
  {
    key: "price24hPcnt",
    label: "% 24h",
    sortable: true,
    title: "Variazione % prezzo (rolling 24h, come Bybit)",
  },
  { key: "volume24h", label: "Vol 24h", sortable: true },
  { key: "fundingRate", label: "Funding", sortable: true },
  { key: "openInterestValue", label: "OI ($)", sortable: true },
];

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
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            {COLUMNS.map((c) => (
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
                title="Variazione % ultime 24 ore"
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
