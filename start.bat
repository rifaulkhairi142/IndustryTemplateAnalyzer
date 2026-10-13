@echo off
echo ========================================================
echo Starting Web Excel Formula Intelligence Fullstack
echo ========================================================
start cmd /k "run_backend.bat"
start cmd /k "run_frontend.bat"
echo Backend running on http://localhost:8000
echo Frontend running on http://localhost:5173
