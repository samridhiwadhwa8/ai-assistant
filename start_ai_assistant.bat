@echo off
title AI Assistant - Starting...
echo Starting AI Assistant Backend...
cd /d "C:\Users\samridhi wadhwa\llm"
start /B python test_server.py
echo Starting Ollama...
start /B ollama serve
echo AI Assistant is now running in background!
timeout /t 3 >nul
exit
