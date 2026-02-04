import React, { useState, useRef, useEffect } from 'react';
import './uiux-override.css';

const LlamaChatbot = () => {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hello! I'm your LLaMA assistant. I can help analyze your screen content and respond to your voice. Try clicking '🎤 Voice' to talk to me!",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [sessionId, setSessionId] = useState(localStorage.getItem('sessionId') || '');
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [abortController, setAbortController] = useState(null);

  // Load session ID on component mount
  useEffect(() => {
    const savedSessionId = localStorage.getItem('sessionId');
    if (savedSessionId) {
      setSessionId(savedSessionId);
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = {
      role: "user",
      content: input,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    try {
      const params = new URLSearchParams({ question: input });
      const controller = new AbortController();
      setAbortController(controller);
      
      const response = await fetch(`http://localhost:8000/chat?${params}`, {
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream',
          'X-Session-ID': sessionId || undefined
        },
        signal: controller.signal
      });

      const newSessionId = response.headers.get('X-Session-ID');
      if (newSessionId && newSessionId !== sessionId) {
        setSessionId(newSessionId);
        localStorage.setItem('sessionId', newSessionId);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Server responded with ${response.status}`);
      }

      // Add an initial assistant message for streaming
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isStreaming: true
      }]);

      // Process the stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          
          try {
            const data = JSON.parse(line.substring(6).trim());
            if (data.chunk) {
              setMessages(prev => {
                const newMessages = [...prev];
                const lastMessage = { ...newMessages[newMessages.length - 1] };
                if (lastMessage.role === 'assistant') {
                  lastMessage.content += data.chunk;
                }
                return [...newMessages.slice(0, -1), lastMessage];
              });
            }
          } catch (e) {
            console.error('Error parsing chunk:', e);
          }
        }
      }

      // Mark streaming as complete
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = { ...newMessages[newMessages.length - 1] };
        if (lastMessage.role === 'assistant') {
          lastMessage.isStreaming = false;
        }
        return [...newMessages.slice(0, -1), lastMessage];
      });
      
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: `❌ Error: ${error.message}`,
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsTyping(false);
      setAbortController(null);
    }
  };

  const analyzeScreen = async (question = "What's on my screen?") => {
    try {
      setIsTyping(true);

      // Add a streaming message placeholder
      const streamingMessageId = Date.now().toString();
      setMessages(prev => [...prev, {
        id: streamingMessageId,
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
        isStreaming: true
      }]);

      const response = await fetch(`http://localhost:8000/analyze-screen?question=${encodeURIComponent(question)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': sessionId || undefined
        }
      });

      const newSessionId = response.headers.get('X-Session-ID');
      if (newSessionId && newSessionId !== sessionId) {
        setSessionId(newSessionId);
        localStorage.setItem('sessionId', newSessionId);
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.chunk) {
                  accumulatedContent += data.chunk;
                  
                  // Update the streaming message
                  setMessages(prev => prev.map(msg => 
                    msg.id === streamingMessageId 
                      ? { ...msg, content: accumulatedContent }
                      : msg
                  ));
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
      }

      // Finalize the streaming message
      setMessages(prev => prev.map(msg => 
        msg.id === streamingMessageId 
          ? { ...msg, isStreaming: false, content: accumulatedContent }
          : msg
      ));

      setIsTyping(false);

    } catch (error) {
      console.error('Screen analysis error:', error);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "❌ Error: " + error.message,
        timestamp: new Date()
      }]);
      setIsTyping(false);
    } finally {
      if (abortController) {
        abortController = null;
        setAbortController(null);
      }
    }
  };

  useEffect(() => {
    console.log('🚀 REACT: Exposing functions to window...');
    window.captureScreen = captureScreen;
    window.startRecording = startRecording;
    window.stopRecording = stopRecording;
    window.analyzeScreen = analyzeScreen;
    window.reactCaptureScreen = captureScreen;
    window.reactAnalyzeScreen = analyzeScreen;
    console.log('🚀 REACT: Functions exposed to window');
    
    console.log('🚀 UIUX: Is iframe mode:', isIframe);
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        
        reader.onloadend = async () => {
          const base64Audio = reader.result.split(',')[1];
          await sendVoiceToServer(base64Audio);
        };
        
        reader.readAsDataURL(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      setMediaRecorder(recorder);
      recorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: "❌ Error: Could not access microphone. Please check your permissions.",
          timestamp: new Date()
        }
      ]);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const sendVoiceToServer = async (audioData) => {
    try {
      console.log('sendVoiceToServer called with audio data length:', audioData.length);
      setIsTyping(true);

      console.log('Sending request to voice-to-text endpoint...');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch('http://localhost:8000/voice-to-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ audio: audioData }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      console.log('Response received:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Server responded with ${response.status}`);
      }

      // Handle streaming response
      if (response.headers.get('content-type')?.includes('text/event-stream')) {
        // Handle streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantMessage = "";
        
        // Add an initial assistant message for streaming
        setMessages(prev => [...prev, {
          role: "assistant",
          content: "",
          timestamp: new Date(),
          isStreaming: true
        }]);
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const jsonStr = line.substring(6).replace(/,$/, '');
                  // Skip empty lines or malformed JSON
                  if (!jsonStr || jsonStr.trim() === '') continue;
                  const data = JSON.parse(jsonStr);
                  if (data.chunk) {
                    // Create a new variable to avoid loop reference issue
                    const newContent = data.chunk;
                    assistantMessage += newContent;
                    setMessages(prev => {
                      const newMessages = [...prev];
                      const lastMessage = { ...newMessages[newMessages.length - 1] };
                      if (lastMessage.role === 'assistant') {
                        lastMessage.content = assistantMessage;
                      }
                      return [...newMessages.slice(0, -1), lastMessage];
                    });
                  }
                } catch (e) {
                  console.error('Error parsing chunk:', e, 'Line:', line);
                }
              }
            }
          }
        } catch (streamError) {
          if (streamError.name === 'AbortError') {
            console.log('Stream was aborted (timeout or user cancelled)');
          } else {
            console.error('Stream error:', streamError);
          }
        } finally {
          // Mark streaming as complete
          setMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = { ...newMessages[newMessages.length - 1] };
            if (lastMessage.role === 'assistant') {
              lastMessage.isStreaming = false;
            }
            return [...newMessages.slice(0, -1), lastMessage];
          });
        }
      } else {
        // Handle non-streaming response
        const data = await response.json();
        setMessages(prev => [...prev, {
          role: "assistant",
          content: data.text || "No text was found in the audio.",
          timestamp: new Date()
        }]);
      }
    } catch (error) {
      console.error('Error sending voice to server:', error);
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: `❌ Error: ${error.message}`,
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const captureScreen = async () => {
    try {
      console.log('🚀 CAPTURE: Starting screen capture...');
      setIsTyping(true);

      console.log('🚀 CAPTURE: Requesting screen sharing...');
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 1 },
        audio: false
      });
      console.log('🚀 CAPTURE: Screen sharing granted');

      const track = stream.getVideoTracks()[0];
      console.log('🚀 CAPTURE: Got video track');
      
      const imageCapture = new ImageCapture(track);
      console.log('🚀 CAPTURE: ImageCapture created');
      
      const bitmap = await imageCapture.grabFrame();
      console.log('🚀 CAPTURE: Frame captured, bitmap size:', bitmap.width, 'x', bitmap.height);

      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(bitmap, 0, 0);
      console.log('🚀 CAPTURE: Canvas created and drawn');

      const blob = await new Promise(resolve =>
        canvas.toBlob(resolve, "image/png")
      );
      console.log('🚀 CAPTURE: Blob created, size:', blob.size, 'bytes');

      track.stop(); // stop screen sharing immediately
      console.log('🚀 CAPTURE: Screen sharing stopped');

      const formData = new FormData();
      formData.append("file", blob);
      console.log('🚀 CAPTURE: FormData created');

      // Use the analyze-screen endpoint with file upload for intelligent analysis
      console.log('🚀 CAPTURE: Sending to analyze-screen endpoint with file...');
      const response = await fetch("http://localhost:8000/process-screenshot?question=What's in this image?", {
        method: "POST",
        body: formData,
        headers: {
          'X-Session-ID': sessionId || undefined
        }
      });

      console.log('🚀 CAPTURE: Response received, status:', response.status);

      const newSessionId = response.headers.get('X-Session-ID');
      if (newSessionId && newSessionId !== sessionId) {
        setSessionId(newSessionId);
        localStorage.setItem('sessionId', newSessionId);
        console.log('🚀 CAPTURE: Session ID updated');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Server responded with ${response.status}`);
      }

      // Handle JSON response (text only, no AI analysis)
      const data = await response.json();
      
      setMessages(prev => {
        const newMessages = prev.slice(0, -1);
        return [
          ...newMessages,
          {
            role: "assistant",
            content: data.text || "No text was found in the image.",
            timestamp: new Date(),
          }
        ];
      });

    } catch (error) {
      console.error('Error processing file:', error);
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: `❌ Error processing file: ${error.message}`,
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

const handleKeyPress = (e) => {
if (e.key === 'Enter' && !e.shiftKey) {
  e.preventDefault();
  handleSend();
}};

const isIframe = window.self !== window.top;

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setIsTyping(true);
      
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("http://localhost:8000/process-screenshot?question=What's in this image?", {
        method: "POST",
        body: formData,
        headers: {
          'X-Session-ID': sessionId || undefined
        }
      });

      const data = await response.json();
      
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.text || "No text was found in the image.",
        timestamp: new Date()
      }]);

    } catch (error) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `❌ Error processing file: ${error.message}`,
        timestamp: new Date()
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const backgroundStyle = window.self !== window.top 
    ? { 
        background: 'rgba(0, 0, 0, 0.08)',
        backdropFilter: 'blur(6px) brightness(0.9)',
        WebkitBackdropFilter: 'blur(6px) brightness(0.9)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '20px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
        isolation: 'isolate',
        mixBlendMode: 'normal'
      }
    : { background: 'linear-gradient(135deg, #0f172a 0%, #581c87 50%, #0f172a 100%)' };
  
  const textStyle = isIframe 
    ? {}
    : {};


  return (
    <div 
      className="flex flex-col h-screen" 
      style={{
        ...backgroundStyle,
        ...(isMinimized ? {
          height: '2px !important',
          minHeight: '2px !important',
          maxHeight: '2px !important',
          width: '100% !important',
          padding: '0 !important',
          margin: '0 !important',
          border: 'none !important',
          borderRadius: '0 !important',
          overflow: 'hidden !important',
          cursor: 'pointer !important',
          position: 'fixed !important',
          top: '0 !important',
          left: '0 !important',
          right: '0 !important',
          zIndex: '999999999 !important',
          background: 'rgba(255, 255, 255, 0.4) !important',
          backdropFilter: 'none !important',
          WebkitBackdropFilter: 'none !important',
          boxShadow: 'none !important'
        } : {})
      }}
      onClick={() => {
        if (isMinimized) {
          setIsMinimized(false);
        }
      }}
    >
      <header 
        className="text-white p-4" 
        style={{
          background: 'transparent', 
          backdropFilter: 'none', 
          WebkitBackdropFilter: 'none', 
          borderBottom: 'none', 
          display: isMinimized ? 'none !important' : 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center'
        }}
      >
        <h1 className="text-xl font-bold text-white" style={{textShadow: '0 0 4px rgba(0,0,0,0.8), 0 0 8px rgba(0,0,0,0.5)'}}>{isMinimized ? 'ScreenAI' : 'ScreenAI Assistant'}</h1>
        <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              // Toggle minimize state
              setIsMinimized(!isMinimized);
            }}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: '2px solid rgba(255,255,255,0.5)',
              borderRadius: '8px',
              padding: '10px 14px',
              color: 'black',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              textShadow: '0 0 4px rgba(255,255,255,0.9)',
              position: 'relative',
              zIndex: '9999',
              minWidth: '60px',
              minHeight: '30px'
            }}
          >{isMinimized ? '□' : '_'}</button>
          <button 
            onClick={() => {
              // Close the chat window
              if (window.parent && window.parent.postMessage) {
                window.parent.postMessage({action: 'closeChat'}, '*');
              }
            }}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: '2px solid rgba(255,255,255,0.5)',
              borderRadius: '8px',
              padding: '10px 14px',
              color: 'black',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              textShadow: '0 0 4px rgba(255,255,255,0.9)',
              position: 'relative',
              zIndex: '9999',
              minWidth: '60px',
              minHeight: '30px'
            }}
          >×</button>
        </div>
      </header>

      {!isMinimized && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4" style={textStyle}>
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-3xl rounded-xl p-4 ${
                  message.role === "user"
                    ? "text-white rounded-br-none"
                    : "text-white rounded-bl-none"
                }`}
                style={{
                  background: 'rgba(0, 0, 0, 0.08)',
                  backdropFilter: 'blur(6px) brightness(0.9)',
                  WebkitBackdropFilter: 'blur(6px) brightness(0.9)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px'
                }}
              >
              <div className="whitespace-pre-wrap text-white" style={{textShadow: '0 0 4px rgba(0,0,0,0.8), 0 0 8px rgba(0,0,0,0.5)'}}>
                {message.isStreaming ? (
                  <div className="flex items-center gap-2">
                    <span>{message.content}</span>
                    <div className="flex space-x-1">
                      <div className="w-1 h-1 bg-white/60 rounded-full animate-bounce"></div>
                      <div className="w-1 h-1 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-1 h-1 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  </div>
                ) : (
                  message.content
                )}
              </div>
              <div className="text-xs opacity-80 mt-2 text-white/90">
                {formatTime(new Date(message.timestamp))}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      )}

      {!isMinimized && (
        <div className="p-4" style={{background: 'rgba(0, 0, 0, 0.08)', backdropFilter: 'blur(6px) brightness(0.9)', WebkitBackdropFilter: 'blur(6px) brightness(0.9)', borderTop: 'none'}}>
        <div className="flex gap-2 mb-3">
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={(e) => handleFileUpload(e)}
            className="hidden"
            disabled={isTyping}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isTyping}
            className={`px-3 py-2 rounded-lg backdrop-blur-lg border transition-all text-sm font-medium ${
              isTyping 
                ? 'bg-black/20 border-black/30 text-white/60 cursor-not-allowed' 
                : 'bg-black/30 border-black/40 text-white hover:bg-black/40 hover:border-black/50'
            }`}
            title="Upload Image"
          >
            Upload
          </button>
          <button
            onClick={captureScreen}
            disabled={isTyping}
            className={`px-3 py-2 rounded-lg backdrop-blur-lg border transition-all text-sm font-medium ${
              isTyping 
                ? 'bg-black/20 border-black/30 text-white/60 cursor-not-allowed' 
                : 'bg-black/30 border-black/40 text-white hover:bg-black/40 hover:border-black/50'
            }`}
            title="Capture Screen"
          >
            Screen
          </button>
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isTyping}
            className={`px-3 py-2 rounded-lg backdrop-blur-lg border transition-all text-sm font-medium ${
              isRecording 
                ? 'bg-red-500/30 border-red-500/50 text-red-300 animate-pulse hover:bg-red-500/40' 
                : isTyping
                  ? 'bg-black/20 border-black/30 text-white/60 cursor-not-allowed'
                  : 'bg-black/30 border-black/40 text-white hover:bg-black/40 hover:border-black/50'
            }`}
            title={isRecording ? "Stop Recording" : "Start Voice Recording"}
          >
            {isRecording ? 'Recording' : 'Voice'}
          </button>
          <button
            onClick={() => analyzeScreen("What's on my screen?")}
            disabled={isTyping}
            className={`px-3 py-2 rounded-lg backdrop-blur-lg border transition-all text-sm font-medium ${
              isTyping 
                ? 'bg-white/10 border-white/20 text-white/40 cursor-not-allowed' 
                : 'bg-blue-500/30 border-blue-500/50 text-blue-300 hover:bg-blue-500/40 hover:border-blue-500/60'
            }`}
          >
            Analyze
          </button>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="w-full p-3 rounded-xl bg-black/20 backdrop-blur-xl border border-black/30 text-white placeholder-gray-400 pr-20 focus:outline-none focus:ring-2 focus:ring-black/40 resize-none"
              rows={1}
              style={{ minHeight: '48px', maxHeight: '200px' }}
              disabled={false}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className={`absolute right-2 bottom-2 p-2 rounded-lg transition-all backdrop-blur-lg border ${
                input.trim() && !isTyping
                  ? "bg-black/30 border-black/50 text-white hover:bg-black/40" 
                  : "bg-black/20 border-black/30 text-white/60 hover:bg-black/30"
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </button>
          </div>
        </div>
        </div>
      )}

    </div>
  );
};

export default LlamaChatbot;
