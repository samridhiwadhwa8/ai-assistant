from fastapi import FastAPI, HTTPException, Request, UploadFile, File, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import json
import logging
import time
import pytesseract
import pyautogui
import os
from PIL import Image, ImageDraw
import io
from typing import Optional, Dict, Any
import uuid
from ollama import AsyncClient
import asyncio
import speech_recognition as sr
import wave
import tempfile
import base64

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for conversation history
conversation_store = {}

# Persistence for conversation store
CONVERSATION_STORE_FILE = "conversation_store.json"

def load_conversation_store():
    global conversation_store
    try:
        if os.path.exists(CONVERSATION_STORE_FILE):
            with open(CONVERSATION_STORE_FILE, "r", encoding="utf-8") as f:
                conversation_store = json.load(f)
                logger.info(f"Loaded conversation store with {len(conversation_store)} sessions")
    except Exception as e:
        logger.warning(f"Could not load conversation store: {e}")

def save_conversation_store():
    try:
        with open(CONVERSATION_STORE_FILE, "w", encoding="utf-8") as f:
            json.dump(conversation_store, f)
    except Exception as e:
        logger.error(f"Failed to save conversation store: {e}")

# Load persisted conversations at startup
load_conversation_store()

# Initialize Ollama client (non-blocking)
try:
    ollama = AsyncClient(host='http://localhost:11434')
    logger.info("Ollama client initialized successfully")
except Exception as e:
    logger.error(f"Could not initialize Ollama client: {e}")
    ollama = None

def is_tesseract_available() -> bool:
    """Simple Tesseract availability check."""
    try:
        # Quick check without timeout
        pytesseract.get_tesseract_version()
        return True
    except Exception:
        return False

# Set Tesseract and ffmpeg paths for Windows
if os.name == 'nt':
    tesseract_path = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
    if os.path.exists(tesseract_path):
        pytesseract.pytesseract.tesseract_cmd = tesseract_path
        os.environ['PATH'] = r'C:\Program Files\Tesseract-OCR;' + os.environ['PATH']
    
    # Set ffmpeg path for Windows BEFORE importing pydub
    ffmpeg_path = r'C:\Users\samridhi wadhwa\Downloads\ffmpeg-release-essentials\ffmpeg-8.0.1-essentials_build\bin'
    if os.path.exists(ffmpeg_path):
        ffmpeg_exe = os.path.join(ffmpeg_path, 'ffmpeg.exe')
        os.environ['PATH'] = ffmpeg_path + ';' + os.environ.get('PATH', '')
        os.environ['FFMPEG_PATH'] = ffmpeg_exe
        logger.info(f"FFmpeg path set to: {ffmpeg_exe}")
    else:
        logger.error(f"FFmpeg path not found: {ffmpeg_path}")

# Now import pydub after setting the path
from pydub import AudioSegment
if os.name == 'nt' and 'ffmpeg_path' in locals() and os.path.exists(ffmpeg_path):
    AudioSegment.converter = os.path.join(ffmpeg_path, 'ffmpeg.exe')
    AudioSegment.ffmpeg = os.path.join(ffmpeg_path, 'ffmpeg.exe')
    logger.info(f"AudioSegment ffmpeg path set to: {os.path.join(ffmpeg_path, 'ffmpeg.exe')}")

def get_session_id(request: Request) -> str:
    """Get or create a session ID from the request headers or cookies, or generate a new one."""
    session_id = None
    # Prefer explicit header
    if request is not None:
        session_id = request.headers.get('X-Session-ID')
        if not session_id:
            # Fallback to cookie
            try:
                session_id = request.cookies.get('session_id')
            except Exception:
                session_id = None

    if not session_id:
        session_id = str(uuid.uuid4())
        logger.info(f"Generated new session ID: {session_id}")
    return session_id

# Intent detection function
def detect_intent(text: str) -> str:
    """
    Detect user intent based on keyword matching.
    Returns: 'CHAT', 'SCREEN', 'VOICE', 'UNKNOWN'
    """
    if not text or not isinstance(text, str):
        return 'UNKNOWN'
    
    text_lower = text.lower().strip()
    logger.info(f"Detecting intent for: '{text_lower}'")
    
    # Voice-related keywords (check first to be more specific)
    voice_keywords = [
        'talk to me', 'voice command', 'voice input', 'voice assistant',
        'start voice', 'activate voice', 'use voice', 'voice mode'
    ]
    
    # Voice deactivation keywords
    voice_deactivate_keywords = [
        'stop listening', 'stop voice', 'stop recording', 'voice off', 'microphone off',
        'deactivate voice', 'voice deactivate', 'stop talking'
    ]
    
    # Screen-related keywords (more specific to avoid false positives)
    screen_keywords = [
        'analyze screen', 'what\'s on my screen', 'what is on my screen',
        'screenshot', 'capture screen', 'analyze this page', 'what do you see',
        'look at my screen', 'read my screen', 'screen content',
        'what can you see', 'analyze my display', 'screen analysis'
    ]
    
    # Check for voice deactivation first (highest priority)
    for keyword in voice_deactivate_keywords:
        if keyword in text_lower:
            logger.info(f"Voice deactivation detected with keyword: '{keyword}'")
            return 'VOICE_DEACTIVATE'
    
    # Check for voice intent first (more specific)
    for keyword in voice_keywords:
        if keyword in text_lower:
            logger.info(f"Voice intent detected with keyword: '{keyword}'")
            return 'VOICE'
    
    # Check for screen intent
    for keyword in screen_keywords:
        if keyword in text_lower:
            logger.info(f"Screen intent detected with keyword: '{keyword}'")
            return 'SCREEN'
    
    # Default to chat if no specific intent detected
    if len(text_lower) > 0:
        logger.info(f"Chat intent detected (default)")
        return 'CHAT'
    
    logger.info(f"Unknown intent detected")
    return 'UNKNOWN'

