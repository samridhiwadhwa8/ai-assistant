@echo off
title AI Assistant - Auto-Start Setup
echo Setting up AI Assistant to start with Windows...
echo.
echo Creating scheduled task...
schtasks /create /tn "AI_Assistant" /trig "AtStartup" /sc ONSTART /ru "SYSTEM" /rl HIGHEST /f /tn "AI_Assistant" /tr "C:\Users\samridhi wadhwa\llm\start_ai_assistant.bat"
echo.
echo AI Assistant will now start automatically when Windows boots!
echo.
echo To remove this later, run: schtasks /delete /tn "AI_Assistant"
pause
