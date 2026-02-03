import React from 'react';
import { ArrowLeft, ArrowRight, Eye, Zap, Mic, Brain, Shield, Globe } from 'lucide-react';
import './GetStartedPage.css';

const GetStartedPage = () => {
  const handleGoBack = () => {
    window.location.href = '/';
  };

  const handleLaunchApp = () => {
    window.location.href = '/app';
  };

  return (
    <div className="get-started-page">
      {/* Navigation */}
      <nav className="navbar">
        <div className="nav-container">
          <button className="back-btn" onClick={handleGoBack}>
            <ArrowLeft className="btn-icon" />
            Back
          </button>
          <div className="logo">
            <Brain className="logo-icon" />
            <span>ScreenAI</span>
          </div>
          <button className="launch-btn" onClick={handleLaunchApp}>
            Launch App
            <ArrowRight className="btn-icon" />
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <h1 className="hero-title">
            How ScreenAI
            <span className="gradient-text"> Works</span>
          </h1>
          <p className="hero-description">
            Discover the powerful features that make ScreenAI your intelligent screen analysis companion
          </p>
        </div>
      </section>

      {/* How It Works */}
      <section className="how-it-works">
        <div className="container">
          <h2 className="section-title">How It Works</h2>
          <div className="steps">
            <div className="step">
              <div className="step-number">1</div>
              <div className="step-content">
                <Eye className="step-icon" />
                <h3>Capture Your Screen</h3>
                <p>Click the camera icon to capture any application, browser tab, or your entire screen</p>
              </div>
            </div>
            <div className="step">
              <div className="step-number">2</div>
              <div className="step-content">
                <Zap className="step-icon" />
                <h3>Instant Analysis</h3>
                <p>Our advanced OCR technology extracts text and content from your screen in seconds</p>
              </div>
            </div>
            <div className="step">
              <div className="step-number">3</div>
              <div className="step-content">
                <Brain className="step-icon" />
                <h3>AI-Powered Insights</h3>
                <p>Get intelligent responses and analysis powered by advanced LLaMA AI models</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="features">
        <div className="container">
          <h2 className="section-title">Powerful Features</h2>
          <div className="features-grid">
            <div className="feature-card">
              <Eye className="feature-icon" />
              <h3>Screen Capture</h3>
              <p>Capture any application, browser tab, or entire screen with one click</p>
            </div>
            <div className="feature-card">
              <Zap className="feature-icon" />
              <h3>Lightning Fast</h3>
              <p>Get results in seconds with our optimized OCR and AI processing</p>
            </div>
            <div className="feature-card">
              <Mic className="feature-icon" />
              <h3>Voice Control</h3>
              <p>Use your voice to ask questions and control the assistant hands-free</p>
            </div>
            <div className="feature-card">
              <Brain className="feature-icon" />
              <h3>Smart Analysis</h3>
              <p>Understand context and provide intelligent insights about your screen content</p>
            </div>
            <div className="feature-card">
              <Shield className="feature-icon" />
              <h3>Privacy First</h3>
              <p>Your screen data is processed securely and never stored permanently</p>
            </div>
            <div className="feature-card">
              <Globe className="feature-icon" />
              <h3>Cross-Platform</h3>
              <p>Works with any application on Windows, Mac, and Linux</p>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="use-cases">
        <div className="container">
          <h2 className="section-title">Perfect For</h2>
          <div className="use-cases-grid">
            <div className="use-case">
              <h3>👨‍💻 Developers</h3>
              <p>Analyze code, debug errors, and get help with programming challenges</p>
            </div>
            <div className="use-case">
              <h3>📊 Data Analysts</h3>
              <p>Extract insights from charts, graphs, and data visualizations</p>
            </div>
            <div className="use-case">
              <h3>📚 Students</h3>
              <p>Get help with homework, research, and studying from screen content</p>
            </div>
            <div className="use-case">
              <h3>💼 Professionals</h3>
              <p>Analyze documents, presentations, and business reports instantly</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta">
        <div className="container">
          <h2>Ready to Get Started?</h2>
          <p>Experience the power of AI-assisted screen analysis today</p>
          <button className="cta-btn" onClick={handleLaunchApp}>
            Launch ScreenAI
            <ArrowRight className="btn-icon" />
          </button>
        </div>
      </section>
    </div>
  );
};

export default GetStartedPage;