async def analyze_image_with_chat(message: str, image_data: str, session_id: str):
    """
    Analyze image using LLM with vision capabilities.
    """
    try:
        if not ollama:
            return {
                "response": "AI model not available for image analysis.",
                "intent": "CHAT"
            }
        
        # Decode base64 image
        image_bytes = base64.b64decode(image_data)
        
        # Create conversation with image
        if session_id not in conversation_store:
            conversation_store[session_id] = []
        
        # Add user message to conversation
        conversation_store[session_id].append({
            "role": "user", 
            "content": message,
            "images": [image_bytes]
        })
        
        # Keep last 4 messages for context
        conversation_store[session_id] = conversation_store[session_id][-4:]
        
        try:
            # Get response from LLM with vision
            response = await ollama.chat(
                model='llama3',
                messages=conversation_store[session_id].copy()
            )
            
            ai_response = response['message']['content']
            
            # Add to conversation history (without image to save memory)
            conversation_store[session_id].append({
                "role": "assistant",
                "content": ai_response
            })
            
            return {
                "response": ai_response,
                "intent": "CHAT"
            }
            
        except Exception as e:
            logger.error(f"Image analysis LLM error: {e}")
            return {
                "response": f"Sorry, I had trouble analyzing that image: {str(e)}",
                "intent": "CHAT"
            }
            
    except Exception as e:
        logger.error(f"Image analysis error: {e}")
        return {
            "response": f"Error processing image: {str(e)}",
            "intent": "ERROR"
        }

@app.post("/chat")
async def chat_endpoint(request: Request):
    """
    Chat endpoint with intent detection.
    Routes to appropriate handler based on detected intent.
    Handles both form data and JSON with images.
    """
    try:
        session_id = get_session_id(request)
        
        # Check if request is JSON (for image analysis) or form data
        content_type = request.headers.get("content-type", "")
        
        if "application/json" in content_type:
            # Handle JSON request with image
            json_data = await request.json()
            message = json_data.get("message", "")
            image_data = json_data.get("image")
            
            logger.info(f"Chat JSON request received: {message}")
            
            # If image is provided, analyze it
            if image_data:
                logger.info("Processing image analysis request")
                return await analyze_image_with_chat(message, image_data, session_id)
        
        # Handle form data (original behavior)
        form_data = await request.form()
        message = form_data.get("message", "")
        
        logger.info(f"Chat message received: {message}")
        
        # Detect user intent
        intent = detect_intent(message)
        logger.info(f"Detected intent: {intent}")
        
        # Route to appropriate handler based on intent
        if intent == 'SCREEN':
            logger.info("Routing to screen analysis")
            # Call analyze_screen with the message as question
            return await analyze_screen(request, question=message)
        
        elif intent == 'VOICE':
            logger.info("Routing to voice pipeline")
            # For voice intent, return instructions to start voice recording
            return {
                "response": "🎤 Voice mode activated! I'm now listening... Speak clearly and I'll respond. Say 'stop listening' or 'stop voice' to deactivate.",
                "intent": intent,
                "voice_mode": True
            }
        
        elif intent == 'VOICE_DEACTIVATE':
            logger.info("Deactivating voice mode")
            return {
                "response": "🔇 Voice mode deactivated. You can now type messages or say 'talk to me' to activate voice again.",
                "intent": intent,
                "voice_mode": False
            }
        
        elif intent == 'CHAT':
            logger.info("Routing to normal chat")
            # Normal chat processing with LLM
            if session_id not in conversation_store:
                conversation_store[session_id] = []
            
            # Add user message to conversation
            conversation_store[session_id].append({
                "role": "user", 
                "content": message
            })
            
            # Keep last 4 messages for context
            conversation_store[session_id] = conversation_store[session_id][-4:]
            
            if not ollama:
                return {
                    "response": f"AI model not available. Message: {message}",
                    "intent": intent
                }
            
            try:
                # Get response from LLM
                response = await ollama.chat(
                    model='llama3',
                    messages=conversation_store[session_id].copy()
                )
                
                ai_response = response['message']['content']
                
                # Add to conversation history
                conversation_store[session_id].append({
                    "role": "assistant",
                    "content": ai_response
                })
                
                return {
                    "response": ai_response,
                    "intent": intent
                }
                
            except Exception as e:
                logger.error(f"Chat LLM error: {e}")
                return {
                    "response": f"Sorry, I had trouble processing that: {str(e)}",
                    "intent": intent
                }
        
        else:  # UNKNOWN intent
            logger.info("Unknown intent, returning default response")
            return {
                "response": "I'm not sure what you're asking for. You can ask me to analyze your screen, use voice commands, or just chat normally!",
                "intent": intent
            }
            
    except Exception as e:
        logger.error(f"Chat endpoint error: {e}")
        return {
            "response": f"Sorry, there was an error processing your request: {str(e)}",
            "intent": "ERROR"
        }

@app.get("/chat")
async def chat(question: str, request: Request):
    session_id = get_session_id(request)
    
    # Get or create conversation history for this session
    if session_id not in conversation_store:
        conversation_store[session_id] = []
    
    # Add user message to conversation history
    user_message = {"role": "user", "content": question}
    conversation_store[session_id].append(user_message)
    
    # Keep only the last 4 messages (2 exchanges) to maintain context
    conversation_store[session_id] = conversation_store[session_id][-4:]
    
    # Create a streaming response
    async def event_generator():
        try:
            # Prepare the conversation history for the model
            messages = conversation_store[session_id].copy()
            
            # Generate response using Ollama
            response = await ollama.chat(
                model='llama3',  
                messages=messages,
                stream=True
            )
            
            # Stream the response
            assistant_message = ""
            async for chunk in response:
                if chunk and hasattr(chunk, 'message') and hasattr(chunk.message, 'content'):
                    content = chunk.message.content
                    if content:
                        # Escape special characters for JSON
                        escaped_content = content.replace('"', '\\"').replace('\n', '\\n')
                        assistant_message += content
                        # Send each chunk to the client
                        yield f"data: {{\"chunk\": \"{escaped_content}\"}}\n\n"
            
            # Add the complete assistant message to conversation history
            if assistant_message:
                conversation_store[session_id].append({
                    "role": "assistant", 
                    "content": assistant_message
                })
            
        except Exception as e:
            error_msg = f"Error generating response: {str(e)}"
            logger.error(error_msg)
            yield f"data: {{\"chunk\": \"{error_msg}\"}}\n\n"
    
    response = StreamingResponse(
        event_generator(),
        media_type="text/event-stream"
    )
    response.headers["X-Session-ID"] = session_id
    return response

