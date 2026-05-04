@echo off
setlocal

set "ROOT=%~dp0"
if /i "%ROOT:~0,4%"=="\\?\" set "ROOT=%ROOT:~4%"

cd /d "%ROOT%backend"

where python >nul 2>nul
if errorlevel 1 (
  echo [SystemCraft] Python was not found in PATH.
  echo Install Python 3.10+ first, then try again.
  pause
  exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
  echo [SystemCraft] Creating backend virtual environment...
  python -m venv .venv
  if errorlevel 1 goto :error
)

call ".venv\Scripts\activate.bat"
if errorlevel 1 goto :error

set PYTHONIOENCODING=utf-8

python -c "import fastapi, uvicorn, langgraph, langchain_openai" >nul 2>nul
if errorlevel 1 (
  echo [SystemCraft] Installing backend dependencies...
  python -m pip install -r requirements.txt
  if errorlevel 1 goto :error
)

echo [SystemCraft] Starting backend on http://localhost:8000
python main.py
exit /b %errorlevel%

:error
echo [SystemCraft] Backend startup failed.
pause
exit /b 1
