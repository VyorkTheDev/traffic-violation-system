@echo off
title Traffic Violation System - Build EXE
echo.
echo  ============================================================
echo   Building TrafficSystem.exe with PyInstaller
echo  ============================================================
echo.

REM ---------------------------------------------------------------
REM  Install dependencies
REM ---------------------------------------------------------------
echo [1/3] Installing build dependencies...
pip show pyinstaller >nul 2>&1
if %errorlevel% neq 0 (
    echo       Installing PyInstaller...
    pip install pyinstaller
    if %errorlevel% neq 0 (
        echo [ERROR] Could not install PyInstaller. Check your Python/pip setup.
        pause
        exit /b 1
    )
) else (
    echo       PyInstaller already installed.
)

pip show colorama >nul 2>&1
if %errorlevel% neq 0 (
    echo       Installing colorama...
    pip install colorama
    if %errorlevel% neq 0 (
        echo [ERROR] Could not install colorama.
        pause
        exit /b 1
    )
) else (
    echo       colorama already installed.
)

REM ---------------------------------------------------------------
REM  Build
REM ---------------------------------------------------------------
echo.
echo [2/3] Running PyInstaller...
cd /d "%~dp0"

if exist icon.ico (
    pyinstaller --onefile --name "TrafficSystem" --icon=icon.ico --console launcher.py
) else (
    echo       (No icon.ico found - building without custom icon)
    pyinstaller --onefile --name "TrafficSystem" --console launcher.py
)

if %errorlevel% neq 0 (
    echo [ERROR] PyInstaller build failed. See output above.
    pause
    exit /b 1
)

REM ---------------------------------------------------------------
REM  Copy .exe to project root
REM ---------------------------------------------------------------
echo.
echo [3/3] Copying EXE to project root...
if exist "dist\TrafficSystem.exe" (
    copy /Y "dist\TrafficSystem.exe" "TrafficSystem.exe" >nul
    echo.
    echo  ============================================================
    echo   EXE created: TrafficSystem.exe
    echo   Run it directly or distribute it to other Windows machines
    echo   that have Python, Node.js, and PostgreSQL installed.
    echo  ============================================================
) else (
    echo [ERROR] dist\TrafficSystem.exe not found after build.
    pause
    exit /b 1
)

echo.
pause
