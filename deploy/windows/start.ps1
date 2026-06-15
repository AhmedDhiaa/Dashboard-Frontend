# Start the dashboard from the publish bundle on Windows (PowerShell).
#   pwsh deploy/windows/start.ps1      (or right-click → Run with PowerShell)
# Loads .env from the bundle root if present. Requires Node 22+.
$ErrorActionPreference = "Stop"

# Bundle root = two levels up from this script (deploy/windows → root).
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root

$env:NODE_ENV = "production"
if (-not $env:PORT) { $env:PORT = "3000" }
if (-not $env:HOSTNAME) { $env:HOSTNAME = "0.0.0.0" }

$envFile = Join-Path $root ".env"
if (Test-Path $envFile) {
  Get-Content $envFile | Where-Object { $_ -match "^\s*[^#].*=" } | ForEach-Object {
    $pair = $_ -split "=", 2
    [Environment]::SetEnvironmentVariable($pair[0].Trim(), $pair[1].Trim(), "Process")
  }
}

node server.js
