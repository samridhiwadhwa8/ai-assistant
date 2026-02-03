import React from 'react';
import { ArrowRight, Zap, Eye, Mic, Brain } from 'lucide-react';
import './LandingPage.css';

const LandingPage = () => {
  const handleGetStarted = () => {
    // Try to open floating chatbot directly
    try {
      // Open chatbot in popup window
      const width = 450;
      const height = 700;
      const left = window.screen.width - width - 20;
      const top = 100;
      
      window.open(
        'http://localhost:3001/app', 
        'ScreenAI', 
        `width=${width},height=${height},left=${left},top=${top}`
      );
    } catch (error) {
      console.error('Error opening chatbot:', error);
      // Fallback: open in new tab
      window.open('http://localhost:3001/app', '_blank');
    }
  };

  return (
    <div className="landing-page">
      {/* Navigation */}
      <nav className="navbar">
        <div className="nav-container">
          <div className="logo">
            <Brain className="logo-icon" />
            <span>ScreenAI</span>
          </div>
          <div className="nav-links">
            <button className="get-started-btn" onClick={handleGetStarted}>
              Get Started
              <ArrowRight className="btn-icon" />
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <h1 className="hero-title">
            Your AI Assistant for
            <span className="gradient-text"> Screen Analysis</span>
          </h1>
          <p className="hero-description">
            Capture any screen, analyze content instantly, and get intelligent responses. 
            Powered by advanced OCR and AI technology.
          </p>
          <div className="hero-buttons">
            <button className="primary-btn" onClick={handleGetStarted}>
              Get Started Free
              <ArrowRight className="btn-icon" />
            </button>
            <button className="secondary-btn" onClick={() => window.location.href = '/get-started'}>
              Learn More
            </button>
          </div>
        </div>
        <div className="hero-visual">
          <div className="floating-card">
            <div className="card-header">
              <div className="card-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <Eye className="card-icon" />
            </div>
            <div className="card-content">
              <div className="analysis-line"></div>
              <div className="analysis-line"></div>
              <div className="analysis-line"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features">
        <div className="container">
          <h2 className="section-title">Powerful Features</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <Eye />
              </div>
              <h3>Screen Capture</h3>
              <p>Capture any application, browser tab, or entire screen with one click</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <Zap />
              </div>
              <h3>Instant Analysis</h3>
              <p>Advanced OCR extracts text and content in seconds, not minutes</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <Mic />
              </div>
              <h3>Voice Control</h3>
              <p>Use your voice to ask questions and control the assistant hands-free</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <Brain />
              </div>
              <h3>AI Powered</h3>
              <p>Powered by advanced LLaMA models for intelligent responses</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta">
        <div className="container">
          <h2>Ready to transform your workflow?</h2>
          <p>Get started with ScreenAI today and experience the power of AI-assisted screen analysis</p>
          <button className="cta-btn" onClick={handleGetStarted}>
            Get Started Now
            <ArrowRight className="btn-icon" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-logo">
              <Brain className="logo-icon" />
              <span>ScreenAI</span>
            </div>
            <p className="footer-text">© 2024 ScreenAI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;