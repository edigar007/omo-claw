param(
  [Parameter(Position = 0)]
  [string]$TargetDir,
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$RemainingArgs = @()
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Show-Usage {
  @"
Usage: .\scripts\install-plugin.ps1 [target-dir]

Clone the omo claw repository into target-dir, run the local setup script,
and print the remaining OpenClaw registration steps.

Arguments:
  target-dir           Optional install destination.
                       Default: <current-directory>\omo-claw

Environment:
  OMO_CLAW_INSTALL_DIR Override the default install destination.
  OMO_CLAW_REPO_URL    Override the git clone source.
  OMO_CLAW_SKIP_SETUP  Set to 1 to skip .\scripts\setup-local.ps1.
"@ | Write-Host
}

if ($TargetDir -in @("-h", "--help") -or $RemainingArgs -contains "-h" -or $RemainingArgs -contains "--help") {
  Show-Usage
  exit 0
}

if ($null -eq (Get-Command "git" -ErrorAction SilentlyContinue)) {
  throw "git is required to install omo claw."
}

$repoUrl = if ($env:OMO_CLAW_REPO_URL) { $env:OMO_CLAW_REPO_URL } else { "https://github.com/Her-xanadu/omo-claw.git" }
$resolvedTargetDir = if ($TargetDir) {
  $TargetDir
} elseif ($env:OMO_CLAW_INSTALL_DIR) {
  $env:OMO_CLAW_INSTALL_DIR
} else {
  Join-Path (Get-Location) "omo-claw"
}

$targetPath = [System.IO.Path]::GetFullPath($resolvedTargetDir)
$targetParent = Split-Path -Parent $targetPath
if ([string]::IsNullOrWhiteSpace($targetParent)) {
  $targetParent = Get-Location
}

if (Test-Path $targetPath) {
  throw "Target path already exists: $targetPath`nChoose an empty directory or remove the existing path first."
}

New-Item -ItemType Directory -Force -Path $targetParent | Out-Null

& git clone $repoUrl $targetPath
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

if ($env:OMO_CLAW_SKIP_SETUP -ne "1") {
  & (Join-Path $targetPath "scripts\setup-local.ps1")
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}

Write-Host "omo claw source installed at: $targetPath"
Write-Host "Next steps:"
Write-Host "  1. register $targetPath\openclaw.plugin.json with OpenClaw"
Write-Host "  2. use plugin id: omo-claw"
Write-Host "  3. start: $targetPath\integration\bridge-runtime\bridge-launcher.ps1"
Write-Host "  4. verify: $targetPath\tests\live\runtime-health.smoke.ps1"
