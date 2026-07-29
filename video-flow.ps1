param(
    [Parameter(Position = 0)]
    [ValidateSet("setup", "doctor", "weekly", "prepare", "preview", "full", "package", "publish")]
    [string]$Command = "doctor",
    [string]$Edition = (Get-Date -Format "yyyy-MM-dd"),
    [string]$Config = "config\weekly.json",
    [string]$Model = "",
    [string]$Voice = "",
    [string]$Episode = "data\full-v2.json",
    [string]$AssetScript = "scripts\fetch_full_assets.py",
    [int]$Concurrency = 3,
    [switch]$ReuseEditorial,
    [switch]$DossierOnly,
    [switch]$PreviewOnly,
    [switch]$SkipCollect,
    [switch]$SkipAssets,
    [switch]$SkipVoice,
    [switch]$SkipInstall,
    [switch]$SkipBrowser,
    [switch]$IncludeFinalVideo
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

Push-Location $Root
try {
    switch ($Command) {
        "setup" {
            & scripts\setup.ps1 -SkipBrowser:$SkipBrowser
        }
        "doctor" {
            & scripts\doctor.ps1
        }
        "weekly" {
            & scripts\auto_weekly.ps1 `
                -Edition $Edition `
                -Config $Config `
                -Model $Model `
                -Voice $Voice `
                -Concurrency $Concurrency `
                -ReuseEditorial:$ReuseEditorial `
                -DossierOnly:$DossierOnly `
                -PreviewOnly:$PreviewOnly `
                -SkipInstall:$SkipInstall
        }
        "prepare" {
            & scripts\run_weekly.ps1 `
                -Phase Prepare `
                -Edition $Edition `
                -Episode $Episode `
                -AssetScript $AssetScript `
                -SkipCollect:$SkipCollect
        }
        "preview" {
            & scripts\run_weekly.ps1 `
                -Phase Preview `
                -Edition $Edition `
                -Episode $Episode `
                -AssetScript $AssetScript `
                -Concurrency $Concurrency `
                -SkipAssets:$SkipAssets `
                -SkipVoice:$SkipVoice `
                -SkipInstall:$SkipInstall
        }
        "full" {
            & scripts\run_weekly.ps1 `
                -Phase Full `
                -Edition $Edition `
                -Episode $Episode `
                -AssetScript $AssetScript `
                -Concurrency $Concurrency `
                -SkipAssets:$SkipAssets `
                -SkipVoice:$SkipVoice `
                -SkipInstall:$SkipInstall
        }
        "package" {
            & scripts\package_release.ps1 -IncludeFinalVideo:$IncludeFinalVideo
        }
        "publish" {
            & scripts\publish_github.ps1
        }
    }
}
finally {
    Pop-Location
}
