$ROOT = Split-Path -Parent $PSScriptRoot
# 仅在关键错误时停止，避免原生命令组合的异常传播问题
$ErrorActionPreference = "Continue"

Write-Host "=== Tourism System - Start All Services ===" -ForegroundColor Cyan
Write-Host ""

# Helper: check if a port is already in use
function Test-PortInUse($port) {
    $line = netstat -ano 2>$null | Select-String ":$port " | Select-String "LISTENING" | Select-Object -First 1
    if ($line) {
        $procId = ($line -split '\s+')[-1]
        if ($procId -ne '0') { return $procId }
    }
    return $null
}

# Helper: kill process on a port
function Clear-Port($port, $name) {
    $existing = Test-PortInUse $port
    if ($existing) {
        Write-Host "  Port $port is in use by PID $existing ($name). Stopping..." -ForegroundColor Yellow
        taskkill /F /PID $existing 2>$null | Out-Null
        Start-Sleep -Seconds 1
    }
}

# Stop any existing services first
Write-Host "[0/3] Cleaning up existing services..." -ForegroundColor Yellow
Clear-Port 8080 "backend"
Clear-Port 5173 "frontend"
Clear-Port 9000 "agent"
Write-Host ""

# Ensure log directory exists
$logDir = Join-Path $ROOT "run"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }

Write-Host "[1/3] Starting backend (port 8080)..." -ForegroundColor Green
$backendLog = Join-Path $logDir "backend.log"
Start-Process -FilePath "powershell" -ArgumentList "-NoProfile -Command `"Set-Location '$ROOT'; mvn spring-boot:run -q *>> '$backendLog'`"" -WindowStyle Hidden
Start-Sleep -Seconds 2

Write-Host "[2/3] Starting frontend (port 5173)..." -ForegroundColor Green
$frontendLog = Join-Path $logDir "frontend.log"
Start-Process -FilePath "powershell" -ArgumentList "-NoProfile -Command `"Set-Location '$ROOT\frontend'; npm run dev *>> '$frontendLog'`"" -WindowStyle Hidden

Write-Host "[3/3] Starting agent (port 9000)..." -ForegroundColor Green
$agentLog = Join-Path $logDir "agent.log"

# 检测 Python
$pythonCmd = $null
foreach ($c in @("python","python3","py")) {
    $null = & $c --version 2>&1
    if ($LASTEXITCODE -eq 0) { $pythonCmd = $c; break }
}

if ($pythonCmd) {
    $venvActivate = Join-Path $ROOT "agent-service\.venv\Scripts\activate.ps1"
    $venvCmd = ""
    if ((Test-Path $venvActivate)) {
        $venvCmd = "& '$venvActivate'; "
    }

    $agentCmd = "Set-Location '$ROOT\agent-service'; ${venvCmd}$pythonCmd -m uvicorn app.main:app --host 0.0.0.0 --port 9000 2>&1 | Out-File -FilePath '$agentLog' -Encoding utf8"
    Write-Host "  Agent command: ${venvCmd}$pythonCmd -m uvicorn app.main:app --host 0.0.0.0 --port 9000" -ForegroundColor Gray
    Start-Process -FilePath "powershell" -ArgumentList "-NoProfile -Command `"$agentCmd`"" -WindowStyle Hidden
    Start-Sleep -Seconds 3

    $agentPid = Test-PortInUse 9000
    if ($agentPid) {
        Write-Host "  Agent started (PID: $agentPid)" -ForegroundColor Green
    } else {
        Write-Host "  Agent may have failed, check: $agentLog" -ForegroundColor Yellow
    }
} else {
    Write-Host "  WARNING: Python not found, agent skipped" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== All services started ===" -ForegroundColor Yellow
Write-Host "Backend:  http://localhost:8080"
Write-Host "Frontend: http://localhost:5173"
Write-Host "Agent:    http://localhost:9000"
Write-Host "Swagger:  http://localhost:8080/swagger-ui.html"
Write-Host ""
Write-Host "Logs: $logDir\backend.log | frontend.log | agent.log" -ForegroundColor Gray
Write-Host "Stop:  .\run\stop-all.ps1" -ForegroundColor Gray
  