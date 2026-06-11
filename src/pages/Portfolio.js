import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import PriceChart from '../components/PriceChart';

const API = process.env.REACT_APP_API_URL;
const COLORS = ['#5865f2', '#00c853', '#ff3d3d', '#ffd600', '#40a9ff'];

function Portfolio() {
  const [trades, setTrades] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [dateRange, setDateRange] = useState(0);
  const [showAllOpen, setShowAllOpen] = useState(false);
  const MAX_OPEN_SHOWN = 20;

  const RANGES = [
    { label: 'Today',    days: 1  },
    { label: '7 Days',   days: 7  },
    { label: '30 Days',  days: 30 },
    { label: 'All Time', days: 0  },
  ];

  // Fetch open and closed trades separately so analytics always have full closed trade history
  useEffect(() => {
    function loadTrades() {
      Promise.all([
        axios.get(`${API}/trades?status=open`),
        axios.get(`${API}/trades?status=closed`)
      ])
        .then(([openRes, closedRes]) => {
          setTrades([...openRes.data, ...closedRes.data]);
          setLoading(false);
        })
        .catch(() => { setLoading(false); setError(true); });
    }
    loadTrades();
    const interval = setInterval(loadTrades, 60000);
    return () => clearInterval(interval);
  }, []);

  // Stats re-fetched from backend whenever date range changes — accurate across all trades
  useEffect(() => {
    const params = dateRange > 0 ? `?days=${dateRange}` : '';
    axios.get(`${API}/trades/stats${params}`)
      .then(res => setStats(res.data))
      .catch(() => {});
  }, [dateRange]);

  // Date filter cutoff
  const cutoff = dateRange > 0 ? new Date(Date.now() - dateRange * 24 * 60 * 60 * 1000) : null;

  // Open trades always shown unfiltered (current positions)
  const openTrades = trades.filter(t => t.status === 'open');
  const capitalAtRisk = openTrades.reduce((sum, t) => sum + (t.amount || 0), 0);

  // All closed trades filtered by selected date range
  const filteredClosed = trades
    .filter(t => t.status === 'closed' && t.closedAt && (!cutoff || new Date(t.closedAt) >= cutoff))
    .sort((a, b) => new Date(a.closedAt) - new Date(b.closedAt));

  // Always use backend stats — accurate across all trades, not just the 100-trade fetch limit
  const viewTotalTrades = stats.totalTrades || 0;
  const viewWinRate     = stats.winRate || 0;
  const viewTotalPL     = stats.totalProfitLoss || 0;
  const viewWins        = stats.winningTrades || 0;
  const viewLosses      = stats.losingTrades || 0;
  const viewAvgWin      = stats.avgWin || 0;
  const viewAvgLoss     = stats.avgLoss || 0;

  // Cumulative P/L chart from filtered trades
  const plChartData = filteredClosed.reduce((acc, t, i) => {
    const prev = acc[i - 1]?.cumulative || 0;
    acc.push({
      trade: i + 1,
      date: new Date(t.closedAt).toLocaleDateString(),
      symbol: t.symbol,
      cumulative: parseFloat((prev + (t.profitLoss || 0)).toFixed(2))
    });
    return acc;
  }, []);

  // Pie chart and market breakdown from filtered closed trades
  const cryptoClosed = filteredClosed.filter(t => t.market === 'crypto');
  const stockClosed  = filteredClosed.filter(t => t.market === 'stock');
  const cryptoPL = cryptoClosed.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
  const stockPL  = stockClosed.reduce((sum, t)  => sum + (t.profitLoss || 0), 0);
  const cryptoWinRate = cryptoClosed.length ? Math.round(cryptoClosed.filter(t => (t.profitLoss || 0) > 0).length / cryptoClosed.length * 100) : 0;
  const stockWinRate  = stockClosed.length  ? Math.round(stockClosed.filter(t =>  (t.profitLoss || 0) > 0).length / stockClosed.length  * 100) : 0;

  const pieData = cryptoClosed.length === 0 && stockClosed.length === 0
    ? [{ name: 'No trades', value: 1 }]
    : [
        ...(cryptoClosed.length > 0 ? [{ name: 'Crypto', value: cryptoClosed.length }] : []),
        ...(stockClosed.length  > 0 ? [{ name: 'Stocks', value: stockClosed.length  }] : []),
      ];

  // Per-symbol breakdown from filtered closed trades
  const bySymbol = {};
  filteredClosed.forEach(t => {
    if (!bySymbol[t.symbol]) bySymbol[t.symbol] = { pl: 0, wins: 0, losses: 0 };
    bySymbol[t.symbol].pl += t.profitLoss || 0;
    if ((t.profitLoss || 0) > 0) bySymbol[t.symbol].wins++;
    else bySymbol[t.symbol].losses++;
  });
  const symbolRows = Object.entries(bySymbol)
    .map(([symbol, d]) => ({ symbol, ...d, total: d.wins + d.losses, winRate: Math.round(d.wins / (d.wins + d.losses) * 100) }))
    .sort((a, b) => b.pl - a.pl);

  const plColor = v => (v ?? 0) >= 0 ? '#00c853' : '#ff3d3d';
  const plStr = v => v == null ? '—' : `${v >= 0 ? '+' : ''}$${v.toFixed(2)}`;

  if (loading) return <div className="page-title">Loading...</div>;

  if (error) return (
    <div>
      <h1 className="page-title">Portfolio</h1>
      <div style={{
        background: '#2a1a1a', border: '1px solid #ff3d3d', borderRadius: 8,
        padding: '16px 20px', color: '#ff3d3d', fontSize: 14
      }}>
        Could not load portfolio data — check your connection or try refreshing.
      </div>
    </div>
  );

  return (
    <div>
      <h1 className="page-title">Portfolio</h1>

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

      {/* Stats */}
      <div className="stats-grid">
        <div className="card">
          <h2>Total Trades</h2>
          <div className="value">{viewTotalTrades}</div>
        </div>
        <div className="card">
          <h2>Win Rate</h2>
          <div className="value" style={{ color: viewWinRate >= 50 ? '#00c853' : '#ff3d3d' }}>
            {viewTotalTrades > 0 ? `${viewWinRate}%` : '—'}
          </div>
        </div>
        <div className="card">
          <h2>Total P/L</h2>
          <div className="value" style={{ color: plColor(viewTotalPL) }}>
            {plStr(viewTotalPL)}
          </div>
        </div>
        <div className="card">
          <h2>Wins / Losses</h2>
          <div className="value">
            <span style={{ color: '#00c853' }}>{viewWins}</span>
            <span style={{ color: '#555', fontSize: 18 }}> / </span>
            <span style={{ color: '#ff3d3d' }}>{viewLosses}</span>
          </div>
        </div>
        <div className="card">
          <h2>Avg Win</h2>
          <div className="value" style={{ color: '#00c853' }}>{viewWins > 0 ? plStr(viewAvgWin) : '—'}</div>
        </div>
        <div className="card">
          <h2>Avg Loss</h2>
          <div className="value" style={{ color: '#ff3d3d' }}>{viewLosses > 0 ? plStr(viewAvgLoss) : '—'}</div>
        </div>
      </div>

      {/* Open Positions */}
      {openTrades.length > 0 && (
        <div className="section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>Open Positions — Live Charts</h3>
            <div style={{ display: 'flex', gap: 24 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#888', fontSize: 12 }}>Open Positions</div>
                <div style={{ color: '#f5a623', fontWeight: 700, fontSize: 18 }}>{openTrades.length}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#888', fontSize: 12 }}>Capital at Risk</div>
                <div style={{ color: '#f5a623', fontWeight: 700, fontSize: 18 }}>${capitalAtRisk.toFixed(2)}</div>
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16 }}>
            {(showAllOpen ? openTrades : openTrades.slice(0, MAX_OPEN_SHOWN)).map((trade) => (
              <PriceChart
                key={trade._id}
                symbol={trade.symbol}
                entryPrice={trade.price}
                market={trade.market}
                type={trade.type}
              />
            ))}
          </div>
          {openTrades.length > MAX_OPEN_SHOWN && (
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button
                onClick={() => setShowAllOpen(v => !v)}
                style={{
                  padding: '8px 24px', borderRadius: 6, fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', background: '#1a1d27', color: '#888',
                  border: '1px solid #2a2d3e'
                }}
              >
                {showAllOpen ? 'Show less' : `Show ${openTrades.length - MAX_OPEN_SHOWN} more positions`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* P/L Chart */}
      <div className="section">
        <h3>Cumulative Profit/Loss Over Time</h3>
        {plChartData.length === 0 ? (
          <p style={{ color: '#666', textAlign: 'center', padding: 40 }}>No closed trades yet</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={plChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3e" />
              <XAxis
                dataKey="trade"
                stroke="#666"
                label={{ value: 'Trade #', position: 'insideBottomRight', offset: -5, fill: '#666', fontSize: 12 }}
              />
              <YAxis stroke="#666" tickFormatter={v => `$${v}`} />
              <Tooltip
                contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3e' }}
                formatter={(value) => [`$${value.toFixed(2)}`, 'Cumulative P/L']}
                labelFormatter={(label, payload) =>
                  payload?.[0]?.payload
                    ? `Trade #${label} — ${payload[0].payload.symbol} (${payload[0].payload.date})`
                    : `Trade #${label}`
                }
              />
              <Line type="monotone" dataKey="cumulative" stroke="#5865f2" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* P/L by Symbol */}
      {symbolRows.length > 0 && (
        <div className="section">
          <h3>Performance by Symbol</h3>
          <table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Trades</th>
                <th>Wins</th>
                <th>Losses</th>
                <th>Win Rate</th>
                <th>Total P/L</th>
              </tr>
            </thead>
            <tbody>
              {symbolRows.map(row => (
                <tr key={row.symbol}>
                  <td><strong>{row.symbol}</strong></td>
                  <td style={{ color: '#888' }}>{row.total}</td>
                  <td style={{ color: '#00c853' }}>{row.wins}</td>
                  <td style={{ color: '#ff3d3d' }}>{row.losses}</td>
                  <td>
                    <span style={{ color: row.winRate >= 50 ? '#00c853' : '#ff3d3d', fontWeight: 600 }}>
                      {row.winRate}%
                    </span>
                  </td>
                  <td style={{ color: plColor(row.pl), fontWeight: 600 }}>{plStr(row.pl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Market Breakdown */}
      <div className="section">
        <h3>Market Breakdown</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, alignItems: 'center' }}>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                outerRadius={90}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {pieData.map((entry, index) => (
                  <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Legend />
              <Tooltip
                contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3e' }}
                formatter={(value, name) => [`${value} trades`, name]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ color: '#888', fontSize: 13, marginBottom: 4 }}>P/L by Market</div>
            <div className="card" style={{ borderLeft: '3px solid #5865f2' }}>
              <div style={{ color: '#888', fontSize: 12 }}>Crypto P/L</div>
              <div style={{ color: plColor(cryptoPL), fontWeight: 700, fontSize: 22, marginTop: 4 }}>
                {plStr(cryptoPL)}
              </div>
              <div style={{ color: cryptoWinRate >= 50 ? '#00c853' : '#ff3d3d', fontSize: 12, marginTop: 4 }}>
                Win Rate: {cryptoWinRate}% ({cryptoClosed.length} trades)
              </div>
            </div>
            <div className="card" style={{ borderLeft: '3px solid #00c853' }}>
              <div style={{ color: '#888', fontSize: 12 }}>Stocks P/L</div>
              <div style={{ color: plColor(stockPL), fontWeight: 700, fontSize: 22, marginTop: 4 }}>
                {plStr(stockPL)}
              </div>
              <div style={{ color: stockWinRate >= 50 ? '#00c853' : '#ff3d3d', fontSize: 12, marginTop: 4 }}>
                Win Rate: {stockWinRate}% ({stockClosed.length} trades)
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Portfolio;
