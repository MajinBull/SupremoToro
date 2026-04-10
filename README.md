# Bullweb — Dashboard perpetual Bybit

Web app minimale per monitorare i **contratti perpetual linear** disponibili su Bybit: tabella con prezzo, volume 24h, funding, open interest (valore in USD), grafico candlestick con timeframe selezionabili e aggiornamento periodico.

## Struttura

```
Bullweb/
├── README.md
├── backend/          # Node.js + Express (proxy verso API pubbliche Bybit v5)
└── frontend/         # React + Vite + Lightweight Charts
```

## Requisiti

- **Node.js 18+** (fetch nativo)

## Installazione

### Backend

```bash
cd backend
npm install
```

### Frontend

```bash
cd frontend
npm install
```

## Avvio in locale

Apri **due terminali**.

**Terminale 1 — backend** (porta predefinita `3001`):

```bash
cd backend
npm run dev
```

**Terminale 2 — frontend** (porta `5173`, proxy `/api` → `3001`):

```bash
cd frontend
npm run dev
```

Apri il browser su **http://localhost:5173**.

In produzione puoi fare `npm run build` nel frontend e servire `frontend/dist` con un reverse proxy, oppure lasciare Vite preview solo per test.

## API backend (riepilogo)

| Metodo | Percorso | Descrizione |
|--------|-----------|-------------|
| `GET` | `/api/health` | Stato servizio e cache simboli |
| `GET` | `/api/perpetuals` | Lista simboli perpetual linear in trading (cache aggiornata ogni ~3 min) |
| `POST` | `/api/perpetuals/refresh` | Forza aggiornamento lista simboli |
| `GET` | `/api/tickers` | Snapshot ticker linear (prezzo, volume, funding, OI) |
| `GET` | `/api/klines?symbol=BTCUSDT&interval=15` | Candele per il grafico (`interval`: `1`,`5`,`15`,`60`,`240`,`D`) |

Le chiamate Bybit sono **solo pubbliche**; non servono chiavi API.

## Note

- Il frontend interroga il polling ogni **~15 s** (ticker) e **~60 s** (metadati simboli); il backend aggiorna la lista strumenti ogni **3 minuti** (configurabile in `backend/src/config.js`).
- Se Bybit risponde in errore, la UI mostra un avviso ma resta utilizzabile con i dati precedenti ove possibile.

## Possibili miglioramenti futuri

- WebSocket Bybit per ticker e candele in tempo quasi reale al posto del polling.
- Paginazione o virtualizzazione tabella con migliaia di righe.
- Indicatori tecnici, alert, watchlist persistita (locale o DB).
- Rate limiting e cache lato server più fine (ETag / TTL per kline).
- Test automatizzati e Docker Compose per avvio unificato.
