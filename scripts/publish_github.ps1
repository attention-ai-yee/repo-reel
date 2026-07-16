param(
    [string]$Repository = "attention-ai-yee/repo-reel",
    [string]$CommitMessage = "Initial RepoReel release"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$RemoteUrl = "https://github.com/$Repository.git"

function Invoke-Checked {
    param(
        [string]$Label,
        [scriptblock]$Action
    )
    Write-Host "`n== $Label ==" -ForegroundColor Cyan
    & $Action
    if ($LASTEXITCODE -ne 0) {
        throw "$Label failed with exit code $LASTEXITCODE"
    }
}

foreach ($command in @("git", "gh")) {
    if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
        throw "$command was not found in PATH."
    }
}

Push-Location $Root
try {
    Invoke-Checked "Check GitHub authentication" {
        gh auth status
    }

    $User = gh api user | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0 -or -not $User.login) {
        throw "Unable to read the authenticated GitHub user."
    }
    $Email = "$($User.id)+$($User.login)@users.noreply.github.com"
    git config user.name $User.login
    git config user.email $Email

    $Repo = gh repo view $Repository --json isEmpty,nameWithOwner,url | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to access $Repository."
    }
    if (-not $Repo.isEmpty) {
        throw "The remote repository is not empty. Stop and reconcile its history before the initial publish."
    }

    git branch -M main
    if ($LASTEXITCODE -ne 0) { throw "Unable to rename the local branch to main." }
    $Remotes = @(git remote)
    if ($Remotes -contains "origin") {
        git remote set-url origin $RemoteUrl
    }
    else {
        git remote add origin $RemoteUrl
    }

    $Scope = @(
        ".gitignore",
        "README.md",
        "VERSION",
        "assets",
        "data",
        "docs",
        "output\github-weekly-v2-pilot.mp4",
        "output\v2-pilot-manifest.json",
        "remotion",
        "requirements.txt",
        "scripts",
        "video-flow.ps1"
    )
    Invoke-Checked "Stage RepoReel release files" {
        git add -- $Scope
    }
    Invoke-Checked "Check staged diff" {
        git diff --cached --check
    }

    $Staged = git diff --cached --name-only
    if (-not $Staged) {
        throw "No release files were staged."
    }
    Write-Host "`nStaged files:" -ForegroundColor Green
    $Staged

    Invoke-Checked "Create initial commit" {
        git commit -m $CommitMessage
    }
    Invoke-Checked "Push main branch" {
        git push -u origin main
    }

    Invoke-Checked "Set repository metadata" {
        gh repo edit $Repository `
            --description "Turn trending repositories into polished short-form videos." `
            --add-topic github-trending `
            --add-topic remotion `
            --add-topic ffmpeg `
            --add-topic video-automation `
            --add-topic short-video `
            --add-topic content-creation
    }

    Write-Host "`nPublished: $($Repo.url)" -ForegroundColor Green
}
finally {
    Pop-Location
}
