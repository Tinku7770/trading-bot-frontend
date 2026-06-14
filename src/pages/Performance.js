import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine
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

function Section({ title, children, defaultOpen = true, badge = null }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="section">
      <div
        onClick={() => setOpen(o => !o)}
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: open ? 16 : 0 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          {badge}
        </div>
        <span style={{ color: '#555', fontSize: 13, userSelect: 'none', flexShrink: 0 }}>{open ? '▼' : '▶'}</span>
      </div>
      {open && children}
    </div>
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
  const [equityCurve, setEquityCurve] = useState(null);
  const [dirBreakdown, setDirBreakdown] = useState(null);

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
    axios.get(`${API}/trades/confidence-breakdown`)
      .then(res => setConfBreakdown(res.data))
      .catch(() => {});
    axios.get(`${API}/trades/equity-curve`)
      .then(res => setEquityCurve(res.data))
      .catch(() => {});
    axios.get(`${API}/trades/direction-breakdown${params}`)
      .then(res => setDirBreakdown(res.data))
      .catch(() => {});
  }, [dateRange]);

  useEffect(() => {
    setLoading(true);
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

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
      <Section title="Streaks">
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
      </Section>

      {/* Best & Worst Trade */}
      {(data.bestTrade || data.worstTrade) && (
        <Section title="Best & Worst Trade">
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
        </Section>
      )}

      {/* Per-Symbol P/L Bar Chart */}
      <Section title="P/L by Symbol">
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
      </Section>

      {/* Per-Symbol Breakdown Table */}
      <Section title="Per-Symbol Breakdown">
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
      </Section>

      {/* Equity Curve */}
      {equityCurve && equityCurve.points.length > 1 && (
        <Section title="Account Equity Curve">
          <p style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>
            Running account value over time. Starts at <strong style={{ color: '#c9d1d9' }}>${equityCurve.startingCapital?.toLocaleString()}</strong> (your configured capital).
          </p>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={equityCurve.points} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3e" />
              <XAxis dataKey="date" stroke="#666" tick={{ fontSize: 11 }} />
              <YAxis stroke="#666" tickFormatter={v => `$${v.toLocaleString()}`} />
              <Tooltip
                contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3e', fontSize: 13 }}
                formatter={(value, name) => [
                  `$${value.toLocaleString()}`,
                  name === 'equity' ? 'Account Value' : 'Daily P/L'
                ]}
              />
              <ReferenceLine
                y={equityCurve.startingCapital}
                stroke="#444"
                strokeDasharray="4 4"
                label={{ value: 'Starting Capital', fill: '#555', fontSize: 11 }}
              />
              <Line
                type="monotone"
                dataKey="equity"
                stroke="#5865f2"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#5865f2' }}
              />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 24, marginTop: 12, flexWrap: 'wrap' }}>
            {(() => {
              const last = equityCurve.points[equityCurve.points.length - 1];
              const totalReturn = last ? last.equity - equityCurve.startingCapital : 0;
              const pct = equityCurve.startingCapital > 0 ? (totalReturn / equityCurve.startingCapital * 100).toFixed(1) : 0;
              return (
                <>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#555', fontSize: 11, marginBottom: 4 }}>Current Value</div>
                    <div style={{ color: '#c9d1d9', fontSize: 18, fontWeight: 700 }}>${last?.equity?.toLocaleString() ?? '—'}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#555', fontSize: 11, marginBottom: 4 }}>Total Return</div>
                    <div style={{ color: plColor(totalReturn), fontSize: 18, fontWeight: 700 }}>{fmt(totalReturn)} ({pct}%)</div>
                  </div>
                </>
              );
            })()}
          </div>
        </Section>
      )}

      {/* Long vs Short Breakdown */}
      {dirBreakdown && (dirBreakdown.long.trades > 0 || dirBreakdown.short.trades > 0) && (
        <Section title="Long vs Short Performance">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'LONG (BUY)', data: dirBreakdown.long,  color: '#00c853', border: '#00c85344' },
              { label: 'SHORT',      data: dirBreakdown.short, color: '#ff3d3d', border: '#ff3d3d44' }
            ].map(({ label, data, color, border }) => (
              <div key={label} style={{ background: '#1a1d27', border: `1px solid ${border}`, borderTop: `3px solid ${color}`, borderRadius: 10, padding: '18px 20px' }}>
                <div style={{ color, fontWeight: 700, fontSize: 15, marginBottom: 14 }}>{label}</div>
                <div style={{ fontWeight: 700, fontSize: 26, color: plColor(data.totalPL), marginBottom: 12 }}>{fmt(data.totalPL)}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: '#888' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Trades</span><span style={{ color: '#fff' }}>{data.trades} ({data.wins}W / {data.losses}L)</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Win Rate</span>
                    <span style={{ color: data.winRate >= 50 ? '#00c853' : '#ff3d3d', fontWeight: 600 }}>
                      {data.trades > 0 ? `${data.winRate}%` : '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Avg Win</span><span style={{ color: '#00c853' }}>{data.avgWin > 0 ? fmt(data.avgWin) : '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Avg Loss</span><span style={{ color: '#ff3d3d' }}>{data.avgLoss < 0 ? fmt(data.avgLoss) : '—'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {dirBreakdown.bySymbol.length > 0 && (
            <>
              <h4 style={{ color: '#888', fontWeight: 600, marginBottom: 10, marginTop: 8 }}>Per-Symbol Direction Breakdown</h4>
              <table>
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th style={{ color: '#00c853' }}>Long Trades</th>
                    <th style={{ color: '#00c853' }}>Long WR</th>
                    <th style={{ color: '#00c853' }}>Long P/L</th>
                    <th style={{ color: '#ff3d3d' }}>Short Trades</th>
                    <th style={{ color: '#ff3d3d' }}>Short WR</th>
                    <th style={{ color: '#ff3d3d' }}>Short P/L</th>
                  </tr>
                </thead>
                <tbody>
                  {dirBreakdown.bySymbol.map(s => (
                    <tr key={s.symbol}>
                      <td><strong>{s.symbol}</strong></td>
                      <td style={{ color: '#888' }}>{s.long.trades > 0 ? `${s.long.trades} (${s.long.wins}W)` : '—'}</td>
                      <td style={{ color: s.long.trades > 0 ? (s.long.winRate >= 50 ? '#00c853' : '#ff3d3d') : '#555' }}>
                        {s.long.trades > 0 ? `${s.long.winRate}%` : '—'}
                      </td>
                      <td style={{ color: s.long.trades > 0 ? plColor(s.long.totalPL) : '#555', fontWeight: s.long.trades > 0 ? 600 : 400 }}>
                        {s.long.trades > 0 ? fmt(s.long.totalPL) : '—'}
                      </td>
                      <td style={{ color: '#888' }}>{s.short.trades > 0 ? `${s.short.trades} (${s.short.wins}W)` : '—'}</td>
                      <td style={{ color: s.short.trades > 0 ? (s.short.winRate >= 50 ? '#00c853' : '#ff3d3d') : '#555' }}>
                        {s.short.trades > 0 ? `${s.short.winRate}%` : '—'}
                      </td>
                      <td style={{ color: s.short.trades > 0 ? plColor(s.short.totalPL) : '#555', fontWeight: s.short.trades > 0 ? 600 : 400 }}>
                        {s.short.trades > 0 ? fmt(s.short.totalPL) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </Section>
      )}

      {/* Confidence Breakdown */}
      {confBreakdown && confBreakdown.bands.length > 0 && (
        <Section title="Win Rate by AI Confidence Band" defaultOpen={false}>
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
        </Section>
      )}
    </div>
  );
}

export default Performance;
