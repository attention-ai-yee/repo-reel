# RepoReel one-command pipeline: collect -> prepare -> voice -> render -> QA.
#
# Usage:
#   .\run.ps1 -Period weekly                      # current week edition (yyyy-MM-dd)
#   .\run.ps1 -Period monthly                     # current month edition (yyyy-MM)
#   .\run.ps1 -Period weekly  -Edition 2026-08-05
#   .\run.ps1 -Period monthly -Edition 2026-08
#   .\run.ps1 -Period monthly -PreviewOnly        # half-res preview render
#   .\run.ps1 -Period weekly -DossierOnly         # stop after dossier/narration
#   .\run.ps1 -Period monthly -ReuseEditorial     # reuse cached editorial
#
# The script resolves the period-specific collector, data file, and output
# naming, then delegates the shared prepare+render stages to auto_prepare.py
# and run_weekly.ps1. Output lands in output\github-<period>-<edition>.mp4.

param(
    [ValidateSet("weekly", "monthly")]
    [string]$Period = "weekly",
    [string]$Edition = "",
    [string]$Config = "config\weekly.json",
    [string]$Model = "",
    [string]$Voice = "",
    [int]$Concurrency = 0,
    [switch]$ReuseEditorial,
    [switch]$DossierOnly,
    [switch]$PreviewOnly,
    [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

function Resolve-Python {
    $command = Get-Command python -ErrorAction SilentlyContinue
    if ($command -and $command.Source -notlike "*WindowsApps*") {
        return $command.Source
    }
    $candidate = Join-Path $env:USERPROFILE "AppData\Local\Python\bin\python.exe"
    if (Test-Path $candidate) {
        return $candidate
    }
    throw "Python was not found. Run .\video-flow.ps1 setup first."
}

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

# Period-specific defaults: edition format, collector script, data file stem.
if (-not $Edition) {
    $Edition = if ($Period -eq "monthly") {
        Get-Date -Format "yyyy-MM"
    } else {
        Get-Date -Format "yyyy-MM-dd"
    }
}
$Collector = "scripts\collect_$Period.py"
$DataFile = Join-Path $Root "data\$Period-$Edition.json"

$Python = Resolve-Python
$ConfigPath = if ([System.IO.Path]::IsPathRooted($Config)) {
    $Config
} else {
    Join-Path $Root $Config
}
if (-not (Test-Path $ConfigPath)) {
    throw "Workflow config does not exist: $ConfigPath"
}

$EffectiveConfig = Get-Content -Raw -Encoding UTF8 $ConfigPath | ConvertFrom-Json
if ($Model) {
    $EffectiveConfig.editorial.model = $Model
}
if ($Voice) {
    $EffectiveConfig.voice.name = $Voice
}
if ($Concurrency -gt 0) {
    $EffectiveConfig.render.concurrency = $Concurrency
}
$EffectiveConcurrency = [int]$EffectiveConfig.render.concurrency

$Work = Join-Path $Root "output\work\$Period-$Edition"
New-Item -ItemType Directory -Force $Work | Out-Null
$EffectiveConfigPath = Join-Path $Work "effective-config.json"
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$EffectiveConfigJson = $EffectiveConfig | ConvertTo-Json -Depth 12
[System.IO.File]::WriteAllText($EffectiveConfigPath, $EffectiveConfigJson, $Utf8NoBom)

$Episode = Join-Path $Root "data\episode-$Edition.json"

Write-Host "RepoReel $Period edition $Edition" -ForegroundColor Green

Push-Location $Root
try {
    Invoke-Checked "Check local video toolchain" {
        & scripts\doctor.ps1 -EditorialProvider $EffectiveConfig.editorial.provider
    }

    Write-Host "`n== Collect current GitHub Trending $Period ranking ==" -ForegroundColor Cyan
    & $Python $Collector --edition $Edition --output $DataFile
    if ($LASTEXITCODE -ne 0) {
        if (Test-Path $DataFile) {
            Write-Warning (
                "Live collection failed. Continuing with the cached same-edition snapshot: " +
                $DataFile
            )
        } else {
            throw "Collect current GitHub Trending $Period ranking failed and no cached snapshot exists."
        }
    }

    Invoke-Checked "Build repository dossier, edit narration, and fetch official assets" {
        $Arguments = @(
            "scripts\auto_prepare.py",
            "--edition", $Edition,
            "--config", $EffectiveConfigPath,
            "--weekly", $DataFile,
            "--episode-output", $Episode
        )
        if ($ReuseEditorial) {
            $Arguments += "--reuse-editorial"
        }
        if ($DossierOnly) {
            $Arguments += "--dossier-only"
        }
        & $Python @Arguments
    }
    if ($DossierOnly) {
        Write-Host "`nDossier ready: data\dossier-$Edition.json" -ForegroundColor Green
        exit 0
    }

    $Phase = if ($PreviewOnly) { "Preview" } else { "Full" }
    $ReuseInstalledDependencies = $SkipInstall -or (
        Test-Path (Join-Path $Root "remotion\node_modules")
    )
    Invoke-Checked "$Phase render, audio mix, and quality checks" {
        & scripts\run_weekly.ps1 `
            -Phase $Phase `
            -Edition $Edition `
            -Episode $Episode `
            -SkipAssets `
            -SkipInstall:$ReuseInstalledDependencies `
            -Concurrency $EffectiveConcurrency
    }

    # run_weekly.ps1 always writes github-weekly-*; rename to the period stem.
    $Rendered = if ($PreviewOnly) {
        Join-Path $Root "output\github-weekly-$Edition-v2-preview.mp4"
    } else {
        Join-Path $Root "output\github-weekly-$Edition-v2.mp4"
    }
    $Final = if ($PreviewOnly) {
        Join-Path $Root "output\github-$Period-$Edition-preview.mp4"
    } else {
        Join-Path $Root "output\github-$Period-$Edition.mp4"
    }
    if (($Period -ne "weekly") -and (Test-Path $Rendered)) {
        Copy-Item $Rendered $Final -Force
    } elseif (Test-Path $Rendered) {
        $Final = $Rendered
    }

    Write-Host "`nRepoReel $Period workflow completed:" -ForegroundColor Green
    Write-Host "  $Final"
    Write-Host "  config: $EffectiveConfigPath"
}
finally {
    Pop-Location
}
