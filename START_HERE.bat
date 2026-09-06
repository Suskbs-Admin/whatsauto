@echo off
echo === WhatsApp Bulk Automation ===
echo.
echo [1] Preview messages (dry run)
echo [2] Start interactive app
echo [3] Install dependencies
echo.
set /p choice=Select option: 
if "%choice%"=="1" node src\testTemplate.js
if "%choice%"=="2" node app.js
if "%choice%"=="3" call npm.cmd install
pause
