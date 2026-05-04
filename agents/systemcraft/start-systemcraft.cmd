@echo off
setlocal

set "ROOT=%~dp0"
if /i "%ROOT:~0,4%"=="\\?\" set "ROOT=%ROOT:~4%"

start "SystemCraft Backend" cmd /k ""%ROOT%start-backend.cmd""
start "SystemCraft Frontend" cmd /k ""%ROOT%start-frontend.cmd""

echo [SystemCraft] Backend and frontend launch commands have been started.
exit /b 0
