import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL;

function Performance() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/trades/performance`)
      .then(res => { setData(res.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-title">Loading...</div>;
  if (!data || data.totalTrades === 0) return (
    <div>
      <h1 className="page-title">Performance</h1>
      <div className="card" style={{ textAlign: 'center', color: '#666', padding: 40 }}>
        No closed trades yet — start the bot and let it run.
      </div>
    </div>
  );

  const plColor = v => v >= 0 ? '#00c853' : '#ff3d3d';

  return (
    <div>
      <h1 className="page-title">Performance Analytics</h1>

      {/* Summary Cards */}
      <div className="stats-grid">
        <div className="card">
          <h2>Total P/L</h2>
          <div className="value" style={{ color: plColor(data.totalPL) }}>
            ${data.totalPL >= 0 ? '+' : ''}{data.totalPL}
          </div>
        </div>
        <div className="card">
          <h2>Win Rate</h2>
          <div className="value" style={{ color: data.winRate >= 50 ? '#00c853' : '#ff3d3d' }}>
            {data.winRate}%
          </div>
        </div>
        <div className="card">
          <h2>Avg Win</h2>
          <div className="value" style={{ color: '#00c853' }}>+${data.avgWin}</div>
        </div>
        <div className="card">
          <h2>Avg Loss</h2>
          <div className="value" style={{ color: '#ff3d3d' }}>${data.avgLoss}</div>
        </div>
        <div className="card">
          <h2>Risk : Reward</h2>
          <div className="value" style={{ color: data.riskReward >= 1 ? '#00c853' : '#f5a623' }}>
            1 : {data.riskReward}
          </div>
        </div>
        <div className="card">
          <h2>Total Trades</h2>
          <div className="value">{data.totalTrades}</div>
        </div>
      </div>

      {/* Streak Badges */}
      <div className="section">
        <h3>Streaks</h3>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'Current Win Streak', value: data.curWinStreak, color: '#00c853' },
            { label: 'Current Loss Streak', value: data.curLossStreak, color: '#ff3d3d' },
            { label: 'Best Win Streak', value: data.maxWinStreak, color: '#00c853' },
            { label: 'Worst Loss Streak', value: data.maxLossStreak, color: '#ff3d3d' }
          ].map((s, i) => (
            <div key={i} className="card" style={{ minWidth: 160, textAlign: 'center' }}>
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
                  <div style={{ color: '#888', fontSize: 12 }}>Entry: ${data.bestTrade.price?.toFixed(2)} → Exit: ${data.bestTrade.closePrice?.toFixed(2)}</div>
                  <div style={{ color: '#00c853', fontSize: 22, fontWeight: 700, marginTop: 8 }}>
                    +${data.bestTrade.profitLoss?.toFixed(2)}
                  </div>
                </div>
              </div>
            )}
            {data.worstTrade && (
              <div className="card" style={{ borderLeft: '3px solid #ff3d3d' }}>
                <div style={{ color: '#ff3d3d', fontWeight: 700, marginBottom: 8 }}>Worst Trade</div>
                <div style={{ fontSize: 14 }}>
                  <div><strong>{data.worstTrade.symbol}</strong> — {data.worstTrade.type}</div>
                  <div style={{ color: '#888', fontSize: 12 }}>Entry: ${data.worstTrade.price?.toFixed(2)} → Exit: ${data.worstTrade.closePrice?.toFixed(2)}</div>
                  <div style={{ color: '#ff3d3d', fontSize: 22, fontWeight: 700, marginTop: 8 }}>
                    ${data.worstTrade.profitLoss?.toFixed(2)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Per-Symbol Breakdown */}
      <div className="section">
        <h3>Per-Symbol Breakdown</h3>
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Market</th>
              <th>Trades</th>
              <th>Win Rate</th>
              <th>Avg Win</th>
              <th>Avg Loss</th>
              <th>Total P/L</th>
            </tr>
          </thead>
          <tbody>
            {data.symbols.map((s, i) => (
              <tr key={i}>
                <td><strong>{s.symbol}</strong></td>
                <td style={{ color: '#888' }}>{s.market}</td>
                <td>{s.trades} ({s.wins}W / {s.losses}L)</td>
                <td style={{ color: s.winRate >= 50 ? '#00c853' : '#ff3d3d' }}>{s.winRate}%</td>
                <td style={{ color: '#00c853' }}>{s.avgWin > 0 ? `+$${s.avgWin}` : '-'}</td>
                <td style={{ color: '#ff3d3d' }}>{s.avgLoss < 0 ? `$${s.avgLoss}` : '-'}</td>
                <td style={{ color: plColor(s.totalPL), fontWeight: 700 }}>
                  {s.totalPL >= 0 ? '+' : ''}${s.totalPL}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Performance;
