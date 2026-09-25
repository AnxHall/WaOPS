# Kills orphaned WaOPS node processes (dev servers started with tsx outside pnpm).
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/kill-waops-node.ps1
$procs = Get-CimInstance Win32_Process -Filter "Name='node.exe'"
foreach ($p in $procs) {
  if ($p.CommandLine -like '*WaOPS*') {
    Stop-Process -Id $p.ProcessId -Force
    Write-Output ("killed " + $p.ProcessId)
  }
}
