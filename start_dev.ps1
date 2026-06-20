# LearNnEarn Unified Dev Startup
# Starts both Backend (FastAPI) and Frontend (Next.js)

Write-Host "[Start] Starting LearNnEarn Ecosystem..." -ForegroundColor Cyan

# 1. Start Backend in a new window
Write-Host "[Backend] Starting Backend (v2) on port 8000..." -ForegroundColor Yellow
# Cleanup port 8000 if occupied
$p8000 = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
if ($p8000) { Stop-Process -Id $p8000.OwningProcess -Force -ErrorAction SilentlyContinue }

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend_v2; ..\venv_v2\Scripts\python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"

# 2. Start Frontend in the current window
Write-Host "[Frontend] Starting Frontend on port 3001..." -ForegroundColor Green
Set-Location frontend
npm run dev
