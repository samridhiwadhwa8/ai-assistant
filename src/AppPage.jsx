import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Eye, Mic, Send, Upload, X, Minimize2, Maximize2 } from 'lucide-react';
import './AppPage.css';

const AppPage = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "👋 Hi! I'm your AI assistant. I can analyze your screen, answer questions, and help with tasks. Click the camera icon to capture your screen!",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState(localStorage.getItem('sessionId') || '');
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [position, setPosition] = useState({ x: window.innerWidth - 400, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

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

  // Dragging functionality
  const handleMouseDown = (e) => {
    if (e.target.closest('.chat-header')) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragStart]);

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
      const response = await fetch(`http://localhost:8000/chat?${params}`, {
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream',
          'X-Session-ID': sessionId || undefined
        }
      });

      const newSessionId = response.headers.get('X-Session-ID');
      if (newSessionId && newSessionId !== sessionId) {
        setSessionId(newSessionId);
        localStorage.setItem('sessionId', newSessionId);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = {
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isStreaming: true
      };

      setMessages(prev => [...prev, assistantMessage]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.chunk) {
                assistantMessage.content += data.chunk;
                setMessages(prev => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1] = { ...assistantMessage };
                  return newMessages;
                });
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }

      assistantMessage.isStreaming = false;
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = { ...assistantMessage };
        return newMessages;
      });

    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date()
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const analyzeScreen = async () => {
    setIsTyping(true);
    
    const processingMessage = {
      role: "assistant",
      content: "📸 Analyzing your screen...",
      timestamp: new Date()
    };
    setMessages(prev => [...prev, processingMessage]);

    try {
      const response = await fetch(`http://localhost:8000/analyze-screen`, {
        method: 'POST',
        headers: {
          'Accept': 'text/event-stream',
          'X-Session-ID': sessionId || undefined
        }
      });

      const newSessionId = response.headers.get('X-Session-ID');
      if (newSessionId && newSessionId !== sessionId) {
        setSessionId(newSessionId);
        localStorage.setItem('sessionId', newSessionId);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = {
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isStreaming: true
      };

      // Remove processing message and add streaming message
      setMessages(prev => {
        const newMessages = prev.slice(0, -1);
        return [...newMessages, assistantMessage];
      });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.chunk) {
                assistantMessage.content += data.chunk;
                setMessages(prev => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1] = { ...assistantMessage };
                  return newMessages;
                });
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }

      assistantMessage.isStreaming = false;
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = { ...assistantMessage };
        return newMessages;
      });

    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => {
        const newMessages = prev.slice(0, -1);
        return [...newMessages, {
          role: "assistant",
          content: "❌ Error: Failed to analyze screen. Please try again.",
          timestamp: new Date()
        }];
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsTyping(true);
    
    const processingMessage = {
      role: "assistant",
      content: "🖼️ Processing uploaded image...",
      timestamp: new Date()
    };
    setMessages(prev => [...prev, processingMessage]);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`http://localhost:8000/process-screenshot`, {
        method: 'POST',
        headers: {
          'X-Session-ID': sessionId || undefined
        },
        body: formData
      });

      const data = await response.json();
      
      setMessages(prev => {
        const newMessages = prev.slice(0, -1);
        return [...newMessages, {
          role: "assistant",
          content: `📄 Image processed: ${data.text}`,
          timestamp: new Date()
        }];
      });

    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => {
        const newMessages = prev.slice(0, -1);
        return [...newMessages, {
          role: "assistant",
          content: "❌ Error: Failed to process image. Please try again.",
          timestamp: new Date()
        }];
      });
    } finally {
      setIsTyping(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = reader.result.split(',')[1];
          await sendVoiceToServer(base64Audio);
        };
        reader.readAsDataURL(audioBlob);
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const sendVoiceToServer = async (audioData) => {
    setIsTyping(true);
    
    const processingMessage = {
      role: "assistant",
      content: "🎤 Processing your voice...",
      timestamp: new Date()
    };
    setMessages(prev => [...prev, processingMessage]);

    try {
      const response = await fetch('http://localhost:8000/voice-to-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': sessionId || undefined
        },
        body: JSON.stringify({ audio: audioData })
      });

      const newSessionId = response.headers.get('X-Session-ID');
      if (newSessionId && newSessionId !== sessionId) {
        setSessionId(newSessionId);
        localStorage.setItem('sessionId', newSessionId);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = {
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isStreaming: true
      };

      // Remove processing message and add streaming message
      setMessages(prev => {
        const newMessages = prev.slice(0, -1);
        return [...newMessages, assistantMessage];
      });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.chunk) {
                assistantMessage.content += data.chunk;
                setMessages(prev => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1] = { ...assistantMessage };
                  return newMessages;
                });
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }

      assistantMessage.isStreaming = false;
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = { ...assistantMessage };
        return newMessages;
      });

    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => {
        const newMessages = prev.slice(0, -1);
        return [...newMessages, {
          role: "assistant",
          content: "❌ Error: Failed to process voice. Please try again.",
          timestamp: new Date()
        }];
      });
    } finally {
      setIsTyping(false);
    }
  };

  if (!isOpen) {
    return (
      <div 
        className="floating-bubble"
        style={{ left: position.x, top: position.y }}
        onClick={() => setIsOpen(true)}
      >
        <Eye />
      </div>
    );
  }

  return (
    <div 
      className={`floating-assistant ${isMinimized ? 'minimized' : ''}`}
      style={{ left: position.x, top: position.y }}
    >
      <div className="chat-header" onMouseDown={handleMouseDown}>
        <div className="header-left">
          <Eye className="header-icon" />
          <span>ScreenAI Assistant</span>
        </div>
        <div className="header-right">
          <button onClick={() => setIsMinimized(!isMinimized)} className="header-btn">
            {isMinimized ? <Maximize2 /> : <Minimize2 />}
          </button>
          <button onClick={() => setIsOpen(false)} className="header-btn">
            <X />
          </button>
        </div>
      </div>
      
      {!isMinimized && (
        <>
          <div className="chat-messages">
            {messages.map((message, index) => (
              <div key={index} className={`message ${message.role}`}>
                <div className="message-content">
                  {message.content}
                  {message.isStreaming && <span className="cursor">|</span>}
                </div>
                <div className="message-time">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          
          <div className="chat-input">
            <div className="input-row">
              <button 
                onClick={analyzeScreen} 
                disabled={isTyping}
                className="action-btn"
                title="Analyze Screen"
              >
                <Eye />
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()} 
                disabled={isTyping}
                className="action-btn"
                title="Upload Image"
              >
                <Upload />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask me anything..."
                disabled={isTyping}
                className="text-input"
              />
              <button 
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isTyping}
                className={`action-btn ${isRecording ? 'recording' : ''}`}
                title={isRecording ? "Stop Recording" : "Voice Input"}
              >
                <Mic />
              </button>
              <button 
                onClick={handleSend} 
                disabled={isTyping || !input.trim()}
                className="send-btn"
              >
                <Send />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AppPage;
