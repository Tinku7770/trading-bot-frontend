import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useApp } from '../context/AppContext';

const API = process.env.REACT_APP_API_URL;

function SymbolTags({ symbols, onChange, placeholder }) {
  const [input, setInput] = useState('');
  const inputRef = useRef(null);

  function addSymbol() {
    const val = input.trim().toUpperCase();
    if (val && !symbols.includes(val)) onChange([...symbols, val]);
    setInput('');
  }

  function removeSymbol(sym) {
    onChange(symbols.filter(s => s !== sym));
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addSymbol(); }
    if (e.key === 'Backspace' && input === '' && symbols.length > 0)
      onChange(symbols.slice(0, -1));
  }

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      style={{
        display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center',
        background: '#0d0f1a', border: '1px solid #2a2d3e', borderRadius: 8,
        padding: '8px 10px', cursor: 'text', minHeight: 42
      }}
    >
      {symbols.map(sym => (
        <span key={sym} style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: '#1a1d2e', border: '1px solid #2a2d3e',
          borderRadius: 20, padding: '3px 10px 3px 12px',
          fontSize: 13, fontWeight: 600, color: '#c9d1d9'
        }}>
          {sym}
          <button
            onClick={e => { e.stopPropagation(); removeSymbol(sym); }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#555', fontSize: 14, lineHeight: 1, padding: 0,
              display: 'flex', alignItems: 'center'
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#ff3d3d'}
            onMouseLeave={e => e.currentTarget.style.color = '#555'}
          >×</button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={addSymbol}
        placeholder={symbols.length === 0 ? placeholder : ''}
        style={{
          background: 'none', border: 'none', outline: 'none',
          color: '#c9d1d9', fontSize: 13, minWidth: 120, flex: 1
        }}
      />
    </div>
  );
}

