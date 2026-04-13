@echo off
title MindEcho Launcher

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173') do taskkill /PID %%a /F >nul 2>&1

start "MindEcho Backend" cmd /k "cd /d C:\Users\diyaa\Desktop\mindecho\backend && call venv\Scripts\activate.bat && uvicorn main:app --reload"
start "MindEcho Frontend" cmd /k "cd /d C:\Users\diyaa\Desktop\mindecho\frontend && npm run dev"

timeout /t 8 >nul
start http://localhost:5173