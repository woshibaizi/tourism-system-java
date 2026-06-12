Write-Host "Stopping all services..." -ForegroundColor Red

Get-Job -Name "tourism-backend", "tourism-frontend", "tourism-agent" -ErrorAction SilentlyContinue |
    Stop-Job -PassThru | Remove-Job

@(8080, 5173, 9000) | ForEach-Object {
    $line = netstat -ano 2>$null | Select-String ":$_ " | Select-String "LISTENING" | Select-Object -First 1
    if ($line) {
        $procId = ($line -split '\s+')[-1]
        if ($procId -ne '0') {
            Write-Host "  Stopping PID $procId (port $_)..." -ForegroundColor Gray
            taskkill /F /PID $procId 2>$null
        }
    }
}

Write-Host "All services stopped." -ForegroundColor Green

3