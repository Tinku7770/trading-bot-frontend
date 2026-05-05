import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import './Navbar.css';

function Navbar() {
  const location = useLocation();
  const { botStatus, tradeMode } = useApp();

  const links = [
    { path: '/', label: 'Dashboard' },
    { path: '/portfolio', label: 'Portfolio' },
    { path: '/trades', label: 'Trades' },
    { path: '/signals', label: 'Signals' },
    { path: '/market', label: 'Market' },
    { path: '/performance', label: 'Performance' },
    { path: '/settings', label: 'Settings' }
  ];

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <span className="brand-icon">AI</span>
        <span className="brand-name">TradingBot</span>
      </div>
      <div className="navbar-links">
        {links.map(link => (
          <Link
            key={link.path}
            to={link.path}
            className={`nav-link ${location.pathname === link.path ? 'active' : ''}`}
          >
            {link.label}
          </Link>
        ))}
      </div>
      <div className="navbar-status">
        <span className={`status-dot ${botStatus ? 'running' : 'stopped'}`}></span>
        <span className="status-text">{botStatus ? 'Bot Running' : 'Bot Stopped'}</span>
        <span className="mode-badge">{tradeMode === 'paper' ? 'Paper' : 'Live'}</span>
      </div>
    </nav>
  );
}

export default Navbar;
