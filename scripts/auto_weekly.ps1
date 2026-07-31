param(
    [string]$Edition = (Get-Date -Format "yyyy-MM-dd"),
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

$Work = Join-Path $Root "output\work\weekly-$Edition"
New-Item -ItemType Directory -Force $Work | Out-Null
$EffectiveConfigPath = Join-Path $Work "effective-config.json"
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$EffectiveConfigJson = $EffectiveConfig | ConvertTo-Json -Depth 12
[System.IO.File]::WriteAllText($EffectiveConfigPath, $EffectiveConfigJson, $Utf8NoBom)

$Weekly = Join-Path $Root "data\weekly-$Edition.json"
$Episode = Join-Path $Root "data\episode-$Edition.json"

Push-Location $Root
try {
    Invoke-Checked "Check local video toolchain" {
        & scripts\doctor.ps1 -EditorialProvider $EffectiveConfig.editorial.provider
    }
    Write-Host "`n== Collect current GitHub Trending weekly ranking ==" -ForegroundColor Cyan
    & $Python scripts\collect_weekly.py --edition $Edition --output $Weekly
    if ($LASTEXITCODE -ne 0) {
        if (Test-Path $Weekly) {
            Write-Warning (
                "Live collection failed. Continuing with the cached same-edition snapshot: " +
                $Weekly
            )
        } else {
            throw "Collect current GitHub Trending weekly ranking failed and no cached snapshot exists."
        }
    }
    Invoke-Checked "Build repository dossier, edit narration, and fetch official assets" {
        $Arguments = @(
            "scripts\auto_prepare.py",
            "--edition", $Edition,
            "--config", $EffectiveConfigPath,
            "--weekly", $Weekly,
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

    $Output = if ($PreviewOnly) {
        Join-Path $Root "output\github-weekly-$Edition-v2-preview.mp4"
    } else {
        Join-Path $Root "output\github-weekly-$Edition-v2.mp4"
    }
    Write-Host "`nRepoReel weekly workflow completed:" -ForegroundColor Green
    Write-Host "  $Output"
    Write-Host "  config: $EffectiveConfigPath"
}
finally {
    Pop-Location
}
