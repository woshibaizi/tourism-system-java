#  YOUJI - Start all services
$ErrorActionPreference = "Continue"

$baseDir = "C:\Users\19374\Desktop\code\tourism"
$myIni = "$baseDir\config\my.ini"
$wrapperJar = "$baseDir\.mvn\wrapper\maven-wrapper.jar"
$mysqlBin = "C:\Program Files\MySQL\MySQL Server 9.6\bin"
$redisDir = "C:\Users\19374\redis"

Write-Host ""
Write-Host "  ==========================================" -ForegroundColor DarkYellow
Write-Host "         YOUJI                          " -ForegroundColor DarkYellow
Write-Host "         Start All Services              " -ForegroundColor DarkYellow
Write-Host "  ==========================================" -ForegroundColor DarkYellow
Write-Host ""

# -------- MySQL --------
Write-Host "[1/5] Starting MySQL..." -ForegroundColor Cyan
$mysqlRunning = netstat -ano | Select-String ":3306.*LISTENING"
if (-not $mysqlRunning) {
    Start-Process -FilePath "$mysqlBin\mysqld.exe" -ArgumentList "--defaults-file=`"$myIni`"" -WindowStyle Minimized
    do {
        Start-Sleep -Seconds 2
        $mysqlRunning = netstat -ano | Select-String ":3306.*LISTENING"
        Write-Host "  Waiting for MySQL..." -ForegroundColor DarkGray
    } until ($mysqlRunning)
}
Write-Host "  MySQL ready." -ForegroundColor Green

# -------- Redis --------
Write-Host "[2/5] Starting Redis..." -ForegroundColor Cyan
$redisRunning = & "$redisDir\redis-cli.exe" ping 2>$null
if ($redisRunning -ne "PONG") {
    Start-Process -FilePath "$redisDir\redis-server.exe" -ArgumentList "$redisDir\redis.windows.conf" -WindowStyle Minimized
    Start-Sleep -Seconds 2
}
Write-Host "  Redis ready." -ForegroundColor Green

# -------- Backend --------
Write-Host "[3/5] Starting backend (port 8080)..." -ForegroundColor Cyan

$backendLog = "$env:TEMP\tourism-backend.log"
$backendErrLog = "$env:TEMP\tourism-backend-err.log"

$javaArgs = @(
    "-classpath", $wrapperJar,
    "-Dmaven.multiModuleProjectDirectory=$baseDir",
    "org.apache.maven.wrapper.MavenWrapperMain",
    "spring-boot:run", "-q"
)

$backendProc = Start-Process -FilePath "java.exe" `
    -ArgumentList $javaArgs `
    -WorkingDirectory $baseDir `
    -PassThru `
    -NoNewWindow `
    -RedirectStandardOutput $backendLog `
    -RedirectStandardError $backendErrLog

# Verify the process actually started
Start-Sleep -Seconds 3
if ($backendProc.HasExited) {
    Write-Host "  BACKEND FAILED TO START (exit code: $($backendProc.ExitCode))" -ForegroundColor Red
    Write-Host "  --- STDERR (last 20 lines) ---" -ForegroundColor Red
    if (Test-Path $backendErrLog) {
        Get-Content $backendErrLog -Tail 20 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkRed }
    }
    Write-Host "  Check full logs: $backendErrLog" -ForegroundColor DarkYellow
    exit 1
}

# Wait up to 10 minutes for backend to be ready
# (handles first-run Maven distribution download ~9MB)
$maxRetries = 120
$retry = 0
do {
    Start-Sleep -Seconds 5
    $retry++
    try { $null = Invoke-WebRequest -Uri "http://localhost:8080/api/places/hot?limit=1" -TimeoutSec 3 -UseBasicParsing; $backendReady = $true } catch { $backendReady = $false }

    # Check if the process died mid-way
    if (-not $backendReady -and $backendProc.HasExited) {
        Write-Host "  BACKEND PROCESS DIED (exit code: $($backendProc.ExitCode))" -ForegroundColor Red
        Write-Host "  --- STDERR (last 20 lines) ---" -ForegroundColor Red
        if (Test-Path $backendErrLog) {
            Get-Content $backendErrLog -Tail 20 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkRed }
        }
        Write-Host "  Check full logs: $backendErrLog" -ForegroundColor DarkYellow
        exit 1
    }

    if (-not $backendReady) {
        if ($retry -eq 1) {
            Write-Host "  Waiting for backend (first startup may download Maven, ~1-2 min)..." -ForegroundColor DarkGray
        } elseif ($retry % 12 -eq 0) {
            Write-Host "  Still waiting... ($([math]::Round($retry * 5 / 60, 1)) min elapsed)" -ForegroundColor DarkGray
        }
    }
} until ($backendReady -or $retry -ge $maxRetries)

if (-not $backendReady) {
    Write-Host "  BACKEND FAILED TO START within 10 minutes" -ForegroundColor Red
    Write-Host "  --- STDERR (last 20 lines) ---" -ForegroundColor Red
    if (Test-Path $backendErrLog) {
        Get-Content $backendErrLog -Tail 20 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkRed }
    }
    Write-Host "  --- STDOUT (last 20 lines) ---" -ForegroundColor Red
    if (Test-Path $backendLog) {
        Get-Content $backendLog -Tail 20 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkRed }
    }
    Write-Host "  Check full logs: $backendLog and $backendErrLog" -ForegroundColor DarkYellow
    exit 1
}

Write-Host "  Backend ready: http://localhost:8080" -ForegroundColor Green

# -------- Frontend --------
Write-Host "[4/5] Starting frontend (port 5173)..." -ForegroundColor Cyan
Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd /d `"$baseDir\frontend`" && npm run dev && pause" -WindowStyle Minimized

do {
    Start-Sleep -Seconds 3
    try { $null = Invoke-WebRequest -Uri "http://localhost:5173" -TimeoutSec 2 -UseBasicParsing; $frontendReady = $true } catch { $frontendReady = $false }
    Write-Host "  Waiting for frontend..." -ForegroundColor DarkGray
} until ($frontendReady)
Write-Host "  Frontend ready: http://localhost:5173" -ForegroundColor Green

# -------- Agent --------
Write-Host "[5/5] Starting Agent (port 9000)..." -ForegroundColor Cyan
if (Test-Path "$baseDir\agent-service\.venv\Scripts\uvicorn.exe") {
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd /d `"$baseDir\agent-service`" && .venv\Scripts\uvicorn app.main:app --host 0.0.0.0 --port 9000 && pause" -WindowStyle Minimized
} else {
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd /d `"$baseDir\agent-service`" && uvicorn app.main:app --host 0.0.0.0 --port 9000 && pause" -WindowStyle Minimized
}

do {
    Start-Sleep -Seconds 2
    try { $null = Invoke-WebRequest -Uri "http://localhost:9000/health" -TimeoutSec 2 -UseBasicParsing; $agentReady = $true } catch { $agentReady = $false }
    Write-Host "  Waiting for agent..." -ForegroundColor DarkGray
} until ($agentReady)
Write-Host "  Agent ready: http://localhost:9000" -ForegroundColor Green

# -------- Done --------
Write-Host ""
Write-Host "  ==========================================" -ForegroundColor DarkYellow
Write-Host "  All services running!                     " -ForegroundColor DarkYellow
Write-Host "  Backend:  http://localhost:8080           " -ForegroundColor DarkYellow
Write-Host "  Frontend: http://localhost:5173           " -ForegroundColor DarkYellow
Write-Host "  Agent:    http://localhost:9000           " -ForegroundColor DarkYellow
Write-Host "  ==========================================" -ForegroundColor DarkYellow
Write-Host ""

Start-Process "http://localhost:5173"
Write-Host "Press any key to close this window..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
