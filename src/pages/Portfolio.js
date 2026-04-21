import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import PriceChart from '../components/PriceChart';

const API = 'https://trading-bot-backend-production-9a53.up.railway.app/api';
const COLORS = ['#5865f2', '#00c853', '#ff3d3d', '#ffd600', '#40a9ff'];

function Portfolio() {
  const [trades, setTrades] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/trades`),
      axios.get(`${API}/trades/stats`)
    ]).then(([tradesRes, statsRes]) => {
      setTrades(tradesRes.data);
      setStats(statsRes.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Build P/L chart data over time
  const plChartData = trades
    .filter(t => t.status === 'closed')
    .sort((a, b) => new Date(a.executedAt) - new Date(b.executedAt))
    .reduce((acc, t, i) => {
      const prev = acc[i - 1]?.cumulative || 0;
      acc.push({ date: new Date(t.executedAt).toLocaleDateString(), cumulative: prev + (t.profitLoss || 0) });
      return acc;
    }, []);

  // Pie chart: crypto vs stocks
  const cryptoTrades = trades.filter(t => t.market === 'crypto').length;
  const stockTrades = trades.filter(t => t.market === 'stock').length;
  const pieData = [
    { name: 'Crypto', value: cryptoTrades || 1 },
    { name: 'Stocks', value: stockTrades || 1 }
  ];

  if (loading) return <div className="page-title">Loading...</div>;

  return (
    <div>
      <h1 className="page-title">Portfolio</h1>

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
          <h2>Total P/L</h2>
          <div className="value" style={{ color: stats.totalProfitLoss >= 0 ? '#00c853' : '#ff3d3d' }}>
            ${(stats.totalProfitLoss || 0).toFixed(2)}
          </div>
        </div>
        <div className="card">
          <h2>Winning Trades</h2>
          <div className="value" style={{ color: '#00c853' }}>{stats.winningTrades || 0}</div>
        </div>
      </div>

      {/* Open Position Live Charts */}
      {trades.filter(t => t.status === 'open').length > 0 && (
        <div className="section">
          <h3>Open Positions — Live Charts</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16 }}>
            {trades.filter(t => t.status === 'open').map((trade, i) => (
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

      {/* P/L Chart */}
      <div className="section">
        <h3>Cumulative Profit/Loss Over Time</h3>
        {plChartData.length === 0 ? (
          <p style={{ color: '#666', textAlign: 'center', padding: 40 }}>No closed trades yet</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={plChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3e" />
              <XAxis dataKey="date" stroke="#666" />
              <YAxis stroke="#666" />
              <Tooltip contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3e' }} />
              <Line type="monotone" dataKey="cumulative" stroke="#5865f2" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Pie Chart */}
      <div className="section">
        <h3>Crypto vs Stocks</h3>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label>
              {pieData.map((entry, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Legend />
            <Tooltip contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3e' }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default Portfolio;
