param(
    [switch]$IncludeFinalVideo
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Version = (Get-Content -Raw -Encoding utf8 (Join-Path $Root "VERSION")).Trim()
$Dist = Join-Path $Root "dist"
$Stage = Join-Path $Dist ".staging-repo-reel-$Version"
$ArchiveName = if ($IncludeFinalVideo) {
    "repo-reel-$Version-complete.zip"
} else {
    "repo-reel-$Version-source.zip"
}
$Archive = Join-Path $Dist $ArchiveName

function Assert-InWorkspace {
    param([string]$Path)
    $full = [System.IO.Path]::GetFullPath($Path)
    $rootFull = [System.IO.Path]::GetFullPath($Root)
    if (-not $full.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Path is outside workspace: $full"
    }
}

Assert-InWorkspace $Dist
Assert-InWorkspace $Stage
Assert-InWorkspace $Archive
New-Item -ItemType Directory -Force $Dist | Out-Null
if (Test-Path $Stage) {
    Remove-Item -LiteralPath $Stage -Recurse -Force
}
if (Test-Path $Archive) {
    Remove-Item -LiteralPath $Archive -Force
}
New-Item -ItemType Directory -Force $Stage | Out-Null

$Files = @(
    ".gitignore",
    "README.md",
    "VERSION",
    "requirements.txt",
    "video-flow.ps1",
    "config\weekly.json",
    "schemas\editorial-plan.schema.json",
    "data\full-v2.json",
    "data\pilot-v2.json",
    "data\weekly-2026-07-15.json",
    "data\weekly-2026-07-29.json",
    "data\editorial-2026-07-29.json",
    "data\episode-2026-07-29.json",
    "docs\V2_QUALITY_PIPELINE.md",
    "docs\WEEKLY_RUNBOOK.md",
    "docs\THIRD_PARTY_NOTICES.md",
    "assets\seed\opencut-editor-clean.png",
    "output\github-weekly-v2-pilot.mp4",
    "output\v2-pilot-manifest.json",
    "remotion\package.json",
    "remotion\package-lock.json",
    "remotion\remotion.config.ts",
    "remotion\tsconfig.json",
    "remotion\src\index.ts",
    "remotion\src\root.tsx",
    "remotion\src\v2-pilot.tsx",
    "remotion\src\v2-full.tsx",
    "remotion\src\generated\pilot-timeline.json",
    "scripts\collect_weekly.py",
    "scripts\auto_prepare.py",
    "scripts\auto_weekly.ps1",
    "scripts\doctor.ps1",
    "scripts\fetch_full_assets.py",
    "scripts\fetch_pilot_assets.py",
    "scripts\generate_voice.py",
    "scripts\lint_episode.py",
    "scripts\make_full_sound_design.py",
    "scripts\make_sound_design.py",
    "scripts\package_release.ps1",
    "scripts\publish_github.ps1",
    "scripts\render_v2.ps1",
    "scripts\run_weekly.ps1",
    "scripts\scaffold_episode.py",
    "scripts\setup.ps1",
    "scripts\verify_full.py",
    "scripts\verify_package.py",
    "scripts\verify_v2.py"
)

if ($IncludeFinalVideo) {
    $Files += @(
        "output\github-weekly-2026-07-15-v2.mp4",
        "output\github-weekly-2026-07-15-v2-manifest.json"
    )
}

$ManifestFiles = [System.Collections.Generic.List[object]]::new()
foreach ($relative in $Files) {
    $source = Join-Path $Root $relative
    if (-not (Test-Path $source)) {
        throw "Release file is missing: $relative"
    }
    $target = Join-Path $Stage $relative
    New-Item -ItemType Directory -Force (Split-Path $target -Parent) | Out-Null
    Copy-Item -LiteralPath $source -Destination $target -Force
    $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $source).Hash.ToLowerInvariant()
    $ManifestFiles.Add([pscustomobject]@{
        path = $relative.Replace("\", "/")
        bytes = (Get-Item -LiteralPath $source).Length
        sha256 = $hash
    })
}

$PackageManifest = [ordered]@{
    name = "RepoReel"
    version = $Version
    created_at = (Get-Date).ToString("o")
    includes_final_video = [bool]$IncludeFinalVideo
    files = $ManifestFiles
}
$PackageManifest | ConvertTo-Json -Depth 5 |
    Set-Content -LiteralPath (Join-Path $Stage "PACKAGE_MANIFEST.json") -Encoding UTF8

Compress-Archive -Path (Join-Path $Stage "*") -DestinationPath $Archive -CompressionLevel Optimal
$PythonCommand = Get-Command python -ErrorAction SilentlyContinue
$PythonPath = if ($PythonCommand -and $PythonCommand.Source -notlike "*WindowsApps*") {
    $PythonCommand.Source
} else {
    $null
}
if (-not $PythonPath) {
    $fallback = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
    if (Test-Path $fallback) { $PythonPath = $fallback }
}
if (-not $PythonPath) {
    throw "Python is required to verify the release package."
}
& $PythonPath scripts\verify_package.py $Archive
if ($LASTEXITCODE -ne 0) {
    throw "Release package verification failed."
}
Remove-Item -LiteralPath $Stage -Recurse -Force
Get-Item $Archive | Select-Object FullName, Length, LastWriteTime
