@echo off
cd /d "%~dp0frontend"
node node_modules\next\dist\bin\next dev -H 127.0.0.1 -p 3001 > "%~dp0frontend-dev.out.log" 2> "%~dp0frontend-dev.err.log"
