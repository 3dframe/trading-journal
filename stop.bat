@echo off
REM ============================================================
REM  Trading Journal - paragem dos servidores
REM  Mata os processos node a ocupar as portas 3001 e 5173.
REM ============================================================

echo A terminar servidores...

for %%P in (3001 5173) do (
    for /f "tokens=5" %%A in ('netstat -ano ^| findstr ":%%P" ^| findstr "LISTENING"') do (
        echo   Porta %%P -> a terminar PID %%A
        taskkill /F /PID %%A >nul 2>&1
    )
)

echo.
echo Concluido.
timeout /t 2 /nobreak >nul
