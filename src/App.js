import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './LandingPage';
import GetStartedPage from './GetStartedPage';
import InstallExtensionPage from './InstallExtensionPage';
import LlamaChatbot from './uiux'; // Original chat interface

// Check if app is loaded in iframe and add transparent class
if (window.self !== window.top) {
  document.body.classList.add('iframe-mode');
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/get-started" element={<GetStartedPage />} />
        <Route path="/install-extension" element={<InstallExtensionPage />} />
        <Route path="/app" element={<LlamaChatbot />} />
      </Routes>
    </Router>
  );
}

export default App;
