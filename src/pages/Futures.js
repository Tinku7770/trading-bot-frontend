import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import Section from '../components/Section';
import { formatDateTime } from '../utils';
import { API_URL as API } from '../config';

const MULTIPLIERS = { '/MGC': 10, '/SIL': 1000 };

function formatDuration(start, end) {
  if (!start) return '—';
  const mins = Math.floor((new Date(end || Date.now()) - new Date(start)) / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  return `${Math.floor(hrs / 24)}d ${hrs % 24}h`;
}

function StatCard({ label, value, sub, color, badge }) {
  return (
    <div style={{
      background: '#141720', border: '1px solid #2a2d3e', borderRadius: 10,
      padding: '18px 22px', minWidth: 150, flex: 1
    }}>
      <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || '#fff' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>{sub}</div>}
      {badge && <div style={{ marginTop: 6 }}>{badge}</div>}
    </div>
  );
}

function Futures() {
  const [openTrades, setOpenTrades]     = useState([]);
  const [closedTrades, setClosedTrades] = useState([]);
  const [prices, setPrices]             = useState({});
  const [settings, setSettings]         = useState(null);
  const [ttStatus, setTtStatus]         = useState(null);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [expandedId, setExpandedId]     = useState(null);
  const [localSettings, setLocalSettings] = useState(null);

  const loadTrades = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/futures/trades`);
      setOpenTrades(res.data.open || []);
      setClosedTrades(res.data.closed || []);
    } catch {}
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/futures/settings`);
      setSettings(res.data);
      setLocalSettings(res.data);
    } catch {}
  }, []);

  const loadTTStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/futures/status`);
      setTtStatus(res.data);
    } catch {}
  }, []);

  const refreshPrices = useCallback(async (symbols) => {
    for (const sym of symbols) {
      try {
        const res = await axios.get(`${API}/futures/price/${encodeURIComponent(sym)}`);
        setPrices(p => ({ ...p, [sym]: res.data }));
      } catch {}
    }
  }, []);

  useEffect(() => {
    Promise.all([loadTrades(), loadSettings(), loadTTStatus()]).finally(() => setLoading(false));
    const t1 = setInterval(loadTrades, 30000);
    return () => clearInterval(t1);
  }, [loadTrades, loadSettings, loadTTStatus]);

  // Refresh live prices every 30s
  useEffect(() => {
    const symbols = [...new Set([...(settings?.futuresSymbols || ['/MGC']), ...openTrades.map(t => t.symbol)])];
    refreshPrices(symbols);
    const t = setInterval(() => refreshPrices(symbols), 30000);
    return () => clearInterval(t);
  }, [settings, openTrades, refreshPrices]);

  function unrealizedPL(trade) {
    const currentPrice = prices[trade.symbol]?.price;
    if (!currentPrice) return null;
    const diff = currentPrice - trade.price;
    const gross = trade.type === 'SHORT'
      ? -(diff * trade.quantity * (trade.leverage || 10))
      : (diff * trade.quantity * (trade.leverage || 10));
    return parseFloat(gross.toFixed(2));
  }

  function unrealizedPct(trade) {
    const currentPrice = prices[trade.symbol]?.price;
    if (!currentPrice || !trade.price) return null;
    const pctMove = ((currentPrice - trade.price) / trade.price) * 100;
    return trade.type === 'SHORT' ? -pctMove : pctMove;
  }

  async function saveSettings() {
    if (!localSettings) return;
    setSaving(true);
    try {
      await axios.post(`${API}/futures/settings`, localSettings);
      setSettings(localSettings);
    } catch {}
    setSaving(false);
  }

  function update(key, val) {
    setLocalSettings(prev => ({ ...prev, [key]: val }));
  }

  const totalPL = closedTrades.reduce((s, t) => s + (t.profitLoss || 0), 0);
  const wins = closedTrades.filter(t => (t.profitLoss || 0) > 0).length;
  const winRate = closedTrades.length > 0 ? Math.round(wins / closedTrades.length * 100) : null;
  const totalUnrealized = openTrades.reduce((s, t) => {
    const u = unrealizedPL(t); return s + (u ?? 0);
  }, 0);
  const goldPrice = prices['/MGC'];

  if (loading) return <div className="page-title">Loading...</div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Futures</h1>
        <span style={{
          background: '#1a1d2e', border: '1px solid #2a2d3e', borderRadius: 20,
          padding: '3px 12px', fontSize: 12, color: '#888'
        }}>
          CME Micro Gold /MGC via Tastytrade
        </span>
        {settings?.tastytradeEnabled
          ? <span style={{ background: '#0a2e1a', border: '1px solid #00c853', borderRadius: 20, padding: '3px 12px', fontSize: 12, color: '#00c853', fontWeight: 700 }}>LIVE</span>
          : <span style={{ background: '#1a1a2e', border: '1px solid #5865f2', borderRadius: 20, padding: '3px 12px', fontSize: 12, color: '#5865f2', fontWeight: 700 }}>PAPER</span>
        }
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <StatCard
          label="Gold Price"
          value={goldPrice?.price ? `$${goldPrice.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
          sub={goldPrice?.change24h != null
            ? `${goldPrice.change24h >= 0 ? '+' : ''}${goldPrice.change24h.toFixed(2)}% today`
            : '/oz (GC=F)'}
          color={goldPrice?.change24h > 0 ? '#00c853' : goldPrice?.change24h < 0 ? '#ff3d3d' : '#fff'}
        />
        <StatCard
          label="Realized P/L"
          value={closedTrades.length === 0 ? '—' : `${totalPL >= 0 ? '+' : ''}$${totalPL.toFixed(2)}`}
          sub={`${closedTrades.length} closed trade${closedTrades.length !== 1 ? 's' : ''}`}
          color={totalPL >= 0 ? '#00c853' : '#ff3d3d'}
        />
        <StatCard
          label="Unrealized P/L"
          value={openTrades.length === 0 ? '—' : `${totalUnrealized >= 0 ? '+' : ''}$${totalUnrealized.toFixed(2)}`}
          sub={`${openTrades.length} open position${openTrades.length !== 1 ? 's' : ''}`}
          color={totalUnrealized >= 0 ? '#00c853' : '#ff3d3d'}
        />
        <StatCard
          label="Win Rate"
          value={winRate !== null ? `${winRate}%` : '—'}
          sub={closedTrades.length > 0 ? `${wins}W / ${closedTrades.length - wins}L` : 'No closed trades yet'}
          color={winRate !== null ? (winRate >= 50 ? '#00c853' : '#ff3d3d') : '#fff'}
        />
        <StatCard
          label="Tastytrade"
          value={ttStatus?.configured ? 'Connected' : 'Pending'}
          sub={ttStatus?.configured ? `Account ${ttStatus?.balance?.['net-liq-balance'] ? `$${parseFloat(ttStatus.balance['net-liq-balance']).toLocaleString()}` : '—'}` : 'Waiting for futures approval'}
          color={ttStatus?.configured ? '#00c853' : '#888'}
        />
      </div>

      {/* Open Positions */}
      <Section
        title="Open Positions"
        badge={<span style={{ background: openTrades.length > 0 ? '#0a2e1a' : '#1a1d2e', border: `1px solid ${openTrades.length > 0 ? '#00c853' : '#2a2d3e'}`, color: openTrades.length > 0 ? '#00c853' : '#555', borderRadius: 20, padding: '2px 10px', fontSize: 12 }}>{openTrades.length} open</span>}
      >
        {openTrades.length === 0 ? (
          <div style={{ color: '#555', fontSize: 14, textAlign: 'center', padding: '24px 0' }}>
            No open futures positions — bot will scan every 30 min when Tastytrade is enabled
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Direction</th>
                <th>Entry $/oz</th>
                <th>Current $/oz</th>
                <th>Move</th>
                <th>Contracts</th>
                <th>Multiplier</th>
                <th>Unrealized P/L</th>
                <th>Hold Time</th>
                <th>Stop</th>
                <th>Target</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {openTrades.map(t => {
                const curr = prices[t.symbol]?.price;
                const move = curr != null ? curr - t.price : null;
                const uPL = unrealizedPL(t);
                const uPct = unrealizedPct(t);
                const multiplier = t.leverage || MULTIPLIERS[t.symbol] || 10;
                return (
                  <React.Fragment key={t._id}>
                    <tr
                      onClick={() => setExpandedId(expandedId === t._id ? null : t._id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td><strong style={{ color: '#f5a623' }}>{t.symbol}</strong></td>
                      <td>
                        <span className={`badge ${t.type?.toLowerCase()}`}>{t.type === 'BUY' ? 'LONG' : 'SHORT'}</span>
                      </td>
                      <td>${t.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td style={{ color: curr != null ? (curr > t.price ? '#00c853' : '#ff3d3d') : '#555' }}>
                        {curr != null ? `$${curr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Loading...'}
                      </td>
                      <td style={{ color: move != null ? (move >= 0 ? '#00c853' : '#ff3d3d') : '#555' }}>
                        {move != null ? `${move >= 0 ? '+' : ''}$${move.toFixed(2)}/oz` : '—'}
                      </td>
                      <td style={{ color: '#888' }}>{t.quantity} contract{t.quantity !== 1 ? 's' : ''}</td>
                      <td style={{ color: '#f5a623' }}>{multiplier} oz/contract</td>
                      <td style={{ fontWeight: 700, color: uPL != null ? (uPL >= 0 ? '#00c853' : '#ff3d3d') : '#555' }}>
                        {uPL != null ? (
                          <>
                            {uPL >= 0 ? '+' : ''}${uPL.toFixed(2)}
                            {uPct != null && (
                              <span style={{ fontSize: 11, marginLeft: 4, opacity: 0.7 }}>
                                ({uPct >= 0 ? '+' : ''}{uPct.toFixed(2)}%)
                              </span>
                            )}
                          </>
                        ) : '—'}
                      </td>
                      <td style={{ color: '#888' }}>{formatDuration(t.executedAt, null)}</td>
                      <td style={{ fontSize: 12, color: '#ff6b35' }}>
                        {t.atrStopPrice ? `$${t.atrStopPrice.toFixed(2)}` : '—'}
                      </td>
                      <td style={{ fontSize: 12, color: '#00c853' }}>
                        {t.atrTakePrice ? `$${t.atrTakePrice.toFixed(2)}` : '—'}
                      </td>
                      <td style={{ color: '#555', fontSize: 12 }}>{expandedId === t._id ? '▲' : '▼'}</td>
                    </tr>
                    {expandedId === t._id && (
                      <tr>
                        <td colSpan={12} style={{ background: '#0d0f1a', padding: '14px 18px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                            <div>
                              <div style={{ fontSize: 11, color: '#555', marginBottom: 3 }}>HOW P/L IS CALCULATED</div>
                              <div style={{ fontSize: 12, color: '#888', lineHeight: 1.6 }}>
                                ({curr != null ? `$${curr.toFixed(2)}` : 'current'} − ${t.price.toFixed(2)}) × {t.quantity} contract × {multiplier} oz = <strong style={{ color: uPL != null ? (uPL >= 0 ? '#00c853' : '#ff3d3d') : '#fff' }}>{uPL != null ? `${uPL >= 0 ? '+' : ''}$${uPL.toFixed(2)}` : '—'}</strong>
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: 11, color: '#555', marginBottom: 3 }}>MARGIN USED</div>
                              <div style={{ fontSize: 13, color: '#fff' }}>${t.amount?.toFixed(2)}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 11, color: '#555', marginBottom: 3 }}>CONFIDENCE</div>
                              <div style={{ fontSize: 13, color: '#fff' }}>{t.confidence}%</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 11, color: '#555', marginBottom: 3 }}>BROKER</div>
                              <div style={{ fontSize: 13, color: '#fff', textTransform: 'uppercase' }}>{t.broker}</div>
                            </div>
                            {t.suggestedHold && (
                              <div>
                                <div style={{ fontSize: 11, color: '#555', marginBottom: 3 }}>SUGGESTED HOLD</div>
                                <div style={{ fontSize: 13, color: '#fff' }}>{t.suggestedHold}</div>
                              </div>
                            )}
                            {t.aiReason && (
                              <div style={{ gridColumn: '1 / -1' }}>
                                <div style={{ fontSize: 11, color: '#555', marginBottom: 3 }}>AI REASONING</div>
                                <div style={{ fontSize: 12, color: '#888', lineHeight: 1.5 }}>{t.aiReason}</div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </Section>

      {/* Closed Trades */}
      <Section
        title="Trade History"
        badge={
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            {closedTrades.length > 0 && (
              <>
                <span style={{ fontSize: 12, color: totalPL >= 0 ? '#00c853' : '#ff3d3d', fontWeight: 700 }}>
                  {totalPL >= 0 ? '+' : ''}${totalPL.toFixed(2)}
                </span>
                {winRate !== null && (
                  <span style={{ fontSize: 12, color: '#888' }}>
                    {wins}W / {closedTrades.length - wins}L · {winRate}% WR
                  </span>
                )}
              </>
            )}
          </div>
        }
      >
        {closedTrades.length === 0 ? (
          <div style={{ color: '#555', fontSize: 14, textAlign: 'center', padding: '24px 0' }}>
            No closed futures trades yet
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Direction</th>
                <th>Entry $/oz</th>
                <th>Exit $/oz</th>
                <th>Move</th>
                <th>Contracts</th>
                <th>P/L</th>
                <th>Return %</th>
                <th>Closed</th>
                <th>Hold</th>
                <th>Close Reason</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {closedTrades.map(t => {
                const move = t.closePrice != null ? t.closePrice - t.price : null;
                const pctMove = t.price > 0 && t.closePrice != null ? ((t.closePrice - t.price) / t.price * 100) : null;
                const displayMove = t.type === 'SHORT' && move != null ? -move : move;
                const displayPct  = t.type === 'SHORT' && pctMove != null ? -pctMove : pctMove;
                const multiplier  = t.leverage || MULTIPLIERS[t.symbol] || 10;
                const pl = t.profitLoss || 0;
                return (
                  <React.Fragment key={t._id}>
                    <tr
                      onClick={() => setExpandedId(expandedId === t._id ? null : t._id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td><strong style={{ color: '#f5a623' }}>{t.symbol}</strong></td>
                      <td><span className={`badge ${t.type?.toLowerCase()}`}>{t.type === 'BUY' ? 'LONG' : 'SHORT'}</span></td>
                      <td>${t.price?.toFixed(2)}</td>
                      <td style={{ color: '#888' }}>{t.closePrice != null ? `$${t.closePrice.toFixed(2)}` : '—'}</td>
                      <td style={{ color: displayMove != null ? (displayMove >= 0 ? '#00c853' : '#ff3d3d') : '#555' }}>
                        {displayMove != null ? `${displayMove >= 0 ? '+' : ''}$${displayMove.toFixed(2)}/oz` : '—'}
                      </td>
                      <td style={{ color: '#888' }}>{t.quantity} × {multiplier}oz</td>
                      <td style={{ fontWeight: 700, color: pl >= 0 ? '#00c853' : '#ff3d3d' }}>
                        {pl >= 0 ? '+' : ''}${pl.toFixed(2)}
                      </td>
                      <td style={{ color: displayPct != null ? (displayPct >= 0 ? '#00c853' : '#ff3d3d') : '#555', fontSize: 12 }}>
                        {displayPct != null ? `${displayPct >= 0 ? '+' : ''}${displayPct.toFixed(2)}%` : '—'}
                      </td>
                      <td style={{ color: '#888', fontSize: 12 }}>{formatDateTime(t.closedAt)}</td>
                      <td style={{ color: '#888', fontSize: 12 }}>{formatDuration(t.executedAt, t.closedAt)}</td>
                      <td style={{ color: '#555', fontSize: 11, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.closeReason || '—'}
                      </td>
                      <td style={{ color: '#555', fontSize: 12 }}>{expandedId === t._id ? '▲' : '▼'}</td>
                    </tr>
                    {expandedId === t._id && (
                      <tr>
                        <td colSpan={12} style={{ background: '#0d0f1a', padding: '14px 18px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                            <div>
                              <div style={{ fontSize: 11, color: '#555', marginBottom: 3 }}>P/L BREAKDOWN</div>
                              <div style={{ fontSize: 12, color: '#888', lineHeight: 1.6 }}>
                                ({t.closePrice?.toFixed(2) || '?'} − {t.price.toFixed(2)}) × {t.quantity} × {multiplier}oz = <strong style={{ color: pl >= 0 ? '#00c853' : '#ff3d3d' }}>{pl >= 0 ? '+' : ''}${pl.toFixed(2)}</strong>
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: 11, color: '#555', marginBottom: 3 }}>MARGIN USED</div>
                              <div style={{ fontSize: 13, color: '#fff' }}>${t.amount?.toFixed(2)}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 11, color: '#555', marginBottom: 3 }}>RETURN ON MARGIN</div>
                              <div style={{ fontSize: 13, color: pl >= 0 ? '#00c853' : '#ff3d3d' }}>
                                {t.amount > 0 ? `${(pl / t.amount * 100).toFixed(1)}%` : '—'}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: 11, color: '#555', marginBottom: 3 }}>CONFIDENCE</div>
                              <div style={{ fontSize: 13, color: '#fff' }}>{t.confidence}%</div>
                            </div>
                            {t.aiReason && (
                              <div style={{ gridColumn: '1 / -1' }}>
                                <div style={{ fontSize: 11, color: '#555', marginBottom: 3 }}>AI REASONING</div>
                                <div style={{ fontSize: 12, color: '#888', lineHeight: 1.5 }}>{t.aiReason}</div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </Section>

      {/* Settings Panel */}
      {localSettings && (
        <Section title="Tastytrade Settings">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>

            {/* Enable / Disable toggle */}
            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', background: localSettings.tastytradeEnabled ? '#0a2e1a' : '#1a1a2e', borderRadius: 10, border: `1px solid ${localSettings.tastytradeEnabled ? '#00c853' : '#5865f2'}` }}>
              <div>
                <div style={{ fontWeight: 700, color: localSettings.tastytradeEnabled ? '#00c853' : '#5865f2', fontSize: 15 }}>
                  {localSettings.tastytradeEnabled ? 'Futures Trading ENABLED' : 'Futures Trading DISABLED (Paper Mode)'}
                </div>
                <div style={{ fontSize: 12, color: '#555', marginTop: 3 }}>
                  {localSettings.tastytradeEnabled
                    ? 'Bot places real orders on Tastytrade when signals fire'
                    : 'Bot simulates trades — no real orders. Enable after getting Tastytrade futures approval + funding account.'}
                </div>
              </div>
              <button
                onClick={() => update('tastytradeEnabled', !localSettings.tastytradeEnabled)}
                style={{
                  marginLeft: 'auto', padding: '8px 20px', borderRadius: 8,
                  border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
                  background: localSettings.tastytradeEnabled ? '#ff3d3d' : '#00c853',
                  color: '#fff', whiteSpace: 'nowrap'
                }}
              >
                {localSettings.tastytradeEnabled ? 'Disable' : 'Enable'}
              </button>
            </div>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#888' }}>Capital Allocated ($)</span>
              <input
                type="number"
                value={localSettings.tastytradeCapital}
                onChange={e => update('tastytradeCapital', parseFloat(e.target.value))}
                style={{ background: '#0d0f1a', border: '1px solid #2a2d3e', color: '#fff', padding: '8px 12px', borderRadius: 8, fontSize: 14 }}
              />
              <span style={{ fontSize: 11, color: '#555' }}>Total $ in Tastytrade account for futures</span>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#888' }}>Margin per Trade ($)</span>
              <input
                type="number"
                value={localSettings.futuresMaxTradeAmount}
                onChange={e => update('futuresMaxTradeAmount', parseFloat(e.target.value))}
                style={{ background: '#0d0f1a', border: '1px solid #2a2d3e', color: '#fff', padding: '8px 12px', borderRadius: 8, fontSize: 14 }}
              />
              <span style={{ fontSize: 11, color: '#555' }}>/MGC requires ~$1,500 margin per contract</span>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#888' }}>Min AI Confidence (%)</span>
              <input
                type="number" min={55} max={95}
                value={localSettings.futuresMinConfidence}
                onChange={e => update('futuresMinConfidence', parseInt(e.target.value))}
                style={{ background: '#0d0f1a', border: '1px solid #2a2d3e', color: '#fff', padding: '8px 12px', borderRadius: 8, fontSize: 14 }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#888' }}>Max Open Positions</span>
              <input
                type="number" min={1} max={5}
                value={localSettings.futuresMaxPositions}
                onChange={e => update('futuresMaxPositions', parseInt(e.target.value))}
                style={{ background: '#0d0f1a', border: '1px solid #2a2d3e', color: '#fff', padding: '8px 12px', borderRadius: 8, fontSize: 14 }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#888' }}>Take Profit (% spot move)</span>
              <input
                type="number" step="0.1"
                value={localSettings.futuresTakeProfitPercent}
                onChange={e => update('futuresTakeProfitPercent', parseFloat(e.target.value))}
                style={{ background: '#0d0f1a', border: '1px solid #2a2d3e', color: '#fff', padding: '8px 12px', borderRadius: 8, fontSize: 14 }}
              />
              <span style={{ fontSize: 11, color: '#555' }}>0.6% move on $3,300 gold = $20/oz × 10 = $200</span>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#888' }}>Stop Loss (% spot move)</span>
              <input
                type="number" step="0.1"
                value={localSettings.futuresStopLossPercent}
                onChange={e => update('futuresStopLossPercent', parseFloat(e.target.value))}
                style={{ background: '#0d0f1a', border: '1px solid #2a2d3e', color: '#fff', padding: '8px 12px', borderRadius: 8, fontSize: 14 }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#888' }}>Max Hold Hours</span>
              <input
                type="number"
                value={localSettings.futuresMaxHoldHours}
                onChange={e => update('futuresMaxHoldHours', parseInt(e.target.value))}
                style={{ background: '#0d0f1a', border: '1px solid #2a2d3e', color: '#fff', padding: '8px 12px', borderRadius: 8, fontSize: 14 }}
              />
              <span style={{ fontSize: 11, color: '#555' }}>Gold can trend for days — 72h default</span>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#888' }}>Futures Symbols</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', background: '#0d0f1a', border: '1px solid #2a2d3e', borderRadius: 8, padding: '8px 10px' }}>
                {(localSettings.futuresSymbols || []).map(sym => (
                  <span key={sym} style={{ background: '#1a1d2e', border: '1px solid #f5a623', borderRadius: 20, padding: '3px 10px', fontSize: 13, fontWeight: 700, color: '#f5a623', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {sym}
                    <button
                      onClick={() => update('futuresSymbols', localSettings.futuresSymbols.filter(s => s !== sym))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: 14, padding: 0 }}
                    >×</button>
                  </span>
                ))}
                <span style={{ fontSize: 11, color: '#555' }}>
                  {localSettings.futuresSymbols?.length === 0 ? 'No symbols — add /MGC' : ''}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {['/MGC', '/SIL'].filter(s => !(localSettings.futuresSymbols || []).includes(s)).map(s => (
                  <button
                    key={s}
                    onClick={() => update('futuresSymbols', [...(localSettings.futuresSymbols || []), s])}
                    style={{ background: '#1a1d2e', border: '1px solid #2a2d3e', color: '#888', padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
                  >
                    + {s}
                  </button>
                ))}
              </div>
              <span style={{ fontSize: 11, color: '#555' }}>/MGC = Micro Gold (10oz) · /SIL = Micro Silver (1,000oz)</span>
            </label>
          </div>

          <div style={{ marginTop: 20 }}>
            <button
              onClick={saveSettings}
              disabled={saving}
              style={{
                background: saving ? '#2a2d3e' : '#5865f2', color: '#fff',
                border: 'none', borderRadius: 8, padding: '10px 28px',
                fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer'
              }}
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </Section>
      )}

      {/* Tastytrade Account Info */}
      <Section title="Tastytrade Account">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          <div style={{ background: '#0d0f1a', borderRadius: 8, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: '#555', marginBottom: 4 }}>ACCOUNT NUMBER</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>5WI91851</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Individual Margin</div>
          </div>
          <div style={{ background: '#0d0f1a', borderRadius: 8, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: '#555', marginBottom: 4 }}>FUTURES STATUS</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: settings?.tastytradeEnabled ? '#00c853' : '#f5a623' }}>
              {settings?.tastytradeEnabled ? 'Approved + Active' : 'Awaiting Approval'}
            </div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
              {settings?.tastytradeEnabled ? 'Bot placing live orders' : 'Email sent — check soheb.s@yahoo.com'}
            </div>
          </div>
          <div style={{ background: '#0d0f1a', borderRadius: 8, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: '#555', marginBottom: 4 }}>API CREDENTIALS</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: ttStatus?.configured ? '#00c853' : '#888' }}>
              {ttStatus?.configured ? 'Set' : 'Not Set'}
            </div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
              {ttStatus?.configured ? 'TASTYTRADE_USERNAME/PASSWORD in Railway' : 'Add to Railway env vars to go live'}
            </div>
          </div>
          {ttStatus?.configured && ttStatus?.balance && (
            <div style={{ background: '#0d0f1a', borderRadius: 8, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, color: '#555', marginBottom: 4 }}>NET LIQUIDATION</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#00c853' }}>
                {ttStatus.balance['net-liq-balance']
                  ? `$${parseFloat(ttStatus.balance['net-liq-balance']).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                  : '—'}
              </div>
            </div>
          )}
          <div style={{ background: '#0d0f1a', borderRadius: 8, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: '#555', marginBottom: 4 }}>GO-LIVE CHECKLIST</div>
            <div style={{ fontSize: 12, color: '#888', lineHeight: 1.8 }}>
              {[
                ['Tastytrade account open', true],
                ['Futures approval email sent', true],
                ['Futures approval received', !!settings?.tastytradeEnabled],
                ['Account funded ($2,500+)', false],
                ['Railway env vars set', !!ttStatus?.configured],
                ['tastytradeEnabled = true', !!settings?.tastytradeEnabled],
              ].map(([label, done]) => (
                <div key={label} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ color: done ? '#00c853' : '#555' }}>{done ? '✓' : '○'}</span>
                  <span style={{ color: done ? '#c9d1d9' : '#555' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}

export default Futures;
