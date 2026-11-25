@echo off
rem Abre la web local del repo (lectura de los .md y checkboxes).
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 tools\web\server.py %*
) else (
  python tools\web\server.py %*
)
