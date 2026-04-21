import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API = 'https://trading-bot-backend-production-9a53.up.railway.app/api';

function Trades() {
  const [trades, setTrades] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/trades`).then(res => {
      setTrades(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filtered = trades.filter(t => {
    if (filter === 'all') return true;
    if (filter === 'open') return t.status === 'open';
    if (filter === 'closed') return t.status === 'closed';
    if (filter === 'crypto') return t.market === 'crypto';
    if (filter === 'stock') return t.market === 'stock';
    return true;
  });

  if (loading) return <div className="page-title">Loading...</div>;

  return (
    <div>
      <h1 className="page-title">Trade History</h1>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['all', 'open', 'closed', 'crypto', 'stock'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 16px',
              borderRadius: 8,
              border: 'none',
              background: filter === f ? '#5865f2' : '#2a2d3e',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              textTransform: 'capitalize'
            }}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="section">
        <h3>{filtered.length} Trades</h3>
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Type</th>
              <th>Market</th>
              <th>Entry Price</th>
              <th>Close Price</th>
              <th>Qty</th>
              <th>Amount</th>
              <th>Leverage</th>
              <th>Status</th>
              <th>P/L</th>
              <th>AI Reason</th>
              <th>Opened</th>
              <th>Closed</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={13} style={{ color: '#666', textAlign: 'center' }}>No trades found</td></tr>
            ) : filtered.map((t, i) => (
              <tr key={i}>
                <td><strong>{t.symbol}</strong></td>
                <td><span className={`badge ${t.type?.toLowerCase()}`}>{t.type}</span></td>
                <td style={{ color: '#888' }}>{t.market}</td>
                <td>${t.price?.toFixed(2)}</td>
                <td style={{ color: t.closePrice ? '#fff' : '#555' }}>
                  {t.closePrice ? `$${t.closePrice.toFixed(2)}` : '—'}
                </td>
                <td>{t.quantity}</td>
                <td>${t.amount?.toFixed(2)}</td>
                <td style={{ color: (t.leverage || 1) > 1 ? '#f5a623' : '#555', fontWeight: (t.leverage || 1) > 1 ? 700 : 400 }}>
                  {t.leverage || 1}x
                </td>
                <td><span className={`badge ${t.status}`}>{t.status}</span></td>
                <td style={{ color: t.profitLoss >= 0 ? '#00c853' : '#ff3d3d' }}>
                  ${(t.profitLoss || 0).toFixed(2)}
                </td>
                <td style={{ color: '#888', fontSize: 12 }}>{t.aiReason?.substring(0, 50)}...</td>
                <td style={{ color: '#666', fontSize: 12 }}>{new Date(t.executedAt).toLocaleDateString()}</td>
                <td style={{ color: '#666', fontSize: 12 }}>
                  {t.closedAt ? new Date(t.closedAt).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Trades;
