Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-PowerShellCommand {
  foreach ($candidate in @("pwsh.exe", "powershell.exe", "pwsh", "powershell")) {
    $command = Get-Command $candidate -ErrorAction SilentlyContinue
    if ($null -ne $command) {
      return $command.Source
    }
  }

  throw "PowerShell is required to launch the bridge runtime smoke test."
}

$rootDir = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
$secretFile = Join-Path $rootDir "integration\bridge-runtime\.bridge-secret"
$launcherPath = Join-Path $rootDir "integration\bridge-runtime\bridge-launcher.ps1"

if (-not (Test-Path $secretFile)) {
  throw "missing secret file: $secretFile"
}

$powerShellCommand = Resolve-PowerShellCommand
$launcher = Start-Process -FilePath $powerShellCommand -ArgumentList @(
  "-NoProfile",
  "-ExecutionPolicy",
  "Bypass",
  "-File",
  $launcherPath
) -PassThru -WindowStyle Hidden

try {
  Start-Sleep -Seconds 5

  $secret = (Get-Content $secretFile -Raw).Trim()
  $token = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("opencode:$secret"))
  $headers = @{ Authorization = "Basic $token" }
  $response = Invoke-RestMethod -Uri "http://127.0.0.1:19222/global/health" -Headers $headers -TimeoutSec 10
  $response | ConvertTo-Json -Compress
}
finally {
  if ($null -ne $launcher -and -not $launcher.HasExited) {
    Stop-Process -Id $launcher.Id -Force
  }
}
