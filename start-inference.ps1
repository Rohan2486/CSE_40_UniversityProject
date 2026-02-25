param(
  [string]$BindHost = "0.0.0.0",
  [int]$Port = 8001,
  [switch]$NoReload
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$serviceDir = Join-Path $repoRoot "services\cnn-inference"
$venvPython = Join-Path $serviceDir "venv\Scripts\python.exe"

if (-not (Test-Path $serviceDir)) {
  Write-Error "Missing service directory: $serviceDir"
}

if (-not (Test-Path $venvPython)) {
  Write-Error "Python venv not found at $venvPython. Create it and install requirements first."
}

$uvicornArgs = @(
  "app.main:app",
  "--app-dir", $serviceDir,
  "--host", $BindHost,
  "--port", $Port.ToString()
)

if (-not $NoReload) {
  $uvicornArgs += "--reload"
}

Write-Host "Starting CNN inference service on http://$BindHost`:$Port"
& $venvPython -m uvicorn @uvicornArgs
