import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useApp } from '../context/AppContext';

const API = process.env.REACT_APP_API_URL;

function Signals() {
  const { liveSignals } = useApp();
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/signals`).then(res => {
      setSignals(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const seenIds = new Set();
  const allSignals = [...liveSignals, ...signals]
    .filter(s => { if (seenIds.has(s._id)) return false; seenIds.add(s._id); return true; })
    .slice(0, 50);

  if (loading) return <div className="page-title">Loading...</div>;

  return (
    <div>
      <h1 className="page-title">AI Signals</h1>
      <p style={{ color: '#888', marginBottom: 20 }}>All AI trading decisions with reasoning</p>

      <div className="section">
        <h3>{allSignals.length} Signals</h3>
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Market</th>
              <th>Decision</th>
              <th>Confidence</th>
              <th>Price</th>
              <th>News</th>
              <th>Whale</th>
              <th>Trend</th>
              <th>Reasoning</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {allSignals.length === 0 ? (
              <tr><td colSpan={10} style={{ color: '#666', textAlign: 'center' }}>No signals yet — start the bot</td></tr>
            ) : allSignals.map((s, i) => (
              <tr key={i}>
                <td><strong>{s.symbol}</strong></td>
                <td style={{ color: '#888' }}>{s.market}</td>
                <td><span className={`badge ${s.decision?.toLowerCase()}`}>{s.decision}</span></td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 50, height: 6, background: '#2a2d3e', borderRadius: 3, overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${s.confidence}%`, height: '100%',
                        background: s.confidence >= 70 ? '#00c853' : s.confidence >= 50 ? '#ffd600' : '#ff3d3d'
                      }} />
                    </div>
                    <span>{s.confidence}%</span>
                  </div>
                </td>
                <td>${s.price?.toFixed(2)}</td>
                <td style={{ color: s.newsSentiment === 'positive' ? '#00c853' : s.newsSentiment === 'negative' ? '#ff3d3d' : '#888' }}>
                  {s.newsSentiment}
                </td>
                <td style={{ color: s.whaleActivity === 'buying' ? '#00c853' : s.whaleActivity === 'selling' ? '#ff3d3d' : '#888' }}>
                  {s.whaleActivity}
                </td>
                <td style={{ color: s.marketTrend === 'bullish' ? '#00c853' : s.marketTrend === 'bearish' ? '#ff3d3d' : '#888' }}>
                  {s.marketTrend}
                </td>
                <td style={{ color: '#888', fontSize: 12 }}>{s.reasoning?.substring(0, 60)}...</td>
                <td style={{ color: '#666', fontSize: 12 }}>{new Date(s.createdAt).toLocaleTimeString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Signals;
