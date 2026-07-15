import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { API_URL as API } from '../config';

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

function Toggle({ value, onChange, options }) {
  return (
    <div style={{
      display: 'inline-flex', background: '#0d0f1a', border: '1px solid #3a3d52',
      borderRadius: 8, padding: 4, gap: 3
    }}>
      {options.map(opt => (
        <button
          type="button"
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            background: value === opt.value ? '#2a4a8a' : '#1a1d2e',
            border: `1px solid ${value === opt.value ? '#5b8def' : '#3a3d52'}`,
            color: value === opt.value ? '#ffffff' : '#99a0b8',
            borderRadius: 6, padding: '5px 16px', fontSize: 12,
            cursor: 'pointer', transition: 'all 0.15s',
            fontWeight: value === opt.value ? 700 : 400,
            minWidth: 90, textAlign: 'center'
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
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

  useEffect(() => {
    load();
    const t = setInterval(load, 2 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

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
                      <td style={{ color: (s.changePct || 0) >= 0 ? '#00c853' : '#ff3d3d' }}>
                        {(s.changePct || 0) >= 0 ? '+' : ''}{(s.changePct || 0).toFixed(2)}%
                      </td>
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

  useEffect(() => {
    load();
    const t = setInterval(load, 2 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

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

  useEffect(() => {
    load();
    const t = setInterval(load, 2 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

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

// ─── Upcoming Listings ────────────────────────────────────────────────────────

function useCountdown(targetDate) {
  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    if (!targetDate) return;
    const tick = () => {
      const diff = new Date(targetDate) - Date.now();
      if (diff <= 0) { setTimeLeft('LIVE NOW'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h}h ${m}m ${s}s`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [targetDate]);
  return timeLeft;
}

const EXCHANGE_COLORS = {
  binanceus: { label: 'Binance.US', color: '#f0b90b' },
  kraken:    { label: 'Kraken',     color: '#5741d9' },
  coinbase:  { label: 'Coinbase',   color: '#0052ff' },
  unknown:   { label: 'Unknown',    color: '#555' },
};

const STATUS_COLORS = {
  announced: { label: 'ANNOUNCED', color: '#40a9ff' },
  live:      { label: 'LIVE',      color: '#00c853' },
  traded:    { label: 'TRADED',    color: '#ffd600' },
  skipped:   { label: 'SKIPPED',   color: '#555'    },
};

function ListingRow({ listing }) {
  const countdown = useCountdown(listing.listingDate);
  const ex  = EXCHANGE_COLORS[listing.exchange] || EXCHANGE_COLORS.unknown;
  const st  = STATUS_COLORS[listing.status]     || STATUS_COLORS.announced;
  const ago = timeAgo(listing.announcedAt);

  return (
    <div style={{
      background: '#1e2130', border: '1px solid #2a2d3e', borderRadius: 8,
      padding: '12px 14px', display: 'flex', alignItems: 'center',
      gap: 12, flexWrap: 'wrap'
    }}>
      <div style={{ minWidth: 80 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>{listing.symbol}</div>
        {listing.name && listing.name !== listing.symbol && (
          <div style={{ fontSize: 11, color: '#555' }}>{listing.name}</div>
        )}
      </div>

      <span style={{
        background: ex.color + '22', color: ex.color,
        borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700
      }}>{ex.label}</span>

      <span style={{
        background: st.color + '22', color: st.color,
        borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700
      }}>{st.label}</span>

      {listing.listingDate && (
        <span style={{ fontSize: 12, color: countdown === 'LIVE NOW' ? '#00c853' : '#ffd600', fontWeight: 600 }}>
          {countdown === 'LIVE NOW' ? '🟢 LIVE NOW' : `⏱ ${countdown}`}
        </span>
      )}

      <span style={{ fontSize: 11, color: '#555', marginLeft: 'auto' }}>
        {listing.source} · {ago}
      </span>

      {listing.skipReason && (
        <div style={{ width: '100%', fontSize: 11, color: '#ff9800', marginTop: 2 }}>
          Skipped: {listing.skipReason}
        </div>
      )}
    </div>
  );
}

function UpcomingListingsSection() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(false);
  const [filter, setFilter]   = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await axios.get(`${API}/listings/upcoming`);
      setData(res.data);
    } catch {
      setError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 2 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

  const listings = (data?.listings || []).filter(l =>
    filter === 'all' || l.status === filter
  );

  return (
    <Section title="Upcoming Listings" icon="🚀" onRefresh={load} loading={loading}>
      {error && <p style={{ color: '#ff3d3d', fontSize: 13 }}>Failed to load upcoming listings.</p>}

      <div style={{ marginBottom: 14 }}>
        <Toggle
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all',       label: 'All' },
            { value: 'announced', label: 'Announced' },
            { value: 'traded',    label: 'Traded' },
            { value: 'skipped',   label: 'Skipped' },
          ]}
        />
      </div>

      {!error && listings.length === 0 && (
        <p style={{ color: '#555', fontSize: 13 }}>
          No listings detected yet — scanner runs every 2 hours.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {listings.map((l, i) => <ListingRow key={i} listing={l} />)}
      </div>
    </Section>
  );
}

// ─── Scanner Performance ──────────────────────────────────────────────────────

function ScannerPerformanceSection() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(false);
  const [days, setDays]       = useState(30);

  const load = useCallback(async (d) => {
    setLoading(true);
    setError(false);
    try {
      const res = await axios.get(`${API}/scanner/performance?days=${d}`);
      setData(res.data);
    } catch {
      setError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(days); }, [load, days]);

  const s = data?.summary;

  return (
    <Section
      title="Scanner Performance"
      icon="📊"
      onRefresh={() => load(days)}
      loading={loading}
    >
      {error && <p style={{ color: '#ff3d3d', fontSize: 13 }}>Failed to load scanner performance.</p>}

      {/* Period selector */}
      <div style={{ marginBottom: 16 }}>
        <Toggle
          value={days}
          onChange={setDays}
          options={[{ value: 7, label: '7 Days' }, { value: 30, label: '30 Days' }, { value: 90, label: '90 Days' }]}
        />
      </div>

      {/* Summary cards */}
      {s && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Traded Picks', value: s.tradedPicks },
            { label: 'Win Rate',     value: `${s.winRate}%`, color: s.winRate >= 55 ? '#00c853' : s.winRate >= 45 ? '#ffd600' : '#ff3d3d' },
            { label: 'Total P/L',    value: `${s.totalPL >= 0 ? '+' : ''}$${s.totalPL.toFixed(2)}`, color: s.totalPL >= 0 ? '#00c853' : '#ff3d3d' },
            { label: 'Avg P/L',      value: `${s.avgPL >= 0 ? '+' : ''}$${s.avgPL.toFixed(2)}`,    color: s.avgPL >= 0 ? '#00c853' : '#ff3d3d' },
          ].map(card => (
            <div key={card.label} style={{
              background: '#1e2130', border: '1px solid #2a2d3e',
              borderRadius: 8, padding: '12px 14px', textAlign: 'center'
            }}>
              <div style={{ fontSize: 11, color: '#555', marginBottom: 4 }}>{card.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: card.color || '#e0e0e0' }}>{card.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Per-symbol breakdown */}
      {data?.bySymbol?.length > 0 && (
        <>
          <h4 style={{ margin: '0 0 10px', color: '#aaa', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
            By Symbol
          </h4>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Trades</th>
                  <th>Win Rate</th>
                  <th>Total P/L</th>
                </tr>
              </thead>
              <tbody>
                {data.bySymbol.map(row => (
                  <tr key={row.symbol}>
                    <td style={{ fontWeight: 700, color: '#fff' }}>{row.symbol}</td>
                    <td>{row.trades}</td>
                    <td style={{ color: row.winRate >= 55 ? '#00c853' : row.winRate >= 45 ? '#ffd600' : '#ff3d3d' }}>
                      {row.winRate}%
                    </td>
                    <td style={{ color: row.totalPL >= 0 ? '#00c853' : '#ff3d3d', fontWeight: 600 }}>
                      {row.totalPL >= 0 ? '+' : ''}${row.totalPL.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {data && !data.bySymbol?.length && (
        <p style={{ color: '#555', fontSize: 13 }}>No scanner trades in the last {days} days.</p>
      )}
    </Section>
  );
}

// ─── Crypto Scanner Picks ────────────────────────────────────────────────────

function CryptoPicksSection() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(false);
  const [mode, setMode]     = useState('live');

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await axios.get(`${API}/scanner/crypto-picks`);
      setData(res.data);
    } catch {
      setError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 2 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

  const picks = mode === 'live' ? (data?.live || []) : (data?.recent || []);

  return (
    <Section title="Crypto Scanner Picks" icon="🪙" onRefresh={load} loading={loading}>
      {error && <p style={{ color: '#ff3d3d', fontSize: 13 }}>Failed to load crypto picks.</p>}

      <div style={{ marginBottom: 14 }}>
        <Toggle
          value={mode}
          onChange={setMode}
          options={[{ value: 'live', label: 'Live Session' }, { value: 'recent', label: 'Recent (DB)' }]}
        />
      </div>

      {!error && picks.length === 0 && (
        <p style={{ color: '#555', fontSize: 13 }}>
          {mode === 'live' ? 'No picks in current session yet — scanner runs every 10–20 min.' : 'No recent picks found.'}
        </p>
      )}

      {picks.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {picks.map((p, i) => {
            const isLong = (p.direction || '').toUpperCase() === 'LONG';
            return (
              <div key={i} style={{
                background: '#1e2130', border: `1px solid ${isLong ? '#00c85330' : '#ff3d3d30'}`,
                borderLeft: `3px solid ${isLong ? '#00c853' : '#ff3d3d'}`,
                borderRadius: 8, padding: '12px 14px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>{p.symbol}</span>
                  <span style={{
                    background: isLong ? '#00c85322' : '#ff3d3d22',
                    color: isLong ? '#00c853' : '#ff3d3d',
                    borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700
                  }}>
                    {p.direction || 'N/A'}
                  </span>
                  {p.conviction != null && (
                    <span style={{ background: '#1a2540', color: '#40a9ff', borderRadius: 4, padding: '2px 8px', fontSize: 11 }}>
                      {p.conviction}% conf
                    </span>
                  )}
                  {p.changePct != null && (
                    <span style={{ color: p.changePct >= 0 ? '#00c853' : '#ff3d3d', fontSize: 12 }}>
                      {p.changePct >= 0 ? '+' : ''}{p.changePct.toFixed(2)}%
                    </span>
                  )}
                  {p.volRatio != null && (
                    <span style={{ color: '#40a9ff', fontSize: 12 }}>{p.volRatio.toFixed(1)}x vol</span>
                  )}
                  {p.price != null && (
                    <span style={{ color: '#888', fontSize: 12, marginLeft: 'auto' }}>
                      ${p.price < 1 ? p.price.toFixed(4) : p.price.toFixed(2)}
                    </span>
                  )}
                </div>
                {p.reason && (
                  <p style={{ margin: 0, fontSize: 12, color: '#aaa', lineHeight: 1.5 }}>{p.reason}</p>
                )}
                {p.entryNote && (
                  <p style={{ margin: '6px 0 0', fontSize: 11, color: '#40a9ff' }}>Entry: {p.entryNote}</p>
                )}
                {p.riskNote && (
                  <p style={{ margin: '3px 0 0', fontSize: 11, color: '#ff9800' }}>Risk: {p.riskNote}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}

// ─── Stock Scanner Picks ──────────────────────────────────────────────────────

function StockPicksSection() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(false);
  const [mode, setMode]       = useState('live');

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await axios.get(`${API}/scanner/stock-picks`);
      setData(res.data);
    } catch {
      setError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 2 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

  const picks = mode === 'live' ? (data?.live || []) : (data?.recent || []);

  return (
    <Section title="Stock Scanner Picks" icon="📈" onRefresh={load} loading={loading}>
      {error && <p style={{ color: '#ff3d3d', fontSize: 13 }}>Failed to load stock picks.</p>}

      <div style={{ marginBottom: 14 }}>
        <Toggle
          value={mode}
          onChange={setMode}
          options={[{ value: 'live', label: 'Live Session' }, { value: 'recent', label: 'Recent (DB)' }]}
        />
      </div>

      {!error && picks.length === 0 && (
        <p style={{ color: '#555', fontSize: 13 }}>
          {mode === 'live' ? 'No stock picks in current session — scanner runs pre-market and intraday.' : 'No recent stock picks found.'}
        </p>
      )}

      {picks.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Price</th>
                <th>Change</th>
                <th>Volume</th>
              </tr>
            </thead>
            <tbody>
              {picks.map((s, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 700, color: '#fff' }}>{s.symbol}</td>
                  <td>${(s.price || 0).toFixed(2)}</td>
                  <td style={{ color: (s.changePct || 0) >= 0 ? '#00c853' : '#ff3d3d' }}>
                    {(s.changePct || 0) >= 0 ? '+' : ''}{(s.changePct || 0).toFixed(2)}%
                  </td>
                  <td style={{ color: '#40a9ff' }}>{(s.volRatio || 0).toFixed(1)}x avg</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
      <UpcomingListingsSection />
      <ScannerPerformanceSection />
      <CryptoPicksSection />
      <StockPicksSection />
      <SqueezeSection />
      <IpoSection />
      <ListingsSection />
    </div>
  );
}

export default Scanners;