@app.post("/capture-screen")
async def capture_screen(exclude_area: Optional[Dict[str, int]] = None, request: Request = None, response: Response = None):
    try:
        session_id = get_session_id(request) if request else "default"
        # Return session id so client can persist it
        try:
            if response is not None:
                response.headers["X-Session-ID"] = session_id
                response.set_cookie("session_id", session_id, httponly=True)
        except Exception:
            pass
        
        if not is_tesseract_available():
            raise HTTPException(
                status_code=500,
                detail="Tesseract OCR is not installed or not in system PATH"
            )

        # Take screenshot
        screenshot = pyautogui.screenshot()
        
        # If exclude_area is provided, blank out that region
        if exclude_area:
            draw = ImageDraw.Draw(screenshot)
            draw.rectangle(
                [
                    (exclude_area['x'], exclude_area['y']),
                    (exclude_area['x'] + exclude_area['width'], 
                     exclude_area['y'] + exclude_area['height'])
                ],
                fill='black'
            )
        
        # Fast OCR processing
        # Convert to grayscale only
        screenshot = screenshot.convert('L')
        
        # Use single fast OCR config
        text = pytesseract.image_to_string(screenshot, config='--oem 3 --psm 6 -l eng')
        
        # Basic cleanup only
        if text:
            import re
            text = re.sub(r'\s+', ' ', text.strip())
        else:
            text = ""
        
        # Add to conversation history
        if session_id not in conversation_store:
            conversation_store[session_id] = []
        
        response_text = text.strip() or "No text was found on the screen."
        conversation_store[session_id].append({
            "role": "assistant",
            "content": f"Captured screen content: {response_text}"
        })
        # Persist conversation store
        save_conversation_store()
        
        return {"text": response_text}
        
    except Exception as e:
        logger.error(f"Error in capture_screen: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to capture or process screenshot: {str(e)}"
        )

@app.post("/process-screenshot")
async def process_screenshot(file: UploadFile = File(...), request: Request = None, response: Response = None):
    try:
        session_id = get_session_id(request) if request else "default"
        # Return session id so client can persist it
        try:
            if response is not None:
                response.headers["X-Session-ID"] = session_id
                response.set_cookie("session_id", session_id, httponly=True)
        except Exception:
            pass
        
        if not is_tesseract_available():
            raise HTTPException(
                status_code=500,
                detail="Tesseract OCR is not installed or not in system PATH"
            )

        # Read the uploaded file
        contents = await file.read()
        
        # Convert bytes to image
        image = Image.open(io.BytesIO(contents))

        import cv2
        import numpy as np


        # Convert PIL → OpenCV (handle RGBA/RGB/gray)
        open_cv_image = np.array(image)
        if open_cv_image.ndim == 3 and open_cv_image.shape[2] == 4:
            open_cv_image = cv2.cvtColor(open_cv_image, cv2.COLOR_RGBA2RGB)
        if open_cv_image.ndim == 3:
            open_cv_image = cv2.cvtColor(open_cv_image, cv2.COLOR_RGB2GRAY)

        # Upscale small images to help OCR
        h, w = open_cv_image.shape[:2]
        if max(w, h) < 800:
            scale = 2
            open_cv_image = cv2.resize(open_cv_image, (w * scale, h * scale), interpolation=cv2.INTER_CUBIC)

        # Improve local contrast using CLAHE
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        open_cv_image = clahe.apply(open_cv_image)

        # Light blur to reduce small noise
        open_cv_image = cv2.GaussianBlur(open_cv_image, (3, 3), 0)

        # Use adaptive thresholding (better with mixed lighting) or Otsu as fallback
        try:
            open_cv_image = cv2.adaptiveThreshold(open_cv_image, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                                  cv2.THRESH_BINARY, 11, 2)
        except Exception:
            _, open_cv_image = cv2.threshold(open_cv_image, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        # Optional median blur to clean small speckles
        open_cv_image = cv2.medianBlur(open_cv_image, 3)

        # Convert back to PIL
        image = Image.fromarray(open_cv_image)

        # Force English OCR
        custom_config = r'--oem 3 --psm 6 -l eng'
        text = pytesseract.image_to_string(image, config=custom_config)
        
        # Add to conversation history
        if session_id not in conversation_store:
            conversation_store[session_id] = []
        
        response_text = text.strip() or "No text was found in the image."
        conversation_store[session_id].append({
            "role": "assistant",
            "content": f"Processed screenshot: {response_text}"
        })
        # Persist conversation store
        save_conversation_store()
        
        return {"text": response_text}
        
    except Exception as e:
        logger.error(f"Error in process_screenshot: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process screenshot: {str(e)}"
        )

@app.get("/test")
async def test_endpoint():
    """Simple test endpoint to verify server is accessible"""
    logger.info("Test endpoint called")
    return {"message": "Server is accessible"}

async def handle_screen_intent(text: str, session_id: str):
    """Handle screen analysis intent"""
    logger.info(f"Handling SCREEN intent: {text}")
    
    # Extract question from text (remove screen-related keywords)
    question = text.lower()
    screen_words = ["what's on my screen", "what is on my screen", "screen", "read screen", "analyze screen"]
    for word in screen_words:
        question = question.replace(word, "").strip()
    
    if not question:
        question = "What's on my screen?"
    
    # Call the analyze_screen logic
    try:
        # First capture the screen
        screenshot = pyautogui.screenshot()
        
        # Convert to grayscale for faster OCR
        screenshot = screenshot.convert('L')
        
        # Use better OCR settings to capture more text
        try:
            # Configure tesseract for better text extraction (less restrictive)
            custom_config = r'--oem 3 --psm 6 -l eng'
            # Resize image for better OCR (not too small)
            screenshot = screenshot.resize((screenshot.width // 2, screenshot.height // 2))
            screen_text = pytesseract.image_to_string(screenshot, config=custom_config)
            logger.info(f"OCR extracted text: '{screen_text[:300]}...'")  # Debug log
        except Exception as ocr_error:
            logger.error(f"OCR error: {ocr_error}")
            screen_text = ""
        
        # Add to conversation history
        if session_id not in conversation_store:
            conversation_store[session_id] = []
        
        # Create a more concise prompt to reduce processing time
        prompt = f"Screen: {screen_text[:500]}\n\nQ: {question}\n\nA:"
        
        # Add user message to conversation history
        conversation_store[session_id].append({
            "role": "user",
            "content": prompt
        })
        
        # Keep only the last 2 messages to reduce context size
        conversation_store[session_id] = conversation_store[session_id][-2:]
        
        # Generate response using Ollama
        response = await ollama.chat(
            model='llama3',  # Use tiny 0.5B parameter model (394 MB)
            messages=conversation_store[session_id].copy(),
            stream=True
        )
        
        # Stream the response
        async def generate():
            assistant_message = ""
            async for chunk in response:
                if chunk and hasattr(chunk, 'message') and hasattr(chunk.message, 'content'):
                    content = chunk.message.content
                    if content:
                        # Escape special characters for JSON
                        escaped_content = content.replace('"', '\\"').replace('\n', '\\n')
                        assistant_message += content
                        # Send each chunk to the client
                        yield f"data: {{\"chunk\": \"{escaped_content}\"}}\n\n"
                        await asyncio.sleep(0.001)  # Minimal delay for fastest streaming
            
            # Add the complete assistant message to conversation history
            if assistant_message:
                conversation_store[session_id].append({
                    "role": "assistant", 
                    "content": assistant_message
                })
        
        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={"X-Session-ID": session_id}
        )
            
    except Exception as e:
        logger.error(f"Error in handle_screen_intent: {str(e)}")
        async def error_stream():
            error_msg = f" Error analyzing screen: {str(e)}"
            escaped_msg = error_msg.replace('"', '\\"').replace('\n', '\\n')
            yield f"data: {{\"chunk\": \"{escaped_msg}\"}}\n\n"
        return StreamingResponse(
            error_stream(),
            media_type="text/event-stream",
            headers={"X-Session-ID": session_id}
        )

async def handle_chat_intent(text: str, session_id: str):
    """Handle normal chat intent"""
    logger.info(f"Handling CHAT intent: {text}")
    
    # Add to conversation history
    if session_id not in conversation_store:
        conversation_store[session_id] = []
    
    # Add user message to conversation history
    conversation_store[session_id].append({
        "role": "user",
        "content": text
    })
    
    # Keep only the last 4 messages (2 exchanges) to maintain context
    conversation_store[session_id] = conversation_store[session_id][-4:]
    
    # Generate response using Ollama
    response = await ollama.chat(
        model='llama3',  # Use tiny 0.5B parameter model (394 MB)
        messages=conversation_store[session_id].copy(),
        stream=True
    )
    
    # Stream the response
    async def generate():
        assistant_message = ""
        async for chunk in response:
            if chunk and hasattr(chunk, 'message') and hasattr(chunk.message, 'content'):
                content = chunk.message.content
                if content:
                    # Escape special characters for JSON
                    escaped_content = content.replace('"', '\\"').replace('\n', '\\n')
                    assistant_message += content
                    # Send each chunk to the client
                    yield f"data: {{\"chunk\": \"{escaped_content}\"}}\n\n"
        
        # Add the complete assistant message to conversation history
        if assistant_message:
            conversation_store[session_id].append({
                "role": "assistant", 
                "content": assistant_message
            })
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"X-Session-ID": session_id}
    )

