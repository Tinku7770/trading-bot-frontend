import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import './Navbar.css';

function Navbar() {
  const location = useLocation();
  const { botStatus, tradeMode } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = [
    { path: '/',            label: 'Dashboard' },
    { path: '/portfolio',   label: 'Portfolio' },
    { path: '/trades',      label: 'Trades' },
    { path: '/signals',     label: 'Signals' },
    { path: '/market',      label: 'Market' },
    { path: '/performance', label: 'Performance' },
    { path: '/backtest',    label: 'Backtest' },
    { path: '/settings',    label: 'Settings' }
  ];

  function closeMenu() { setMenuOpen(false); }

  return (
    <>
      <nav className="navbar">
        <div className="navbar-brand">
          <span className="brand-icon">AI</span>
          <span className="brand-name">TradingBot</span>
        </div>

        {/* Desktop links */}
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

        {/* Hamburger button — mobile only */}
        <button
          className="hamburger"
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Toggle menu"
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </nav>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <>
          <div className="mobile-menu-overlay" onClick={closeMenu} />
          <div className="mobile-menu">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderBottom: '1px solid #2a2d3e', marginBottom: 8 }}>
              <span className={`status-dot ${botStatus ? 'running' : 'stopped'}`}></span>
              <span style={{ fontSize: 13, color: '#888' }}>{botStatus ? 'Bot Running' : 'Bot Stopped'}</span>
              <span className="mode-badge" style={{ marginLeft: 4 }}>{tradeMode === 'paper' ? 'Paper' : 'Live'}</span>
            </div>
            {links.map(link => (
              <Link
                key={link.path}
                to={link.path}
                className={`mobile-nav-link ${location.pathname === link.path ? 'active' : ''}`}
                onClick={closeMenu}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}

export default Navbar;
