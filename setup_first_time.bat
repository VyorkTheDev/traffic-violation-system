@echo off
title Traffic Violation System - First Time Setup
echo.
echo  ============================================================
echo   TRAFFIC VIOLATION SYSTEM - First Time Setup
echo  ============================================================
echo.
echo  This script will:
echo    1. Create Python virtual environment in backend/
echo    2. Install Python dependencies
echo    3. Install Node.js dependencies
echo    4. Seed the database with test data
echo.
echo  Make sure PostgreSQL is running before continuing.
echo.
pause

REM ---------------------------------------------------------------
REM  1. Python venv
REM ---------------------------------------------------------------
echo.
echo [1/4] Creating Python virtual environment...
cd /d "%~dp0backend"

if exist venv (
    echo       Virtual environment already exists, skipping creation.
) else (
    python -m venv venv
    if %errorlevel% neq 0 (
        echo [ERROR] Could not create virtual environment.
        echo         Make sure Python 3.10+ is installed and on your PATH.
        pause
        exit /b 1
    )
    echo       Virtual environment created.
)

REM ---------------------------------------------------------------
REM  2. Python dependencies
REM ---------------------------------------------------------------
echo.
echo [2/4] Installing Python dependencies...
call venv\Scripts\activate
pip install --upgrade pip --quiet
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] pip install failed. Check requirements.txt and your internet connection.
    pause
    exit /b 1
)
echo       Python dependencies installed.

REM ---------------------------------------------------------------
REM  3. Node.js dependencies
REM ---------------------------------------------------------------
echo.
echo [3/4] Installing Node.js dependencies...
cd /d "%~dp0frontend"
if exist node_modules (
    echo       node_modules already exists, skipping npm install.
) else (
    npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed.
        echo         Make sure Node.js 18+ is installed and on your PATH.
        pause
        exit /b 1
    )
    echo       Node.js dependencies installed.
)

REM ---------------------------------------------------------------
REM  4. Seed database
REM ---------------------------------------------------------------
echo.
echo [4/4] Seeding the database with test data...
cd /d "%~dp0backend"
call venv\Scripts\activate
python seed.py
if %errorlevel% neq 0 (
    echo [ERROR] Database seeding failed.
    echo         Make sure PostgreSQL is running and backend\.env is configured.
    echo         Check DATABASE_URL in backend\.env
    pause
    exit /b 1
)

REM ---------------------------------------------------------------
REM  Done
REM ---------------------------------------------------------------
echo.
echo  ============================================================
echo   First-time setup complete!
echo.
echo   Default credentials:
echo     Admin   : admin / admin123
echo     Police  : emre.arslan / sifre123
echo     Police  : fatma.yildiz / sifre123
echo     Citizen : ahmet.yilmaz / sifre123 (and others)
echo.
echo   Now run:  start.bat  or  TrafficSystem.exe
echo  ============================================================
echo.
pause
