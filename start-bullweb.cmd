@echo off
setlocal
title Bullweb launcher
cd /d "%~dp0"

echo.
echo  Bullweb - avvio guidato
echo  Cartella: %CD%
echo.
echo  Dipendenze: serve la cartella node_modules in backend e frontend.
echo  Se manca, viene eseguito npm install automaticamente.
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo  ERRORE: Node.js non trovato nel PATH.
  echo  Scarica la versione LTS da https://nodejs.org
  echo  Poi chiudi questa finestra, riapri Explorer e rilancia start-bullweb.cmd
  goto :fine
)

where npm >nul 2>nul
if errorlevel 1 (
  echo  ERRORE: npm non trovato - di solito arriva con Node.js.
  goto :fine
)

if not exist "backend\package.json" (
  echo  ERRORE: Questo file va nella cartella Bullweb - stesso livello di backend e frontend.
  echo  Percorso atteso ...\Bullweb\start-bullweb.cmd
  goto :fine
)
if not exist "frontend\package.json" (
  echo  ERRORE: Manca frontend\package.json
  goto :fine
)

if not exist "backend\node_modules\" (
  echo  Installazione BACKEND - npm install...
  pushd "%~dp0backend"
  call npm install
  if errorlevel 1 (
    echo  ERRORE durante npm install nel backend.
    popd
    goto :fine
  )
  popd
  echo  OK backend.
  echo.
)

if not exist "frontend\node_modules\" (
  echo  Installazione FRONTEND - npm install...
  pushd "%~dp0frontend"
  call npm install
  if errorlevel 1 (
    echo  ERRORE durante npm install nel frontend.
    popd
    goto :fine
  )
  popd
  echo  OK frontend.
  echo.
)

echo  Apertura di due finestre CMD - backend su porta 3001, frontend Vite...
echo.

rem %ComSpec% = cmd.exe di sistema (percorso affidabile)
start "Bullweb-backend" /D "%~dp0backend" "%ComSpec%" /k npm run dev
start "Bullweb-frontend" /D "%~dp0frontend" "%ComSpec%" /k npm run dev

echo  Se NON si aprono altre finestre, prova start-bullweb-debug.cmd nella stessa cartella.
echo.
echo  NEL BROWSER: usa l'indirizzo "Local" scritto nella finestra del frontend.
echo  Di solito e' http://localhost:5173  -  se quella porta e' gia' in uso sara' 5174, 5175, ecc.
echo.
echo  Puoi chiudere QUESTA finestra dopo che backend e frontend sono partiti ^(restano le altre due^).
echo.

:fine
pause
endlocal
