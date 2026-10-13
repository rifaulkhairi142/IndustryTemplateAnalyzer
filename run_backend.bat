@echo off
echo ========================================================
echo Starting Web Excel Formula Intelligence - Backend
echo ========================================================
call .\venv\Scripts\activate.bat
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