async def handle_chat_intent(text: str, session_id: str):
    """Handle normal chat intent"""
    logger.info(f"Handling CHAT intent: {text}")
    
    # Add to conversation history
    if session_id not in conversation_store:
        conversation_store[session_id] = []
    
    # Add user message to conversation history
    conversation_store[session_id].append({
        "role": "user",
        "content": text
    })
    
    # Keep only the last 4 messages (2 exchanges) to maintain context
    conversation_store[session_id] = conversation_store[session_id][-4:]
    
    # Generate response using Ollama
    response = await ollama.chat(
        model='llama3',  # Use tiny 0.5B parameter model (394 MB)
        messages=conversation_store[session_id].copy(),
        stream=True
    )
    
    # Stream the response
    async def generate():
        assistant_message = ""
        async for chunk in response:
            if chunk and hasattr(chunk, 'message') and hasattr(chunk.message, 'content'):
                content = chunk.message.content
                if content:
                    # Escape special characters for JSON
                    escaped_content = content.replace('"', '\\"').replace('\n', '\\n')
                    assistant_message += content
                    # Send each chunk to the client
                    yield f"data: {{\"chunk\": \"{escaped_content}\"}}\n\n"
        
        # Add the complete assistant message to conversation history
        if assistant_message:
            conversation_store[session_id].append({
                "role": "assistant", 
                "content": assistant_message
            })
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"X-Session-ID": session_id}
    )

