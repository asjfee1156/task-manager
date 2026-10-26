@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"
title Reset Task Manager Demo

echo ============================================================
echo   Reset Task Manager - restore the default seed data
echo ============================================================
echo.

REM 1) Stop the running server so the database file is unlocked
echo [INFO] Stopping server if it is running ...
call "%~dp0stop.bat" >nul 2>&1

REM 2) Choose Node (bundled runtime first, machine Node as fallback)
set "NODE_EXE="
if exist "%~dp0runtime\node\node.exe" set "NODE_EXE=%~dp0runtime\node\node.exe"
if not defined NODE_EXE (
    where node >nul 2>&1 && set "NODE_EXE=node"
)
if not defined NODE_EXE (
    echo [ERROR] No usable Node.js found.
    echo.
    pause
    exit /b 1
)

REM 3) Delete the old database so it gets rebuilt with seed data
echo [INFO] Clearing data\tasks.db ...
if exist "data\tasks.db" del /q "data\tasks.db"
if exist "data\tasks.db-wal" del /q "data\tasks.db-wal"
if exist "data\tasks.db-shm" del /q "data\tasks.db-shm"

REM 4) Re-seed the default data (2 users, 10 tasks)
echo [INFO] Re-seeding default data ...
"%NODE_EXE%" "%~dp0backend\db.js"

echo.
echo ============================================================
echo   Reset complete. Database = default 2 users / 10 tasks.
echo   Double-click start.bat to launch the app again.
echo ============================================================
timeout /t 4 >nul
