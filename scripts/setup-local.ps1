Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-OpencodeCommand {
  $pathCommand = Get-Command "opencode" -ErrorAction SilentlyContinue
  if ($null -ne $pathCommand) {
    return $pathCommand.Source
  }

  $candidates = @(
    (Join-Path $HOME ".opencode\bin\opencode.exe"),
    (Join-Path $HOME ".opencode\bin\opencode.cmd"),
    (Join-Path $HOME ".opencode\bin\opencode")
  )

  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      return $candidate
    }
  }

  throw "opencode CLI is required. Ensure 'opencode' is in PATH or installed under $HOME\.opencode\bin\."
}

$rootDir = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $rootDir "integration\bridge-runtime"
$secretExample = Join-Path $runtimeDir ".bridge-secret.example"
$secretFile = Join-Path $runtimeDir ".bridge-secret"

if ($null -eq (Get-Command "bun" -ErrorAction SilentlyContinue)) {
  throw "bun is required. Install from https://bun.sh/"
}

$null = Resolve-OpencodeCommand

if (-not (Test-Path $secretFile)) {
  Copy-Item $secretExample $secretFile
}

Push-Location $rootDir
try {
  & bun install
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }

  & bun run compile:definitions
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}
finally {
  Pop-Location
}

Write-Host "Local setup complete. Next steps:"
Write-Host "  platform: Windows"
Write-Host "  1. edit integration/bridge-runtime/.bridge-secret if needed"
Write-Host "  2. run .\integration\bridge-runtime\bridge-launcher.ps1"
Write-Host "  3. verify with .\tests\live\runtime-health.smoke.ps1"
