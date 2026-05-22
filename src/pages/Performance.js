import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts';

const API = process.env.REACT_APP_API_URL;

function fmt(value) {
  if (value == null || !isFinite(value) || isNaN(value)) return 'N/A';
  const abs = Math.abs(value).toFixed(2);
  return value >= 0 ? `+$${abs}` : `-$${abs}`;
}

const plColor = v => v >= 0 ? '#00c853' : '#ff3d3d';

function SortTh({ label, field, sortBy, sortDir, onSort }) {
  const active = sortBy === field;
  return (
    <th
      onClick={() => onSort(field)}
      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
    >
      {label}{' '}
      <span style={{ color: active ? '#5865f2' : '#444', fontSize: 11 }}>
        {active ? (sortDir === 'desc' ? '▼' : '▲') : '▼'}
      </span>
    </th>
  );
}

function Performance() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [sortBy, setSortBy] = useState('totalPL');
  const [sortDir, setSortDir] = useState('desc');
  const [dateRange, setDateRange] = useState(0);
  const [confBreakdown, setConfBreakdown] = useState(null);

  const RANGES = [
    { label: 'Today',    days: 1  },
    { label: '7 Days',   days: 7  },
    { label: '30 Days',  days: 30 },
    { label: 'All Time', days: 0  },
  ];

  const fetchData = useCallback(() => {
    const params = dateRange > 0 ? `?days=${dateRange}` : '';
    axios.get(`${API}/trades/performance${params}`)
      .then(res => { setData(res.data); setLoading(false); setError(false); })
      .catch(() => { setLoading(false); setError(true); });
  }, [dateRange]);

  useEffect(() => {
    setLoading(true);
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    axios.get(`${API}/trades/confidence-breakdown`)
      .then(res => setConfBreakdown(res.data))
      .catch(() => {});
  }, []);

  function handleSort(field) {
    if (sortBy === field) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
  }

  if (loading) return <div className="page-title">Loading...</div>;

  if (error) return (
    <div>
      <h1 className="page-title">Performance Analytics</h1>
      <div style={{
        background: '#2a1a1a', border: '1px solid #ff3d3d', borderRadius: 8,
        padding: '16px 20px', color: '#ff3d3d', fontSize: 14
      }}>
        Could not load performance data — check your connection or try refreshing.
      </div>
    </div>
  );

  if (!data || data.totalTrades === 0) return (
    <div>
      <h1 className="page-title">Performance Analytics</h1>
      <div className="card" style={{ textAlign: 'center', color: '#666', padding: 40 }}>
        No closed trades yet — start the bot and let it run.
      </div>
    </div>
  );

  const totalWins = data.symbols.reduce((sum, s) => sum + s.wins, 0);
  const totalLosses = data.symbols.reduce((sum, s) => sum + s.losses, 0);

  const sortedSymbols = [...data.symbols].sort((a, b) => {
    const av = a[sortBy] ?? 0;
    const bv = b[sortBy] ?? 0;
    return sortDir === 'desc' ? bv - av : av - bv;
  });

  return (
    <div>
      <h1 className="page-title">Performance Analytics</h1>

      {/* Date Range Filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
        {RANGES.map(r => (
          <button
            key={r.days}
            onClick={() => setDateRange(r.days)}
            style={{
              padding: '7px 18px', borderRadius: 6, fontSize: 13, fontWeight: 600,
              cursor: 'pointer',
              background: dateRange === r.days ? '#5865f2' : '#1a1d27',
              color: dateRange === r.days ? '#fff' : '#888',
              border: dateRange === r.days ? 'none' : '1px solid #2a2d3e',
            }}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="stats-grid">
        <div className="card">
          <h2>Total P/L</h2>
          <div className="value" style={{ color: plColor(data.totalPL) }}>
            {fmt(data.totalPL)}
          </div>
        </div>
        <div className="card">
          <h2>Win Rate</h2>
          <div className="value" style={{ color: data.winRate >= 50 ? '#00c853' : '#ff3d3d' }}>
            {data.winRate}%
          </div>
        </div>
        <div className="card">
          <h2>Wins / Losses</h2>
          <div className="value">
            <span style={{ color: '#00c853' }}>{totalWins}</span>
            <span style={{ color: '#555', fontSize: 18 }}> / </span>
            <span style={{ color: '#ff3d3d' }}>{totalLosses}</span>
          </div>
        </div>
        <div className="card">
          <h2>Avg Win</h2>
          <div className="value" style={{ color: '#00c853' }}>{fmt(data.avgWin)}</div>
        </div>
        <div className="card">
          <h2>Avg Loss</h2>
          <div className="value" style={{ color: '#ff3d3d' }}>{fmt(data.avgLoss)}</div>
        </div>
        <div className="card">
          <h2>Risk : Reward</h2>
          <div className="value" style={{ color: (data.riskReward || 0) >= 1 ? '#00c853' : '#f5a623' }}>
            {data.riskReward ? `1 : ${data.riskReward}` : 'N/A'}
          </div>
        </div>
        <div className="card">
          <h2>Profit Factor</h2>
          <div className="value" style={{ color: (() => { const pf = (data.avgWin && data.avgLoss && totalLosses > 0) ? (data.avgWin * totalWins) / (Math.abs(data.avgLoss) * totalLosses) : 0; return pf >= 1.5 ? '#00c853' : pf >= 1 ? '#f5a623' : '#ff3d3d'; })() }}>
            {(data.avgWin && data.avgLoss && totalLosses > 0) ? ((data.avgWin * totalWins) / (Math.abs(data.avgLoss) * totalLosses)).toFixed(2) : 'N/A'}
          </div>
        </div>
      </div>

      {/* Streaks */}
      <div className="section">
        <h3>Streaks</h3>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'Current Win Streak', value: data.curWinStreak, color: '#00c853' },
            { label: 'Current Loss Streak', value: data.curLossStreak, color: '#ff3d3d' },
            { label: 'Best Win Streak', value: data.maxWinStreak, color: '#00c853' },
            { label: 'Worst Loss Streak', value: data.maxLossStreak, color: '#ff3d3d' }
          ].map((s) => (
            <div key={s.label} className="card" style={{ minWidth: 160, textAlign: 'center' }}>
              <div style={{ color: '#888', fontSize: 12, marginBottom: 8 }}>{s.label}</div>
              <div style={{ color: s.color, fontSize: 32, fontWeight: 700 }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Best & Worst Trade */}
      {(data.bestTrade || data.worstTrade) && (
        <div className="section">
          <h3>Best & Worst Trade</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {data.bestTrade && (
              <div className="card" style={{ borderLeft: '3px solid #00c853' }}>
                <div style={{ color: '#00c853', fontWeight: 700, marginBottom: 8 }}>Best Trade</div>
                <div style={{ fontSize: 14 }}>
                  <div><strong>{data.bestTrade.symbol}</strong> — {data.bestTrade.type}</div>
                  <div style={{ color: '#888', fontSize: 12 }}>
                    Entry: ${data.bestTrade.price?.toFixed(2)} → Exit: ${data.bestTrade.closePrice?.toFixed(2)}
                  </div>
                  {data.bestTrade.closedAt && (
                    <div style={{ color: '#555', fontSize: 11, marginTop: 4 }}>
                      {new Date(data.bestTrade.closedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  )}
                  <div style={{ color: '#00c853', fontSize: 22, fontWeight: 700, marginTop: 8 }}>
                    {fmt(data.bestTrade.profitLoss)}
                  </div>
                </div>
              </div>
            )}
            {data.worstTrade && (
              <div className="card" style={{ borderLeft: '3px solid #ff3d3d' }}>
                <div style={{ color: '#ff3d3d', fontWeight: 700, marginBottom: 8 }}>Worst Trade</div>
                <div style={{ fontSize: 14 }}>
                  <div><strong>{data.worstTrade.symbol}</strong> — {data.worstTrade.type}</div>
                  <div style={{ color: '#888', fontSize: 12 }}>
                    Entry: ${data.worstTrade.price?.toFixed(2)} → Exit: ${data.worstTrade.closePrice?.toFixed(2)}
                  </div>
                  {data.worstTrade.closedAt && (
                    <div style={{ color: '#555', fontSize: 11, marginTop: 4 }}>
                      {new Date(data.worstTrade.closedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  )}
                  <div style={{ color: '#ff3d3d', fontSize: 22, fontWeight: 700, marginTop: 8 }}>
                    {fmt(data.worstTrade.profitLoss)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Per-Symbol P/L Bar Chart */}
      <div className="section">
        <h3>P/L by Symbol</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data.symbols} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3e" />
            <XAxis dataKey="symbol" stroke="#666" tick={{ fontSize: 12 }} />
            <YAxis stroke="#666" tickFormatter={v => `$${v}`} />
            <Tooltip
              contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3e' }}
              formatter={(value) => [fmt(value), 'Total P/L']}
            />
            <Bar dataKey="totalPL" radius={[4, 4, 0, 0]}>
              {data.symbols.map((s) => (
                <Cell key={s.symbol} fill={s.totalPL >= 0 ? '#00c853' : '#ff3d3d'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Per-Symbol Breakdown Table */}
      <div className="section">
        <h3>Per-Symbol Breakdown</h3>
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <SortTh label="Trades" field="trades" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortTh label="Win Rate" field="winRate" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortTh label="Avg Win" field="avgWin" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortTh label="Avg Loss" field="avgLoss" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortTh label="Total P/L" field="totalPL" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
            </tr>
          </thead>
          <tbody>
            {sortedSymbols.map((s) => (
              <tr key={s.symbol}>
                <td><strong>{s.symbol}</strong></td>
                <td>{s.trades} ({s.wins}W / {s.losses}L)</td>
                <td style={{ color: s.winRate >= 50 ? '#00c853' : '#ff3d3d' }}>{s.winRate}%</td>
                <td style={{ color: '#00c853' }}>{s.avgWin > 0 ? fmt(s.avgWin) : '-'}</td>
                <td style={{ color: '#ff3d3d' }}>{s.avgLoss < 0 ? fmt(s.avgLoss) : '-'}</td>
                <td style={{ color: plColor(s.totalPL), fontWeight: 700 }}>{fmt(s.totalPL)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Confidence Breakdown */}
      {confBreakdown && confBreakdown.bands.length > 0 && (
        <div className="section">
          <h3>Win Rate by AI Confidence Band</h3>
          {confBreakdown.recommendation && (
            <div style={{
              background: '#1e1a2e', border: '1px solid #5865f2', borderRadius: 8,
              padding: '10px 16px', color: '#aaa', fontSize: 13, marginBottom: 16
            }}>
              {confBreakdown.recommendation}
            </div>
          )}
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={confBreakdown.bands} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3e" />
              <XAxis dataKey="band" stroke="#666" tick={{ fontSize: 12 }} />
              <YAxis stroke="#666" tickFormatter={v => `${v}%`} domain={[0, 100]} />
              <Tooltip
                contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3e', fontSize: 13 }}
                formatter={(value, name) => name === 'winRate' ? [`${value}%`, 'Win Rate'] : [fmt(value), 'Avg P/L']}
              />
              <Bar dataKey="winRate" radius={[4, 4, 0, 0]} name="winRate">
                {confBreakdown.bands.map(b => (
                  <Cell key={b.band} fill={b.winRate >= 50 ? '#00c853' : '#ff3d3d'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <table style={{ marginTop: 16 }}>
            <thead>
              <tr>
                <th>Band</th>
                <th>Trades</th>
                <th>Win Rate</th>
                <th>Avg P/L</th>
                <th>Total P/L</th>
              </tr>
            </thead>
            <tbody>
              {confBreakdown.bands.map(b => (
                <tr key={b.band}>
                  <td><strong>{b.band}</strong></td>
                  <td>{b.trades} ({b.wins}W / {b.losses}L)</td>
                  <td style={{ color: b.winRate >= 50 ? '#00c853' : '#ff3d3d' }}>{b.winRate}%</td>
                  <td style={{ color: plColor(b.avgPL) }}>{fmt(b.avgPL)}</td>
                  <td style={{ color: plColor(b.totalPL), fontWeight: 700 }}>{fmt(b.totalPL)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Performance;
