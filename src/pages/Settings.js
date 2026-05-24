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
    cryptoSymbols: [],
    stockSymbols: []
  });
  const [saved, setSaved] = useState(false);
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
    if ((settings.minConfidence || 0) < 55 || (settings.minConfidence || 0) > 90) return 'Min Confidence must be between 55% and 90%';
    if ((settings.leverageMultiplier || 0) < 1) return 'Leverage must be at least 1x';
    if ((settings.leverageMultiplier || 0) > 10) return 'Leverage cannot exceed 10x';
    if ((settings.maxTradeAmount || 0) <= 0) return 'Max Trade Amount must be greater than $0';
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
      setOriginalSettings(settings);
      setSaved(true);
      setDirty(false);
      setTimeout(() => setSaved(false), 3000);
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
          <label>Total Trading Capital ($)</label>
          <input
            type="number"
            min="1"
            value={settings.maxTradeAmount}
            onChange={e => numInput('maxTradeAmount', e.target.value)}
          />
          <p style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
            Total capital available to the bot. Each trade receives an equal share — e.g. $1,000 across 5 symbols = ~$200 per trade.
          </p>
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
              checked={settings.shortingEnabled || false}
              onChange={e => updateSettings({ shortingEnabled: e.target.checked })}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
            <span>Enable Short Selling</span>
            <span style={{ background: '#3d1a00', color: '#ff6b35', fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>SHORT</span>
          </label>
          <p style={{ color: '#888', fontSize: 12, marginTop: 6 }}>
            When enabled: bot opens a SHORT position when AI says SELL with {settings.minConfidence}%+ confidence.
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
            <p style={{ color: '#888', fontSize: 12, marginTop: 4 }}>1x = no leverage (spot trading). Try 2x or 3x to test.</p>
          )}
        </div>

        <div className="form-group">
          <label>Minimum AI Confidence (%) to Trade</label>
          <input
            type="number"
            min="55"
            max="90"
            step="1"
            value={settings.minConfidence ?? 60}
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
            {saved ? 'Saved!' : 'Save Settings'}
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

      {/* Info */}
      <div className="section" style={{ maxWidth: 600 }}>
        <h3>How The Bot Works</h3>
        <div style={{ color: '#888', fontSize: 14, lineHeight: 1.8 }}>
          <p>1. Every <strong style={{ color: '#c9d1d9' }}>30 minutes</strong> the bot runs an analysis cycle for every symbol</p>
          <p>2. Data collected per symbol: live price, news, whale activity, Fear &amp; Greed index, macro news, Alpaca financial news (stocks), order book imbalance &amp; liquidation data (crypto), funding rate, BTC dominance</p>
          <p>3. Technical indicators computed: RSI, MACD histogram, MA50, MA200</p>
          <p>4. Social sentiment from StockTwits + Polymarket prediction markets</p>
          <p>5. All data is sent to Claude AI for a BUY / SELL / HOLD decision</p>
          <p>6. Confidence ≥ <strong style={{ color: '#c9d1d9' }}>{settings.minConfidence}%</strong> + BUY → opens LONG position</p>
          <p>7. Confidence ≥ <strong style={{ color: '#c9d1d9' }}>{settings.minConfidence}%</strong> + SELL + shorting enabled → opens SHORT</p>
          <p>8. Open trades checked <strong style={{ color: '#c9d1d9' }}>every 5 minutes</strong> for stop loss / take profit</p>
          {settings.trailingStopEnabled
            ? <p>9. <strong style={{ color: '#00c853' }}>Trailing stop</strong> at {settings.trailingStopPercent}% — stop moves up as price rises, locking in profits | Take profit at {settings.takeProfitPercent}%</p>
            : <p>9. Stop loss at {settings.stopLossPercent}% | Take profit at {settings.takeProfitPercent}%</p>
          }
          <p>10. <strong style={{ color: '#c9d1d9' }}>2-hour</strong> re-entry cooldown after a stop loss | <strong style={{ color: '#c9d1d9' }}>1-hour</strong> cooldown after an AI-signal close</p>
          <p>11. <strong style={{ color: '#c9d1d9' }}>BTC correlation guard</strong>: skips new ETH/SOL/XRP/BNB entries when BTC is strongly bearish (SELL ≥ 75%)</p>
          <p>12. <strong style={{ color: '#c9d1d9' }}>Pre-market scanner</strong> runs 5:25–6:30 AM PT, flags high-volume movers before open. Sends Telegram alert.</p>
          <p>13. <strong style={{ color: '#c9d1d9' }}>Daily stock scanner</strong> runs at market open — finds top movers by volume and % change, adds them to the watchlist for the day</p>
          {settings.winRatePauseEnabled && (
            <p>14. <strong style={{ color: '#a855f7' }}>Win rate auto-pause</strong>: bot pauses 1 hour if today's win rate drops below {settings.minWinRate}% after 5+ trades. Sends Telegram alert.</p>
          )}
          <p>{settings.winRatePauseEnabled ? '15.' : '14.'} <strong style={{ color: '#c9d1d9' }}>Max daily loss</strong>: bot stops if total daily loss (realized + unrealized) exceeds {settings.maxDailyLossPercent}% of capital (${((settings.maxTradeAmount || 0) * (settings.maxDailyLossPercent || 0) / 100).toFixed(0)})</p>
          <p>{settings.winRatePauseEnabled ? '16.' : '15.'} Daily report sent at <strong style={{ color: '#c9d1d9' }}>1 AM UTC</strong> (6 PM California time) via Telegram</p>
          <p>{settings.winRatePauseEnabled ? '17.' : '16.'} Stale positions older than 7 days auto-closed every Sunday at 2 AM UTC</p>
        </div>
      </div>
    </div>
  );
}

export default Settings;
