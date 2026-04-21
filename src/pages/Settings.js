import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API = 'https://trading-bot-backend-production-9a53.up.railway.app/api';

function Settings() {
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
    cryptoSymbols: ['BTC/USDT', 'ETH/USDT'],
    stockSymbols: ['AAPL', 'TSLA', 'NVDA', 'XOM', 'CVX']
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    axios.get(`${API}/bot/status`).then(res => {
      if (res.data) setSettings(res.data);
    });
  }, []);

  async function saveSettings() {
    try {
      await axios.put(`${API}/bot/settings`, settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert('Failed to save settings');
    }
  }

  return (
    <div>
      <h1 className="page-title">Settings</h1>

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
            value={settings.maxTradeAmount}
            onChange={e => setSettings({ ...settings, maxTradeAmount: parseFloat(e.target.value) })}
          />
        </div>

        <div className="form-group">
          <label>Stop Loss (%)</label>
          <input
            type="number"
            value={settings.stopLossPercent}
            onChange={e => setSettings({ ...settings, stopLossPercent: parseFloat(e.target.value) })}
          />
        </div>

        <div className="form-group">
          <label>Take Profit (%)</label>
          <input
            type="number"
            value={settings.takeProfitPercent}
            onChange={e => setSettings({ ...settings, takeProfitPercent: parseFloat(e.target.value) })}
          />
        </div>

        <div className="form-group">
          <label>Max Daily Loss (% of total capital)</label>
          <input
            type="number"
            value={settings.maxDailyLossPercent}
            onChange={e => setSettings({ ...settings, maxDailyLossPercent: parseFloat(e.target.value) })}
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
              onChange={e => setSettings({ ...settings, trailingStopPercent: parseFloat(e.target.value) })}
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
              onChange={e => setSettings({ ...settings, minWinRate: parseFloat(e.target.value) })}
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
            When enabled: bot opens a SHORT position when AI says SELL with 60%+ confidence.
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
            onChange={e => setSettings({ ...settings, leverageMultiplier: parseFloat(e.target.value) })}
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
          <label>Crypto Symbols (comma separated)</label>
          <input
            type="text"
            value={settings.cryptoSymbols?.join(', ')}
            onChange={e => setSettings({ ...settings, cryptoSymbols: e.target.value.split(',').map(s => s.trim()) })}
          />
        </div>

        <div className="form-group">
          <label>Stock Symbols (comma separated)</label>
          <input
            type="text"
            value={settings.stockSymbols?.join(', ')}
            onChange={e => setSettings({ ...settings, stockSymbols: e.target.value.split(',').map(s => s.trim()) })}
          />
        </div>

        <button className="save-btn" onClick={saveSettings}>
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>

      {/* Info */}
      <div className="section" style={{ maxWidth: 600 }}>
        <h3>How The Bot Works</h3>
        <div style={{ color: '#888', fontSize: 14, lineHeight: 1.8 }}>
          <p>1. Every 15 minutes the bot runs an analysis cycle</p>
          <p>2. It fetches latest news for each symbol</p>
          <p>3. It checks current price and 24h change</p>
          <p>4. For crypto, it checks whale wallet activity</p>
          <p>5. All data is sent to Claude AI for decision</p>
          <p>6. If confidence is 60%+ and decision is BUY → opens LONG position</p>
          <p>6b. If confidence is 60%+ and decision is SELL + shorting enabled → opens SHORT position</p>
          <p>7. All signals and trades are logged to dashboard</p>
        </div>
      </div>
    </div>
  );
}

export default Settings;
