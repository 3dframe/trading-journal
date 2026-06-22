@echo off
REM ============================================================
REM  Trading Journal - arranque dos servidores
REM  Abre o backend (Express/nodemon) e o frontend (Vite)
REM  em duas janelas separadas.
REM ============================================================

cd /d "%~dp0"

echo A arrancar o backend (http://localhost:3001)...
start "Trading Journal - Server" cmd /k "cd /d "%~dp0server" && npm run dev"

echo A arrancar o frontend (http://localhost:5173)...
start "Trading Journal - Client" cmd /k "cd /d "%~dp0client" && npm run dev"

echo.
echo Servidores a arrancar em janelas separadas.
echo   Backend:  http://localhost:3001
echo   Frontend: http://localhost:5173
echo.

REM Espera um pouco e abre o browser na app
timeout /t 5 /nobreak >nul
start "" "http://localhost:5173"
