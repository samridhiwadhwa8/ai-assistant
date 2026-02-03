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
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const isIframe = window.self !== window.top;
  console.log('🚀 UIUX: Is iframe mode:', isIframe);
  
  const backgroundStyle = isIframe 
    ? { 
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(20px) saturate(140%)',
        WebkitBackdropFilter: 'blur(20px) saturate(140%)',
        border: '1px solid rgba(255,255,255,0.25)',
        borderRadius: '18px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.35)',
        isolation: 'isolate',
        mixBlendMode: 'normal'
      }
    : { background: 'linear-gradient(135deg, #0f172a 0%, #581c87 50%, #0f172a 100%)' };
  
  const textStyle = isIframe 
    ? {}
    : {};
  
  return (
    <div className="flex flex-col h-screen" style={backgroundStyle}>
      <header className="text-white p-4 border-b border-white/20" style={{backgroundColor: 'rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(12px) saturate(140%)', WebkitBackdropFilter: 'blur(12px) saturate(140%)', borderBottom: '1px solid rgba(255,255,255,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <h1 className="text-xl font-bold text-white" style={{textShadow: '0 0 4px rgba(0,0,0,0.8), 0 0 8px rgba(0,0,0,0.5)'}}>{isMinimized ? 'ScreenAI' : 'ScreenAI Assistant'}</h1>
        <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
          <button 
            onClick={() => {
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
                  backgroundColor: message.role === "user" ? 'rgba(59, 130, 246, 0.15)' : 'rgba(0, 0, 0, 0.25)',
                  backdropFilter: 'blur(12px) saturate(140%)',
                  WebkitBackdropFilter: 'blur(12px) saturate(140%)',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}
              >
                <div className="whitespace-pre-wrap text-white" style={{textShadow: '0 0 4px rgba(0,0,0,0.8), 0 0 8px rgba(0,0,0,0.5)'}}>
                  {message.content}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}

      {!isMinimized && (
        <div className="p-4 border-t border-white/20" style={{backgroundColor: 'rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(12px) saturate(140%)', WebkitBackdropFilter: 'blur(12px) saturate(140%)', borderTop: '1px solid rgba(255,255,255,0.15)'}}>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Type your message..."
                className="w-full p-3 rounded-xl bg-white/20 backdrop-blur-xl border border-white/30 text-white placeholder-gray-400 pr-20 focus:outline-none focus:ring-2 focus:ring-white/40 resize-none"
                rows={1}
                style={{ minHeight: '48px', maxHeight: '200px' }}
                disabled={false}
              />
              <button
                onClick={() => {
                  if (inputValue.trim()) {
                    handleSend();
                  }
                }}
                disabled={!inputValue.trim()}
                className={`absolute right-2 bottom-2 p-2 rounded-lg transition-all backdrop-blur-lg border ${
                  inputValue.trim()
                    ? "bg-white/30 border-white/40 text-white hover:bg-white/40 hover:scale-105"
                    : "bg-white/10 border-white/20 text-white/40 cursor-not-allowed"
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

  function handleSend() {
    if (!inputValue.trim()) return;
    
    const userMessage = {
      role: "user",
      content: inputValue,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    
    // Here you would typically send the message to your backend
    console.log('Sending message:', userMessage);
  }
};

export default LlamaChatbot;
