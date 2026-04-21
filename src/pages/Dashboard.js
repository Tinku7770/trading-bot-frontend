import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useApp } from '../context/AppContext';
import PriceChart from '../components/PriceChart';

const API = 'https://trading-bot-backend-production-9a53.up.railway.app/api';

function Dashboard() {
  const { botStatus, setBotStatus, tradeMode, liveSignals, liveTrades } = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [closingId, setClosingId] = useState(null);
  const [trumpAlert, setTrumpAlert] = useState(null);

  useEffect(() => {
    fetchDashboard(); // eslint-disable-line react-hooks/exhaustive-deps
    const interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for Trump alerts via WebSocket
  useEffect(() => {
    const handler = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'TRUMP_ALERT') {
          setTrumpAlert(msg);
          setTimeout(() => setTrumpAlert(null), 60000); // hide after 60s
        }
      } catch {}
    };
    window.addEventListener('ws-message', handler);
    return () => window.removeEventListener('ws-message', handler);
  }, []);

  async function fetchDashboard() {
    try {
      const res = await axios.get(`${API}/dashboard`);
      setData(res.data);
      setBotStatus(res.data.botStatus);
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  }

  async function toggleBot() {
    try {
      if (botStatus) {
        await axios.post(`${API}/bot/stop`);
        setBotStatus(false);
      } else {
        await axios.post(`${API}/bot/start`);
        setBotStatus(true);
      }
    } catch (err) {
      alert('Failed to toggle bot');
    }
  }

  async function closePosition(tradeId, symbol) {
    if (!window.confirm(`Close ${symbol} position at current market price?`)) return;
    try {
      setClosingId(tradeId);
      await axios.post(`${API}/bot/close-position/${tradeId}`);
      setTimeout(async () => {
        await fetchDashboard();
        setClosingId(null);
      }, 2000);
    } catch (err) {
      alert('Failed to close position');
      setClosingId(null);
    }
  }

  async function runNow() {
    try {
      setRunning(true);
      await axios.post(`${API}/bot/run-now`);
      setTimeout(() => { fetchDashboard(); setRunning(false); }, 30000);
    } catch (err) {
      alert('Failed to trigger bot');
      setRunning(false);
    }
  }

  if (loading) return <div className="page-title">Loading...</div>;

  const stats = data?.stats || {};
  const recentTrades = [...(liveTrades.length ? liveTrades : []), ...(data?.recentTrades || [])].slice(0, 8);
  const recentSignals = [...(liveSignals.length ? liveSignals : []), ...(data?.recentSignals || [])].slice(0, 8);

  const capitalPct = stats.totalCapital > 0
    ? ((stats.capitalInTrades / stats.totalCapital) * 100).toFixed(0)
    : 0;

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>

      {/* Trump Alert Banner */}
      {trumpAlert && (
        <div style={{
          background: 'linear-gradient(135deg, #1a0a00, #2d1200)',
          border: '2px solid #ff6b35',
          borderRadius: 12,
          padding: 16,
          marginBottom: 20,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12
        }}>
          <span style={{ fontSize: 28 }}>🚨</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: '#ff6b35', fontSize: 15, marginBottom: 4 }}>
              Trump Post Detected — {trumpAlert.analysis?.impact} Market Impact
            </div>
            <div style={{ color: '#ccc', fontSize: 13, marginBottom: 6 }}>
              "{trumpAlert.post?.substring(0, 150)}..."
            </div>
            <div style={{ fontSize: 12, color: '#888' }}>
              Direction: <span style={{ color: trumpAlert.analysis?.direction === 'BULLISH' ? '#00c853' : '#ff3d3d', fontWeight: 600 }}>
                {trumpAlert.analysis?.direction}
              </span>
              &nbsp;|&nbsp;
              Affected: <strong style={{ color: '#fff' }}>{trumpAlert.analysis?.affectedSymbols?.join(', ')}</strong>
            </div>
          </div>
          <button onClick={() => setTrumpAlert(null)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>
      )}

      {/* Bot Control */}
      <div className="bot-toggle">
        <div>
          <h2>AI Trading Bot</h2>
          <p style={{ color: '#888', fontSize: 13, marginTop: 4 }}>Analyzes market every 15 minutes | Trump monitor: every 2 min</p>
        </div>
        <button className={`toggle-btn ${botStatus ? 'stop' : 'start'}`} onClick={toggleBot}>
          {botStatus ? 'Stop Bot' : 'Start Bot'}
        </button>
        <span className="mode-badge">{tradeMode === 'paper' ? 'Paper Trading' : 'Live Trading'}</span>
        <span style={{ color: botStatus ? '#00c853' : '#ff3d3d', fontWeight: 600 }}>
          {botStatus ? 'RUNNING' : 'STOPPED'}
        </span>
        <button
          onClick={runNow}
          disabled={running}
          style={{
            marginLeft: 'auto', padding: '10px 20px', borderRadius: 8,
            border: 'none', background: running ? '#333' : '#5865f2',
            color: '#fff', fontWeight: 600, cursor: running ? 'not-allowed' : 'pointer', fontSize: 14
          }}
        >
          {running ? 'Analyzing... (30s)' : 'Run Now'}
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="card">
          <h2>Total Trades</h2>
          <div className="value">{stats.totalTrades || 0}</div>
        </div>
        <div className="card">
          <h2>Win Rate</h2>
          <div className="value" style={{ color: '#00c853' }}>{stats.winRate || 0}%</div>
        </div>
        <div className="card">
          <h2>Profit / Loss</h2>
          <div className="value" style={{ color: stats.totalProfitLoss >= 0 ? '#00c853' : '#ff3d3d' }}>
            ${(stats.totalProfitLoss || 0).toFixed(2)}
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
        {/* Progress bar */}
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

      {/* Open Positions with individual close buttons */}
      {data?.openTrades?.length > 0 && (
        <div className="section">
          <h3>Open Positions</h3>
          <table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Type</th>
                <th>Market</th>
                <th>Entry Price</th>
                <th>Amount</th>
                <th>Leverage</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {data.openTrades.map((trade, i) => (
                <tr key={i}>
                  <td><strong>{trade.symbol}</strong></td>
                  <td><span className={`badge ${trade.type?.toLowerCase()}`}>{trade.type}</span></td>
                  <td style={{ color: '#888' }}>{trade.market}</td>
                  <td>${trade.price?.toFixed(2)}</td>
                  <td>${trade.amount?.toFixed(2)}</td>
                  <td style={{ color: (trade.leverage || 1) > 1 ? '#f5a623' : '#555', fontWeight: (trade.leverage || 1) > 1 ? 700 : 400 }}>
                    {trade.leverage || 1}x
                  </td>
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

          {/* Live charts below the table */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16, marginTop: 20 }}>
            {data.openTrades.map((trade, i) => (
              <PriceChart
                key={i}
                symbol={trade.symbol}
                entryPrice={trade.price}
                market={trade.market}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recent Signals */}
      <div className="section">
        <h3>Latest AI Signals</h3>
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Decision</th>
              <th>Confidence</th>
              <th>Sentiment</th>
              <th>Reason</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {recentSignals.length === 0 ? (
              <tr><td colSpan={6} style={{ color: '#666', textAlign: 'center' }}>No signals yet — start the bot</td></tr>
            ) : recentSignals.map((s, i) => (
              <tr key={i}>
                <td><strong>{s.symbol}</strong></td>
                <td><span className={`badge ${s.decision?.toLowerCase()}`}>{s.decision}</span></td>
                <td>{s.confidence}%</td>
                <td style={{ color: s.newsSentiment === 'positive' ? '#00c853' : s.newsSentiment === 'negative' ? '#ff3d3d' : '#888' }}>
                  {s.newsSentiment}
                </td>
                <td style={{ color: '#888', fontSize: 12 }}>{s.reasoning?.substring(0, 60)}...</td>
                <td style={{ color: '#666', fontSize: 12 }}>{new Date(s.createdAt).toLocaleTimeString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recent Trades */}
      <div className="section">
        <h3>Recent Trades</h3>
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
              <tr><td colSpan={7} style={{ color: '#666', textAlign: 'center' }}>No trades yet</td></tr>
            ) : recentTrades.map((t, i) => (
              <tr key={i}>
                <td><strong>{t.symbol}</strong></td>
                <td><span className={`badge ${t.type?.toLowerCase()}`}>{t.type}</span></td>
                <td style={{ color: '#888' }}>{t.market}</td>
                <td>${t.price?.toFixed(2)}</td>
                <td>${t.amount?.toFixed(2)}</td>
                <td style={{ color: (t.leverage || 1) > 1 ? '#f5a623' : '#555', fontWeight: (t.leverage || 1) > 1 ? 700 : 400 }}>
                  {t.leverage || 1}x
                </td>
                <td><span className={`badge ${t.status}`}>{t.status}</span></td>
                <td style={{ color: t.profitLoss >= 0 ? '#00c853' : '#ff3d3d' }}>
                  ${(t.profitLoss || 0).toFixed(2)}
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