@app.post("/voice-to-text")
async def voice_to_text(request: Request):
    """
    Receives audio data, converts it to text using speech recognition,
    and processes it through the chat pipeline
    """
    logger.info("Voice-to-text endpoint called")
    try:
        session_id = get_session_id(request)
        logger.info(f"Session ID: {session_id}")
        
        # Get the audio data from the request
        logger.info("Parsing request body...")
        body = await request.json()
        audio_data = body.get("audio")
        logger.info(f"Audio data received: {len(audio_data) if audio_data else 0} characters")
        
        if not audio_data:
            logger.error("No audio data provided")
            raise HTTPException(
                status_code=400,
                detail="No audio data provided"
            )
        
        # Decode base64 audio data
        audio_bytes = base64.b64decode(audio_data)
        
        # Save to temporary file with webm extension
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as temp_file:
            temp_file.write(audio_bytes)
            temp_file_path = temp_file.name
        
        try:
            # Initialize recognizer
            recognizer = sr.Recognizer()
            
            # Try to use the audio file directly
            # SpeechRecognition might be able to handle webm in some cases
            try:
                logger.info(f"Attempting to read audio file directly: {temp_file_path}")
                with sr.AudioFile(temp_file_path) as source:
                    # Record the audio from the file
                    audio = recognizer.record(source)
                logger.info("Successfully read audio file directly")
            except Exception as e:
                logger.error(f"Error reading audio file: {str(e)}")
                # If direct reading fails, try to convert using ffmpeg
                try:
                    import subprocess
                    wav_path = temp_file_path.replace('.webm', '.wav')
                    # Use full path to ffmpeg
                    ffmpeg_exe = os.path.join(ffmpeg_path, 'ffmpeg.exe')
                    logger.info(f"Converting audio using ffmpeg: {temp_file_path} -> {wav_path}")
                    # Use ffmpeg with ultra-fast settings
                    result = subprocess.run([
                        ffmpeg_exe, '-i', temp_file_path, 
                        '-ar', '8000',   # Lower sample rate for faster processing
                        '-ac', '1',      # Mono channel
                        '-b:a', '32k',   # Low bitrate
                        '-f', 'wav',     # Force wav format
                        '-y',            # Overwrite output file
                        wav_path
                    ], capture_output=True, text=True, timeout=10)  # 10 second timeout
                    
                    if result.returncode != 0:
                        logger.error(f"FFmpeg error: {result.stderr}")
                        raise Exception(f"FFmpeg conversion failed: {result.stderr}")
                    
                    logger.info("FFmpeg conversion successful")
                    with sr.AudioFile(wav_path) as source:
                        audio = recognizer.record(source)
                    os.unlink(wav_path)
                except subprocess.TimeoutExpired:
                    logger.error("FFmpeg conversion timed out")
                    # Try direct recognition without conversion
                    try:
                        logger.info("Attempting direct recognition without conversion")
                        with sr.AudioFile(temp_file_path) as source:
                            audio = recognizer.record(source)
                        text = recognizer.recognize_google(audio)
                        logger.info("Direct recognition successful")
                    except:
                        raise HTTPException(
                            status_code=408,
                            detail="Audio processing timed out. Please try a shorter recording."
                        )
                except Exception as conversion_error:
                    logger.error(f"Audio conversion failed: {str(conversion_error)}")
                    raise HTTPException(
                        status_code=500,
                        detail=f"Failed to convert audio: {str(conversion_error)}"
                    )
                
            # Recognize speech using Google's free speech recognition
            try:
                # Try Google's speech recognition first
                logger.info("Attempting Google speech recognition")
                text = recognizer.recognize_google(audio)
                logger.info("Google speech recognition successful")
            except sr.UnknownValueError:
                # If Google fails, try Sphinx (offline)
                try:
                    text = recognizer.recognize_sphinx(audio)
                except:
                    text = "Could not understand audio"
            except sr.RequestError:
                # If there's a network error, try Sphinx
                try:
                    text = recognizer.recognize_sphinx(audio)
                except:
                    text = "Speech recognition service unavailable"
            except Exception as e:
                logger.error(f"Speech recognition error: {str(e)}")
                text = "Could not understand audio"
            
            # Clean up temporary file
            try:
                os.unlink(temp_file_path)
            except:
                # File might still be in use, Windows will clean it up eventually
                logger.warning(f"Could not delete temporary file {temp_file_path}")
                pass
            
            # Now process the transcribed text as normal chat (no intent detection)
            if text and text not in ["Could not understand audio", "Speech recognition service unavailable"]:
                logger.info(f"Transcribed text: {text}")
                
                # Handle as normal chat
                return await handle_chat_intent(text, session_id)
            else:
                # Return error if speech recognition failed
                # Properly escape the error message for JSON
                escaped_text = text.replace('"', '\\"').replace('\n', '\\n')
                async def error_stream():
                    yield f"data: {{\"chunk\": \"{escaped_text}\"}}\n\n"
                return StreamingResponse(
                    error_stream(),
                    media_type="text/event-stream",
                    headers={"X-Session-ID": session_id}
                )
                
        except Exception as e:
            # Clean up temporary file if it exists
            try:
                if os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)
            except:
                # File might still be in use, Windows will clean it up eventually
                logger.warning(f"Could not delete temporary file {temp_file_path}")
                pass
            raise e
            
    except Exception as e:
        logger.error(f"Error in voice_to_text: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process voice input: {str(e)}"
        )

