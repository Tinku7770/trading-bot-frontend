import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Trades from './pages/Trades';
import Signals from './pages/Signals';
import Portfolio from './pages/Portfolio';
import Market from './pages/Market';
import Settings from './pages/Settings';
import Performance from './pages/Performance';
import './App.css';

function App() {
  return (
    <AppProvider>
      <Router>
        <div className="app">
          <Navbar />
          <div className="main-content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/trades" element={<Trades />} />
              <Route path="/signals" element={<Signals />} />
              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/market" element={<Market />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/performance" element={<Performance />} />
            </Routes>
          </div>
        </div>
      </Router>
    </AppProvider>
  );
}

export default App;
