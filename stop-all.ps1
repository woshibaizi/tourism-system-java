#  YOUJI - Stop all services
$ErrorActionPreference = "Continue"

$baseDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $baseDir) { $baseDir = Get-Location }

Write-Host ""
Write-Host "  ==========================================" -ForegroundColor DarkYellow
Write-Host "  Stopping all services...                  " -ForegroundColor DarkYellow
Write-Host "  ==========================================" -ForegroundColor DarkYellow
Write-Host ""

$services = @(
    @{Port=9000; Name="Agent"},
    @{Port=5173; Name="Frontend"},
    @{Port=8080; Name="Backend"}
)

foreach ($svc in $services) {
    Write-Host "[ ] Stopping $($svc.Name) ($($svc.Port))..." -ForegroundColor Cyan
    netstat -ano | Select-String ":$($svc.Port).*LISTENING" | ForEach-Object {
        $pid = ($_ -split '\s+')[-1]
        if ($pid) {
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            Write-Host "    Stopped PID $pid" -ForegroundColor Gray
        }
    }
}

# Redis
Write-Host "[ ] Stopping Redis..." -ForegroundColor Cyan
$redisCli = "$baseDir\..\redis\redis-cli.exe"
if (Test-Path $redisCli) {
    & $redisCli shutdown 2>$null
} elseif (Test-Path "$env:USERPROFILE\redis\redis-cli.exe") {
    & "$env:USERPROFILE\redis\redis-cli.exe" shutdown 2>$null
}
Write-Host "    Redis stopped" -ForegroundColor Gray

# MySQL
Write-Host "[ ] Stopping MySQL..." -ForegroundColor Cyan
Get-Process -Name "mysqld" -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    Write-Host "    MySQL stopped (PID $($_.Id))" -ForegroundColor Gray
}

Write-Host ""
Write-Host "  All services stopped." -ForegroundColor Green
Write-Host ""
Write-Host "Press any key to close..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