@app.post("/analyze-screen")
async def analyze_screen(request: Request, question: str = "What's on my screen?", url: str = ""):
    try:
        session_id = get_session_id(request)
        logger.info(f"Analyzing screen with question: {question}, URL: {url}")
        
        # Get screen dimensions
        screen_width, screen_height = pyautogui.size()
        
        # Calculate main content area (exclude browser tabs but include right side with recommendations)
        # Exclude top 120px (browser tabs/address bar)
        # Include full width to capture video recommendations on right
        # Exclude bottom 100px (taskbar/browser bottom)
        
        # Take screenshot of main content area including right sidebar
        content_region = (
            0,                          # left
            120,                        # top (skip browser chrome)
            screen_width,               # right (full width to include recommendations)
            screen_height - 100         # bottom (skip taskbar)
        )
        
        logger.info(f"Capturing content region: {content_region}")
        screenshot = pyautogui.screenshot(region=content_region)
        
        # Check if Tesseract is available
        if not is_tesseract_available():
            raise HTTPException(
                status_code=500,
                detail="Tesseract OCR is not installed or not in PATH"
            )
        
        # Save debug screenshot to see what we're capturing
        screenshot.save("debug_content_area.png")
        logger.info("Saved debug screenshot as debug_content_area.png")
        
        # Convert to grayscale for better OCR
        screenshot = screenshot.convert('L')
        
        # Try multiple OCR configurations
        all_text = []
        configs = [
            '--oem 3 --psm 6 -l eng',  # Uniform block of text
            '--oem 3 --psm 3 -l eng',  # Fully automatic page segmentation
        ]
        
        for config in configs:
            try:
                text = pytesseract.image_to_string(screenshot, config=config)
                if text and text.strip():
                    all_text.append(text.strip())
                    logger.info(f"OCR with {config}: {len(text)} chars extracted")
            except Exception as e:
                logger.error(f"OCR failed with {config}: {e}")
                continue
        
        # Get the longest OCR result
        if all_text:
            screen_text = max(all_text, key=len)
            
            # Clean up noise and make text more readable
            import re
            
            # Remove browser UI patterns
            noise_patterns = [
                r'^\s*[\|x\+\-=€@%]+\s*$',  # Lines with only symbols
                r'^\s*[A-Z]{1,2}\s*$',       # Single letters (tabs shortcuts)
                r'www\.\w+\.\w+',            # URLs in address bar
                r'youtube\.com/watch\?v=\w+', # YouTube URLs
                r'Inbox\s*\(\d+\)',          # Email counts
                r'Extensions?',               # Browser extensions
                r'Related|For you',          # YouTube sidebar
                r'Learn more|Sponsored',     # Ads
                r'ScreenAl Assistant',       # Our own interface
                r'Hello! I\'m your',         # Our chat messages
                r'^[vB]$',                   # Random letters
                r'Try clicking.*Voice.*talk to me',  # Our UI text
                r'Upload Screen.*Analyze',   # Our UI text
            ]
            
            lines = screen_text.split('\n')
            clean_lines = []
            
            for line in lines:
                line = line.strip()
                
                # Skip if line matches noise patterns
                is_noise = False
                for pattern in noise_patterns:
                    if re.search(pattern, line, re.IGNORECASE):
                        is_noise = True
                        break
                
                # Keep lines with substantial content (3+ words or 20+ chars)
                if not is_noise and (len(line.split()) >= 3 or len(line) >= 20):
                    # Clean up fragmented text
                    # Fix common OCR issues
                    line = re.sub(r'\s*[-–_]\s*', ' - ', line)  # Normalize dashes
                    line = re.sub(r'\s*\|\s*', ' ', line)      # Remove vertical bars
                    line = re.sub(r'\s*\.\s*', '. ', line)    # Fix periods
                    line = re.sub(r'\s+', ' ', line)          # Normalize spaces
                    line = line.strip()
                    
                    # Fix capitalization for song titles
                    if len(line.split()) >= 3:
                        words = line.split()
                        # Capitalize first letter of each word for titles
                        fixed_words = []
                        for word in words:
                            if len(word) > 2 and word.isupper():
                                fixed_words.append(word.title())
                            else:
                                fixed_words.append(word)
                        line = ' '.join(fixed_words)
                    
                    clean_lines.append(line)
            
            screen_text = '\n'.join(clean_lines)
            
            # Further cleanup
            screen_text = re.sub(r'\n{3,}', '\n\n', screen_text)
            screen_text = re.sub(r' {2,}', ' ', screen_text)
            screen_text = screen_text.strip()
            
            logger.info(f"Cleaned OCR text length: {len(screen_text)} characters")
            logger.info(f"Cleaned OCR preview: {screen_text[:800]}")
        else:
            screen_text = ""
            logger.warning("No text extracted from screen")
        
        # Build prompt for LLM - detailed but optimized with URL context
        if screen_text and len(screen_text) > 50:
            # Detect website context from URL if available
            website_context = ""
            if url:
                from urllib.parse import urlparse
                parsed_url = urlparse(url)
                hostname = parsed_url.hostname.lower() if parsed_url.hostname else ""
                
                if 'leetcode.com' in hostname or 'hackerrank.com' in hostname or 'codeforces.com' in hostname:
                    website_context = "CODING PRACTICE PLATFORM - User is solving programming problems."
                elif 'github.com' in hostname or 'gitlab.com' in hostname:
                    website_context = "CODE REPOSITORY - User is reviewing code or documentation."
                elif 'stackoverflow.com' in hostname or 'stackexchange.com' in hostname:
                    website_context = "Q&A FORUM - User is looking for programming help."
                elif 'youtube.com' in hostname or 'vimeo.com' in hostname:
                    website_context = "VIDEO PLATFORM - User is watching educational content."
                elif 'wikipedia.org' in hostname or 'docs.' in hostname:
                    website_context = "DOCUMENTATION - User is reading technical documentation."
                elif 'coursera.org' in hostname or 'udemy.com' in hostname:
                    website_context = "E-LEARNING - User is taking an online course."
                else:
                    website_context = "GENERAL WEBSITE"
            
            # Check if user is asking for song recommendations
            if "song" in question.lower() and ("next" in question.lower() or "listen" in question.lower()):
                logger.info(f"Song recommendation detected! Question: {question}")
                # Extract song titles for intelligent fallback - faster processing
                import re
                song_pattern = r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*[-–]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)'
                songs_found = re.findall(song_pattern, screen_text[:500])  # Limit to first 500 chars for speed
                logger.info(f"Songs found by regex: {songs_found}")
                
                if songs_found:
                    song_list = [f"{artist} - {title}" for artist, title in songs_found[:5]]  # Back to 5 songs
                    fallback_recommendation = f"Based on the songs I can see on your screen, I recommend:\n\n" + "\n".join([f"• {song}" for song in song_list]) + "\n\nThese are the top recommendations from your YouTube sidebar!"
                    logger.info(f"Generated fallback: {fallback_recommendation}")
                else:
                    fallback_recommendation = f"I can see several music videos on your screen. From what I can read: {screen_text[:300]}..."
            else:
                fallback_recommendation = f"I can see this content on your screen: {screen_text[:600]}..."
            
            # Enhanced prompt with URL context
            prompt = f"""You are analyzing the MAIN CONTENT of a user's screen with additional context.

WEBSITE CONTEXT: {website_context}
CURRENT URL: {url}

MAIN CONTENT VISIBLE:
{screen_text[:500]}  # Reasonable limit for speed

USER QUESTION: {question}

Based on the content and website context above, provide a helpful and specific response:

If on CODING PLATFORMS (LeetCode, HackerRank):
- Recognize the specific programming problem
- Provide algorithm explanations
- Give code solutions with time/space complexity
- Suggest optimization approaches

If on CODE REPOSITORIES (GitHub, GitLab):
- Explain the code structure
- Help with code review
- Suggest improvements

If on VIDEO PLATFORMS (YouTube):
- Summarize video content
- Answer questions about the topic
- Provide additional resources

If on DOCUMENTATION:
- Explain technical concepts
- Provide examples
- Suggest related topics

For general content:
- Identify what they're viewing
- Explain the main topic
- Answer their specific question

Be specific, detailed, and actionable!"""
        else:
            prompt = f"The main content area appears to be mostly visual (images/video) with minimal text, or the content could not be extracted clearly. Question: {question}"
            fallback_recommendation = "I can see music video content but the text extraction is limited. Try checking the video titles visible in your YouTube recommendations."
        
        # Add to conversation history
        if session_id not in conversation_store:
            conversation_store[session_id] = []
        
        conversation_store[session_id].append({
            "role": "user",
            "content": prompt
        })
        
        conversation_store[session_id] = conversation_store[session_id][-4:]
        
        # Get AI response
        if not ollama:
            return {
                "analysis": f"AI model not available. Content text: {screen_text[:500]}",
                "raw_text": screen_text
            }
        
        try:
            # Get response from LLM with streaming
            response = await ollama.chat(
                model='llama3',
                messages=conversation_store[session_id].copy(),
                stream=True
            )
            
            async def generate():
                assistant_message = ""
                try:
                    async for chunk in response:
                        if chunk and hasattr(chunk, 'message') and hasattr(chunk.message, 'content'):
                            content = chunk.message.content
                            if content:
                                escaped_content = content.replace('"', '\\"').replace('\n', '\\n')
                                assistant_message += content
                                yield f"data: {{\"chunk\": \"{escaped_content}\"}}\n\n"
                                await asyncio.sleep(0.001)
                    
                    if assistant_message:
                        conversation_store[session_id].append({
                            "role": "assistant",
                            "content": assistant_message
                        })
                    else:
                        # Fallback if no content generated
                        fallback_msg = f"I can see this content on your screen: {screen_text[:400]}..."
                        escaped_msg = fallback_msg.replace('"', '\\"').replace('\n', '\\n')
                        yield f"data: {{\"chunk\": \"{escaped_msg}\"}}\n\n"
                        
                except Exception as stream_error:
                    logger.error(f"Streaming error: {stream_error}")
                    fallback_msg = f"Error generating response. Here's what I can see: {screen_text[:400]}..."
                    escaped_msg = fallback_msg.replace('"', '\\"').replace('\n', '\\n')
                    yield f"data: {{\"chunk\": \"{escaped_msg}\"}}\n\n"
            
            return StreamingResponse(
                generate(),
                media_type="text/event-stream",
                headers={"X-Session-ID": session_id}
            )
                
        except Exception as ai_error:
            logger.error(f"AI processing error: {ai_error}")
            if screen_text:
                return {
                    "analysis": fallback_recommendation,
                    "raw_text": screen_text
                }
            else:
                return {
                    "analysis": "The content appears to be primarily visual (video/images) with little readable text.",
                    "raw_text": ""
                }
    
    except Exception as e:
        logger.error(f"Error in analyze_screen: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to analyze screen: {str(e)}"
        )

