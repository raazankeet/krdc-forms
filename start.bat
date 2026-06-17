@echo off
REM ============================================
REM  GLP Forms - Research Lab Form Management
REM  Quick Start Script
REM ============================================

echo.
echo ======================================
echo   GLP Forms Platform - Starting...
echo ======================================
echo.

REM Check for Python
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python not found. Please install Python 3.11+
    pause
    exit /b 1
)

echo [1/5] Setting up Python virtual environment...
cd backend
if not exist venv (
    python -m venv venv --system-site-packages
    echo   Virtual environment created.
) else (
    echo   Virtual environment already exists.
)
echo [2/5] Installing backend dependencies...
venv\Scripts\python.exe -m pip install -r requirements.txt -q 2>nul
echo   Done.

echo [3/5] Running database migrations...
venv\Scripts\python.exe -m alembic upgrade head
echo   Done.

echo [4/5] Seeding database...
venv\Scripts\python.exe seed_db.py
echo   Done.

echo [5/5] Installing frontend dependencies...
cd ..\frontend
call npm install
echo   Done.

cd ..

echo.
echo [Starting servers...]
echo.

REM Start backend
echo Starting backend server at http://localhost:8000 ...
start "GLP Forms Backend" cmd /c "cd backend && venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

REM Start frontend
echo Starting frontend dev server at http://localhost:5173 ...
start "GLP Forms Frontend" cmd /c "cd frontend && npx vite --host 0.0.0.0"

echo.
echo ======================================
echo   GLP Forms is starting!
echo   Backend:  http://localhost:8000
echo   API Docs: http://localhost:8000/docs
echo   Frontend: http://localhost:5173
echo.
echo   Demo Credentials:
echo     admin      / password123  (Administrator)
echo     researcher1 / password123 (Research User)
echo     reviewer1   / password123 (Reviewer)
echo     approver1   / password123 (Approver)
echo.
echo   Press any key to stop all servers...
echo ======================================
pause >nul

REM Cleanup
taskkill /FI "WindowTitle eq GLP Forms Backend*" /T /F 2>nul
taskkill /FI "WindowTitle eq GLP Forms Frontend*" /T /F 2>nul
echo Servers stopped.
