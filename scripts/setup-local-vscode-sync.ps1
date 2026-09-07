Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-Git {
    param(
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]]$GitArgs
    )

    & git @GitArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Git command failed: git $($GitArgs -join ' ')"
    }
}

Write-Host ""
Write-Host "GDP Clothing - Local VS Code / Git Sync Setup"
Write-Host "============================================="
Write-Host ""

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "Git is not installed or is not available in PATH."
}

$insideWorkTree = (& git rev-parse --is-inside-work-tree 2>$null)
if ($LASTEXITCODE -ne 0 -or $insideWorkTree.Trim() -ne "true") {
    throw "Open the GDP Clothing repository folder in VS Code, then run this task again."
}

$originUrl = (& git remote get-url origin 2>$null)
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($originUrl)) {
    throw "This local repository does not have an 'origin' remote configured."
}

Write-Host "Origin: $originUrl"

# Repository-local safety defaults.
Invoke-Git config --local pull.ff only
Invoke-Git config --local fetch.prune true

Write-Host ""
Write-Host "Fetching latest GitHub changes..."
Invoke-Git fetch --prune origin

$currentBranch = (& git branch --show-current).Trim()
if ([string]::IsNullOrWhiteSpace($currentBranch)) {
    throw "No active Git branch was detected."
}

Write-Host "Current branch: $currentBranch"

if ($currentBranch -eq "main") {
    & git branch --set-upstream-to=origin/main main *> $null
}

$workingChanges = @(& git status --porcelain)

Write-Host ""
if ($workingChanges.Count -gt 0) {
    Write-Host "Local edits detected."
    Write-Host "For safety, the setup will NOT pull while your working tree has uncommitted changes."
    Write-Host "Save/commit or stash those changes, then run 'GDP: Pull Latest Safely'."
}
elseif ($currentBranch -eq "main") {
    Write-Host "Working tree is clean. Pulling main with fast-forward-only protection..."
    Invoke-Git pull --ff-only origin main
}
else {
    Write-Host "You are on '$currentBranch', not 'main'. No automatic pull was performed."
}

Write-Host ""
Write-Host "Current synchronization status:"
Invoke-Git status -sb

Write-Host ""
Write-Host "Setup complete."
Write-Host "- VS Code Auto Save: enabled by workspace settings"
Write-Host "- Git Auto Fetch: enabled by workspace settings"
Write-Host "- Pull mode: fast-forward only"
Write-Host "- Fetch pruning: enabled"
Write-Host "- Sync confirmation: enabled"
Write-Host ""