function Settings() {
  const { setTradeMode } = useApp();
  const [settings, setSettings] = useState({
    maxTradeAmount: 1000,
    stopLossPercent: 1,
    takeProfitPercent: 1.5,
    maxDailyLossPercent: 5,
    tradeMode: 'paper',
    shortingEnabled: false,
    leverageMultiplier: 1,
    trailingStopEnabled: false,
    trailingStopPercent: 2,
    winRatePauseEnabled: false,
    minWinRate: 40,
    minConfidence: 60,
    cryptoSymbols: ['BTC/USDT', 'ETH/USDT'],
    stockSymbols: ['AAPL', 'TSLA', 'NVDA', 'XOM', 'CVX']
  });
  const [saved, setSaved] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    axios.get(`${API}/bot/status`)
      .then(res => { if (res.data) { setSettings(res.data); setLoadError(false); } })
      .catch(() => setLoadError(true));
  }, []);

  function numInput(field, value) {
    const parsed = parseFloat(value);
    setSettings({ ...settings, [field]: isNaN(parsed) ? '' : parsed });
  }

  async function saveSettings() {
    try {
      await axios.put(`${API}/bot/settings`, settings);
      setTradeMode(settings.tradeMode);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert('Failed to save settings — check your connection');
    }
  }

  return (
    <div>
      <h1 className="page-title">Settings</h1>

      {loadError && (
        <div style={{
          background: '#2a1a1a', border: '1px solid #ff3d3d', borderRadius: 8,
          padding: '12px 16px', marginBottom: 20, color: '#ff3d3d', fontSize: 13
        }}>
          Could not load saved settings — showing defaults. Check your connection or restart the dev server.
        </div>
      )}

      <div className="section" style={{ maxWidth: 600 }}>
        <h3>Trading Settings</h3>

        <div className="form-group">
          <label>Trade Mode</label>
          <select value={settings.tradeMode} onChange={e => setSettings({ ...settings, tradeMode: e.target.value })}>
            <option value="paper">Paper Trading (Simulated)</option>
            <option value="live">Live Trading (Real Money)</option>
          </select>
          {settings.tradeMode === 'live' && (
            <p style={{ color: '#ff3d3d', fontSize: 12, marginTop: 6 }}>
              Warning: Live mode uses real money. Use at your own risk.
            </p>
          )}
        </div>

        <div className="form-group">
          <label>Max Trade Amount ($)</label>
          <input
            type="number"
            min="1"
            value={settings.maxTradeAmount}
            onChange={e => numInput('maxTradeAmount', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Stop Loss (%)</label>
          <input
            type="number"
            min="0.1"
            step="0.1"
            value={settings.stopLossPercent}
            onChange={e => numInput('stopLossPercent', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Take Profit (%)</label>
          <input
            type="number"
            min="0.1"
            step="0.1"
            value={settings.takeProfitPercent}
            onChange={e => numInput('takeProfitPercent', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Max Daily Loss (% of total capital)</label>
          <input
            type="number"
            min="0.1"
            step="0.5"
            value={settings.maxDailyLossPercent}
            onChange={e => numInput('maxDailyLossPercent', e.target.value)}
          />
          <p style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
            Bot auto-stops if daily loss exceeds this % of your capital. e.g. 5% of $1,000 = bot stops after -$50 loss in one day.
          </p>
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.trailingStopEnabled || false}
              onChange={e => setSettings({ ...settings, trailingStopEnabled: e.target.checked })}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
            <span>Enable Trailing Stop Loss</span>
            <span style={{ background: '#1a2a0d', color: '#00c853', fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>PROTECTS PROFITS</span>
          </label>
          <p style={{ color: '#888', fontSize: 12, marginTop: 6 }}>
            Stop loss moves UP as price moves in your favor. Locks in profits instead of risking a full reversal.
          </p>
        </div>

        {settings.trailingStopEnabled && (
          <div className="form-group">
            <label>Trailing Stop Distance (%)</label>
            <input
              type="number"
              min="0.5"
              max="10"
              step="0.5"
              value={settings.trailingStopPercent || 2}
              onChange={e => numInput('trailingStopPercent', e.target.value)}
            />
            <p style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
              e.g. 2% — if TSLA peaks at $420, stop sits at $411.60. If price drops to $411.60 → closes trade.
            </p>
          </div>
        )}

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.winRatePauseEnabled || false}
              onChange={e => setSettings({ ...settings, winRatePauseEnabled: e.target.checked })}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
            <span>Win Rate Auto-Pause</span>
            <span style={{ background: '#1a0d2a', color: '#a855f7', fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>PROTECTS CAPITAL</span>
          </label>
          <p style={{ color: '#888', fontSize: 12, marginTop: 6 }}>
            Bot pauses automatically if today's win rate drops below minimum (after 5+ trades). Sends Telegram alert.
          </p>
        </div>

        {settings.winRatePauseEnabled && (
          <div className="form-group">
            <label>Minimum Win Rate (%) before auto-pause</label>
            <input
              type="number"
              min="10"
              max="80"
              step="5"
              value={settings.minWinRate || 40}
              onChange={e => numInput('minWinRate', e.target.value)}
            />
            <p style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
              Recommended: 40%. Bot pauses if win rate falls below this after at least 5 trades today.
            </p>
          </div>
        )}

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.shortingEnabled || false}
              onChange={e => setSettings({ ...settings, shortingEnabled: e.target.checked })}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
            <span>Enable Short Selling</span>
            <span style={{ background: '#3d1a00', color: '#ff6b35', fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>SHORT</span>
          </label>
          <p style={{ color: '#888', fontSize: 12, marginTop: 6 }}>
            When enabled: bot opens a SHORT position when AI says SELL with {settings.minConfidence || 65}%+ confidence.
            Profits when price goes <strong style={{ color: '#ff6b35' }}>down</strong>, loses when price goes up.
          </p>
        </div>

        <div className="form-group">
          <label>Leverage Multiplier (1x = no leverage)</label>
          <input
            type="number"
            min="1"
            max="10"
            step="0.5"
            value={settings.leverageMultiplier || 1}
            onChange={e => numInput('leverageMultiplier', e.target.value)}
          />
          {(settings.leverageMultiplier || 1) > 1 && (
            <p style={{ color: '#ff3d3d', fontSize: 12, marginTop: 4 }}>
              ⚠️ {settings.leverageMultiplier}x leverage amplifies both gains AND losses by {settings.leverageMultiplier}x.
              Only use in paper trading mode to test.
            </p>
          )}
          {(settings.leverageMultiplier || 1) === 1 && (
            <p style={{ color: '#888', fontSize: 12, marginTop: 4 }}>1x = no leverage (spot trading). Try 2x or 3x to test.</p>
          )}
        </div>

        <div className="form-group">
          <label>Minimum AI Confidence (%) to Trade</label>
          <input
            type="number"
            min="55"
            max="90"
            step="5"
            value={settings.minConfidence || 65}
            onChange={e => numInput('minConfidence', e.target.value)}
          />
          <p style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
            Bot only trades when AI confidence is at or above this %. Higher = fewer but better trades. Recommended: 65%.
          </p>
        </div>

        <div className="form-group">
          <label>Crypto Symbols</label>
          <SymbolTags
            symbols={settings.cryptoSymbols || []}
            onChange={val => setSettings({ ...settings, cryptoSymbols: val })}
            placeholder="Type symbol + Enter (e.g. BTC/USDT)"
          />
          <p style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
            Type a symbol and press Enter to add. Click × to remove.
          </p>
        </div>

        <div className="form-group">
          <label>Stock Symbols</label>
          <SymbolTags
            symbols={settings.stockSymbols || []}
            onChange={val => setSettings({ ...settings, stockSymbols: val })}
            placeholder="Type symbol + Enter (e.g. AAPL)"
          />
          <p style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
            Type a symbol and press Enter to add. Click × to remove.
          </p>
        </div>

        <button className="save-btn" onClick={saveSettings}>
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>

      {/* Info */}
      <div className="section" style={{ maxWidth: 600 }}>
        <h3>How The Bot Works</h3>
        <div style={{ color: '#888', fontSize: 14, lineHeight: 1.8 }}>
          <p>1. Every 30 minutes the bot runs an analysis cycle</p>
          <p>2. It fetches latest news, price, whale activity for each symbol</p>
          <p>3. Technical indicators: RSI, MACD, MA50, MA200</p>
          <p>4. Social sentiment from StockTwits + Polymarket predictions</p>
          <p>5. All data is sent to Claude AI for a trading decision</p>
          <p>6. If confidence ≥ {settings.minConfidence || 65}% and decision is BUY → opens LONG position</p>
          <p>7. If confidence ≥ {settings.minConfidence || 65}% and decision is SELL + shorting enabled → opens SHORT</p>
          <p>8. Stop loss at {settings.stopLossPercent || 1}% | Take profit at {settings.takeProfitPercent || 1.5}%</p>
          <p>9. Daily report sent at 1 AM UTC</p>
        </div>
      </div>
    </div>
  );
}

export default Settings;
