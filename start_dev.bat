@echo off
echo 🚀 Starting LearNnEarn Ecosystem...

:: Start Backend in a new window
echo 📡 Starting Backend (v2) on port 8000...
start cmd /k "cd backend_v2 && ..\venv_v2\Scripts\python.exe -m uvicorn main:app --reload --port 8000 --host 0.0.0.0"

:: Start Frontend in the current window
echo 🎨 Starting Frontend on port 3001...
cd frontend
npm run dev
