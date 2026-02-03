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

# Initialize Ollama client
ollama = AsyncClient(host='http://localhost:11434')

def is_tesseract_available() -> bool:
    """Check if Tesseract is installed and accessible."""
    try:
        pytesseract.get_tesseract_version()
        return True
    except pytesseract.TesseractNotFoundError:
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
        
        # Convert to grayscale for better OCR
        screenshot = screenshot.convert('L')
        
        # Use pytesseract to extract text
        text = pytesseract.image_to_string(screenshot)
        
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
async def analyze_screen(request: Request, question: str = "What's on my screen?"):
    try:
        session_id = get_session_id(request)
        logger.info(f"Analyzing screen with question: {question}")
        
        # Fast screen capture and analysis
        try:
            # Quick screenshot
            screenshot = pyautogui.screenshot()
            
            # Better OCR with more selective settings
            try:
                # Use more conservative OCR settings for better text extraction
                custom_config = r'--oem 3 --psm 3 -l eng --psm 6'
                # Resize for better OCR but not too large
                if screenshot.width > 1920:
                    screenshot = screenshot.resize((1920, int(screenshot.height * 1920 / screenshot.width)))
                
                screen_text = pytesseract.image_to_string(screenshot, config=custom_config)
                
                # Clean up the text - remove garbage characters
                import re
                # Keep only readable text, remove weird characters
                screen_text = re.sub(r'[^\w\s\.\,\?\!\:\;\-\(\)\[\]\{\}\"\'\/\\@#$%^&*+=<>', ' ', screen_text)
                # Remove multiple spaces and newlines
                screen_text = re.sub(r'\s+', ' ', screen_text).strip()
                
                # Only keep if it has meaningful content
                if len(screen_text) < 10 or not any(c.isalpha() for c in screen_text):
                    screen_text = ""
                
                logger.info(f"Clean OCR text: '{screen_text[:200]}...'")
                
            except Exception as ocr_error:
                logger.error(f"OCR error: {ocr_error}")
                screen_text = ""
            
            # Clean up the text
            screen_text = screen_text.strip()[:500]  # Increased limit to 500 chars to capture more songs
            
            if screen_text and len(screen_text) > 10:
                # Create an extremely specific prompt to force analysis of actual screen content
                prompt = f"SCREEN TEXT: '{screen_text}'\n\nQUESTION: {question}\n\nCRITICAL INSTRUCTION: You MUST analyze the SCREEN TEXT above and answer based ONLY on the actual content you can see. If you see song titles like 'HIGHEST IN THE ROOM', 'HiiiPower', 'HUMBLE.', 'Hold On, We're Going Home', etc., you MUST recommend from those specific songs. Do NOT give generic suggestions. Answer ONLY about what is visible in the screen text."
            else:
                prompt = f"No readable text found on screen. Question: {question}\n\nThe screen appears to contain images, icons, or non-text elements. Please describe what you're trying to analyze."
            
            # Add to conversation history
            if session_id not in conversation_store:
                conversation_store[session_id] = []
            
            conversation_store[session_id].append({
                "role": "user",
                "content": prompt
            })
            
            # Keep only last 2 messages for speed
            conversation_store[session_id] = conversation_store[session_id][-2:]
            
            # Fast LLaMA response
            response = await ollama.chat(
                model='llama3',
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
                            escaped_content = content.replace('"', '\\"').replace('\n', '\\n')
                            assistant_message += content
                            yield f"data: {{\"chunk\": \"{escaped_content}\"}}\n\n"
                            await asyncio.sleep(0.001)  # Fast streaming
                
                # Save to conversation
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
            logger.error(f"Screen analysis error: {e}")
            # Fallback to instant response if analysis fails
            async def fallback_response():
                response_text = f"📸 Screen captured but analysis failed. Error: {str(e)[:100]}. Try uploading a screenshot instead."
                escaped_content = response_text.replace('"', '\\"').replace('\n', '\\n')
                yield f"data: {{\"chunk\": \"{escaped_content}\"}}\n\n"
            
            return StreamingResponse(
                fallback_response(),
                media_type="text/event-stream",
                headers={"X-Session-ID": session_id}
            )
            
    except Exception as e:
        logger.error(f"Error in analyze_screen: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to analyze screen: {str(e)}"
        )

# CORS preflight for /chat
@app.options("/chat")
async def options_chat():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    if not is_tesseract_available():
        logger.warning("Tesseract OCR is not installed or not in system PATH. Screen capture will not work.")
    uvicorn.run("test_server:app", host="0.0.0.0", port=8000, reload=True)