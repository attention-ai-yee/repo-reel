param(
    [ValidateSet("Prepare", "Preview", "Full")]
    [string]$Phase = "Full",
    [string]$Edition = (Get-Date -Format "yyyy-MM-dd"),
    [string]$Episode = "data\full-v2.json",
    [string]$AssetScript = "scripts\fetch_full_assets.py",
    [switch]$SkipCollect,
    [switch]$SkipAssets,
    [switch]$SkipVoice,
    [switch]$SkipInstall,
    [int]$Concurrency = 3
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Remotion = Join-Path $Root "remotion"

function Resolve-Python {
    $command = Get-Command python -ErrorAction SilentlyContinue
    if ($command -and $command.Source -notlike "*WindowsApps*") {
        return $command.Source
    }
    $candidates = @(
        (Join-Path $env:USERPROFILE "AppData\Local\Python\bin\python.exe"),
        (Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe")
    )
    foreach ($candidate in $candidates) {
        if (Test-Path $candidate) {
            return $candidate
        }
    }
    throw "Python was not found. Install Python 3.11+ and run: pip install -r requirements.txt"
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
$EpisodePath = if ([System.IO.Path]::IsPathRooted($Episode)) {
    $Episode
} else {
    Join-Path $Root $Episode
}
$AssetScriptPath = if ([System.IO.Path]::IsPathRooted($AssetScript)) {
    $AssetScript
} else {
    Join-Path $Root $AssetScript
}
$Timeline = Join-Path $Remotion "src\generated\full-timeline.json"
$Raw = Join-Path $Root "output\github-weekly-$Edition-v2-raw.mp4"
$Preview = Join-Path $Root "output\github-weekly-$Edition-v2-preview.mp4"
$Final = Join-Path $Root "output\github-weekly-$Edition-v2.mp4"
$Manifest = Join-Path $Root "output\github-weekly-$Edition-v2-manifest.json"

Push-Location $Root
try {
    if ($Phase -eq "Prepare") {
        $WeeklyData = Join-Path $Root "data\weekly-$Edition.json"
        $Draft = Join-Path $Root "data\episode-$Edition.draft.json"
        if (-not $SkipCollect) {
            Invoke-Checked "Collect GitHub Trending weekly data" {
                & $Python scripts\collect_weekly.py --edition $Edition --output $WeeklyData
            }
        }
        Invoke-Checked "Create editorial episode scaffold" {
            & $Python scripts\scaffold_episode.py --input $WeeklyData --output $Draft
        }
        Write-Host "`nPrepared:" -ForegroundColor Green
        Write-Host "  $WeeklyData"
        Write-Host "  $Draft"
        Write-Host "Next: let Codex turn the draft into a reviewed episode spec and asset manifest."
        exit 0
    }

    if (-not (Test-Path $EpisodePath)) {
        throw "Episode spec does not exist: $EpisodePath"
    }
    Invoke-Checked "Lint narration for banned AI-style phrasing" {
        & $Python scripts\lint_episode.py --input $EpisodePath
    }
    if (-not $SkipAssets) {
        if (-not (Test-Path $AssetScriptPath)) {
            throw "Asset script does not exist: $AssetScriptPath"
        }
        Invoke-Checked "Fetch and normalize official project assets" {
            & $Python $AssetScriptPath
        }
    }
    if (-not $SkipVoice) {
        Invoke-Checked "Generate narration and exact sentence timeline" {
            & $Python scripts\generate_voice.py `
                --input $EpisodePath `
                --timeline-output $Timeline `
                --skip-tests
        }
    }
    if (-not (Test-Path $Timeline)) {
        throw "Timeline does not exist: $Timeline"
    }

    Invoke-Checked "Generate original music bed" {
        & $Python scripts\make_full_sound_design.py
    }

    Push-Location $Remotion
    try {
        if (-not $SkipInstall -or -not (Test-Path "node_modules")) {
            Invoke-Checked "Install pinned Remotion dependencies" {
                npm install
            }
        }
        Invoke-Checked "Type-check Remotion composition" {
            .\node_modules\.bin\tsc.cmd --noEmit
        }

        if ($Phase -eq "Preview") {
            Invoke-Checked "Render half-resolution preview" {
                .\node_modules\.bin\remotion.cmd render `
                    src\index.ts GitHubWeeklyV2Full $Preview `
                    --codec=h264 --crf=22 --pixel-format=yuv420p `
                    --audio-codec=aac --audio-bitrate=160k `
                    --scale=0.5 --concurrency=$Concurrency
            }
            Write-Host "`nPreview ready: $Preview" -ForegroundColor Green
            exit 0
        }

        Invoke-Checked "Render full-resolution master" {
            .\node_modules\.bin\remotion.cmd render `
                src\index.ts GitHubWeeklyV2Full $Raw `
                --codec=h264 --crf=18 --pixel-format=yuv420p `
                --audio-codec=aac --audio-bitrate=192k `
                --concurrency=$Concurrency
        }
    }
    finally {
        Pop-Location
    }

    Invoke-Checked "Normalize final loudness and enable fast start" {
        ffmpeg -y -hide_banner -loglevel warning -i $Raw `
            -map 0:v:0 -map 0:a:0 -c:v copy `
            -af "loudnorm=I=-16:LRA=7:TP=-1.5" `
            -c:a aac -b:a 192k -ar 48000 -movflags +faststart $Final
    }
    Invoke-Checked "Decode and validate final episode" {
        & $Python scripts\verify_full.py `
            --video $Final `
            --timeline $Timeline `
            --manifest $Manifest
    }
    Write-Host "`nFull episode ready: $Final" -ForegroundColor Green
}
finally {
    Pop-Location
}
