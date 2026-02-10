import React from 'react';
import { ArrowRight, Zap, Eye, Mic, Brain, Shield, Globe } from 'lucide-react';
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
              <Eye className="feature-icon" style={{
                width: '60px',
                height: '60px',
                color: '#667eea',
                marginBottom: '1rem'
              }} />
              <h3>Screen Capture</h3>
              <p>Capture any application, browser tab, or entire screen with one click</p>
            </div>
            <div className="feature-card">
              <Zap className="feature-icon" style={{
                width: '60px',
                height: '60px',
                color: '#667eea',
                marginBottom: '1rem'
              }} />
              <h3>Lightning Fast</h3>
              <p>Get results in seconds with our optimized OCR and AI processing</p>
            </div>
            <div className="feature-card">
              <Mic className="feature-icon" style={{
                width: '60px',
                height: '60px',
                color: '#667eea',
                marginBottom: '1rem'
              }} />
              <h3>Voice Control</h3>
              <p>Use your voice to ask questions and control the assistant hands-free</p>
            </div>
            <div className="feature-card">
              <Brain className="feature-icon" style={{
                width: '60px',
                height: '60px',
                color: '#667eea',
                marginBottom: '1rem'
              }} />
              <h3>Smart Analysis</h3>
              <p>Understand context and provide intelligent insights about your screen content</p>
            </div>
            <div className="feature-card">
              <Shield className="feature-icon" style={{
                width: '60px',
                height: '60px',
                color: '#667eea',
                marginBottom: '1rem'
              }} />
              <h3>Privacy First</h3>
              <p>Your screen data is processed securely and never stored permanently</p>
            </div>
            <div className="feature-card">
              <Globe className="feature-icon" style={{
                width: '60px',
                height: '60px',
                color: '#667eea',
                marginBottom: '1rem'
              }} />
              <h3>Cross-Platform</h3>
              <p>Works with any application on Windows, Mac, and Linux</p>
            </div>
          </div>
        </div>
      </section>

      {/* Unique Feature */}
      <section className="unique-feature">
        <div className="container">
          <div className="unique-content">
            <div className="unique-text">
              <h2 className="unique-title">One-Click Intelligence</h2>
              <p className="unique-description">
                No complex setup, no training required. Just capture your screen and get instant AI-powered insights. 
                ScreenAI works seamlessly with any application, browser, or system - making you more productive from day one.
              </p>
              <div className="unique-highlights">
                <div className="highlight">
                  <span className="highlight-number">3</span>
                  <span className="highlight-text">Second Analysis</span>
                </div>
                <div className="highlight">
                  <span className="highlight-number">100%</span>
                  <span className="highlight-text">Privacy</span>
                </div>
                <div className="highlight">
                  <span className="highlight-number">∞</span>
                  <span className="highlight-text">Applications</span>
                </div>
              </div>
            </div>
            <div className="unique-visual">
              <div className="pulse-circle">
                <Brain className="pulse-icon" />
              </div>
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