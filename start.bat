@echo off
REM ============================================================
REM  Trading Journal - arranque dos servidores
REM  Arranca o backend (Express/nodemon) e o frontend (Vite)
REM  em segundo plano, sem janelas de terminal visiveis.
REM  Usar stop.bat para os terminar.
REM ============================================================

cd /d "%~dp0"

echo A arrancar backend + frontend em segundo plano...
powershell -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0start-hidden.ps1"

echo.
echo Servidores a arrancar em segundo plano (sem janelas).
echo   Backend:  http://localhost:3001  (log em server\log.txt)
echo   Frontend: http://localhost:5173  (log em client\log.txt)
echo.
echo Para terminar, usa o stop.bat.
echo.

REM Espera um pouco e abre o browser na app
timeout /t 6 /nobreak >nul
start "" "http://localhost:5173"
