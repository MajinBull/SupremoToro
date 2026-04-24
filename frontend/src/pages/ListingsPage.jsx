import { useMemo } from "react";
import { useTickers } from "../TickerContext.jsx";

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

function daysHoursUntil(iso) {
  if (!iso) return "—";
  const t = new Date(iso).getTime() - Date.now();
  if (t <= 0) return "—";
  const d = Math.floor(t / (24 * 60 * 60 * 1000));
  const h = Math.floor((t % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (d > 0) return `${d}g ${h}h`;
  const m = Math.floor((t % (60 * 60 * 1000)) / (60 * 1000));
  return `${h}h ${m}m`;
}

export default function ListingsPage() {
  const { recentListings, delisted } = useTickers();

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
      <div className="listings-grid">
        <section className="listings-panel" aria-labelledby="listings-new-h">
          <h2 id="listings-new-h" className="listings-panel-title">
            Nuove listate (ultimi 14 giorni)
          </h2>
          <div className="listings-table-wrap">
            <table className="listings-table listings-table--recent">
              <thead>
                <tr>
                  <th>Coppia</th>
                  <th>Giorno di lancio</th>
                  <th>Aperta da</th>
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
            Delistate (ultimi 14 giorni)
          </h2>
          <div className="listings-table-wrap">
            <table className="listings-table">
              <thead>
                <tr>
                  <th>Simbolo</th>
                  <th>Delisting (stima)</th>
                  <th>Visibile fino a</th>
                  <th>Tempo rimasto</th>
                </tr>
              </thead>
              <tbody>
                {delistedSorted.map((row) => (
                  <tr key={row.symbol}>
                    <td className="listings-mono">{row.symbol}</td>
                    <td>{formatDt(row.delistedAt)}</td>
                    <td>{formatDt(row.visibleUntil)}</td>
                    <td>{daysHoursUntil(row.visibleUntil)}</td>
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
