import React, { useState } from 'react';
import axios from 'axios';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';

const API = process.env.REACT_APP_API_URL;

function fmt(v) {
  if (v == null || !isFinite(v)) return '—';
  const abs = Math.abs(v).toFixed(2);
  return v > 0 ? `+$${abs}` : v < 0 ? `-$${abs}` : `$${abs}`;
}

const plColor = v => v > 0 ? '#00c853' : v < 0 ? '#ff3d3d' : '#888';

function Backtest() {
  const [params, setParams] = useState({
    days: 30,
    minConfidence: 65,
    stopLoss: 2,
    takeProfit: 4,
    tradeAmount: 100,
    symbol: ''
  });
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  function update(field, value) {
    setParams(prev => ({ ...prev, [field]: value }));
  }

  async function runBacktest() {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const q = new URLSearchParams({
        days:          params.days,
        minConfidence: params.minConfidence,
        stopLoss:      params.stopLoss,
        takeProfit:    params.takeProfit,
        tradeAmount:   params.tradeAmount,
        ...(params.symbol ? { symbol: params.symbol.trim().toUpperCase() } : {})
      });
      const res = await axios.get(`${API}/backtest?${q}`);
      setResult(res.data);
    } catch {
      setError('Backtest failed — check your connection or try a shorter date range.');
    } finally {
      setLoading(false);
    }
  }

  const DAY_OPTS = [7, 14, 30, 60, 90];

  return (
    <div>
      <h1 className="page-title">Backtesting</h1>
      <p style={{ color: '#888', fontSize: 14, marginBottom: 24, marginTop: -8 }}>
        Replays your bot's stored AI signals with different settings to show how performance would have changed.
      </p>

      {/* Parameters */}
      <div className="section" style={{ maxWidth: 700 }}>
        <h3>Parameters</h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Date Range</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {DAY_OPTS.map(d => (
                <button
                  key={d}
                  onClick={() => update('days', d)}
                  style={{
                    padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    background: params.days === d ? '#5865f2' : '#1a1d27',
                    color:      params.days === d ? '#fff'    : '#888',
                    border:     params.days === d ? 'none'    : '1px solid #2a2d3e'
                  }}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label>Min Confidence: <strong style={{ color: '#c9d1d9' }}>{params.minConfidence}%</strong></label>
            <input
              type="range" min="55" max="90" step="1"
              value={params.minConfidence}
              onChange={e => update('minConfidence', parseInt(e.target.value))}
              style={{ width: '100%', marginTop: 6 }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#555' }}>
              <span>55% (more trades)</span><span>90% (fewer trades)</span>
            </div>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label>Stop Loss (%)</label>
            <input type="number" min="0.1" max="20" step="0.5"
              value={params.stopLoss}
              onChange={e => update('stopLoss', parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label>Take Profit (%)</label>
            <input type="number" min="0.1" max="50" step="0.5"
              value={params.takeProfit}
              onChange={e => update('takeProfit', parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label>Amount Per Trade ($)</label>
            <input type="number" min="1" step="10"
              value={params.tradeAmount}
              onChange={e => update('tradeAmount', parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label>Symbol Filter (optional)</label>
            <input
              type="text"
              placeholder="e.g. BTC/USDT or NVDA"
              value={params.symbol}
              onChange={e => update('symbol', e.target.value)}
            />
            <p style={{ color: '#555', fontSize: 11, marginTop: 4 }}>Leave blank to include all symbols</p>
          </div>
        </div>

        <button
          className="save-btn"
          onClick={runBacktest}
          disabled={loading}
          style={{ opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading ? 'Running...' : 'Run Backtest'}
        </button>

        {error && (
          <div style={{
            marginTop: 12, background: '#2a1a1a', border: '1px solid #ff3d3d',
            borderRadius: 8, padding: '10px 14px', color: '#ff3d3d', fontSize: 13
          }}>
            {error}
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <>
          {result.stats.totalTrades === 0 ? (
            <div className="section">
              <div style={{ color: '#666', textAlign: 'center', padding: 32 }}>
                No signals found for the selected parameters. Try a longer date range or lower confidence threshold.
              </div>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="section">
                <h3>
                  Results — Last {result.params.days} days | Confidence ≥{result.params.minConfidence}% | SL {result.params.stopLoss}% | TP {result.params.takeProfit}%
                  {result.params.symbol && ` | ${result.params.symbol}`}
                </h3>
                <div className="stats-grid">
                  <div className="card">
                    <h2>Total P/L</h2>
                    <div className="value" style={{ color: plColor(result.stats.totalPL) }}>
                      {fmt(result.stats.totalPL)}
                    </div>
                  </div>
                  <div className="card">
                    <h2>Win Rate</h2>
                    <div className="value" style={{ color: result.stats.winRate >= 50 ? '#00c853' : '#ff3d3d' }}>
                      {result.stats.winRate}%
                    </div>
                  </div>
                  <div className="card">
                    <h2>Trades</h2>
                    <div className="value">
                      <span style={{ color: '#00c853' }}>{result.stats.wins}W</span>
                      <span style={{ color: '#555', fontSize: 18 }}> / </span>
                      <span style={{ color: '#ff3d3d' }}>{result.stats.losses}L</span>
                    </div>
                  </div>
                  <div className="card">
                    <h2>Avg Win</h2>
                    <div className="value" style={{ color: '#00c853' }}>{fmt(result.stats.avgWin)}</div>
                  </div>
                  <div className="card">
                    <h2>Avg Loss</h2>
                    <div className="value" style={{ color: '#ff3d3d' }}>{fmt(result.stats.avgLoss)}</div>
                  </div>
                  <div className="card">
                    <h2>Max Drawdown</h2>
                    <div className="value" style={{ color: '#f5a623' }}>
                      {result.stats.maxDrawdown > 0 ? `-$${result.stats.maxDrawdown.toFixed(2)}` : '$0.00'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Equity Curve */}
              {result.equityCurve.length > 1 && (
                <div className="section">
                  <h3>Equity Curve — Cumulative P/L (${result.params.tradeAmount}/trade)</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={result.equityCurve} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                      <defs>
                        <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={result.stats.totalPL >= 0 ? '#00c853' : '#ff3d3d'} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={result.stats.totalPL >= 0 ? '#00c853' : '#ff3d3d'} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3e" />
                      <XAxis dataKey="time" stroke="#666" tick={{ fontSize: 11 }} />
                      <YAxis stroke="#666" tickFormatter={v => `$${v}`} />
                      <Tooltip
                        contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3e', fontSize: 13 }}
                        formatter={v => [`$${v.toFixed(2)}`, 'Equity']}
                      />
                      <ReferenceLine y={0} stroke="#444" strokeDasharray="4 4" />
                      <Area
                        type="monotone" dataKey="equity"
                        stroke={result.stats.totalPL >= 0 ? '#00c853' : '#ff3d3d'}
                        fill="url(#eq)" strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Trade list */}
              <div className="section">
                <h3>Simulated Trades ({result.trades.length})</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Entry</th>
                      <th>Exit</th>
                      <th>Confidence</th>
                      <th>P/L %</th>
                      <th>P/L $</th>
                      <th>Close Reason</th>
                      <th>Close Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.trades.map((t, i) => (
                      <tr key={i}>
                        <td><strong>{t.symbol}</strong></td>
                        <td>${t.entryPrice.toFixed(2)}</td>
                        <td>${t.closePrice.toFixed(2)}</td>
                        <td style={{ color: t.entryConfidence >= 70 ? '#00c853' : '#ffd600' }}>
                          {t.entryConfidence}%
                        </td>
                        <td style={{ color: plColor(t.plPct), fontWeight: 600 }}>
                          {t.plPct > 0 ? '+' : ''}{t.plPct.toFixed(2)}%
                        </td>
                        <td style={{ color: plColor(t.plDollar), fontWeight: 600 }}>
                          {fmt(t.plDollar)}
                        </td>
                        <td style={{ color: '#888', fontSize: 12 }}>{t.closeReason}</td>
                        <td style={{ color: '#666', fontSize: 12 }}>
                          {new Date(t.closeTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default Backtest;
