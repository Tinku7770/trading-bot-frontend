import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'https://trading-bot-backend-production-9a53.up.railway.app/api';

function timeAgo(isoStr) {
  if (!isoStr) return 'never';
  const diff = Math.floor((Date.now() - new Date(isoStr)) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function squeezeStrength(score) {
  if (score >= 20) return { label: 'STRONG', color: '#ff3d3d' };
  if (score >= 8)  return { label: 'MODERATE', color: '#ff9800' };
  return              { label: 'EARLY', color: '#ffd600' };
}

function Section({ title, icon, lastUpdated, onRefresh, loading, children }) {
  return (
    <div className="section" style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>{icon}</span>
          <h3 style={{ margin: 0 }}>{title}</h3>
          {lastUpdated && (
            <span style={{ fontSize: 11, color: '#555', marginLeft: 4 }}>
              updated {timeAgo(lastUpdated)}
            </span>
          )}
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          style={{
            background: '#1e2130', border: '1px solid #2a2d3e', color: loading ? '#444' : '#aaa',
            borderRadius: 6, padding: '5px 14px', fontSize: 12, cursor: loading ? 'default' : 'pointer'
          }}
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>
      {children}
    </div>
  );
}

// ─── Short Squeeze ─────────────────────────────────────────────────────────

function SqueezeSection() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await axios.get(`${API}/scanner/squeeze`);
      setData(res.data);
    } catch {
      setError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <Section
      title="Short Squeeze"
      icon="🔥"
      lastUpdated={data?.scannedAt}
      onRefresh={load}
      loading={loading}
    >
      {error && <p style={{ color: '#ff3d3d', fontSize: 13 }}>Failed to load. Check backend.</p>}
      {!error && !loading && data?.candidates?.length === 0 && (
        <p style={{ color: '#555', fontSize: 13 }}>
          No squeeze candidates right now — no stocks with 2x+ volume AND rising price.
          {data.source === 'live' && ' (live scan of 35 watchlist stocks)'}
        </p>
      )}
      {data?.candidates?.length > 0 && (
        <>
          <p style={{ fontSize: 11, color: '#555', marginTop: 0, marginBottom: 12 }}>
            {data.source === 'live' ? 'Live scan — 35 squeeze-watchlist stocks' : 'From market-open scanner cache'}
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Price</th>
                  <th>Move</th>
                  <th>Volume</th>
                  <th>Score</th>
                  <th>Strength</th>
                </tr>
              </thead>
              <tbody>
                {data.candidates.map(s => {
                  const score = ((s.volRatio || 0) * Math.max(s.changePct || 0, 1)).toFixed(1);
                  const str   = squeezeStrength(parseFloat(score));
                  return (
                    <tr key={s.symbol}>
                      <td style={{ fontWeight: 700, color: '#fff' }}>{s.symbol}</td>
                      <td>${(s.price || 0).toFixed(2)}</td>
                      <td style={{ color: '#00c853' }}>+{(s.changePct || 0).toFixed(2)}%</td>
                      <td style={{ color: '#40a9ff' }}>{(s.volRatio || 0).toFixed(1)}x avg</td>
                      <td>{score}</td>
                      <td>
                        <span style={{
                          background: str.color + '22', color: str.color,
                          borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700
                        }}>
                          {str.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Section>
  );
}

// ─── IPO / SPAC ─────────────────────────────────────────────────────────────

function IpoSection() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await axios.get(`${API}/scanner/ipo`);
      setData(res.data);
    } catch {
      setError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <Section
      title="IPO & SPAC"
      icon="📋"
      lastUpdated={data?.fetchedAt}
      onRefresh={load}
      loading={loading}
    >
      {error && <p style={{ color: '#ff3d3d', fontSize: 13 }}>Failed to load. Check backend.</p>}
      {!error && !loading && data?.articles?.length === 0 && (
        <p style={{ color: '#555', fontSize: 13 }}>No IPO or SPAC news found right now.</p>
      )}
      {data?.articles?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {data.articles.map((a, i) => (
            <div key={i} style={{
              background: '#1e2130', border: '1px solid #2a2d3e', borderRadius: 8,
              padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 3
            }}>
              <span style={{ fontSize: 13, color: '#e0e0e0', lineHeight: 1.4 }}>{a.title}</span>
              <span style={{ fontSize: 11, color: '#555' }}>{a.source}</span>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

// ─── Crypto Listings ─────────────────────────────────────────────────────────

function ListingsSection() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await axios.get(`${API}/listings`);
      setData(res.data);
    } catch {
      setError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <Section
      title="Crypto Listings"
      icon="🚀"
      lastUpdated={data?.lastUpdated}
      onRefresh={load}
      loading={loading}
    >
      {error && <p style={{ color: '#ff3d3d', fontSize: 13 }}>Failed to load. Check backend.</p>}
      {!error && !loading && !data?.lastUpdated && (
        <p style={{ color: '#555', fontSize: 13 }}>Scanner warming up — runs every 2 hours.</p>
      )}

      {data?.announcements?.length > 0 && (
        <>
          <h4 style={{ margin: '0 0 10px', color: '#aaa', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
            Listing Announcements
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {data.announcements.map((a, i) => (
              <div key={i} style={{
                background: '#1e2130', border: '1px solid #2a2d3e', borderRadius: 8, padding: '10px 14px'
              }}>
                <div style={{ fontSize: 13, color: '#e0e0e0', marginBottom: 4 }}>{a.title}</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {a.exchange && (
                    <span style={{
                      background: '#0d2a3d', color: '#40a9ff',
                      borderRadius: 4, padding: '2px 8px', fontSize: 11
                    }}>
                      {a.exchange.label} — {a.exchange.side}
                    </span>
                  )}
                  {a.exchange?.warning && (
                    <span style={{ fontSize: 11, color: '#ff9800' }}>⚠ Verify on Binance.US</span>
                  )}
                  <span style={{ fontSize: 11, color: '#555' }}>{a.source}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {data?.newCoins?.length > 0 && (
        <>
          <h4 style={{ margin: '0 0 10px', color: '#aaa', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
            Recently Added on CoinGecko
          </h4>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Symbol</th>
                  <th>Price</th>
                  <th>24h Change</th>
                </tr>
              </thead>
              <tbody>
                {data.newCoins.slice(0, 10).map((c, i) => {
                  const ch = c.change24h != null ? c.change24h : null;
                  return (
                    <tr key={i}>
                      <td style={{ color: '#e0e0e0' }}>{c.name}</td>
                      <td style={{ color: '#888' }}>{c.symbol}</td>
                      <td>
                        {c.price
                          ? `$${c.price < 0.01 ? c.price.toFixed(6) : c.price.toFixed(4)}`
                          : 'N/A'}
                      </td>
                      <td style={{ color: ch == null ? '#888' : ch >= 0 ? '#00c853' : '#ff3d3d' }}>
                        {ch == null ? 'N/A' : `${ch >= 0 ? '+' : ''}${ch.toFixed(1)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {data?.lastUpdated && !data?.announcements?.length && !data?.newCoins?.length && (
        <p style={{ color: '#555', fontSize: 13 }}>No new listings detected in the last scan.</p>
      )}
    </Section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function Scanners() {
  return (
    <div style={{ padding: '24px 20px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 4px' }}>Scanners</h2>
        <p style={{ margin: 0, color: '#555', fontSize: 13 }}>
          Live market scanners — short squeeze, IPO/SPAC, and crypto listings.
          Scheduled Telegram alerts fire automatically (squeeze at 9:45 AM + 12:30 PM ET, IPO at 8:30 AM ET).
        </p>
      </div>
      <SqueezeSection />
      <IpoSection />
      <ListingsSection />
    </div>
  );
}

export default Scanners;
