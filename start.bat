@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Task Manager Demo - Node + Express + SQLite

echo.
echo ============================================================
echo   Task Manager Demo  v1.0
echo   Bundled Node.js v24 LTS + Express + SQLite + Vanilla JS
echo   http://localhost:8591 - fully offline, zero dependencies
echo ============================================================
echo.

REM ============================================================
REM 1) Node interpreter: bundled runtime first (portable),
REM    then the machine's Node as fallback. The bundled
REM    runtime keeps this folder 100% self-contained.
REM ============================================================
set "NODE_EXE="
if exist "%~dp0runtime\node\node.exe" set "NODE_EXE=%~dp0runtime\node\node.exe"
if not defined NODE_EXE (
    where node >nul 2>&1 && set "NODE_EXE=node"
)
if not defined NODE_EXE (
    echo [ERROR] No usable Node.js found.
    echo.
    echo   The bundled runtime folder is missing - copy the whole folder
    echo   from the original zip, or install Node.js 18+ on this machine.
    echo.
    pause
    exit /b 1
)
echo [INFO] Node: %NODE_EXE%
if exist "%~dp0runtime\node\node.exe" echo [INFO] Mode: bundled portable runtime - no machine Node needed

REM Put the bundled Node first on PATH so npm.cmd resolves there too
if exist "%~dp0runtime\node\node.exe" set "PATH=%~dp0runtime\node;%PATH%"

REM ============================================================
REM 2) Check port 8591 availability
REM ============================================================
set "PORT_BUSY=0"
for /f "tokens=5" %%P in ('netstat -aon -p tcp ^| findstr ":8591" ^| findstr LISTENING') do (
    echo [WARN] Port 8591 is already in use by PID=%%P
    echo       Run stop.bat to free it, or change PORT in backend\config.js
    set "PORT_BUSY=1"
)
if "!PORT_BUSY!"=="1" (
    echo.
    pause
    exit /b 1
)

REM ============================================================
REM 3) First run: install backend dependencies if missing
REM ============================================================
if not exist "%~dp0backend\node_modules" (
    echo [INFO] First run - installing backend packages, please wait...
    pushd "%~dp0backend"
    call npm install --no-audit --no-fund --loglevel=error
    if errorlevel 1 (
        echo.
        echo [ERROR] npm install failed. Check your network, or copy
        echo         backend\node_modules from the original machine.
        popd
        pause
        exit /b 1
    )
    popd
    echo [INFO] Packages installed.
)

REM ============================================================
REM 4) Delayed browser opening (waits for the server to be ready)
REM ============================================================
echo [INFO] Starting server on http://localhost:8591 ...
echo [INFO] Test accounts: demo / demo1234 , alice / alice1234
start "OpenBrowser" cmd /c "timeout /t 5 /nobreak >nul & start "" http://localhost:8591"

REM ============================================================
REM 5) Run the server in the foreground.
REM    Close this window (or double-click stop.bat) to stop it.
REM ============================================================
echo [INFO] Press Ctrl + C or double-click stop.bat to stop the service.
echo.
pushd "%~dp0backend"
"%NODE_EXE%" server.js
popd

echo.
echo [INFO] Server stopped.
pause
