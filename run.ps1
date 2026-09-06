# Run with correct execution policy bypass for npm
# Usage: powershell -ExecutionPolicy Bypass -File .\run.ps1
# Or right-click -> Run with PowerShell

Write-Host "=== WhatsApp Automation Launcher ===" -ForegroundColor Green
Set-Location -Path $PSScriptRoot

# Bypass policy for this process only
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force

Write-Host "`n[1] Preview messages (dry run)"
Write-Host "[2] Start interactive app (QR + send + group)"
Write-Host "[3] Send bulk only"
Write-Host "[4] Create group only"
Write-Host "[5] Create groups per session"
Write-Host "[0] Install / Update dependencies`n"

$choice = Read-Host "Select option"

switch ($choice) {
    "1" { node src/testTemplate.js }
    "2" { node app.js }
    "3" { node src/bulkSender.js }
    "4" { $name = Read-Host "Group name (enter for default)"; if ($name) { node src/groupCreator.js "$name" } else { node src/groupCreator.js } }
    "5" { node src/groupBySession.js }
    "0" { npm.cmd install }
    default { Write-Host "Invalid choice" -ForegroundColor Red }
}

Read-Host "`nPress Enter to exit"
