param(
    [switch]$SkipBrowser
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

function Find-Python {
    $command = Get-Command python -ErrorAction SilentlyContinue
    if ($command -and $command.Source -notlike "*WindowsApps*") {
        return $command.Source
    }
    foreach ($candidate in @(
        (Join-Path $env:USERPROFILE "AppData\Local\Python\bin\python.exe"),
        (Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe")
    )) {
        if (Test-Path $candidate) {
            return $candidate
        }
    }
    throw "Python 3.11+ was not found."
}

foreach ($command in @("node", "npm", "ffmpeg", "ffprobe")) {
    if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
        throw "$command was not found in PATH."
    }
}

$Python = Find-Python
Push-Location $Root
try {
    if (-not (Get-Command codex -ErrorAction SilentlyContinue)) {
        Write-Host "`n== Install Codex CLI ==" -ForegroundColor Cyan
        npm install -g @openai/codex
        if ($LASTEXITCODE -ne 0) { throw "Codex CLI installation failed." }
    }

    $PreviousErrorAction = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & codex -c 'service_tier="fast"' login status *> $null
    $CodexLoginExitCode = $LASTEXITCODE
    $ErrorActionPreference = $PreviousErrorAction
    if ($CodexLoginExitCode -ne 0) {
        Write-Host "`n== Sign in to Codex ==" -ForegroundColor Cyan
        & codex -c 'service_tier="fast"' login
        if ($LASTEXITCODE -ne 0) { throw "Codex CLI login failed." }
    }

    & $Python -m pip install -r requirements.txt
    if ($LASTEXITCODE -ne 0) { throw "Python dependency installation failed." }

    if (-not $SkipBrowser) {
        & $Python -m playwright install chromium
        if ($LASTEXITCODE -ne 0) { throw "Chromium installation failed." }
    }

    Push-Location remotion
    try {
        npm ci
        if ($LASTEXITCODE -ne 0) { throw "Remotion dependency installation failed." }
    }
    finally {
        Pop-Location
    }

    & scripts\doctor.ps1
}
finally {
    Pop-Location
}
