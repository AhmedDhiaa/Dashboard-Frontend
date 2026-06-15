@echo off
REM Start the dashboard from the publish bundle on Windows (CMD).
REM   deploy\windows\start.bat   — requires Node 22+ on PATH.
setlocal
cd /d "%~dp0..\.."
set NODE_ENV=production
if "%PORT%"=="" set PORT=3000
if "%HOSTNAME%"=="" set HOSTNAME=0.0.0.0
node server.js
endlocal
