import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useApp } from '../context/AppContext';

const API = process.env.REACT_APP_API_URL;

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString([], {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function formatDuration(start, end) {
  if (!start || !end) return '—';
  const mins = Math.floor((new Date(end) - new Date(start)) / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  return `${Math.floor(hrs / 24)}d ${hrs % 24}h`;
}

function Trades() {
  const { liveTrades } = useApp();
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterMarket, setFilterMarket] = useState('all');
  const [filterSymbol, setFilterSymbol] = useState('all');

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/trades`);
      setTrades(res.data);
      setError(false);
    } catch {
      setError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  // Merge live WebSocket trades with fetched trades
  const seenIds = new Set();
  const allTrades = [...liveTrades, ...trades]
    .filter(t => { if (seenIds.has(t._id)) return false; seenIds.add(t._id); return true; });

  const symbols = ['all', ...new Set(allTrades.map(t => t.symbol))];

  const filtered = allTrades.filter(t => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (filterMarket !== 'all' && t.market !== filterMarket) return false;
    if (filterSymbol !== 'all' && t.symbol !== filterSymbol) return false;
    return true;
  });

  const closedFiltered = filtered.filter(t => t.status === 'closed');
  const totalPL = closedFiltered.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
  const wins = closedFiltered.filter(t => (t.profitLoss || 0) > 0).length;
  const losses = closedFiltered.filter(t => (t.profitLoss || 0) < 0).length;
  const winRate = closedFiltered.length > 0 ? Math.round(wins / closedFiltered.length * 100) : null;

  if (loading) return <div className="page-title">Loading...</div>;

  if (error) return (
    <div>
      <h1 className="page-title">Trade History</h1>
      <div style={{
        background: '#2a1a1a', border: '1px solid #ff3d3d', borderRadius: 8,
        padding: '16px 20px', color: '#ff3d3d', fontSize: 14
      }}>
        Could not load trades — check your connection or try refreshing.
      </div>
    </div>
  );

  return (
    <div>
      <h1 className="page-title">Trade History</h1>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {['all', 'open', 'closed'].map(f => (
            <button
              key={f}
              onClick={() => setFilterStatus(f)}
              style={{
                padding: '7px 14px', borderRadius: 6, border: filterStatus === f ? 'none' : '1px solid #2a2d3e',
                background: filterStatus === f ? '#5865f2' : '#1a1d27',
                color: filterStatus === f ? '#fff' : '#888',
                cursor: 'pointer', fontSize: 13, fontWeight: 600, textTransform: 'capitalize'
              }}
            >
              {f}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {['all', 'crypto', 'stock'].map(f => (
            <button
              key={f}
              onClick={() => setFilterMarket(f)}
              style={{
                padding: '7px 14px', borderRadius: 6, border: filterMarket === f ? 'none' : '1px solid #2a2d3e',
                background: filterMarket === f ? '#5865f2' : '#1a1d27',
                color: filterMarket === f ? '#fff' : '#888',
                cursor: 'pointer', fontSize: 13, fontWeight: 600, textTransform: 'capitalize'
              }}
            >
              {f === 'all' ? 'All Markets' : f}
            </button>
          ))}
        </div>

        <select
          value={filterSymbol}
          onChange={e => setFilterSymbol(e.target.value)}
          style={{ background: '#1a1d27', border: '1px solid #2a2d3e', color: '#fff', padding: '7px 12px', borderRadius: 6, fontSize: 13 }}
        >
          {symbols.map(s => (
            <option key={s} value={s}>{s === 'all' ? 'All Symbols' : s}</option>
          ))}
        </select>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          {closedFiltered.length > 0 && (
            <>
              <span style={{ fontSize: 13 }}>
                P/L:{' '}
                <strong style={{ color: totalPL >= 0 ? '#00c853' : '#ff3d3d' }}>
                  {totalPL >= 0 ? '+' : ''}${totalPL.toFixed(2)}
                </strong>
              </span>
              <span style={{ fontSize: 13 }}>
                <strong style={{ color: '#00c853' }}>{wins}W</strong>
                <span style={{ color: '#555', margin: '0 4px' }}>/</span>
                <strong style={{ color: '#ff3d3d' }}>{losses}L</strong>
              </span>
              {winRate !== null && (
                <span style={{ fontSize: 13 }}>
                  Win Rate:{' '}
                  <strong style={{ color: winRate >= 50 ? '#00c853' : '#ff3d3d' }}>
                    {winRate}%
                  </strong>
                </span>
              )}
            </>
          )}
          <span style={{ color: '#555', fontSize: 13 }}>
            {filtered.length} of {allTrades.length} trades{allTrades.length >= 100 ? ' (last 100)' : ''}
          </span>
        </div>
      </div>

      <div className="section">
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Type</th>
              <th>Market</th>
              <th>Entry</th>
              <th>ATR Stop</th>
              <th>ATR TP</th>
              <th>Exit</th>
              <th>Amount</th>
              <th>Leverage</th>
              <th>Status</th>
              <th>P/L</th>
              <th>Opened</th>
              <th>Closed</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={14} style={{ color: '#666', textAlign: 'center' }}>
                    {allTrades.length === 0 ? 'No trades yet — start the bot' : 'No trades match your filters'}
                  </td>
              </tr>
            ) : filtered.map((t) => (
              <React.Fragment key={t._id}>
                <tr
                  onClick={() => setExpandedId(expandedId === t._id ? null : t._id)}
                  style={{ cursor: 'pointer' }}
                >
                  <td><strong>{t.symbol}</strong></td>
                  <td><span className={`badge ${t.type?.toLowerCase()}`}>{t.type}</span></td>
                  <td style={{ color: '#888' }}>{t.market}</td>
                  <td>${t.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td style={{ color: t.atrStopPrice ? (t.status === 'open' ? '#ff6b35' : '#555') : '#444', fontSize: 12, whiteSpace: 'nowrap' }}>
                    {t.atrStopPrice
                      ? `$${t.atrStopPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : '—'}
                  </td>
                  <td style={{ color: t.atrTakePrice ? (t.status === 'open' ? '#00c853' : '#555') : '#444', fontSize: 12, whiteSpace: 'nowrap' }}>
                    {t.atrTakePrice
                      ? `$${t.atrTakePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : '—'}
                  </td>
                  <td style={{ color: t.closePrice ? '#fff' : '#555' }}>
                    {t.closePrice ? `$${t.closePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                  </td>
                  <td>${t.amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td style={{ color: (t.leverage || 1) > 1 ? '#f5a623' : '#555', fontWeight: (t.leverage || 1) > 1 ? 700 : 400 }}>
                    {t.leverage || 1}x
                  </td>
                  <td><span className={`badge ${t.status}`}>{t.status}</span></td>
                  <td style={{ color: t.status === 'open' ? '#888' : (t.profitLoss || 0) >= 0 ? '#00c853' : '#ff3d3d' }}>
                    {t.status === 'open' ? '—' : (
                      <>
                        {(t.profitLoss || 0) >= 0 ? '+' : ''}${(t.profitLoss || 0).toFixed(2)}
                        {t.amount > 0 && (
                          <span style={{ fontSize: 11, marginLeft: 4, opacity: 0.7 }}>
                            ({((t.profitLoss || 0) / t.amount * 100).toFixed(1)}%)
                          </span>
                        )}
                      </>
                    )}
                  </td>
                  <td style={{ color: '#666', fontSize: 12, whiteSpace: 'nowrap' }}>{formatDateTime(t.executedAt)}</td>
                  <td style={{ color: '#666', fontSize: 12, whiteSpace: 'nowrap' }}>{formatDateTime(t.closedAt)}</td>
                  <td style={{ color: '#555', fontSize: 12 }}>{expandedId === t._id ? '▲' : '▼'}</td>
                </tr>

                {expandedId === t._id && (
                  <tr>
                    <td colSpan={14} style={{ background: '#13151f', padding: '16px 20px' }}>
                      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 14 }}>
                        {t.executedAt && (
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ color: '#555', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
                              {t.status === 'open' ? 'Held For' : 'Duration'}
                            </div>
                            <div style={{ color: '#aaa', fontWeight: 600, fontSize: 13, marginTop: 4 }}>
                              {formatDuration(t.executedAt, t.closedAt || new Date())}
                            </div>
                          </div>
                        )}
                        {t.confidence > 0 && (
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ color: '#555', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Confidence</div>
                            <div style={{ color: t.confidence >= 70 ? '#00c853' : '#ffd600', fontWeight: 700, fontSize: 16, marginTop: 4 }}>
                              {t.confidence}%
                            </div>
                          </div>
                        )}
                        {t.whaleActivity && (
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ color: '#555', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Whale</div>
                            <div style={{
                              color: t.whaleActivity === 'buying' ? '#00c853' : t.whaleActivity === 'selling' ? '#ff3d3d' : '#888',
                              fontWeight: 600, fontSize: 13, marginTop: 4
                            }}>
                              {t.whaleActivity}
                            </div>
                          </div>
                        )}
                        {t.quantity > 0 && (
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ color: '#555', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Quantity</div>
                            <div style={{ color: '#aaa', fontWeight: 600, fontSize: 13, marginTop: 4 }}>{t.quantity}</div>
                          </div>
                        )}
                        {t.atrStopPrice && (
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ color: '#555', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>ATR Stop</div>
                            <div style={{ color: t.status === 'open' ? '#ff6b35' : '#666', fontWeight: 700, fontSize: 13, marginTop: 4 }}>
                              ${t.atrStopPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>
                        )}
                        {t.atrTakePrice && (
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ color: '#555', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>ATR TP</div>
                            <div style={{ color: t.status === 'open' ? '#00c853' : '#666', fontWeight: 700, fontSize: 13, marginTop: 4 }}>
                              ${t.atrTakePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>
                        )}
                      </div>
                      {t.aiReason && (
                        <div style={{ borderTop: '1px solid #2a2d3e', paddingTop: 12, marginBottom: t.newsSnapshot ? 10 : 0 }}>
                          <span style={{ color: '#555', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginRight: 8 }}>AI Reason</span>
                          <span style={{ color: '#aaa', fontSize: 13, lineHeight: 1.7 }}>{t.aiReason}</span>
                        </div>
                      )}
                      {t.newsSnapshot && (
                        <div style={{ borderTop: '1px solid #2a2d3e', paddingTop: 12 }}>
                          <span style={{ color: '#555', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginRight: 8 }}>News Snapshot</span>
                          <span style={{ color: '#666', fontSize: 12, lineHeight: 1.7 }}>{t.newsSnapshot}</span>
                        </div>
                      )}
                      {t.closeReason && (
                        <div style={{ borderTop: '1px solid #2a2d3e', paddingTop: 12, marginTop: 10 }}>
                          <span style={{ color: '#555', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginRight: 8 }}>Close Reason</span>
                          <span style={{
                            fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 20,
                            background: t.closeReason?.toLowerCase().includes('stop') ? '#2a1a1a' : t.closeReason?.toLowerCase().includes('profit') ? '#0d2a1a' : '#1a1d27',
                            color: t.closeReason?.toLowerCase().includes('stop') ? '#ff3d3d' : t.closeReason?.toLowerCase().includes('profit') ? '#00c853' : '#888'
                          }}>
                            {t.closeReason}
                          </span>
                        </div>
                      )}
                      {t.postMortem && (
                        <div style={{ borderTop: '1px solid #2a2d3e', paddingTop: 12, marginTop: 10 }}>
                          <span style={{ color: '#5865f2', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginRight: 8 }}>AI Post-Mortem</span>
                          <div style={{ color: '#aaa', fontSize: 13, lineHeight: 1.7, marginTop: 6, fontStyle: 'italic' }}>{t.postMortem}</div>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Trades;
