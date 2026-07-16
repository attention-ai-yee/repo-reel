param(
    [switch]$SkipInstall,
    [switch]$SkipVoice,
    [switch]$SkipAssets
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Remotion = Join-Path $Root "remotion"
$Raw = Join-Path $Root "output\github-weekly-v2-pilot-raw.mp4"
$Final = Join-Path $Root "output\github-weekly-v2-pilot.mp4"

Push-Location $Root
try {
    if (-not $SkipAssets) {
        python scripts/fetch_pilot_assets.py
    }
    if (-not $SkipVoice) {
        python scripts/generate_voice.py
    }
    python scripts/make_sound_design.py

    Push-Location $Remotion
    try {
        if (-not $SkipInstall -or -not (Test-Path "node_modules")) {
            npm install
        }
        npx tsc --noEmit
        .\node_modules\.bin\remotion.cmd render src/index.ts GitHubWeeklyV2Pilot $Raw `
            --codec=h264 --crf=18 --pixel-format=yuv420p --audio-codec=aac --audio-bitrate=192k
    }
    finally {
        Pop-Location
    }

    ffmpeg -y -hide_banner -loglevel warning -i $Raw `
        -map 0:v:0 -map 0:a:0 -c:v copy `
        -af "loudnorm=I=-16:LRA=7:TP=-1.5" `
        -c:a aac -b:a 192k -ar 48000 -movflags +faststart $Final

    python scripts/verify_v2.py
}
finally {
    Pop-Location
}
