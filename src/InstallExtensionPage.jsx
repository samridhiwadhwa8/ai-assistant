import React from 'react';
import { ArrowLeft, Download, Chrome } from 'lucide-react';
import './InstallExtensionPage.css';

const InstallExtensionPage = () => {
  const handleInstallExtension = () => {
    // For development - guide user to load unpacked extension
    const steps = [
      "1. Open Chrome and go to chrome://extensions/",
      "2. Enable 'Developer mode' in the top right",
      "3. Click 'Load unpacked'",
      "4. Navigate to and select the 'browser-extension' folder",
      "5. Pin the ScreenAI extension to your toolbar"
    ];

    alert(`Installation Steps:\n\n${steps.join('\n')}\n\nAfter installation, return to this page and click 'Get Started'!`);
  };

  const handleGoBack = () => {
    window.location.href = '/';
  };

  return (
    <div className="install-extension-page">
      <div className="install-container">
        <button className="back-btn" onClick={handleGoBack}>
          <ArrowLeft size={20} />
          Back to Home
        </button>

        <div className="install-content">
          <div className="install-header">
            <div className="extension-icon">
              <Chrome size={48} />
            </div>
            <h1>Install ScreenAI Extension</h1>
            <p>Get the floating AI assistant that works anywhere on your screen</p>
          </div>

          <div className="install-features">
            <div className="feature-item">
              <div className="feature-icon">🎯</div>
              <div className="feature-text">
                <h3>Floating Assistant</h3>
                <p>Always-on-top AI assistant that floats above any application</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">📸</div>
              <div className="feature-text">
                <h3>Screen Capture</h3>
                <p>Capture any screen, window, or tab for instant AI analysis</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">🤖</div>
              <div className="feature-text">
                <h3>AI-Powered</h3>
                <p>Powered by advanced LLaMA models for intelligent responses</p>
              </div>
            </div>
          </div>

          <div className="install-steps">
            <h2>Installation Instructions</h2>
            <div className="steps-list">
              <div className="step-item">
                <div className="step-number">1</div>
                <div className="step-content">
                  <h3>Open Chrome Extensions</h3>
                  <p>Type <code>chrome://extensions/</code> in your Chrome address bar</p>
                </div>
              </div>
              <div className="step-item">
                <div className="step-number">2</div>
                <div className="step-content">
                  <h3>Enable Developer Mode</h3>
                  <p>Toggle the "Developer mode" switch in the top right corner</p>
                </div>
              </div>
              <div className="step-item">
                <div className="step-number">3</div>
                <div className="step-content">
                  <h3>Load Extension</h3>
                  <p>Click "Load unpacked" and select the <code>browser-extension</code> folder from your project</p>
                </div>
              </div>
              <div className="step-item">
                <div className="step-number">4</div>
                <div className="step-content">
                  <h3>Pin Extension</h3>
                  <p>Click the puzzle icon in Chrome toolbar and pin ScreenAI for easy access</p>
                </div>
              </div>
            </div>
          </div>

          <div className="install-actions">
            <button className="install-btn" onClick={handleInstallExtension}>
              <Download size={20} />
              Show Installation Steps
            </button>
            <button className="test-btn" onClick={() => window.location.href = '/'}>
              <ArrowLeft size={20} />
              Back to Test Extension
            </button>
          </div>

          <div className="install-note">
            <p><strong>Note:</strong> This is a development version. For production, the extension will be available on the Chrome Web Store.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InstallExtensionPage;
