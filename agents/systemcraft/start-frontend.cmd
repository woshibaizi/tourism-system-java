@echo off
setlocal

set "ROOT=%~dp0"
if /i "%ROOT:~0,4%"=="\\?\" set "ROOT=%ROOT:~4%"

cd /d "%ROOT%frontend"

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo [SystemCraft] npm was not found in PATH.
  echo Install Node.js 18+ first, then try again.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [SystemCraft] Installing frontend dependencies...
  npm.cmd install
  if errorlevel 1 goto :error
)

echo [SystemCraft] Starting frontend on http://localhost:3000
npm.cmd run dev
exit /b %errorlevel%

:error
echo [SystemCraft] Frontend startup failed.
pause
exit /b 1
