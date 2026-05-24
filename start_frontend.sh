#!/bin/bash

# Navigate to script directory
cd "$(dirname "$0")"

echo "========================================="
echo "   CFA TUTOR AI FRONTEND INITIALIZER     "
echo "========================================="

# 1. Enter frontend directory
cd frontend

# 2. Run npm dev server
echo "--> Starting Vite dev server..."
npm run dev
