@echo off
setlocal
title Bullweb DEBUG
cd /d "%~dp0"

echo === Bullweb debug ===
echo Cartella script: %~dp0
echo Cartella attuale: %CD%
echo.
echo ComSpec: %ComSpec%
echo.

where node 2>nul
if errorlevel 1 ( echo NODE: NON trovato ) else ( echo NODE: OK )
where npm 2>nul
if errorlevel 1 ( echo NPM: NON trovato ) else ( echo NPM: OK )
echo.

if exist "backend\package.json" ( echo backend\package.json: OK ) else ( echo backend\package.json: MANCA )
if exist "frontend\package.json" ( echo frontend\package.json: OK ) else ( echo frontend\package.json: MANCA )
if exist "backend\node_modules\" ( echo backend\node_modules: OK ) else ( echo backend\node_modules: MANCA )
if exist "frontend\node_modules\" ( echo frontend\node_modules: OK ) else ( echo frontend\node_modules: MANCA )
echo.

echo Prova avvio finestra backend (si deve aprire un CMD con npm^)...
pause
start "TEST-backend" /D "%~dp0backend" "%ComSpec%" /k echo TEST BACKEND OK ^& cd ^& npm run dev

echo.
echo Se non e' apparsa una finestra, il problema e' con il comando START o con i permessi.
echo.
pause
endlocal
