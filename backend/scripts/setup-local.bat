@echo off
echo ========================================
echo     HRMS Local Setup Script
echo ========================================
echo.

cd /d "%~dp0.."

echo [1/5] Installing backend dependencies...
cd backend
call npm install
if errorlevel 1 (
    echo ERROR: Backend dependencies failed
    pause
    exit /b 1
)

echo.
echo [2/5] Adding Recharts to frontend...
cd ..\frontend
call npm install
if errorlevel 1 (
    echo ERROR: Frontend dependencies failed
    pause
    exit /b 1
)

echo.
echo [3/5] Checking PostgreSQL...
powershell -Command "Get-Service | Where-Object {$_.Name -like '*postgres*'}" >nul 2>&1
if errorlevel 1 (
    echo WARNING: PostgreSQL service not found
    echo Please start PostgreSQL manually, then press any key...
    pause >nul
)

echo.
echo [4/5] Generating Prisma client...
cd ..\backend
call npx prisma generate
if errorlevel 1 (
    echo ERROR: Prisma generate failed
    pause
    exit /b 1
)

echo.
echo [5/5] Pushing schema to database...
call npx prisma db push
if errorlevel 1 (
    echo ERROR: Database push failed
    echo Check your DATABASE_URL in backend/.env
    pause
    exit /b 1
)

echo.
echo ========================================
echo Setup complete!
echo.
echo Starting servers...
echo.

start cmd /k "cd backend ^&^& node src\index.js"
timeout /t 2 /nobreak >nul
start cmd /k "cd frontend ^&^& npm run dev"

echo Backend: http://localhost:5000
echo Frontend: http://localhost:3000
echo.
echo Press any key to exit...
pause >nul