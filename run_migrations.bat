@echo off
echo ========================================================
echo  Excel Analyst - Menjalankan Migrasi Database PostgreSQL
echo ========================================================
cd /d "%~dp0"
call .\venv\Scripts\activate
python migrate.py up
pause
