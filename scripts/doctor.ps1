param(
    [ValidateSet("Runtime", "Source")]
    [string]$Mode = "Runtime"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Checks = [System.Collections.Generic.List[object]]::new()

function Add-Check {
    param(
        [string]$Name,
        [bool]$Passed,
        [string]$Detail,
        [bool]$Required = $true
    )
    $Checks.Add([pscustomobject]@{
        Check = $Name
        Status = if ($Passed) { "OK" } elseif ($Required) { "MISSING" } else { "OPTIONAL" }
        Detail = $Detail
        Required = $Required
    })
}

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
    return $null
}

function Find-Browser {
    if ($env:REMOTION_BROWSER_EXECUTABLE -and (Test-Path $env:REMOTION_BROWSER_EXECUTABLE)) {
        return $env:REMOTION_BROWSER_EXECUTABLE
    }
    $root = Join-Path $env:USERPROFILE "AppData\Local\ms-playwright"
    if (-not (Test-Path $root)) {
        return $null
    }
    $candidates = Get-ChildItem $root -Directory -Filter "chromium-*" -ErrorAction SilentlyContinue |
        Sort-Object Name -Descending |
        ForEach-Object {
            @(
                (Join-Path $_.FullName "chrome-win64\chrome.exe"),
                (Join-Path $_.FullName "chrome-win\chrome.exe")
            )
        }
    return $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
}

function Command-Path {
    param([string]$Name)
    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    return "not found"
}

$Python = Find-Python
$Browser = Find-Browser
$RuntimeRequired = $Mode -eq "Runtime"
Add-Check "Python 3.11+" ($null -ne $Python) $(if ($Python) { $Python } else { "not found" }) $RuntimeRequired
Add-Check "Node.js" ($null -ne (Get-Command node -ErrorAction SilentlyContinue)) (Command-Path "node") $RuntimeRequired
Add-Check "npm" ($null -ne (Get-Command npm -ErrorAction SilentlyContinue)) (Command-Path "npm") $RuntimeRequired
Add-Check "FFmpeg" ($null -ne (Get-Command ffmpeg -ErrorAction SilentlyContinue)) (Command-Path "ffmpeg") $RuntimeRequired
Add-Check "FFprobe" ($null -ne (Get-Command ffprobe -ErrorAction SilentlyContinue)) (Command-Path "ffprobe") $RuntimeRequired
Add-Check "Chromium" ($null -ne $Browser) $(if ($Browser) { $Browser } else { "run setup to install" }) $RuntimeRequired
$Codex = Get-Command codex -ErrorAction SilentlyContinue
Add-Check "Codex CLI" ($null -ne $Codex) $(if ($Codex) { & codex --version } else { "run setup to install" }) $RuntimeRequired
if ($Mode -eq "Runtime" -and $Codex) {
    $PreviousErrorAction = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & codex -c 'service_tier="fast"' login status *> $null
    $CodexLoginExitCode = $LASTEXITCODE
    $ErrorActionPreference = $PreviousErrorAction
    Add-Check "Codex login" ($CodexLoginExitCode -eq 0) $(if ($CodexLoginExitCode -eq 0) { "authenticated" } else { "run codex login" })
}
elseif ($Mode -eq "Runtime") {
    Add-Check "Codex login" $false "Codex CLI unavailable"
}

if ($Mode -eq "Runtime" -and $Python) {
    & $Python -c "import edge_tts, numpy; print('ok')" *> $null
    Add-Check "Python packages" ($LASTEXITCODE -eq 0) "edge-tts + numpy"
}
elseif ($Mode -eq "Runtime") {
    Add-Check "Python packages" $false "Python unavailable"
}

$RequiredSource = @(
    "README.md",
    "requirements.txt",
    "data\pilot-v2.json",
    "data\full-v2.json",
    "config\weekly.json",
    "schemas\editorial-plan.schema.json",
    "remotion\package-lock.json",
    "remotion\src\v2-pilot.tsx",
    "remotion\src\v2-full.tsx",
    "scripts\run_weekly.ps1",
    "scripts\auto_prepare.py",
    "scripts\auto_weekly.ps1"
)
foreach ($relative in $RequiredSource) {
    Add-Check "Source: $relative" (Test-Path (Join-Path $Root $relative)) $relative
}

if ($Mode -eq "Runtime") {
    Add-Check "Remotion dependencies" (Test-Path (Join-Path $Root "remotion\node_modules\.bin\remotion.cmd")) "remotion/node_modules"
    Add-Check "Sample pilot" (Test-Path (Join-Path $Root "output\github-weekly-v2-pilot.mp4")) "needed by the current full-episode template"
    Add-Check "Pilot timeline" (Test-Path (Join-Path $Root "remotion\src\generated\pilot-timeline.json")) "needed because root.tsx exposes the pilot composition"
}

$Checks | Format-Table Check, Status, Detail -AutoSize
$Failed = @($Checks | Where-Object { $_.Required -and $_.Status -eq "MISSING" })
if ($Failed.Count) {
    Write-Host "`nDoctor found $($Failed.Count) required problem(s)." -ForegroundColor Red
    exit 1
}
Write-Host "`nDoctor passed." -ForegroundColor Green
