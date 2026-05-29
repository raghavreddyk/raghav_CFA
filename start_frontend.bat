@echo off
echo =========================================
echo    CFA TUTOR AI FRONTEND INITIALIZER     
echo =========================================

REM Navigate to frontend directory
cd /d "%~dp0\frontend"

REM Check if node_modules exists, if not run npm install
if exist node_modules goto node_modules_exists
echo -- node_modules not found. Installing frontend dependencies...
call npm install
:node_modules_exists

REM Run npm dev server
echo -- Starting Vite dev server...
call npm run dev
