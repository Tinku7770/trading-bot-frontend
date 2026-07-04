import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useApp } from '../context/AppContext';
import Section from '../components/Section';
import { formatDateTime } from '../utils';
import { API_URL as API } from '../config';

function sentimentColor(val) {
  if (!val) return '#888';
  const v = val.toLowerCase();
  if (['positive', 'bullish', 'buying', 'greed', 'extreme_greed'].includes(v)) return '#00c853';
  if (['negative', 'bearish', 'selling', 'fear', 'extreme_fear'].includes(v)) return '#ff3d3d';
  return '#888';
}

function SentimentBadge({ label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 80 }}>
      <span style={{ color: '#555', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</span>
      <span style={{ color: sentimentColor(value), fontWeight: 600, fontSize: 13 }}>{value || 'N/A'}</span>
    </div>
  );
}

function Signals() {
  const { liveSignals } = useApp();
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [filterSymbol, setFilterSymbol] = useState('all');
  const [filterDecision, setFilterDecision] = useState('all');

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/signals`);
      setSignals(res.data);
      setError(false);
    } catch (err) {
      console.error('Failed to fetch signals:', err);
      setError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [load]);

  const seenIds = new Set();
  const allSignals = [...liveSignals, ...signals]
    .filter(s => { if (seenIds.has(s._id)) return false; seenIds.add(s._id); return true; });

  const symbols = ['all', ...new Set(allSignals.map(s => s.symbol))];

  const filtered = allSignals.filter(s => {
    if (filterSymbol !== 'all' && s.symbol !== filterSymbol) return false;
    if (filterDecision !== 'all' && s.decision !== filterDecision) return false;
    return true;
  });

  const buys  = filtered.filter(s => s.decision === 'BUY').length;
  const sells = filtered.filter(s => s.decision === 'SELL').length;
  const holds = filtered.filter(s => s.decision === 'HOLD').length;

  if (loading) return <div className="page-title">Loading...</div>;

  if (error) return (
    <div>
      <h1 className="page-title">AI Signals</h1>
      <div style={{
        background: '#2a1a1a', border: '1px solid #ff3d3d', borderRadius: 8,
        padding: '16px 20px', color: '#ff3d3d', fontSize: 14
      }}>
        Could not load signals — check your connection or try refreshing.
      </div>
    </div>
  );

  return (
    <div>
      <h1 className="page-title">AI Signals</h1>
      <p style={{ color: '#888', marginBottom: 20 }}>All AI trading decisions with reasoning — click a row to expand</p>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
        <select
          value={filterSymbol}
          onChange={e => setFilterSymbol(e.target.value)}
          style={{ background: '#1a1d27', border: '1px solid #2a2d3e', color: '#fff', padding: '8px 12px', borderRadius: 6, fontSize: 13 }}
        >
          {symbols.map(s => (
            <option key={s} value={s}>{s === 'all' ? 'All Symbols' : s}</option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: 6 }}>
          {['all', 'BUY', 'SELL', 'HOLD'].map(d => (
            <button
              key={d}
              onClick={() => setFilterDecision(d)}
              style={{
                padding: '8px 16px', borderRadius: 6, fontSize: 13,
                fontWeight: 600, cursor: 'pointer',
                background: filterDecision === d ? (d === 'BUY' ? '#00c853' : d === 'SELL' ? '#ff3d3d' : d === 'HOLD' ? '#ffd600' : '#5865f2') : '#1a1d27',
                color: filterDecision === d ? '#000' : '#888',
                border: filterDecision === d ? 'none' : '1px solid #2a2d3e'
              }}
            >
              {d === 'all' ? 'All' : d}
            </button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13 }}>
            <strong style={{ color: '#00c853' }}>{buys} BUY</strong>
            <span style={{ color: '#555', margin: '0 6px' }}>·</span>
            <strong style={{ color: '#ff3d3d' }}>{sells} SELL</strong>
            <span style={{ color: '#555', margin: '0 6px' }}>·</span>
            <strong style={{ color: '#ffd600' }}>{holds} HOLD</strong>
          </span>
          <span style={{ color: '#555', fontSize: 13 }}>
            {filtered.length} of {allSignals.length} signals{allSignals.length > 0 ? ` · since ${new Date(allSignals[allSignals.length - 1].createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}` : ''}
          </span>
        </div>
      </div>

      <Section
        title="AI Signals"
        badge={
          <span style={{ color: '#555', fontSize: 12, fontWeight: 400 }}>
            {filtered.length} of {allSignals.length} signals
          </span>
        }
      >
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Decision</th>
              <th>Confidence</th>
              <th>Price</th>
              <th>News</th>
              <th>Whale</th>
              <th>Trend</th>
              <th>Time</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ color: '#666', textAlign: 'center' }}>
                  {allSignals.length === 0 ? 'No signals yet — start the bot' : 'No signals match your filters'}
                </td>
              </tr>
            ) : filtered.map((s) => (
              <React.Fragment key={s._id}>
                <tr
                  onClick={() => setExpandedId(expandedId === s._id ? null : s._id)}
                  style={{ cursor: 'pointer' }}
                >
                  <td><strong>{s.symbol}</strong></td>
                  <td><span className={`badge ${s.decision?.toLowerCase()}`}>{s.decision}</span></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 50, height: 6, background: '#2a2d3e', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{
                          width: `${s.confidence}%`, height: '100%',
                          background: s.confidence >= 70 ? '#00c853' : s.confidence >= 50 ? '#ffd600' : '#ff3d3d'
                        }} />
                      </div>
                      <span>{s.confidence}%</span>
                    </div>
                  </td>
                  <td>${s.price?.toFixed(2)}</td>
                  <td style={{ color: sentimentColor(s.newsSentiment) }}>{s.newsSentiment}</td>
                  <td style={{ color: sentimentColor(s.whaleActivity) }}>{s.whaleActivity}</td>
                  <td style={{ color: sentimentColor(s.marketTrend) }}>{s.marketTrend}</td>
                  <td style={{ color: '#666', fontSize: 12, whiteSpace: 'nowrap' }}>{formatDateTime(s.createdAt)}</td>
                  <td style={{ color: '#555', fontSize: 12 }}>{expandedId === s._id ? '▲' : '▼'}</td>
                </tr>

                {expandedId === s._id && (
                  <tr>
                    <td colSpan={9} style={{ background: '#13151f', padding: '16px 20px' }}>
                      <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', marginBottom: 16 }}>
                        <SentimentBadge label="News" value={s.newsSentiment} />
                        <SentimentBadge label="Whale" value={s.whaleActivity} />
                        <SentimentBadge label="Trend" value={s.marketTrend} />
                        <SentimentBadge label="Fear & Greed" value={s.fearGreedSignal} />
                        <SentimentBadge label="Social" value={s.socialSignal} />
                      </div>
                      <div style={{ color: '#aaa', fontSize: 13, lineHeight: 1.7, borderTop: '1px solid #2a2d3e', paddingTop: 12 }}>
                        <span style={{ color: '#555', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginRight: 8 }}>AI Reasoning</span>
                        {s.reasoning || 'No reasoning available'}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}

export default Signals;
