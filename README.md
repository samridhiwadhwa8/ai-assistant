**Multimodal Local LLM AI Assistant**

A privacy-focused multimodal AI assistant that runs locally using Ollama.
Supports voice input, screen OCR, contextual chat, and browser extension integration.

Runs fully locally without external APIs.

**Features**

Local LLM using Ollama

Voice Interaction

Screen OCR

Context-aware Chat

Real-time Streaming (SSE)

Browser Extension Support

Autonomous Context Awareness

Local Memory

Privacy Focused (No API Keys)

**Tech Stack**

Frontend

React

TailwindCSS

Backend

Python

FastAPI

SSE Streaming

AI

Ollama (LLaMA3)

SpeechRecognition

Tesseract OCR

Platform

Chrome Extension

Windows Background Service

**Installation**
1. Install Python

Install Python 3.10+

Check installation:

python --version
**2. Install Ollama**

Download:

https://ollama.com/download

Pull model:

ollama pull llama3

Check installation:

ollama list
**3. Install Tesseract OCR**

Install from:

https://github.com/UB-Mannheim/tesseract/wiki

Default path:

C:\Program Files\Tesseract-OCR
**4. Install FFmpeg**

Download:

https://ffmpeg.org/download.html

Extract and add to system path.

**5. Install Python Dependencies**

Inside project folder:

pip install fastapi uvicorn ollama pytesseract pyautogui pillow numpy opencv-python speechrecognition pydub mss
Running the Assistant
Automatic Start (Recommended)

Double click:

start_ai_assistant.bat

This starts:

FastAPI backend

Ollama server

Test Backend

Open browser:

http://localhost:8000/test

Expected output:

Server is accessible
Start Frontend
cd frontend
npm install
npm start

Open:

http://localhost:3001
Browser Extension Setup

**Open Chrome:**

chrome://extensions

Enable:

Developer Mode

Click:

Load Unpacked

Select:

extension/

Extension will appear in toolbar.

How To Use
Step 1

Double click:

start_ai_assistant.bat
Step 2

Open:

http://localhost:3001
Step 3

Click:

Get Started

Assistant loads.

Voice Input

Click microphone button.

Speak normally.

Speech → Text → AI Response.

Screen Reading

Click:

Read Screen

Select:

Entire screen

Window

Tab

Text will be extracted using OCR.

Autonomous Context Detection

Assistant detects websites automatically.

Examples:

Amazon → Shopping suggestions

YouTube → Learning suggestions

GitHub → Coding suggestions

Background Service (Jarvis Mode)

Run once:

setup_autostart.bat

Assistant will start automatically when Windows starts.

Manual Start

Start backend:

python test_server.py

Start Ollama:

ollama serve

Start frontend:

npm start
Troubleshooting
Ollama Port Error
bind: Only one usage of each socket address permitted

Means Ollama is already running.

Safe to ignore.

Backend Not Running

Run:

python test_server.py
Ollama Not Running

Run:

ollama serve
