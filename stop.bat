@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion
title Stop Task Manager Demo

echo Stopping server on port 8591 ...
set "FOUND=0"
for /f "tokens=5" %%a in ('netstat -aon -p tcp ^| findstr ":8591" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
    if not errorlevel 1 (
        echo [INFO] Terminated server process PID %%a
        set "FOUND=1"
    )
)
if "!FOUND!"=="0" echo [INFO] No server is listening on port 8591.
timeout /t 2 >nul
