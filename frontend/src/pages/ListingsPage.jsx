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

/** Solo data di lancio (giorno). */
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

/** Giorni interi dall’apertura Bybit (0 se non è passato un giorno pieno). */
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
  const { recentListings, delisted, lastSymbolsAt, symbolsError } =
    useTickers();

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
      <p className="listings-intro">
        Coppie perpetual <strong>USDT</strong>: <strong>nuove listate</strong>{" "}
        (meno di 14 giorni da <code>launchTime</code> Bybit — coincide con
        l’inizio dello storico candele) e <strong>delistate</strong> (visibili 14
        giorni dall’uscita da Trading).
      </p>
      {lastSymbolsAt && (
        <p className="listings-meta">
          Dati strumenti aggiornati:{" "}
          {formatDt(lastSymbolsAt)}
        </p>
      )}
      {symbolsError && (
        <div className="listings-banner" role="alert">
          {symbolsError}
        </div>
      )}

      <div className="listings-grid">
        <section className="listings-panel" aria-labelledby="listings-new-h">
          <h2 id="listings-new-h" className="listings-panel-title">
            Nuove listate (ultimi 14 giorni)
          </h2>
          <p className="listings-panel-hint">
            Elenco completo dei perpetual USDT ancora in Trading la cui data di
            lancio Bybit è entro gli ultimi 14 giorni (stessa finestra del
            grafico “giovane”). Ordine: dal più recente. «Aperta da» = giorni
            interi (0 se sono passate meno di 24 ore).
          </p>
          {recentSorted.length === 0 ? (
            <p className="listings-empty">
              Nessun perpetual USDT con meno di 14 giorni di mercato secondo
              Bybit.
            </p>
          ) : (
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
                      <td className="listings-days-num">{openDaysInteger(row.listedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section
          className="listings-panel"
          aria-labelledby="listings-delist-h"
        >
          <h2 id="listings-delist-h" className="listings-panel-title">
            Delistate (ultimi 14 giorni)
          </h2>
          <p className="listings-panel-hint">
            Rilevate quando il simbolo non è più in Trading rispetto al refresh
            precedente. Persistenza su disco dove il filesystem è scrivibile
            (es. backend locale/Render); su ambienti read-only la lista può
            resettarsi al riavvio.
          </p>
          {delistedSorted.length === 0 ? (
            <p className="listings-empty">
              Nessuna delist recente registrata. Dopo un delisting reale,
              comparirà qui automaticamente.
            </p>
          ) : (
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
          )}
        </section>
      </div>
    </div>
  );
}
