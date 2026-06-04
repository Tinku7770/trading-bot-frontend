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
        placeholder={symbols.length === 0 ? placeholder : ''}
        style={{
          background: 'none', border: 'none', outline: 'none',
          color: '#c9d1d9', fontSize: 13, minWidth: 120, flex: 1
        }}
      />
    </div>
  );
}

function ConnectionDot({ connected, configured }) {
  const color = connected ? '#00c853' : configured ? '#ff3d3d' : '#555';
  return (
    <div style={{
      width: 10, height: 10, borderRadius: '50%', background: color,
      boxShadow: connected ? `0 0 6px ${color}` : 'none', flexShrink: 0
    }} />
  );
}

function Settings() {
  const { setTradeMode } = useApp();
  const [connStatus, setConnStatus] = useState(null);
  const [testing, setTesting]       = useState(false);
  const [settings, setSettings] = useState({
    totalCapital: 2000,
    maxTradeAmount: 1000,
    stopLossPercent: 1,
    takeProfitPercent: 1.5,
    maxDailyLossPercent: 5,
    tradeMode: 'paper',
    shortingEnabled: false,
    leverageMultiplier: 1,
    cryptoLeverageMultiplier: 1,
    trailingStopEnabled: false,
    trailingStopPercent: 2,
    trailingStopActivationPercent: 2,
    breakevenStopEnabled: false,
    breakevenActivationPercent: 1.5,
    weeklyTrendFilterEnabled: false,
    maxWeeklyLossPercent: 10,
    winRatePauseEnabled: false,
    minWinRate: 40,
    scaleOutEnabled: false,
    cryptoEnabled: true,
    krakenEnabled: false,
    minConfidence: 60,
    maxConcurrentPositions: 3,
    maxHoldHours: 48,
    aiModel: 'claude-haiku-4-5-20251001',
    cryptoSymbols: [],
    stockSymbols: []
  });
  const [saved, setSaved] = useState(false);
  const [savedFields, setSavedFields] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [originalSettings, setOriginalSettings] = useState(null);
  const [showLiveConfirm, setShowLiveConfirm] = useState(false);

  useEffect(() => {
    axios.get(`${API}/bot/status`)
      .then(res => {
        if (res.data) {
          setSettings(res.data);
          setOriginalSettings(res.data);
          setLoadError(false);
        }
      })
      .catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    axios.get(`${API}/bot/connection-status`)
      .then(res => setConnStatus(res.data))
      .catch(() => {});
  }, []);

  async function testConnections() {
    setTesting(true);
    try {
      const res = await axios.get(`${API}/bot/connection-status`);
      setConnStatus(res.data);
    } catch {}
    setTesting(false);
  }

  function updateSettings(patch) {
    setSettings(prev => ({ ...prev, ...patch }));
    setDirty(true);
  }

  function numInput(field, value) {
    const parsed = parseFloat(value);
    updateSettings({ [field]: isNaN(parsed) ? 0 : parsed });
  }

  function validate() {
    if ((settings.stopLossPercent || 0) <= 0) return 'Stop Loss must be greater than 0%';
    if ((settings.takeProfitPercent || 0) <= 0) return 'Take Profit must be greater than 0%';
    if ((settings.maxDailyLossPercent || 0) <= 0) return 'Max Daily Loss must be greater than 0%';
    if ((settings.minConfidence || 0) < 50 || (settings.minConfidence || 0) > 90) return 'Stock Min Confidence must be between 50% and 90%';
    if ((settings.cryptoMinConfidence || 0) < 50 || (settings.cryptoMinConfidence || 0) > 90) return 'Crypto Min Confidence must be between 50% and 90%';
    if ((settings.leverageMultiplier || 0) < 1) return 'Stock Leverage must be at least 1x';
    if ((settings.leverageMultiplier || 0) > 10) return 'Stock Leverage cannot exceed 10x';
    if ((settings.cryptoLeverageMultiplier || 0) < 1) return 'Crypto Leverage must be at least 1x';
    if ((settings.cryptoLeverageMultiplier || 0) > 10) return 'Crypto Leverage cannot exceed 10x';
    if ((settings.totalCapital || 0) <= 0) return 'Total Account Capital must be greater than $0';
    if ((settings.maxTradeAmount || 0) <= 0) return 'Max Trade Amount must be greater than $0';
    if ((settings.maxTradeAmount || 0) > (settings.totalCapital || Infinity)) return 'Max Trade Amount cannot exceed Total Account Capital';
    if ((settings.cryptoSymbols?.length || 0) + (settings.stockSymbols?.length || 0) === 0) return 'Add at least one symbol to trade';
    return null;
  }

  function handleTradeModeChange(newMode) {
    if (newMode === 'live' && settings.tradeMode !== 'live') {
      setShowLiveConfirm(true);
    } else {
      updateSettings({ tradeMode: newMode });
      setShowLiveConfirm(false);
    }
  }

  function confirmLiveMode() {
    updateSettings({ tradeMode: 'live' });
    setShowLiveConfirm(false);
  }

  function discardSettings() {
    if (originalSettings) {
      setSettings(originalSettings);
      setDirty(false);
      setSaveError('');
      setShowLiveConfirm(false);
    }
  }

  async function saveSettings() {
    const err = validate();
    if (err) { setSaveError(err); return; }
    setSaveError('');
    try {
      const { _id, __v, cooldowns, updatedAt, isRunning, ...payload } = settings;
      await axios.put(`${API}/bot/settings`, payload);
      setTradeMode(settings.tradeMode);

      // Build a summary of what changed so the user knows exactly what was saved
      const changes = [];
      if (originalSettings) {
        if (originalSettings.tradeMode !== settings.tradeMode) changes.push(`Trade Mode → ${settings.tradeMode}`);
        if (originalSettings.totalCapital !== settings.totalCapital) changes.push(`Account Capital → $${settings.totalCapital}`);
        if (originalSettings.maxTradeAmount !== settings.maxTradeAmount) changes.push(`Max Trade Amount → $${settings.maxTradeAmount}`);
        if (originalSettings.stopLossPercent !== settings.stopLossPercent) changes.push(`Stop Loss → ${settings.stopLossPercent}%`);
        if (originalSettings.takeProfitPercent !== settings.takeProfitPercent) changes.push(`Take Profit → ${settings.takeProfitPercent}%`);
        if (originalSettings.maxDailyLossPercent !== settings.maxDailyLossPercent) changes.push(`Max Daily Loss → ${settings.maxDailyLossPercent}%`);
        if (originalSettings.minConfidence !== settings.minConfidence) changes.push(`Stock Min Confidence → ${settings.minConfidence}%`);
        if (originalSettings.cryptoMinConfidence !== settings.cryptoMinConfidence) changes.push(`Crypto Min Confidence → ${settings.cryptoMinConfidence}%`);
        if (originalSettings.leverageMultiplier !== settings.leverageMultiplier) changes.push(`Stock Leverage → ${settings.leverageMultiplier}x`);
        if (originalSettings.cryptoLeverageMultiplier !== settings.cryptoLeverageMultiplier) changes.push(`Crypto Leverage → ${settings.cryptoLeverageMultiplier}x`);
        if (originalSettings.shortingEnabled !== settings.shortingEnabled) changes.push(`Shorting → ${settings.shortingEnabled ? 'ON' : 'OFF'}`);
        if (originalSettings.trailingStopEnabled !== settings.trailingStopEnabled) changes.push(`Trailing Stop → ${settings.trailingStopEnabled ? 'ON' : 'OFF'}`);
        if (originalSettings.trailingStopPercent !== settings.trailingStopPercent) changes.push(`Trailing Distance → ${settings.trailingStopPercent}%`);
        if (originalSettings.trailingStopActivationPercent !== settings.trailingStopActivationPercent) changes.push(`Trailing Activation → ${settings.trailingStopActivationPercent}%`);
        if (originalSettings.breakevenStopEnabled !== settings.breakevenStopEnabled) changes.push(`Breakeven Stop → ${settings.breakevenStopEnabled ? 'ON' : 'OFF'}`);
        if (originalSettings.breakevenActivationPercent !== settings.breakevenActivationPercent) changes.push(`Breakeven Activation → ${settings.breakevenActivationPercent}%`);
        if (originalSettings.weeklyTrendFilterEnabled !== settings.weeklyTrendFilterEnabled) changes.push(`Weekly Trend Filter → ${settings.weeklyTrendFilterEnabled ? 'ON' : 'OFF'}`);
        if (originalSettings.maxWeeklyLossPercent !== settings.maxWeeklyLossPercent) changes.push(`Max Weekly Loss → ${settings.maxWeeklyLossPercent}%`);
        if (originalSettings.winRatePauseEnabled !== settings.winRatePauseEnabled) changes.push(`Win Rate Pause → ${settings.winRatePauseEnabled ? 'ON' : 'OFF'}`);
        if (originalSettings.minWinRate !== settings.minWinRate) changes.push(`Min Win Rate → ${settings.minWinRate}%`);
        if (originalSettings.scaleOutEnabled !== settings.scaleOutEnabled) changes.push(`Scale-Out Exit → ${settings.scaleOutEnabled ? 'ON' : 'OFF'}`);
        if (originalSettings.krakenEnabled !== settings.krakenEnabled) changes.push(`Kraken Margin Shorts → ${settings.krakenEnabled ? 'ON' : 'OFF'}`);
        if (originalSettings.cryptoEnabled !== settings.cryptoEnabled) changes.push(`Crypto Trading → ${settings.cryptoEnabled !== false ? 'ON' : 'OFF'}`);
        if (originalSettings.maxConcurrentPositions !== settings.maxConcurrentPositions) changes.push(`Max Positions → ${settings.maxConcurrentPositions}`);
        if (originalSettings.maxHoldHours !== settings.maxHoldHours) changes.push(`Stock Max Hold → ${settings.maxHoldHours}h`);
        if (originalSettings.cryptoMaxHoldHours !== settings.cryptoMaxHoldHours) changes.push(`Crypto Core Max Hold → ${settings.cryptoMaxHoldHours}h`);
        if (originalSettings.cryptoScannerMaxHoldHours !== settings.cryptoScannerMaxHoldHours) changes.push(`Crypto Scanner Max Hold → ${settings.cryptoScannerMaxHoldHours}h`);
        if (originalSettings.aiModel !== settings.aiModel) changes.push(`AI Model → ${settings.aiModel}`);
        const prevCrypto = (originalSettings.cryptoSymbols || []).join(',');
        const newCrypto  = (settings.cryptoSymbols || []).join(',');
        if (prevCrypto !== newCrypto) changes.push(`Crypto symbols updated (${(settings.cryptoSymbols || []).length} symbols)`);
        const prevStocks = (originalSettings.stockSymbols || []).join(',');
        const newStocks  = (settings.stockSymbols || []).join(',');
        if (prevStocks !== newStocks) changes.push(`Stock symbols updated (${(settings.stockSymbols || []).length} symbols)`);
      }

      setOriginalSettings(settings);
      setSaved(true);
      setSavedFields(changes.length > 0 ? changes : ['All settings saved']);
      setDirty(false);
      setTimeout(() => { setSaved(false); setSavedFields(null); }, 8000);
    } catch {
      setSaveError('Failed to save settings — check your connection');
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
          <select value={settings.tradeMode} onChange={e => handleTradeModeChange(e.target.value)}>
            <option value="paper">Paper Trading (Simulated)</option>
            <option value="live">Live Trading (Real Money)</option>
          </select>
          {settings.tradeMode === 'live' && !showLiveConfirm && (
            <p style={{ color: '#ff3d3d', fontSize: 12, marginTop: 6 }}>
              Live mode is active — bot is trading with real money.
            </p>
          )}
          {showLiveConfirm && (
            <div style={{
              marginTop: 10, background: '#2a1500', border: '1px solid #ff3d3d',
              borderRadius: 8, padding: '14px 16px'
            }}>
              <p style={{ color: '#ff3d3d', fontWeight: 700, fontSize: 13, margin: '0 0 6px' }}>
                Switch to Live Trading?
              </p>
              <p style={{ color: '#c8852a', fontSize: 12, margin: '0 0 12px', lineHeight: 1.6 }}>
                This will use <strong>real money</strong> on your connected Alpaca and Binance accounts.
                Make sure your API keys are configured and you understand the risks before proceeding.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={confirmLiveMode}
                  style={{
                    background: '#ff3d3d', border: 'none', borderRadius: 6,
                    padding: '7px 14px', color: '#fff', fontSize: 13,
                    fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  Yes, switch to Live
                </button>
                <button
                  onClick={() => setShowLiveConfirm(false)}
                  style={{
                    background: 'none', border: '1px solid #2a2d3e', borderRadius: 6,
                    padding: '7px 14px', color: '#888', fontSize: 13, cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="form-group">
          <label>AI Model</label>
          <select value={settings.aiModel || 'claude-haiku-4-5-20251001'} onChange={e => updateSettings({ aiModel: e.target.value })}>
            <option value="claude-haiku-4-5-20251001">Claude Haiku (Fast · Cheapest · Recommended)</option>
            <option value="claude-sonnet-4-6">Claude Sonnet 4.6 (Smarter · Higher Cost)</option>
            <option value="claude-opus-4-7">Claude Opus 4.7 (Most Powerful · Most Expensive)</option>
          </select>
          <p style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
            Model used for every BUY/SELL/HOLD decision. <strong style={{ color: '#c9d1d9' }}>Haiku</strong> runs ~100 decisions/day cheaply.
            Switch to <strong style={{ color: '#c9d1d9' }}>Sonnet</strong> for higher quality decisions when using larger capital or live trading.
          </p>
          {(settings.aiModel || '').includes('opus') && (
            <div style={{ background: '#2a1500', border: '1px solid #f5a623', borderRadius: 8, padding: '10px 14px', marginTop: 8 }}>
              <span style={{ color: '#f5a623', fontSize: 12, fontWeight: 700 }}>⚠️ Opus is ~15x more expensive than Haiku per decision. Only recommended for live trading with significant capital.</span>
            </div>
          )}
        </div>

        <div className="form-group">
          <label>Total Account Capital ($)</label>
          <input
            type="number"
            min="1"
            value={settings.totalCapital ?? 2000}
            onChange={e => numInput('totalCapital', e.target.value)}
          />
          <p style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
            Your total paper/live account size. Used for daily/weekly loss limit calculations.
            e.g. {settings.maxDailyLossPercent || 5}% of ${(settings.totalCapital || 2000).toLocaleString()} = bot stops after a <strong style={{ color: '#ff3d3d' }}>-${((settings.totalCapital || 2000) * (settings.maxDailyLossPercent || 5) / 100).toFixed(0)}</strong> daily loss.
          </p>
        </div>

        <div className="form-group">
          <label>Max Trade Amount — per trade ($)</label>
          <input
            type="number"
            min="1"
            value={settings.maxTradeAmount}
            onChange={e => numInput('maxTradeAmount', e.target.value)}
          />
          <div style={{ marginTop: 8, background: '#0d0f1a', border: '1px solid #2a2d3e', borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ color: '#888', fontSize: 11, marginBottom: 8 }}>Position size scales with AI confidence — higher conviction = larger trade:</div>
            {[
              { label: '90%+ confidence', pct: 1.00, color: '#00c853' },
              { label: '80–89% confidence', pct: 0.75, color: '#69f0ae' },
              { label: '70–79% confidence', pct: 0.50, color: '#f5a623' },
              { label: '60–69% confidence', pct: 0.25, color: '#ff7043' },
            ].map(({ label, pct, color }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <span style={{ color: '#888', fontSize: 12 }}>{label}</span>
                <span style={{ color, fontWeight: 700, fontSize: 13 }}>
                  ${((settings.maxTradeAmount || 0) * pct).toFixed(0)}
                </span>
              </div>
            ))}
            <div style={{ color: '#555', fontSize: 11, marginTop: 8, borderTop: '1px solid #1a1d2e', paddingTop: 8 }}>
              Max exposure ({settings.maxConcurrentPositions ?? 3} positions × ${(settings.maxTradeAmount || 0).toFixed(0)}): <strong style={{ color: '#c9d1d9' }}>${((settings.maxTradeAmount || 0) * (settings.maxConcurrentPositions ?? 3)).toFixed(0)}</strong>
              {' '}({(((settings.maxTradeAmount || 0) * (settings.maxConcurrentPositions ?? 3)) / (settings.totalCapital || 1) * 100).toFixed(0)}% of capital)
            </div>
          </div>
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
          <label>Max Weekly Loss (% of total capital)</label>
          <input
            type="number"
            min="0.1"
            step="0.5"
            value={settings.maxWeeklyLossPercent ?? 10}
            onChange={e => numInput('maxWeeklyLossPercent', e.target.value)}
          />
          <p style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
            Bot auto-stops for the week if cumulative loss (Monday UTC reset) exceeds this %. e.g. 10% of $1,000 = bot stops after -$100 loss in one week.
          </p>
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.trailingStopEnabled || false}
              onChange={e => updateSettings({ trailingStopEnabled: e.target.checked })}
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

        {settings.trailingStopEnabled && (
          <div className="form-group">
            <label>Trailing Stop Activation Threshold (%)</label>
            <input
              type="number"
              min="0.5"
              max="10"
              step="0.5"
              value={settings.trailingStopActivationPercent ?? 2}
              onChange={e => numInput('trailingStopActivationPercent', e.target.value)}
            />
            <p style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
              Trailing stop only kicks in after the trade gains this much. Prevents early exits on normal noise.
              e.g. 2% = trailing stop ignores the trade until it's up 2%, then starts protecting profits.
            </p>
          </div>
        )}

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.winRatePauseEnabled || false}
              onChange={e => updateSettings({ winRatePauseEnabled: e.target.checked })}
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
              checked={settings.scaleOutEnabled || false}
              onChange={e => updateSettings({ scaleOutEnabled: e.target.checked })}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
            <span>Scale-Out Exit</span>
            <span style={{ background: '#0d1a2a', color: '#5865f2', fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>MAXIMIZES WINNERS</span>
          </label>
          <p style={{ color: '#888', fontSize: 12, marginTop: 6 }}>
            When take profit is hit, closes <strong style={{ color: '#c9d1d9' }}>50% of the position</strong> to lock in gains.
            The remaining 50% stays open with a trailing stop — letting winners run further.
          </p>
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.breakevenStopEnabled || false}
              onChange={e => updateSettings({ breakevenStopEnabled: e.target.checked })}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
            <span>Breakeven Stop</span>
            <span style={{ background: '#0d1a2a', color: '#5865f2', fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>LOCKS ENTRY</span>
          </label>
          <p style={{ color: '#888', fontSize: 12, marginTop: 6 }}>
            After a trade gains enough profit, locks the entry price as the stop floor.
            If price then falls back to entry → closes at breakeven instead of a loss.
          </p>
        </div>

        {settings.breakevenStopEnabled && (
          <div className="form-group">
            <label>Breakeven Activation Threshold (%)</label>
            <input
              type="number"
              min="0.5"
              max="10"
              step="0.5"
              value={settings.breakevenActivationPercent ?? 1.5}
              onChange={e => numInput('breakevenActivationPercent', e.target.value)}
            />
            <p style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
              Breakeven stop locks in after the trade gains this %. e.g. 1.5% = once trade is up 1.5%, entry price becomes the floor.
            </p>
          </div>
        )}

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.shortingEnabled || false}
              onChange={e => updateSettings({ shortingEnabled: e.target.checked })}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
            <span>Enable Short Selling</span>
            <span style={{ background: '#3d1a00', color: '#ff6b35', fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>SHORT</span>
          </label>
          <p style={{ color: '#888', fontSize: 12, marginTop: 6 }}>
            When AI says SELL with {settings.minConfidence}%+ confidence, the bot opens a SHORT — profits when price goes{' '}
            <strong style={{ color: '#ff6b35' }}>down</strong>, loses when price goes up.
          </p>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ color: '#00c853', fontSize: 12, fontWeight: 700, minWidth: 14 }}>✓</span>
              <span style={{ color: '#888', fontSize: 12 }}>
                <strong style={{ color: '#c9d1d9' }}>Stocks (paper + live)</strong> — Alpaca supports short selling. Works in both modes.
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ color: '#f5a623', fontSize: 12, fontWeight: 700, minWidth: 14 }}>!</span>
              <span style={{ color: '#888', fontSize: 12 }}>
                <strong style={{ color: '#c9d1d9' }}>Crypto (paper only)</strong> — Binance.US spot accounts cannot short-sell. Crypto shorts are recorded in paper mode but skipped in live mode. SELL signals are still shown on the dashboard either way.
              </span>
            </div>
          </div>
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.weeklyTrendFilterEnabled || false}
              onChange={e => updateSettings({ weeklyTrendFilterEnabled: e.target.checked })}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
            <span>Weekly Trend Filter</span>
            <span style={{ background: '#0d1a0d', color: '#00c853', fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>TREND ALIGNMENT</span>
          </label>
          <p style={{ color: '#888', fontSize: 12, marginTop: 6 }}>
            Checks the weekly MA10 trend before entering. Only BUYs when weekly trend is up; only SHORTs when weekly trend is down.
            Filters out counter-trend trades that fight the bigger picture.
          </p>
        </div>

        <div className="form-group">
          <label>Stock Leverage Multiplier (1x = no leverage)</label>
          <input
            type="number"
            min="1"
            max="10"
            step="0.5"
            value={settings.leverageMultiplier || 1}
            onChange={e => numInput('leverageMultiplier', e.target.value)}
          />
          {(settings.leverageMultiplier || 1) > 3 && (
            <div style={{
              background: '#2a1500', border: '1px solid #f5a623', borderRadius: 8,
              padding: '10px 14px', marginTop: 8
            }}>
              <div style={{ color: '#f5a623', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                ⚠️ High Leverage Warning — {settings.leverageMultiplier}x
              </div>
              <p style={{ color: '#c8852a', fontSize: 12, margin: 0, lineHeight: 1.6 }}>
                A 1% move against you = <strong style={{ color: '#f5a623' }}>{settings.leverageMultiplier}% real loss</strong>.
                A {(100 / settings.leverageMultiplier).toFixed(0)}% move = full liquidation.
                Only use this in paper trading until you fully understand the risk.
              </p>
            </div>
          )}
          {(settings.leverageMultiplier || 1) > 1 && (settings.leverageMultiplier || 1) <= 3 && (
            <p style={{ color: '#f5a623', fontSize: 12, marginTop: 4 }}>
              ⚠️ {settings.leverageMultiplier}x leverage amplifies both gains AND losses by {settings.leverageMultiplier}x.
            </p>
          )}
          {(settings.leverageMultiplier || 1) === 1 && (
            <p style={{ color: '#888', fontSize: 12, marginTop: 4 }}>1x = no leverage (spot trading). Stocks: keep at 1x unless you know margin trading well.</p>
          )}
        </div>

        <div className="form-group">
          <label>Crypto Leverage Multiplier (1x = no leverage)</label>
          <input
            type="number"
            min="1"
            max="10"
            step="0.5"
            value={settings.cryptoLeverageMultiplier || 1}
            onChange={e => numInput('cryptoLeverageMultiplier', e.target.value)}
          />
          {(settings.cryptoLeverageMultiplier || 1) > 3 && (
            <div style={{
              background: '#2a1500', border: '1px solid #f5a623', borderRadius: 8,
              padding: '10px 14px', marginTop: 8
            }}>
              <div style={{ color: '#f5a623', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                ⚠️ High Leverage Warning — {settings.cryptoLeverageMultiplier}x on Crypto
              </div>
              <p style={{ color: '#c8852a', fontSize: 12, margin: 0, lineHeight: 1.6 }}>
                A 1% move against you = <strong style={{ color: '#f5a623' }}>{settings.cryptoLeverageMultiplier}% real loss</strong>.
                Crypto is more volatile than stocks — high leverage can liquidate quickly.
              </p>
            </div>
          )}
          {(settings.cryptoLeverageMultiplier || 1) > 1 && (settings.cryptoLeverageMultiplier || 1) <= 3 && (
            <p style={{ color: '#f5a623', fontSize: 12, marginTop: 4 }}>
              ⚠️ {settings.cryptoLeverageMultiplier}x leverage amplifies both gains AND losses by {settings.cryptoLeverageMultiplier}x.
            </p>
          )}
          {(settings.cryptoLeverageMultiplier || 1) === 1 && (
            <p style={{ color: '#888', fontSize: 12, marginTop: 4 }}>1x = no leverage (spot trading). Try 2x for crypto — it's commonly used and manageable.</p>
          )}
        </div>

        <div className="form-group">
          <label>Min AI Confidence — Stocks (%)</label>
          <input
            type="number"
            min="50"
            max="90"
            step="1"
            value={settings.minConfidence ?? 60}
            onChange={e => numInput('minConfidence', e.target.value)}
          />
          <p style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
            Stocks only. Bot trades when AI confidence ≥ this %. 50–60% = more trades, higher risk. 65–75% = fewer but higher quality. Recommended: 63%.
          </p>
        </div>

        <div className="form-group">
          <label>Min AI Confidence — Crypto (%)</label>
          <input
            type="number"
            min="50"
            max="90"
            step="1"
            value={settings.cryptoMinConfidence ?? 72}
            onChange={e => numInput('cryptoMinConfidence', e.target.value)}
          />
          <p style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
            Crypto only. Higher than stocks because crypto is more volatile and spot-only (no shorting). Recommended: 72–75%. Scanner picks use 58% regardless.
          </p>
        </div>

        <div className="form-group">
          <label>Max Concurrent Positions</label>
          <input
            type="number"
            min="1"
            max="20"
            step="1"
            value={settings.maxConcurrentPositions ?? 3}
            onChange={e => numInput('maxConcurrentPositions', e.target.value)}
          />
          <p style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
            Bot will not open new trades when this many positions are already open.
            Lower = less capital at risk at once. Recommended: 3–5.
          </p>
        </div>

        <div className="form-group">
          <label>Max Hold Time — Stocks (hours)</label>
          <input
            type="number"
            min="1"
            max="168"
            step="1"
            value={settings.maxHoldHours ?? 48}
            onChange={e => numInput('maxHoldHours', e.target.value)}
          />
          <p style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
            Stocks only. Any position held longer than this is automatically closed regardless of P/L. Recommended: 24–72h.
          </p>
        </div>

        <div className="form-group">
          <label>Max Hold Time — Crypto Core Watchlist (hours)</label>
          <input
            type="number"
            min="1"
            max="168"
            step="1"
            value={settings.cryptoMaxHoldHours ?? 16}
            onChange={e => numInput('cryptoMaxHoldHours', e.target.value)}
          />
          <p style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
            BTC, ETH and any coin you added manually to your crypto watchlist. Recommended: 12–24h.
          </p>
        </div>

        <div className="form-group">
          <label>Max Hold Time — Crypto Scanner Picks (hours)</label>
          <input
            type="number"
            min="1"
            max="48"
            step="1"
            value={settings.cryptoScannerMaxHoldHours ?? 12}
            onChange={e => numInput('cryptoScannerMaxHoldHours', e.target.value)}
          />
          <p style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
            Coins discovered by the scanner (momentum picks like XLM, HYPE). These move fast and fade fast — exit sooner. Recommended: 8–12h.
          </p>
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.krakenEnabled === true}
              onChange={e => updateSettings({ krakenEnabled: e.target.checked })}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
            <span>Enable Kraken Margin Shorts</span>
            {settings.krakenEnabled
              ? <span style={{ background: '#0d2a1a', color: '#00c853', fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>ON</span>
              : <span style={{ background: '#2a1a1a', color: '#ff3d3d', fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>OFF</span>
            }
          </label>
          <p style={{ color: '#888', fontSize: 12, marginTop: 6 }}>
            Controls how crypto SELL signals are handled. When OFF, falls back to BITI stock via Alpaca (weekdays only).
            <br /><strong style={{ color: '#f5a623' }}>Paper mode:</strong> simulates Kraken shorts as paper trades — no real orders, no money touched.
            <br /><strong style={{ color: '#ff6b35' }}>Live mode only:</strong> sends real margin orders to Kraken 24/7. Requires KRAKEN_API_KEY + KRAKEN_PRIVATE_KEY in Railway env vars.
          </p>
          {settings.krakenEnabled && (
            <div style={{
              background: settings.tradeMode === 'live' ? '#1a0d00' : '#0d1a0d',
              border: `1px solid ${settings.tradeMode === 'live' ? '#ff6b35' : '#00c853'}`,
              borderRadius: 8, padding: '10px 14px', marginTop: 8
            }}>
              {settings.tradeMode === 'live'
                ? <span style={{ color: '#ff6b35', fontSize: 12, fontWeight: 700 }}>⚠️ Live mode — Kraken will send REAL margin orders. Make sure your Kraken account is funded.</span>
                : <span style={{ color: '#00c853', fontSize: 12, fontWeight: 700 }}>✓ Paper mode — Kraken shorts are simulated only. No real orders sent.</span>
              }
            </div>
          )}
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.cryptoEnabled !== false}
              onChange={e => updateSettings({ cryptoEnabled: e.target.checked })}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
            <span>Enable Crypto Trading</span>
            {settings.cryptoEnabled !== false
              ? <span style={{ background: '#0d2a1a', color: '#00c853', fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>ON</span>
              : <span style={{ background: '#2a1a1a', color: '#ff3d3d', fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>OFF</span>
            }
          </label>
          <p style={{ color: '#888', fontSize: 12, marginTop: 6 }}>
            When OFF, all crypto analysis cycles are skipped — saves ~70% of daily AI costs. Open crypto positions are <strong style={{ color: '#c9d1d9' }}>not force-closed</strong>; they will exit naturally via stop loss or take profit.
          </p>
          {settings.cryptoEnabled === false && (
            <div style={{ background: '#1a1200', border: '1px solid #f5a623', borderRadius: 8, padding: '10px 14px', marginTop: 8 }}>
              <span style={{ color: '#f5a623', fontSize: 12, fontWeight: 700 }}>Crypto trading is paused. Stocks + scanner continue running normally.</span>
            </div>
          )}
        </div>

        <div className="form-group">
          <label>Crypto Symbols</label>
          <SymbolTags
            symbols={settings.cryptoSymbols || []}
            onChange={val => updateSettings({ cryptoSymbols: val })}
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
            onChange={val => updateSettings({ stockSymbols: val })}
            placeholder="Type symbol + Enter (e.g. AAPL)"
          />
          <p style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
            Type a symbol and press Enter to add. Click × to remove.
          </p>
        </div>

        {saved && savedFields && (
          <div style={{
            background: '#0d2a1a', border: '1px solid #00c853', borderRadius: 8,
            padding: '14px 16px', marginBottom: 12
          }}>
            <div style={{ color: '#00c853', fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
              ✓ Settings saved — takes effect on next bot cycle (within 30 min)
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {savedFields.map((f, i) => (
                <span key={i} style={{
                  background: '#0a1f12', border: '1px solid #00c85340',
                  borderRadius: 20, padding: '3px 10px',
                  color: '#00c853', fontSize: 12, fontWeight: 600
                }}>{f}</span>
              ))}
            </div>
            <div style={{ color: '#555', fontSize: 11, marginTop: 10 }}>
              To apply immediately → go to Dashboard and click <strong style={{ color: '#888' }}>Run Now</strong>
            </div>
          </div>
        )}

        {saveError && (
          <div style={{
            background: '#2a1a1a', border: '1px solid #ff3d3d', borderRadius: 8,
            padding: '10px 14px', marginBottom: 12, color: '#ff3d3d', fontSize: 13
          }}>
            {saveError}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="save-btn" onClick={saveSettings}>
            {saved ? '✓ Saved' : 'Save Settings'}
          </button>
          {dirty && !saved && (
            <>
              <button
                onClick={discardSettings}
                style={{
                  background: 'none', border: '1px solid #2a2d3e', borderRadius: 8,
                  padding: '8px 16px', color: '#888', fontSize: 13, cursor: 'pointer'
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#c9d1d9'}
                onMouseLeave={e => e.currentTarget.style.color = '#888'}
              >
                Discard
              </button>
              <span style={{ color: '#f5a623', fontSize: 13 }}>Unsaved changes</span>
            </>
          )}
        </div>
      </div>

      {/* Connection Status */}
      <div className="section" style={{ maxWidth: 600 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Connection Status</h3>
          <button
            onClick={testConnections}
            disabled={testing}
            style={{
              background: 'none', border: '1px solid #2a2d3e', borderRadius: 8,
              padding: '6px 14px', color: testing ? '#5865f2' : '#888',
              fontSize: 13, cursor: testing ? 'not-allowed' : 'pointer',
              opacity: testing ? 0.7 : 1
            }}
            onMouseEnter={e => { if (!testing) e.currentTarget.style.color = '#c9d1d9'; }}
            onMouseLeave={e => { if (!testing) e.currentTarget.style.color = '#888'; }}
          >
            {testing ? 'Testing...' : 'Test All'}
          </button>
        </div>

        {!connStatus ? (
          <div style={{ color: '#555', fontSize: 13, padding: '8px 0' }}>Loading connection status...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { key: 'alpaca',    label: 'Alpaca',    desc: 'Stock trading' },
              { key: 'binance',   label: 'Binance US', desc: 'Crypto spot trading' },
              { key: 'kraken',    label: 'Kraken',    desc: 'Crypto margin shorts' },
              { key: 'telegram',  label: 'Telegram',  desc: 'Alerts & reports' },
              { key: 'anthropic', label: 'Anthropic', desc: 'AI decisions' },
            ].map(({ key, label, desc }) => {
              const s = connStatus[key] || {};
              const statusColor = s.connected ? '#00c853' : s.configured ? '#ff3d3d' : '#555';
              const statusText  = s.connected ? 'Connected' : s.configured ? 'Error' : 'Not configured';
              return (
                <div key={key} className="card" style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '12px 16px',
                  borderLeft: `3px solid ${statusColor}`
                }}>
                  <ConnectionDot connected={s.connected} configured={s.configured} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{label}</span>
                      <span style={{ color: '#555', fontSize: 12 }}>{desc}</span>
                    </div>
                    <div style={{ color: '#666', fontSize: 12, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.label || '—'}
                    </div>
                  </div>
                  <span style={{
                    color: statusColor, fontSize: 12, fontWeight: 600,
                    background: `${statusColor}18`, border: `1px solid ${statusColor}40`,
                    borderRadius: 20, padding: '3px 10px', flexShrink: 0
                  }}>
                    {statusText}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {connStatus && !connStatus.alpaca?.connected && settings.tradeMode === 'live' && (
          <div style={{
            marginTop: 14, background: '#2a1500', border: '1px solid #f5a623',
            borderRadius: 8, padding: '10px 14px', color: '#c8852a', fontSize: 13
          }}>
            <strong style={{ color: '#f5a623' }}>Warning:</strong> You're in Live mode but Alpaca is not connected. Stock trades will fail. Check your <code>ALPACA_API_KEY</code> and <code>ALPACA_SECRET_KEY</code> environment variables.
          </div>
        )}
        {connStatus && !connStatus.kraken?.connected && settings.krakenEnabled && settings.tradeMode === 'live' && (
          <div style={{
            marginTop: 14, background: '#2a1500', border: '1px solid #f5a623',
            borderRadius: 8, padding: '10px 14px', color: '#c8852a', fontSize: 13
          }}>
            <strong style={{ color: '#f5a623' }}>Warning:</strong> Kraken is enabled in Live mode but not connected. Crypto shorts will fail. Check your <code>KRAKEN_API_KEY</code> and <code>KRAKEN_PRIVATE_KEY</code> environment variables.
          </div>
        )}
        {connStatus && !connStatus.anthropic?.connected && (
          <div style={{
            marginTop: 14, background: '#2a1a1a', border: '1px solid #ff3d3d',
            borderRadius: 8, padding: '10px 14px', color: '#ff3d3d', fontSize: 13
          }}>
            <strong>Critical:</strong> Anthropic API key is not configured. The bot cannot make any BUY/SELL/HOLD decisions. Set <code>ANTHROPIC_API_KEY</code> in your environment variables.
          </div>
        )}
      </div>

      {/* Info */}
      <div className="section" style={{ maxWidth: 600 }}>
        <h3>How The Bot Works</h3>
        <div style={{ color: '#888', fontSize: 14, lineHeight: 1.8 }}>
          <p>1. Every <strong style={{ color: '#c9d1d9' }}>30 minutes</strong> the bot runs a full cycle (crypto + stocks). Crypto is also re-analyzed every <strong style={{ color: '#c9d1d9' }}>10 minutes</strong> to catch fast moves.</p>
          <p>2. Data collected per symbol: live price, news, whale activity, Fear &amp; Greed index, macro news, Alpaca financial news (stocks), order book imbalance &amp; liquidation data (crypto), funding rate, BTC dominance</p>
          <p>3. Technical indicators computed: RSI, MACD histogram, MA50, MA200</p>
          <p>4. Social sentiment from StockTwits + Polymarket prediction markets</p>
          <p>5. All data is sent to Claude AI for a BUY / SELL / HOLD decision</p>
          <p>6. Confidence ≥ <strong style={{ color: '#c9d1d9' }}>{settings.minConfidence}%</strong> + BUY → opens LONG (scanner picks use 58%)</p>
          <p>7. Confidence ≥ <strong style={{ color: '#c9d1d9' }}>{settings.minConfidence}%</strong> + SELL + shorting enabled → opens SHORT (scanner picks use 58%)</p>
          <p>8. Open trades checked <strong style={{ color: '#c9d1d9' }}>every 5 minutes</strong> for stop loss / take profit</p>
          {settings.trailingStopEnabled
            ? <p>9. <strong style={{ color: '#00c853' }}>Trailing stop</strong> at {settings.trailingStopPercent}% — stop moves up as price rises, locking in profits | Take profit at {settings.takeProfitPercent}%</p>
            : <p>9. Stop loss at {settings.stopLossPercent}% | Take profit at {settings.takeProfitPercent}%</p>
          }
          {settings.scaleOutEnabled && (
            <p>9b. <strong style={{ color: '#5865f2' }}>Scale-Out Exit</strong>: closes 50% at take profit, lets the remaining 50% trail — captures more upside on strong moves</p>
          )}
          <p>10. <strong style={{ color: '#c9d1d9' }}>2-hour</strong> re-entry cooldown after a stop loss | <strong style={{ color: '#c9d1d9' }}>1-hour</strong> cooldown after an AI-signal close</p>
          <p>10b. <strong style={{ color: '#c9d1d9' }}>Smarter re-entry</strong>: after a stop loss, requires <strong style={{ color: '#c9d1d9' }}>75%+</strong> AI confidence for the next 24 hours before re-entering that symbol</p>
          <p>11. <strong style={{ color: '#c9d1d9' }}>BTC correlation guard</strong>: skips new ETH/SOL/XRP/BNB entries when BTC is strongly bearish (SELL ≥ 75%)</p>
          <p>12. <strong style={{ color: '#c9d1d9' }}>Pre-market scanner</strong> runs 5:25–6:30 AM PT, flags high-volume movers before open. Sends Telegram alert.</p>
          <p>13. <strong style={{ color: '#c9d1d9' }}>Daily stock scanner</strong> runs at market open — finds top movers by volume and % change, adds them to the watchlist for the day</p>
          {settings.winRatePauseEnabled && (
            <p>14. <strong style={{ color: '#a855f7' }}>Win rate auto-pause</strong>: bot pauses 1 hour if today's win rate drops below {settings.minWinRate}% after 5+ trades. Sends Telegram alert.</p>
          )}
          <p>{settings.winRatePauseEnabled ? '15.' : '14.'} <strong style={{ color: '#c9d1d9' }}>Max daily loss</strong>: bot stops if total daily loss (realized + unrealized) exceeds {settings.maxDailyLossPercent}% of capital (${((settings.totalCapital || settings.maxTradeAmount || 0) * (settings.maxDailyLossPercent || 0) / 100).toFixed(0)})</p>
          <p>{settings.winRatePauseEnabled ? '16.' : '15.'} Daily report sent at <strong style={{ color: '#c9d1d9' }}>1 AM UTC</strong> (6 PM California time) via Telegram</p>
          <p>{settings.winRatePauseEnabled ? '17.' : '16.'} Stale positions older than 7 days auto-closed every Sunday at 2 AM UTC</p>
        </div>
      </div>
    </div>
  );
}

export default Settings;
