@echo off
title Traffic Violation System - Stopping

echo.
echo  ============================================================
echo   TRAFFIC VIOLATION SYSTEM - Stopping services...
echo  ============================================================
echo.

REM Try window-title kill first (cleanest approach)
echo  Stopping Flask backend...
taskkill /FI "WINDOWTITLE eq FlaskBackend" /F >nul 2>&1

echo  Stopping React frontend...
taskkill /FI "WINDOWTITLE eq ReactFrontend" /F >nul 2>&1

REM Fallback: kill by process name
echo  Cleaning up remaining Python processes...
taskkill /F /IM python.exe >nul 2>&1

echo  Cleaning up remaining Node processes...
taskkill /F /IM node.exe >nul 2>&1

echo.
echo  All services stopped.
echo.
