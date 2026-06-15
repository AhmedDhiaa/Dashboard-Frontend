# Install the dashboard as a Windows service via NSSM (https://nssm.cc).
# Run from an ELEVATED PowerShell. Requires nssm.exe on PATH and Node 22+.
#   pwsh deploy/windows/install-service.ps1
#
# Manage afterwards:  nssm start|stop|restart|remove AcmeDashboard
# Logs:               check the AppStdout/AppStderr paths set below.
$ErrorActionPreference = "Stop"

$service = "AcmeDashboard"
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)  # bundle root
$node = (Get-Command node -ErrorAction Stop).Source
$logDir = Join-Path $root "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

if (-not (Get-Command nssm -ErrorAction SilentlyContinue)) {
  throw "nssm.exe not found on PATH. Install from https://nssm.cc or 'choco install nssm', then re-run."
}

# Re-create cleanly if it already exists.
nssm stop $service 2>$null
nssm remove $service confirm 2>$null

nssm install $service $node "server.js"
nssm set $service AppDirectory $root
nssm set $service AppEnvironmentExtra NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
nssm set $service AppStdout (Join-Path $logDir "out.log")
nssm set $service AppStderr (Join-Path $logDir "err.log")
nssm set $service Start SERVICE_AUTO_START
nssm start $service

Write-Host "Service '$service' installed and started on http://localhost:3000"
