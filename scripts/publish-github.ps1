param(
  [Parameter(Position = 0)]
  [string]$RepoName = "omo-claw",
  [Parameter(Position = 1)]
  [string]$Owner = "oasjkow",
  [Parameter(Position = 2)]
  [ValidateSet("public", "private", "internal")]
  [string]$Visibility = "public"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$description = "SDK-only OpenClaw plugin and context engine bridging OpenClaw threads into an isolated headless OpenCode + OmO runtime."

if ($null -eq (Get-Command "gh" -ErrorAction SilentlyContinue)) {
  throw "gh is required"
}

& gh auth status *> $null
if ($LASTEXITCODE -ne 0) {
  throw "GitHub CLI is not authenticated. Run: gh auth login -h github.com"
}

& git diff --quiet
$unstagedExitCode = $LASTEXITCODE
& git diff --cached --quiet
$stagedExitCode = $LASTEXITCODE
if ($unstagedExitCode -ne 0 -or $stagedExitCode -ne 0) {
  throw "Working tree is not clean. Commit or stash changes before publishing."
}

& gh repo view "$Owner/$RepoName" *> $null
if ($LASTEXITCODE -ne 0) {
  & gh repo create "$Owner/$RepoName" "--$Visibility" --description $description --source=. --remote=origin --push=false
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}

$remotes = (& git remote) -split "`r?`n" | Where-Object { $_ -ne "" }
if ($remotes -notcontains "origin") {
  & git remote add origin "https://github.com/$Owner/$RepoName.git"
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}

& git push -u origin HEAD
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

& gh repo edit "$Owner/$RepoName" --description $description --add-topic openclaw --add-topic omo --add-topic sdk-bridge --add-topic context-engine --add-topic opencode
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host "Published: https://github.com/$Owner/$RepoName"
