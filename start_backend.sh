#!/bin/bash

# Navigate to script directory
cd "$(dirname "$0")"

echo "========================================="
echo "   CFA TUTOR AI BACKEND INITIALIZER      "
echo "========================================="

# 1. Create .env if not exists
if [ ! -f .env ]; then
  echo "--> Copying .env.example to .env..."
  cp .env.example .env
  echo "⚠️  Created '.env'. Open it in an editor to add your API keys!"
fi

# 2. Setup Python virtual environment
if [ ! -d .venv ]; then
  echo "--> Creating Python virtual environment (.venv)..."
  python3 -m venv .venv
fi

# 3. Activate virtual environment
echo "--> Activating virtual environment..."
source .venv/bin/activate

# 4. Install backend dependencies
echo "--> Installing dependencies (this may take a minute)..."
pip install --upgrade pip
pip install -r backend/requirements.txt

# 5. Launch FastAPI server
echo "--> Starting FastAPI on http://localhost:8000..."
python3 -m uvicorn backend.app.main:app --reload --port 8000
