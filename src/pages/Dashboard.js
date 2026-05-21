import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import PriceChart from '../components/PriceChart';
import MarketStatus from '../components/MarketStatus';

const API = process.env.REACT_APP_API_URL;

function formatCountdown(ms) {
  if (ms <= 0) return '00:00';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
  const s = (totalSec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString([], {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function Dashboard() {
  const { botStatus, setBotStatus, tradeMode, liveSignals, liveTrades } = useApp();
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(false);
  const [running, setRunning]     = useState(false);
  const [toggling, setToggling]   = useState(false);
  const [closingId, setClosingId] = useState(null);
  const [closingAll, setClosingAll] = useState(false);
  const [countdown, setCountdown] = useState('');
  const [nextRunTime, setNextRunTime] = useState(null);
  const [currentPrices, setCurrentPrices] = useState({});
  const [scannedStocks, setScannedStocks]     = useState([]);
  const [preMarketFlags, setPreMarketFlags]   = useState([]);
  const [cryptoHealth, setCryptoHealth]       = useState(null);
  const openTradesRef = useRef([]);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    async function fetchScanned() {
      try {
        const [scannedRes, preRes] = await Promise.all([
          axios.get(`${API}/bot/scanned-stocks`),
          axios.get(`${API}/bot/pre-market-flags`)
        ]);
        setScannedStocks(scannedRes.data || []);
        setPreMarketFlags(preRes.data || []);
      } catch { setScannedStocks([]); setPreMarketFlags([]); }
    }
    fetchScanned();
    const interval = setInterval(fetchScanned, 60000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    async function fetchCryptoHealth() {
      try {
        const res = await axios.get(`${API}/market/crypto-health`);
        setCryptoHealth(res.data);
      } catch { /* keep previous data */ }
    }
    fetchCryptoHealth();
    const interval = setInterval(fetchCryptoHealth, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchNextRun() {
    try {
      const res = await axios.get(`${API}/bot/next-run`);
      setNextRunTime(new Date(res.data.nextRun));
    } catch (err) {
      console.error('Failed to fetch next run time:', err);
    }
  }

  useEffect(() => {
    fetchNextRun();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!nextRunTime) return;
    function tick() {
      const ms = nextRunTime - new Date();
      if (ms <= 0) {
        setCountdown('00:00');
        fetchNextRun();
      } else {
        setCountdown(formatCountdown(ms));
      }
    }
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [nextRunTime]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep ref in sync so the stable interval below always reads the latest trades
  useEffect(() => {
    openTradesRef.current = data?.openTrades || [];
  }, [data?.openTrades]);

  // Stable 30s interval — dep on length so it only restarts when positions open/close
  useEffect(() => {
    if (!data?.openTrades?.length) return;
    const interval = setInterval(() => fetchCurrentPrices(openTradesRef.current), 30000);
    return () => clearInterval(interval);
  }, [data?.openTrades?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchDashboard() {
    try {
      const res = await axios.get(`${API}/dashboard`);
      setData(res.data);
      setBotStatus(res.data.botStatus);
      setError(false);
      setLoading(false);
      fetchCurrentPrices(res.data.openTrades || []);
    } catch {
      setError(true);
      setLoading(false);
    }
  }

  async function fetchCurrentPrices(openTrades) {
    if (!openTrades || openTrades.length === 0) return;
    const results = {};
    const cryptoTrades = openTrades.filter(t => t.market === 'crypto');
    const stockTrades  = openTrades.filter(t => t.market !== 'crypto');

    // One Binance call for all open crypto positions
    if (cryptoTrades.length > 0) {
      try {
        const tickers = JSON.stringify(cryptoTrades.map(t => t.symbol.replace('/', '')));
        const res = await axios.get(
          `https://api.binance.us/api/v3/ticker/price?symbols=${encodeURIComponent(tickers)}`
        );
        res.data.forEach(item => {
          const trade = cryptoTrades.find(t => t.symbol.replace('/', '') === item.symbol);
          if (trade) results[trade.symbol] = parseFloat(item.price);
        });
      } catch (err) {
        console.error('Failed to batch-fetch crypto prices:', err);
      }
    }

    // Stock prices from chart endpoint (no free batch alternative)
    await Promise.all(stockTrades.map(async trade => {
      try {
        const encoded = encodeURIComponent(trade.symbol);
        const res = await axios.get(`${API}/dashboard/chart/${encoded}`);
        const points = res.data || [];
        if (points.length > 0) results[trade.symbol] = points[points.length - 1].price;
      } catch (err) {
        console.error(`Failed to fetch price for ${trade.symbol}:`, err);
      }
    }));

    setCurrentPrices(prev => ({ ...prev, ...results }));
  }

  async function toggleBot() {
    try {
      setToggling(true);
      if (botStatus) {
        await axios.post(`${API}/bot/stop`);
        setBotStatus(false);
      } else {
        await axios.post(`${API}/bot/start`);
        setBotStatus(true);
      }
    } catch {
      alert('Failed to toggle bot');
    } finally {
      setToggling(false);
    }
  }

  async function closePosition(tradeId, symbol) {
    if (!window.confirm(`Close ${symbol} position at current market price?`)) return;
    try {
      setClosingId(tradeId);
      await axios.post(`${API}/bot/close-position/${tradeId}`);
      await fetchDashboard();
      setClosingId(null);
    } catch {
      alert('Failed to close position');
      setClosingId(null);
    }
  }

  async function closeAllPositions() {
    if (!window.confirm('Close ALL open positions at current market prices?')) return;
    try {
      setClosingAll(true);
      await axios.post(`${API}/bot/close-all`);
      await fetchDashboard();
      setClosingAll(false);
    } catch {
      alert('Failed to close all positions');
      setClosingAll(false);
    }
  }

  async function runNow() {
    try {
      setRunning(true);
      await axios.post(`${API}/bot/run-now`);
      setTimeout(() => { fetchDashboard(); fetchNextRun(); setRunning(false); }, 25000);
    } catch {
      alert('Failed to trigger bot');
      setRunning(false);
    }
  }

  if (loading) return <div className="page-title">Loading...</div>;

  if (error) return (
    <div>
      <h1 className="page-title">Dashboard</h1>
      <div style={{
        background: '#2a1a1a', border: '1px solid #ff3d3d', borderRadius: 8,
        padding: '16px 20px', color: '#ff3d3d', fontSize: 14
      }}>
        Could not load dashboard data — check your connection or try refreshing.
      </div>
    </div>
  );

  const stats = data?.stats || {};

  const seenTradeIds = new Set();
  const recentTrades = [...liveTrades, ...(data?.recentTrades || [])]
    .filter(t => { if (seenTradeIds.has(t._id)) return false; seenTradeIds.add(t._id); return true; })
    .slice(0, 8);

  const seenSignalIds = new Set();
  const recentSignals = [...liveSignals, ...(data?.recentSignals || [])]
    .filter(s => { if (seenSignalIds.has(s._id)) return false; seenSignalIds.add(s._id); return true; })
    .slice(0, 8);

  const capitalPctRaw = stats.totalCapital > 0
    ? (stats.capitalInTrades / stats.totalCapital) * 100
    : 0;
  const capitalPct = Math.min(100, Math.round(capitalPctRaw));

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>

      {/* Bot Control */}
      <div className="bot-toggle">
        <div>
          <h2>AI Trading Bot</h2>
          <div style={{ display: 'flex', gap: 16, marginTop: 4, flexWrap: 'wrap' }}>
            {recentSignals.length > 0 && (
              <p style={{ color: '#888', fontSize: 13, margin: 0 }}>
                Last run: <span style={{ color: '#aaa' }}>{new Date(recentSignals[0].createdAt).toLocaleTimeString()}</span>
              </p>
            )}
            <p style={{ color: '#888', fontSize: 13, margin: 0 }}>
              Next run in: <span style={{ color: botStatus ? '#00c853' : '#555', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                {botStatus ? countdown : '--:--'}
              </span>
            </p>
          </div>
        </div>
        <button
          className={`toggle-btn ${botStatus ? 'stop' : 'start'}`}
          onClick={toggleBot}
          disabled={toggling}
          style={{ opacity: toggling ? 0.6 : 1, cursor: toggling ? 'not-allowed' : 'pointer' }}
        >
          {toggling ? (botStatus ? 'Stopping...' : 'Starting...') : (botStatus ? 'Stop Bot' : 'Start Bot')}
        </button>
        <span className="mode-badge">{tradeMode === 'paper' ? 'Paper Trading' : 'Live Trading'}</span>
        <span style={{ color: botStatus ? '#00c853' : '#ff3d3d', fontWeight: 600 }}>
          {botStatus ? 'RUNNING' : 'STOPPED'}
        </span>
        <button
          onClick={runNow}
          disabled={running || !botStatus}
          style={{
            marginLeft: 'auto', padding: '10px 20px', borderRadius: 8,
            border: 'none', background: (running || !botStatus) ? '#333' : '#5865f2',
            color: (running || !botStatus) ? '#666' : '#fff',
            fontWeight: 600, cursor: (running || !botStatus) ? 'not-allowed' : 'pointer', fontSize: 14
          }}
        >
          {running ? 'Analyzing...' : 'Run Now'}
        </button>
      </div>

      <MarketStatus />

      {/* High Leverage Warning */}
      {data.leverageMultiplier > 3 && data.tradeMode === 'live' && (
        <div style={{
          background: '#2a1500', border: '1px solid #f5a623', borderRadius: 10,
          padding: '14px 20px', marginBottom: 24,
          display: 'flex', alignItems: 'flex-start', gap: 14
        }}>
          <span style={{ fontSize: 22, lineHeight: 1 }}>⚠️</span>
          <div>
            <div style={{ color: '#f5a623', fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
              High Leverage Active — {data.leverageMultiplier}x in Live Trading
            </div>
            <div style={{ color: '#c8852a', fontSize: 13, lineHeight: 1.6 }}>
              A <strong style={{ color: '#f5a623' }}>1% move against you</strong> = <strong style={{ color: '#f5a623' }}>{data.leverageMultiplier}% real loss</strong> per trade.
              A <strong style={{ color: '#ff3d3d' }}>{(100 / (data.leverageMultiplier || 1)).toFixed(0)}% move</strong> = full position liquidation.
              Make sure your stop loss is set tight and your trade amount is small.
            </div>
          </div>
        </div>
      )}

      {data.leverageMultiplier > 3 && data.tradeMode === 'paper' && (
        <div style={{
          background: '#1a1500', border: '1px solid #555', borderRadius: 10,
          padding: '14px 20px', marginBottom: 24,
          display: 'flex', alignItems: 'flex-start', gap: 14
        }}>
          <span style={{ fontSize: 22, lineHeight: 1 }}>⚠️</span>
          <div>
            <div style={{ color: '#888', fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
              High Leverage ({data.leverageMultiplier}x) — Paper Trading Mode
            </div>
            <div style={{ color: '#666', fontSize: 13, lineHeight: 1.6 }}>
              You're testing {data.leverageMultiplier}x leverage safely in paper mode. Before switching to live,
              remember: a {(100 / (data.leverageMultiplier || 1)).toFixed(0)}% adverse move will liquidate your position.
            </div>
          </div>
        </div>
      )}

      {/* Today's Performance — always shown; zeroed when no trades yet */}
      {(() => {
        const ts = data?.todayStats || { pl: 0, trades: 0, wins: 0, winRate: 0 };
        return (
          <div className="section">
            <h3>Today's Performance</h3>
            {ts.trades === 0 && (
              <p style={{ color: '#555', fontSize: 13, marginBottom: 12 }}>No trades closed today — bot is watching the market.</p>
            )}
            <div className="stats-grid">
              <div className="card">
                <h2>Today's P/L</h2>
                <div className="value" style={{ color: (ts.pl || 0) >= 0 ? '#00c853' : '#ff3d3d' }}>
                  {(ts.pl || 0) >= 0 ? '+' : ''}${(ts.pl || 0).toFixed(2)}
                </div>
              </div>
              <div className="card">
                <h2>Trades Today</h2>
                <div className="value">{ts.trades || 0}</div>
              </div>
              <div className="card">
                <h2>Today's Wins</h2>
                <div className="value" style={{ color: '#00c853' }}>{ts.wins || 0}</div>
              </div>
              <div className="card">
                <h2>Today's Win Rate</h2>
                <div className="value" style={{ color: (ts.winRate || 0) >= 50 ? '#00c853' : ts.trades > 0 ? '#ff3d3d' : '#555' }}>
                  {ts.trades > 0 ? `${ts.winRate}%` : '—'}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Pre-Market Alerts */}
      {preMarketFlags.length > 0 && (
        <div className="section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <h3 style={{ margin: 0 }}>Pre-Market Alerts</h3>
              <p style={{ color: '#888', fontSize: 12, margin: '4px 0 0' }}>
                Flagged before market open — bot will trade these at 6:30 AM PT if AI confirms
              </p>
            </div>
            <span style={{
              background: '#2a1500', color: '#f5a623',
              border: '1px solid #f5a623',
              borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 600
            }}>
              {preMarketFlags.length} flagged
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
            {preMarketFlags.map(s => (
              <div key={s.symbol} className="card" style={{ padding: '12px 16px', borderLeft: '3px solid #f5a623' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <strong style={{ fontSize: 15 }}>{s.symbol}</strong>
                  <span style={{
                    background: '#2a1500', color: '#f5a623',
                    fontSize: 10, padding: '2px 6px', borderRadius: 10, fontWeight: 700
                  }}>PRE</span>
                </div>
                <div style={{ color: s.changePct >= 0 ? '#00c853' : '#ff3d3d', fontWeight: 700, fontSize: 18, marginTop: 6 }}>
                  {s.changePct >= 0 ? '+' : ''}{s.changePct.toFixed(2)}%
                </div>
                <div style={{ color: '#888', fontSize: 11, marginTop: 4 }}>
                  Vol: {s.volRatio.toFixed(1)}x avg &nbsp;·&nbsp; ${s.price?.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today's Scanner Picks */}
      <div className="section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h3 style={{ margin: 0 }}>Today's Scanner Picks</h3>
            <p style={{ color: '#888', fontSize: 12, margin: '4px 0 0' }}>
              Top movers from Tech, Semiconductors &amp; Energy — added to bot watchlist at market open
            </p>
          </div>
          <span style={{
            background: scannedStocks.length > 0 ? '#0d2a0d' : '#1a1d27',
            color: scannedStocks.length > 0 ? '#00c853' : '#555',
            border: `1px solid ${scannedStocks.length > 0 ? '#00c853' : '#2a2d3e'}`,
            borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 600
          }}>
            {scannedStocks.length > 0 ? `${scannedStocks.length} active` : 'Market closed'}
          </span>
        </div>
        {scannedStocks.length === 0 ? (
          <div style={{ color: '#555', fontSize: 13, padding: '16px 0' }}>
            No scanner picks yet — scanner runs automatically when market opens at 9:30 AM PT
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
            {scannedStocks.map(s => (
              <div key={s.symbol} className="card" style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <strong style={{ fontSize: 15 }}>{s.symbol}</strong>
                  <span style={{
                    background: '#1a2a0d', color: '#00c853',
                    fontSize: 10, padding: '2px 6px', borderRadius: 10, fontWeight: 700
                  }}>SCAN</span>
                </div>
                <div style={{ color: s.changePct >= 0 ? '#00c853' : '#ff3d3d', fontWeight: 700, fontSize: 18, marginTop: 6 }}>
                  {s.changePct >= 0 ? '+' : ''}{s.changePct.toFixed(2)}%
                </div>
                <div style={{ color: '#888', fontSize: 11, marginTop: 4 }}>
                  Vol: {s.volRatio.toFixed(1)}x avg &nbsp;·&nbsp; ${s.price?.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Crypto Market Health */}
      {cryptoHealth && (
        <div className="section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <h3 style={{ margin: 0 }}>Crypto Market Health</h3>
              <p style={{ color: '#888', fontSize: 12, margin: '4px 0 0' }}>
                BTC dominance &amp; funding rates — refreshed every 10 min
              </p>
            </div>
          </div>

          {/* BTC Dominance */}
          {cryptoHealth.btcDominance && (() => {
            const dom = cryptoHealth.btcDominance;
            const domColors = {
              bearish_alts: '#ff3d3d',
              elevated: '#f5a623',
              altseason: '#00c853',
              declining: '#5ac8fa',
              neutral: '#888'
            };
            const domLabels = {
              bearish_alts: 'BTC Dominant — Alts Weak',
              elevated: 'Elevated Dominance',
              altseason: 'Alt Season',
              declining: 'Dominance Falling',
              neutral: 'Neutral'
            };
            const color = domColors[dom.signal] || '#888';
            return (
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: '#aaa', fontSize: 12, marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                  BTC Dominance
                </div>
                <div className="card" style={{ padding: '14px 20px', borderLeft: `3px solid ${color}`, display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ color: '#aaa', fontSize: 11, marginBottom: 2 }}>Dominance</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: color }}>{dom.value}%</div>
                  </div>
                  <div>
                    <div style={{ color: '#aaa', fontSize: 11, marginBottom: 2 }}>24h Change</div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: dom.change24h >= 0 ? '#00c853' : '#ff3d3d' }}>
                      {dom.change24h >= 0 ? '+' : ''}{dom.change24h}%
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#aaa', fontSize: 11, marginBottom: 4 }}>Signal</div>
                    <span style={{
                      background: color + '22', color: color,
                      border: `1px solid ${color}`,
                      borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700
                    }}>
                      {domLabels[dom.signal] || dom.signal}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Funding Rates */}
          {cryptoHealth.fundingRates && Object.keys(cryptoHealth.fundingRates).length > 0 && (
            <div>
              <div style={{ color: '#aaa', fontSize: 12, marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                Funding Rates
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                {Object.entries(cryptoHealth.fundingRates).map(([sym, fr]) => {
                  const frColors = {
                    overheated_longs: '#ff3d3d',
                    elevated_longs: '#f5a623',
                    overheated_shorts: '#00c853',
                    elevated_shorts: '#5ac8fa',
                    neutral: '#888'
                  };
                  const frLabels = {
                    overheated_longs: 'Longs Overheated',
                    elevated_longs: 'Elevated Longs',
                    overheated_shorts: 'Shorts Overheated',
                    elevated_shorts: 'Elevated Shorts',
                    neutral: 'Balanced'
                  };
                  const color = frColors[fr.signal] || '#888';
                  const ticker = sym.replace('/USDT', '');
                  return (
                    <div key={sym} className="card" style={{ padding: '12px 16px', borderLeft: `3px solid ${color}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <strong style={{ fontSize: 14 }}>{ticker}</strong>
                        <span style={{ color: '#555', fontSize: 10 }}>USDT</span>
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 700, marginTop: 6, color: fr.rate > 0 ? '#f5a623' : fr.rate < 0 ? '#5ac8fa' : '#888' }}>
                        {fr.rate > 0 ? '+' : ''}{fr.rate.toFixed(4)}%
                      </div>
                      <div style={{
                        marginTop: 6,
                        background: color + '22', color: color,
                        borderRadius: 10, padding: '2px 8px', fontSize: 10, fontWeight: 700,
                        display: 'inline-block'
                      }}>
                        {frLabels[fr.signal] || fr.signal}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* All-Time Stats */}
      <div className="stats-grid" style={{ marginTop: 8 }}>
        <div className="card">
          <h2>Total Trades</h2>
          <div className="value">{stats.totalTrades || 0}</div>
        </div>
        <div className="card">
          <h2>Win Rate</h2>
          <div className="value" style={{ color: (parseFloat(stats.winRate) || 0) >= 50 ? '#00c853' : '#ff3d3d' }}>
            {stats.winRate || 0}%
          </div>
        </div>
        <div className="card">
          <h2>Profit / Loss</h2>
          <div className="value" style={{ color: (stats.totalProfitLoss || 0) >= 0 ? '#00c853' : '#ff3d3d' }}>
            {(stats.totalProfitLoss || 0) >= 0 ? '+' : ''}${(stats.totalProfitLoss || 0).toFixed(2)}
          </div>
        </div>
        <div className="card">
          <h2>Open Positions</h2>
          <div className="value">{stats.openPositions || 0}</div>
        </div>
      </div>

      {/* Balance Section */}
      <div className="section">
        <h3>Account Balance</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 16 }}>
          <div className="card">
            <h2>Total Capital</h2>
            <div className="value" style={{ color: '#5865f2' }}>${stats.totalCapital || 1000}</div>
          </div>
          <div className="card">
            <h2>In Trades</h2>
            <div className="value" style={{ color: '#f5a623' }}>${(stats.capitalInTrades || 0).toFixed(2)}</div>
          </div>
          <div className="card">
            <h2>Available</h2>
            <div className="value" style={{ color: '#00c853' }}>${(stats.availableCapital || 0).toFixed(2)}</div>
          </div>
        </div>
        <div style={{ background: '#1a1d27', borderRadius: 8, overflow: 'hidden', height: 12 }}>
          <div style={{
            width: `${capitalPct}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #5865f2, #f5a623)',
            borderRadius: 8,
            transition: 'width 0.5s ease'
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12, color: '#666' }}>
          <span>{capitalPct}% deployed in trades</span>
          <span>{100 - capitalPct}% available</span>
        </div>
      </div>

      {/* Open Positions */}
      {data?.openTrades?.length > 0 && (
        <div className="section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Open Positions</h3>
            <button
              onClick={closeAllPositions}
              disabled={closingAll}
              style={{
                padding: '6px 14px', borderRadius: 6, border: '1px solid #ff3d3d',
                background: closingAll ? '#2a1a1a' : 'transparent',
                color: '#ff3d3d', fontWeight: 600,
                cursor: closingAll ? 'not-allowed' : 'pointer', fontSize: 12
              }}
            >
              {closingAll ? 'Closing All...' : 'Close All Positions'}
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Type</th>
                <th>Market</th>
                <th>Entry Price</th>
                <th>Amount</th>
                <th>Leverage</th>
                <th>Opened</th>
                <th>Unrealized P/L</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {data.openTrades.map((trade) => (
                <tr key={trade._id}>
                  <td><strong>{trade.symbol}</strong></td>
                  <td><span className={`badge ${trade.type?.toLowerCase()}`}>{trade.type}</span></td>
                  <td style={{ color: '#888' }}>{trade.market}</td>
                  <td>${trade.price?.toFixed(2)}</td>
                  <td>${trade.amount?.toFixed(2)}</td>
                  <td style={{ color: (trade.leverage || 1) > 1 ? '#f5a623' : '#555', fontWeight: (trade.leverage || 1) > 1 ? 700 : 400 }}>
                    {trade.leverage || 1}x
                  </td>
                  <td style={{ color: '#888', fontSize: 12 }}>{formatDateTime(trade.executedAt)}</td>
                  <td>{(() => {
                    const cur = currentPrices[trade.symbol];
                    if (!cur || !trade.price) return <span style={{ color: '#555' }}>—</span>;
                    const isShort = trade.type === 'SHORT';
                    const pnlPct = (cur - trade.price) / trade.price * 100 * (isShort ? -1 : 1);
                    const pnlDollar = pnlPct / 100 * (trade.amount || 0) * (trade.leverage || 1);
                    const color = pnlDollar >= 0 ? '#00c853' : '#ff3d3d';
                    return (
                      <span style={{ color, fontWeight: 600 }}>
                        {pnlDollar >= 0 ? '+' : ''}${pnlDollar.toFixed(2)}
                        <span style={{ fontSize: 11, marginLeft: 4, opacity: 0.8 }}>
                          ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)
                        </span>
                      </span>
                    );
                  })()}</td>
                  <td>
                    <button
                      onClick={() => closePosition(trade._id, trade.symbol)}
                      disabled={closingId === trade._id}
                      style={{
                        padding: '6px 14px', borderRadius: 6, border: '1px solid #ff3d3d',
                        background: 'transparent', color: '#ff3d3d', fontWeight: 600,
                        cursor: closingId === trade._id ? 'not-allowed' : 'pointer', fontSize: 12
                      }}
                    >
                      {closingId === trade._id ? 'Closing...' : 'Close'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16, marginTop: 20 }}>
            {data.openTrades.map((trade) => (
              <PriceChart
                key={trade._id}
                symbol={trade.symbol}
                entryPrice={trade.price}
                market={trade.market}
                type={trade.type}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recent Signals */}
      <div className="section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Latest AI Signals</h3>
          <Link to="/signals" style={{ color: '#5865f2', fontSize: 13, textDecoration: 'none' }}>View All →</Link>
        </div>
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Decision</th>
              <th>Confidence</th>
              <th>Sentiment</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {recentSignals.length === 0 ? (
              <tr><td colSpan={5} style={{ color: '#666', textAlign: 'center' }}>No signals yet — start the bot</td></tr>
            ) : recentSignals.map((s) => (
              <tr key={s._id}>
                <td><strong>{s.symbol}</strong></td>
                <td><span className={`badge ${s.decision?.toLowerCase()}`}>{s.decision}</span></td>
                <td>{s.confidence}%</td>
                <td style={{ color: s.newsSentiment === 'positive' ? '#00c853' : s.newsSentiment === 'negative' ? '#ff3d3d' : '#888' }}>
                  {s.newsSentiment}
                </td>
                <td style={{ color: '#666', fontSize: 12 }}>{formatDateTime(s.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recent Trades */}
      <div className="section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Recent Trades</h3>
          <Link to="/trades" style={{ color: '#5865f2', fontSize: 13, textDecoration: 'none' }}>View All →</Link>
        </div>
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Type</th>
              <th>Market</th>
              <th>Price</th>
              <th>Amount</th>
              <th>Leverage</th>
              <th>Status</th>
              <th>P/L</th>
            </tr>
          </thead>
          <tbody>
            {recentTrades.length === 0 ? (
              <tr><td colSpan={8} style={{ color: '#666', textAlign: 'center' }}>No trades yet</td></tr>
            ) : recentTrades.map((t) => (
              <tr key={t._id}>
                <td><strong>{t.symbol}</strong></td>
                <td><span className={`badge ${t.type?.toLowerCase()}`}>{t.type}</span></td>
                <td style={{ color: '#888' }}>{t.market}</td>
                <td>${t.price?.toFixed(2)}</td>
                <td>${t.amount?.toFixed(2)}</td>
                <td style={{ color: (t.leverage || 1) > 1 ? '#f5a623' : '#555', fontWeight: (t.leverage || 1) > 1 ? 700 : 400 }}>
                  {t.leverage || 1}x
                </td>
                <td><span className={`badge ${t.status}`}>{t.status}</span></td>
                <td style={{ color: t.status === 'open' ? '#888' : (t.profitLoss || 0) >= 0 ? '#00c853' : '#ff3d3d' }}>
                  {t.status === 'open' ? '—' : `${(t.profitLoss || 0) >= 0 ? '+' : ''}$${(t.profitLoss || 0).toFixed(2)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Dashboard;