# Updated handle_screen_intent with same improvements
async def handle_screen_intent(text: str, session_id: str):
    """Handle screen analysis intent from voice or text"""
    logger.info(f"Handling SCREEN intent: {text}")
    
    question = text.lower()
    screen_words = ["what's on my screen", "what is on my screen", "screen", "read screen", "analyze screen", "what am i looking at", "what am i watching", "what's this"]
    for word in screen_words:
        question = question.replace(word, "").strip()
    
    if not question:
        question = "What's on my screen? Describe the main content."
    
    try:
        # Get screen dimensions
        screen_width, screen_height = pyautogui.size()
        
        # Capture main content area (include full width for recommendations)
        content_region = (
            0,
            120,
            screen_width,               # full width to include right sidebar
            screen_height - 100
        )
        
        screenshot = pyautogui.screenshot(region=content_region)
        screenshot = screenshot.convert('L')
        
        # OCR
        custom_config = r'--oem 3 --psm 3 -l eng'
        screen_text = pytesseract.image_to_string(screenshot, config=custom_config)
        
        # Clean up noise
        import re
        noise_patterns = [
            r'^\s*[\|x\+\-=€@%]+\s*$',
            r'www\.\w+\.\w+',
            r'Inbox\s*\(\d+\)',
            r'Extensions?',
            r'Related|For you',
            r'ScreenAl Assistant',
        ]
        
        lines = screen_text.split('\n')
        clean_lines = [
            line.strip() for line in lines 
            if len(line.strip()) > 30 and not any(re.search(p, line, re.IGNORECASE) for p in noise_patterns)
        ]
        
        screen_text = '\n'.join(clean_lines)
        screen_text = re.sub(r'\n{3,}', '\n\n', screen_text).strip()
        
        logger.info(f"OCR extracted {len(screen_text)} characters from content area")
        
        if not screen_text or len(screen_text) < 30:
            screen_text = "Mostly visual content (video/images) with minimal text visible"
        
        prompt = f"""MAIN SCREEN CONTENT:
{screen_text}

QUESTION: {question}

Describe what the user is viewing/watching based on the content above. Be specific about titles, topics, and activities."""
        
        if session_id not in conversation_store:
            conversation_store[session_id] = []
        
        conversation_store[session_id].append({"role": "user", "content": prompt})
        conversation_store[session_id] = conversation_store[session_id][-4:]
        
        try:
            if not ollama:
                # Fallback if Ollama not available
                async def fallback_stream():
                    fallback_msg = f"AI model not available. Based on the content I can see: {screen_text[:300]}..."
                    escaped_msg = fallback_msg.replace('"', '\\"').replace('\n', '\\n')
                    yield f"data: {{\"chunk\": \"{escaped_msg}\"}}\n\n"
                
                return StreamingResponse(
                    fallback_stream(),
                    media_type="text/event-stream",
                    headers={"X-Session-ID": session_id}
                )
            
            response = await ollama.chat(
                model='llama3',
                messages=conversation_store[session_id].copy(),
                stream=True
            )
            
            async def generate():
                assistant_message = ""
                try:
                    async for chunk in response:
                        if chunk and hasattr(chunk, 'message') and hasattr(chunk.message, 'content'):
                            content = chunk.message.content
                            if content:
                                escaped_content = content.replace('"', '\\"').replace('\n', '\\n')
                                assistant_message += content
                                yield f"data: {{\"chunk\": \"{escaped_content}\"}}\n\n"
                                await asyncio.sleep(0.001)
                    
                    if assistant_message:
                        conversation_store[session_id].append({
                            "role": "assistant",
                            "content": assistant_message
                        })
                    else:
                        # Fallback if no content generated
                        fallback_msg = f"I can see this content on your screen: {screen_text[:400]}..."
                        escaped_msg = fallback_msg.replace('"', '\\"').replace('\n', '\\n')
                        yield f"data: {{\"chunk\": \"{escaped_msg}\"}}\n\n"
                        
                except Exception as stream_error:
                    logger.error(f"Streaming error: {stream_error}")
                    fallback_msg = f"Error generating response. Here's what I can see: {screen_text[:400]}..."
                    escaped_msg = fallback_msg.replace('"', '\\"').replace('\n', '\\n')
                    yield f"data: {{\"chunk\": \"{escaped_msg}\"}}\n\n"
            
            return StreamingResponse(
                generate(),
                media_type="text/event-stream",
                headers={"X-Session-ID": session_id}
            )
            
        except Exception as ai_error:
            logger.error(f"AI processing error: {ai_error}")
            async def ai_error_stream():
                error_msg = f"AI processing error: {str(ai_error)}. Here's what I can see: {screen_text[:400]}..."
                escaped_msg = error_msg.replace('"', '\\"').replace('\n', '\\n')
                yield f"data: {{\"chunk\": \"{escaped_msg}\"}}\n\n"
            
            return StreamingResponse(
                ai_error_stream(),
                media_type="text/event-stream",
                headers={"X-Session-ID": session_id}
            )
        
    except Exception as e:
        logger.error(f"Error in handle_screen_intent: {str(e)}")
        
        async def error_stream():
            error_msg = f"Error analyzing screen: {str(e)}"
            escaped_msg = error_msg.replace('"', '\\"').replace('\n', '\\n')
            yield f"data: {{\"chunk\": \"{escaped_msg}\"}}\n\n"
        
        return StreamingResponse(
            error_stream(),
            media_type="text/event-stream",
            headers={"X-Session-ID": session_id}
        )

