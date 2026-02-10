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

      {/* Why Choose ScreenAI */}
      <section className="why-choose">
        <div className="container">
          <h2 className="section-title">Why Choose ScreenAI?</h2>
          <div className="benefits-grid">
            <div className="benefit-card">
              <div className="benefit-icon">
                <Zap />
              </div>
              <h3>Lightning Fast</h3>
              <p>Process screenshots and get AI insights in under 3 seconds with our optimized pipeline</p>
            </div>
            <div className="benefit-card">
              <div className="benefit-icon">
                <Brain />
              </div>
              <h3>Smart Intelligence</h3>
              <p>Advanced LLaMA models understand context and provide meaningful, actionable insights</p>
            </div>
            <div className="benefit-card">
              <div className="benefit-icon">
                <Shield />
              </div>
              <h3>Privacy First</h3>
              <p>Your data never leaves your device. All processing happens locally and securely</p>
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
