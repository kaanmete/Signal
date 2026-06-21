@echo off
cd /d "%~dp0"
echo Starting Deepfake Forensic Analysis Engine...
python launcher.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Failed to start launcher. Make sure Python is installed and in PATH.
    pause
)