@app.get("/test-backend")
async def test_backend():
    """Simple test endpoint to verify backend is working"""
    try:
        # Test Ollama connection
        if ollama:
            try:
                response = await ollama.chat(
                    model='llama3',
                    messages=[{"role": "user", "content": "Say hello"}]
                )
                return {
                    "status": "Backend working",
                    "ollama": "Connected",
                    "response": response['message']['content'] if response and 'message' in response else "No response",
                    "ollama_client": str(type(ollama))
                }
            except Exception as ollama_error:
                return {
                    "status": "Backend working",
                    "ollama": "Connection failed",
                    "error": str(ollama_error),
                    "ollama_client": str(type(ollama)),
                    "suggestion": "Check if Ollama is running on localhost:11434"
                }
        else:
            return {
                "status": "Backend working",
                "ollama": "Not initialized",
                "error": "Ollama client is None",
                "suggestion": "Check Ollama installation and startup logs"
            }
    except Exception as e:
        return {
            "status": "Backend error",
            "ollama": "Unknown",
            "error": str(e),
            "ollama_exists": ollama is not None,
            "ollama_type": str(type(ollama)) if ollama else "None"
        }

@app.post("/debug-ocr")
async def debug_ocr():
    """
    Fast debug endpoint
    """
    try:
        screenshot = pyautogui.screenshot()
        screenshot.save("debug_screenshot.png")
        
        # Fast OCR processing
        screenshot = screenshot.convert('L')
        text = pytesseract.image_to_string(screenshot, config='--oem 3 --psm 6 -l eng')
        
        # Basic cleanup
        if text:
            import re
            screen_text = re.sub(r'\s+', ' ', text.strip())
        else:
            screen_text = ""
        
        return {
            "screenshot_saved": "debug_screenshot.png",
            "text": screen_text,
            "length": len(screen_text),
            "word_count": len(screen_text.split()) if screen_text else 0
        }
        
    except Exception as e:
        return {"error": str(e)}

@app.post("/search")
async def search_screen(query: str, request: Request):
    """
    Search for specific text/content on the screen
    """
    try:
        session_id = get_session_id(request)
        logger.info(f"Searching screen for: {query}")
        
        # Capture screen
        screenshot = pyautogui.screenshot()
        
        # Extract text using OCR
        try:
            custom_config = r'--oem 3 --psm 3 -l eng'
            screen_text = pytesseract.image_to_string(screenshot, config=custom_config)
            
            # Clean up text
            import re
            screen_text = re.sub(r'[^\w\s\.\,\?\!\:\;\-\(\)\[\]\{\}\"\'\/\\@#$%^&*+=<>', ' ', screen_text)
            screen_text = re.sub(r'\s+', ' ', screen_text).strip()
            
        except Exception as ocr_error:
            logger.error(f"OCR error: {ocr_error}")
            screen_text = ""
        
        # Search for the query in the extracted text
        search_results = []
        if screen_text and query:
            query_lower = query.lower()
            screen_text_lower = screen_text.lower()
            
            if query_lower in screen_text_lower:
                # Find context around the match
                words = screen_text.split()
                for i, word in enumerate(words):
                    if query_lower in word.lower():
                        # Get context (5 words before and after)
                        start = max(0, i - 5)
                        end = min(len(words), i + 6)
                        context = ' '.join(words[start:end])
                        search_results.append({
                            "found": True,
                            "context": context,
                            "position": i
                        })
        
        # Add to conversation history
        if session_id not in conversation_store:
            conversation_store[session_id] = []
        
        result = {
            "query": query,
            "found": len(search_results) > 0,
            "results": search_results,
            "full_text": screen_text[:1000] if screen_text else "No text found",
            "timestamp": time.time()
        }
        
        conversation_store[session_id].append({
            "role": "assistant",
            "content": f"Search for '{query}': {'Found' if result['found'] else 'Not found'}"
        })
        
        return result
        
    except Exception as e:
        logger.error(f"Search error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Search failed: {str(e)}"
        )

# CORS preflight for /chat
@app.options("/chat")
async def options_chat():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    if not is_tesseract_available():
        logger.warning("Tesseract OCR is not installed or not in system PATH. Screen capture will not work.")
    logger.info("Starting ScreenAI backend server...")
    uvicorn.run("test_server:app", host="0.0.0.0", port=8000, reload=True)