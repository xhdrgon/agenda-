@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Necesitas Node.js para esta prueba local. Tambien puedes copiar la carpeta public al alojamiento HTTPS existente.
  pause
  exit /b 1
)
node dev-server.cjs
pause
