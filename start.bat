@echo off
setlocal enabledelayedexpansion
title Traffic Violation System - Launcher

echo.
echo  ============================================================
echo   TRAFFIC VIOLATION SYSTEM - Starting...
echo  ============================================================
echo.

REM ---------------------------------------------------------------
REM  1. Check / start PostgreSQL
REM ---------------------------------------------------------------
echo [1/5] Checking PostgreSQL service...
sc query postgresql-x64-18 | find "RUNNING" >nul 2>&1
if %errorlevel% neq 0 (
    echo       PostgreSQL is not running. Attempting to start...
    net start postgresql-x64-18
    if %errorlevel% neq 0 (
        echo [ERROR] Could not start PostgreSQL. Try running as Administrator.
        echo         Or start PostgreSQL manually, then re-run this script.
        pause
        exit /b 1
    )
    echo       Waiting 3 seconds for PostgreSQL to be ready...
    timeout /t 3 /nobreak >nul
) else (
    echo       PostgreSQL is already running.
)

REM ---------------------------------------------------------------
REM  2. Create / migrate DB tables
REM ---------------------------------------------------------------
echo.
echo [2/5] Running database migrations...
cd /d "%~dp0backend"
call venv\Scripts\activate
python -c "from app import app; from models import db; app.app_context().push(); db.create_all(); print('      Tables OK.')"
if %errorlevel% neq 0 (
    echo [ERROR] Database migration failed. Check your .env and PostgreSQL connection.
    pause
    exit /b 1
)

REM ---------------------------------------------------------------
REM  3. Start Flask backend
REM ---------------------------------------------------------------
echo.
echo [3/5] Starting Flask backend...
start "FlaskBackend" /MIN cmd /c "cd /d "%~dp0backend" && call venv\Scripts\activate && python app.py"
echo       Backend started on http://localhost:5000

REM ---------------------------------------------------------------
REM  4. Start React frontend
REM ---------------------------------------------------------------
echo.
echo [4/5] Starting React frontend...
cd /d "%~dp0frontend"
if not exist node_modules (
    echo       node_modules not found. Running npm install - please wait...
    npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed. Make sure Node.js is installed.
        pause
        exit /b 1
    )
)
start "ReactFrontend" /MIN cmd /c "cd /d "%~dp0frontend" && npm run dev"
echo       Frontend started on http://localhost:3000

REM ---------------------------------------------------------------
REM  5. Open browser
REM ---------------------------------------------------------------
echo.
echo [5/5] Waiting 5 seconds then opening browser...
timeout /t 5 /nobreak >nul
start http://localhost:3000

echo.
echo  ============================================================
echo   System is ready!
echo   - Frontend : http://localhost:3000
echo   - Backend  : http://localhost:5000
echo   - Admin    : admin / admin123
echo  ============================================================
echo.
echo  Press any key to STOP all services...
pause >nul

REM ---------------------------------------------------------------
REM  Shutdown
REM ---------------------------------------------------------------
echo.
echo  Stopping services...
taskkill /FI "WINDOWTITLE eq FlaskBackend" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq ReactFrontend" /F >nul 2>&1

REM Fallback: kill by image name (only if the above window-title kill missed)
taskkill /F /FI "IMAGENAME eq python.exe" >nul 2>&1
taskkill /F /FI "IMAGENAME eq node.exe" >nul 2>&1

echo  All services stopped.
echo.
endlocal
