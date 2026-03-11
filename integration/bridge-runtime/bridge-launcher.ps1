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

$rootDir = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
$runtimeDir = Join-Path $rootDir "integration\bridge-runtime"
$secretFile = Join-Path $runtimeDir ".bridge-secret"

if (-not (Test-Path $secretFile)) {
  throw "Missing bridge secret: $secretFile"
}

foreach ($path in @(
  (Join-Path $runtimeDir "xdg\config"),
  (Join-Path $runtimeDir "xdg\data"),
  (Join-Path $runtimeDir "xdg\state"),
  (Join-Path $runtimeDir ".opencode")
)) {
  New-Item -ItemType Directory -Force -Path $path | Out-Null
}

$env:XDG_CONFIG_HOME = Join-Path $runtimeDir "xdg\config"
$env:XDG_DATA_HOME = Join-Path $runtimeDir "xdg\data"
$env:XDG_STATE_HOME = Join-Path $runtimeDir "xdg\state"
$env:OPENCODE_CONFIG_DIR = Join-Path $runtimeDir ".opencode"
$env:OPENCODE_SERVER_PASSWORD = (Get-Content $secretFile -Raw).Trim()

$opencodeCommand = Resolve-OpencodeCommand
& $opencodeCommand serve --port 19222 --hostname 127.0.0.1
exit $LASTEXITCODE
