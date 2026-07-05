import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { API_URL as API } from '../config';

function timeSince(isoStr) {
  if (!isoStr) return '';
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function ChangeChip({ value }) {
  if (value === null || value === undefined) return <span style={{ color: '#888', fontSize: 12 }}>N/A</span>;
  const color = value >= 0 ? '#00c853' : '#ff3d3d';
  return <span style={{ color, fontWeight: 700, fontSize: 13 }}>{value >= 0 ? '+' : ''}{value.toFixed(2)}%</span>;
}

function formatPrice(p) {
  if (!p) return 'N/A';
  if (p < 0.0001) return `$${p.toFixed(8)}`;
  if (p < 0.01) return `$${p.toFixed(6)}`;
  if (p < 1) return `$${p.toFixed(4)}`;
  return `$${p.toFixed(2)}`;
}

function formatMcap(v) {
  if (!v) return 'N/A';
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${(v / 1e3).toFixed(0)}K`;
}

export default function Listings() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const res = await axios.get(`${API}/listings`);
      setData(res.data);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(() => load(), 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, [load]);

  const card = {
    background: '#1a1d2e', border: '1px solid #2a2d3e',
    borderRadius: 12, padding: '20px 24px', marginBottom: 20
  };

  const sectionTitle = {
    fontSize: 15, fontWeight: 700, color: '#e0e0e0',
    marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8
  };

  if (loading) return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e0e0e0', marginBottom: 20 }}>Crypto Listings</h1>
      <div style={{ color: '#888', fontSize: 14 }}>Loading listing data...</div>
    </div>
  );

  if (error) return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e0e0e0', marginBottom: 20 }}>Crypto Listings</h1>
      <div style={{ background: '#2a1a1a', border: '1px solid #ff3d3d', borderRadius: 8, padding: '14px 18px', color: '#ff3d3d', fontSize: 14 }}>
        Could not load listing data — try refreshing.
      </div>
    </div>
  );

  const announcements = data?.announcements || [];
  const newCoins = data?.newCoins || [];

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e0e0e0', margin: 0 }}>Crypto Listings</h1>
          {data?.lastUpdated && (
            <div style={{ color: '#555', fontSize: 12, marginTop: 4 }}>
              Updated {timeSince(data.lastUpdated)} · refreshes every 2h
            </div>
          )}
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          style={{
            background: '#252836', border: '1px solid #3a3d50', borderRadius: 8,
            color: '#e0e0e0', fontSize: 13, padding: '8px 16px', cursor: 'pointer',
            opacity: refreshing ? 0.5 : 1
          }}
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Listing Announcements */}
      <div style={card}>
        <div style={sectionTitle}>
          <span>📢</span> Listing Announcements
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#888', fontWeight: 400 }}>
            {announcements.length} detected
          </span>
        </div>

        {announcements.length === 0 ? (
          <div style={{ color: '#555', fontSize: 13, padding: '12px 0' }}>
            No listing announcements detected in the last 2 hours. Scanner runs every 2h — Telegram alerts fire instantly when new ones are found.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {announcements.map((a, i) => {
              const ex = a.exchange;
              const isWarning = ex?.warning;
              const sideBg = ex?.side === 'SHORT' ? { bg: '#1a0d2e', border: '#3a1a5a', color: '#c77dff' } : { bg: '#0d1a0d', border: '#1a3a1a', color: '#00c853' };
              return (
                <div key={i} style={{
                  background: '#0d1117', border: `1px solid ${isWarning ? '#3a2a00' : '#2a2d3e'}`, borderRadius: 8,
                  padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6
                }}>
                  <div style={{ fontSize: 14, color: '#e0e0e0', lineHeight: 1.4 }}>{a.title}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: '#888' }}>Source: {a.source}</span>
                    {a.time && <span style={{ fontSize: 11, color: '#555' }}>{timeSince(a.time)}</span>}
                    {ex && (
                      <span style={{
                        fontSize: 11, fontWeight: 700, borderRadius: 4, padding: '2px 8px',
                        background: sideBg.bg, border: `1px solid ${sideBg.border}`, color: sideBg.color
                      }}>
                        {ex.label} · {ex.side}
                      </span>
                    )}
                    {isWarning && (
                      <span style={{ fontSize: 11, color: '#f5a623' }}>⚠️ Verify on Binance.US</span>
                    )}
                    <span style={{
                      marginLeft: 'auto', fontSize: 11, fontWeight: 700,
                      color: '#f5a623', background: '#2a1a00', borderRadius: 4,
                      padding: '2px 8px', border: '1px solid #3a2a00'
                    }}>
                      ⚡ ACT FAST
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New Coins */}
      <div style={card}>
        <div style={sectionTitle}>
          <span>🆕</span> Recently Added Coins
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#888', fontWeight: 400 }}>
            via CoinGecko
          </span>
        </div>

        {newCoins.length === 0 ? (
          <div style={{ color: '#555', fontSize: 13, padding: '12px 0' }}>No new coin data available.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #2a2d3e' }}>
                  {['Coin', 'Symbol', 'Price', '24h Change', 'Market Cap', 'Volume'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: '#555', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {newCoins.map((c, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #1a1d2e' }}>
                    <td style={{ padding: '10px 10px', color: '#e0e0e0', fontWeight: 600 }}>{c.name}</td>
                    <td style={{ padding: '10px 10px' }}>
                      <span style={{ background: '#252836', borderRadius: 4, padding: '2px 8px', fontSize: 12, color: '#a0a0a0', fontWeight: 700 }}>{c.symbol}</span>
                    </td>
                    <td style={{ padding: '10px 10px', color: '#e0e0e0', fontFamily: 'monospace' }}>{formatPrice(c.price)}</td>
                    <td style={{ padding: '10px 10px' }}><ChangeChip value={c.change24h} /></td>
                    <td style={{ padding: '10px 10px', color: '#888' }}>{formatMcap(c.marketCap)}</td>
                    <td style={{ padding: '10px 10px', color: '#888' }}>{formatMcap(c.volume)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* How it works info box */}
      <div style={{ ...card, border: '1px solid #1e3a2a', background: '#0d1a14' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#00c853', marginBottom: 10 }}>How This Scanner Works</div>
        <div style={{ fontSize: 12, color: '#888', lineHeight: 1.8 }}>
          <div>📢 <b style={{ color: '#aaa' }}>Announcement alerts</b> — monitors <b style={{ color: '#f0b90b' }}>Binance.US</b>, <b style={{ color: '#5741d9' }}>Kraken</b>, and Coinbase listing news every 2h — Telegram fires instantly</div>
          <div>⚠️ <b style={{ color: '#aaa' }}>Global Binance</b> — flagged separately with a warning. Always verify a coin is on <b style={{ color: '#f0b90b' }}>Binance.US</b> before trading LONG</div>
          <div>🟢 <b style={{ color: '#aaa' }}>LONG plays</b> — Binance.US listings. Buy on announcement, ride to listing day pump, exit</div>
          <div>🔴 <b style={{ color: '#aaa' }}>SHORT plays</b> — Kraken listings that pump hard on day 1 then fade. SHORT the retracement</div>
          <div>🤖 <b style={{ color: '#aaa' }}>AI chat</b> — say "any new listings?" for full AI analysis with specific trade recommendations</div>
        </div>
      </div>
    </div>
  );
}
