import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './LandingPage';
import GetStartedPage from './GetStartedPage';
import AppPage from './AppPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/get-started" element={<GetStartedPage />} />
        <Route path="/app" element={<AppPage />} />
      </Routes>
    </Router>
  );
}

export default App;
