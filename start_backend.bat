@echo off
echo =========================================
echo    CFA TUTOR AI BACKEND INITIALIZER      
echo =========================================

REM 1. Create .env if not exists
if exist .env goto env_exists
echo -- Copying .env.example to .env...
copy .env.example .env
echo Created .env file.
:env_exists

REM 2. Setup Python virtual environment
if exist .venv goto venv_exists
echo -- Creating Python virtual environment (.venv)...
python -m venv .venv
:venv_exists

REM 3. Activate virtual environment
echo -- Activating virtual environment...
call .venv\Scripts\activate.bat

REM 4. Install backend dependencies
echo -- Installing dependencies (this may take a minute)...
python -m pip install --upgrade pip
pip install -r backend/requirements.txt

REM 5. Launch FastAPI server on 0.0.0.0 (listens on both IPv4 and IPv6 to prevent Windows localhost issues)
echo -- Starting FastAPI on http://localhost:8000...
python -m uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000
