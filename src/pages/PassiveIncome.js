import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import Section from '../components/Section';
import PriceChart from '../components/PriceChart';
import { formatDateTime } from '../utils';
import { API_URL as API } from '../config';

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{
      background: '#141720', border: '1px solid #2a2d3e', borderRadius: 10,
      padding: '18px 22px', minWidth: 150, flex: 1
    }}>
      <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || '#fff' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function PaperBadge() {
  return (
    <span style={{ background: '#1a1a2e', border: '1px solid #5865f2', borderRadius: 20, padding: '3px 12px', fontSize: 12, color: '#5865f2', fontWeight: 700 }}>
      PAPER
    </span>
  );
}

function TagInput({ symbols, onChange, placeholder }) {
  const [input, setInput] = useState('');
  function add() {
    const val = input.trim().toUpperCase();
    if (val && !symbols.includes(val)) onChange([...symbols, val]);
    setInput('');
  }
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', background: '#0d0f1a', border: '1px solid #2a2d3e', borderRadius: 8, padding: '8px 10px' }}>
        {symbols.map(sym => (
          <span key={sym} style={{ background: '#1a1d2e', border: '1px solid #2a2d3e', borderRadius: 20, padding: '3px 10px 3px 12px', fontSize: 13, fontWeight: 600, color: '#c9d1d9', display: 'flex', alignItems: 'center', gap: 5 }}>
            {sym}
            <button onClick={() => onChange(symbols.filter(s => s !== sym))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: 14, padding: 0 }}>×</button>
          </span>
        ))}
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }}
          placeholder={symbols.length === 0 ? placeholder : ''}
          style={{ background: 'none', border: 'none', outline: 'none', color: '#c9d1d9', fontSize: 13, minWidth: 100, flex: 1 }}
        />
      </div>
    </div>
  );
}

function NumField({ label, value, onChange, step, sub }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, color: '#888' }}>{label}</span>
      <input
        type="number" step={step || 1}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ background: '#0d0f1a', border: '1px solid #2a2d3e', color: '#fff', padding: '8px 12px', borderRadius: 8, fontSize: 14 }}
      />
      {sub && <span style={{ fontSize: 11, color: '#555' }}>{sub}</span>}
    </label>
  );
}

function EnableToggle({ enabled, onToggle, onLabel, offLabel, onSub, offSub }) {
  return (
    <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', background: enabled ? '#0a2e1a' : '#1a1a2e', borderRadius: 10, border: `1px solid ${enabled ? '#00c853' : '#5865f2'}` }}>
      <div>
        <div style={{ fontWeight: 700, color: enabled ? '#00c853' : '#5865f2', fontSize: 15 }}>
          {enabled ? onLabel : offLabel}
        </div>
        <div style={{ fontSize: 12, color: '#555', marginTop: 3 }}>{enabled ? onSub : offSub}</div>
      </div>
      <button
        onClick={onToggle}
        style={{ marginLeft: 'auto', padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: enabled ? '#ff3d3d' : '#00c853', color: '#fff', whiteSpace: 'nowrap' }}
      >
        {enabled ? 'Disable' : 'Enable'}
      </button>
    </div>
  );
}

function SaveButton({ onClick, saving }) {
  return (
    <div style={{ marginTop: 20 }}>
      <button
        onClick={onClick}
        disabled={saving}
        style={{ background: saving ? '#2a2d3e' : '#5865f2', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 28px', fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer' }}
      >
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
}

function formatDuration(start, end) {
  if (!start) return '—';
  const mins = Math.floor((new Date(end || Date.now()) - new Date(start)) / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  return `${Math.floor(hrs / 24)}d ${hrs % 24}h`;
}

// ─── Funding Arb Tab ─────────────────────────────────────────────────────

function FundingArbTab() {
  const [open, setOpen] = useState([]);
  const [closed, setClosed] = useState([]);
  const [settings, setSettings] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(async () => {
    try {
      const [tradesRes, settingsRes, statusRes] = await Promise.all([
        axios.get(`${API}/funding-arb/trades`),
        axios.get(`${API}/funding-arb/settings`),
        axios.get(`${API}/funding-arb/status`)
      ]);
      setOpen(tradesRes.data.open || []);
      setClosed(tradesRes.data.closed || []);
      setSettings(settingsRes.data);
      setStatus(statusRes.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  async function saveSettings() {
    setSaving(true);
    try {
      await axios.post(`${API}/funding-arb/settings`, settings);
    } catch {}
    setSaving(false);
  }

  function update(key, val) { setSettings(prev => ({ ...prev, [key]: val })); }

  if (loading || !settings) return <div style={{ color: '#555', padding: 20 }}>Loading...</div>;

  const totalPL = closed.reduce((s, t) => s + (t.profitLoss || 0), 0);
  const totalOpenAccrued = open.reduce((s, t) => s + (t.profitLoss ?? t.totalFundingAccrued ?? 0), 0);
  const wins = closed.filter(t => (t.profitLoss || 0) > 0).length;
  const winRate = closed.length > 0 ? Math.round(wins / closed.length * 100) : null;

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <StatCard
          label="Accrued (Open Positions)"
          value={open.length === 0 ? '—' : `${totalOpenAccrued >= 0 ? '+' : ''}$${totalOpenAccrued.toFixed(2)}`}
          sub={`${open.length} open position${open.length !== 1 ? 's' : ''}`}
          color={totalOpenAccrued >= 0 ? '#00c853' : '#ff3d3d'}
        />
        <StatCard
          label="Realized P/L"
          value={closed.length === 0 ? '—' : `${totalPL >= 0 ? '+' : ''}$${totalPL.toFixed(2)}`}
          sub={`${closed.length} closed position${closed.length !== 1 ? 's' : ''}`}
          color={totalPL >= 0 ? '#00c853' : '#ff3d3d'}
        />
        <StatCard
          label="Win Rate"
          value={winRate !== null ? `${winRate}%` : '—'}
          sub={closed.length > 0 ? `${wins}W / ${closed.length - wins}L` : 'No closed positions yet'}
          color={winRate !== null ? (winRate >= 50 ? '#00c853' : '#ff3d3d') : '#fff'}
        />
        <StatCard
          label="Current Rates"
          value={status?.rates?.length ? `${status.rates.filter(r => r.rate != null).length}/${status.rates.length} live` : '—'}
          sub={status?.rates?.map(r => r.rate != null ? `${r.symbol} ${r.rate >= 0 ? '+' : ''}${r.rate.toFixed(4)}%` : `${r.symbol} n/a`).join(' · ') || ''}
          color="#14b8a6"
        />
      </div>

      <Section
        title="Open Positions"
        badge={<span style={{ background: open.length > 0 ? '#0a2e1a' : '#1a1d2e', border: `1px solid ${open.length > 0 ? '#00c853' : '#2a2d3e'}`, color: open.length > 0 ? '#00c853' : '#555', borderRadius: 20, padding: '2px 10px', fontSize: 12 }}>{open.length} open</span>}
      >
        {open.length === 0 ? (
          <div style={{ color: '#555', fontSize: 14, textAlign: 'center', padding: '24px 0' }}>
            No open funding-arb positions — enable below and the bot will scan every 30 min for a positive funding rate
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Symbol</th><th>Notional</th><th>Entry Rate</th><th>Last Rate</th>
                <th>Periods Accrued</th><th>Net P/L</th><th>Held</th><th></th>
              </tr>
            </thead>
            <tbody>
              {open.map(t => {
                const netPL = t.profitLoss ?? t.totalFundingAccrued ?? 0;
                return (
                <React.Fragment key={t._id}>
                  <tr onClick={() => setExpandedId(expandedId === t._id ? null : t._id)} style={{ cursor: 'pointer' }}>
                    <td><strong style={{ color: '#14b8a6' }}>{t.symbol}</strong></td>
                    <td>${t.amount?.toFixed(2)}</td>
                    <td style={{ color: '#00c853' }}>+{t.fundingRateAtEntry?.toFixed(4)}%</td>
                    <td style={{ color: (t.lastFundingRate || 0) >= 0 ? '#00c853' : '#ff3d3d' }}>
                      {t.lastFundingRate != null ? `${t.lastFundingRate >= 0 ? '+' : ''}${t.lastFundingRate.toFixed(4)}%` : '—'}
                    </td>
                    <td style={{ color: '#888' }}>{t.fundingPeriodsAccrued || 0}</td>
                    <td style={{ fontWeight: 700, color: netPL >= 0 ? '#00c853' : '#ff3d3d' }}>
                      {netPL >= 0 ? '+' : ''}${netPL.toFixed(2)}
                    </td>
                    <td style={{ color: '#888' }}>{formatDuration(t.executedAt, null)}</td>
                    <td style={{ color: '#555', fontSize: 12 }}>{expandedId === t._id ? '▲' : '▼'}</td>
                  </tr>
                  {expandedId === t._id && (
                    <tr>
                      <td colSpan={8} style={{ background: '#0d0f1a', padding: '14px 18px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                          <div style={{ gridColumn: '1 / -1' }}>
                            <div style={{ fontSize: 11, color: '#555', marginBottom: 3 }}>HOW P/L IS CALCULATED</div>
                            <div style={{ fontSize: 12, color: '#888', lineHeight: 1.6 }}>
                              Delta-neutral paper position: long {t.symbol} spot + synthetic short {t.hedgeSymbol}. Each cycle, accrued = notional × (latest rate / 100) × (hours since last check / 8). Summed across {t.fundingPeriodsAccrued || 0} checks so far = ${(t.totalFundingAccrued || 0).toFixed(2)} gross funding.
                              Modeled Kraken fees (entry/exit spot+margin fees + rollover while held) so far: ${(t.estimatedFeesAccrued || 0).toFixed(2)}. Net P/L = <strong style={{ color: netPL >= 0 ? '#00c853' : '#ff3d3d' }}>{netPL >= 0 ? '+' : ''}${netPL.toFixed(2)}</strong>.
                              This is an approximation of real 8h-boundary settlement and Kraken's published fee schedule, not an exact reconstruction — and price movement on the two legs is designed to cancel out, so it isn't a directional bet.
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: '#555', marginBottom: 3 }}>ENTRY SPOT PRICE</div>
                            <div style={{ fontSize: 13, color: '#fff' }}>${t.price?.toFixed(4)}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: '#555', marginBottom: 3 }}>SYNTHETIC HEDGE</div>
                            <div style={{ fontSize: 13, color: '#fff' }}>{t.hedgeSymbol}</div>
                          </div>
                          {t.aiReason && (
                            <div style={{ gridColumn: '1 / -1' }}>
                              <div style={{ fontSize: 11, color: '#555', marginBottom: 3 }}>NOTES</div>
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

      <Section title="Position History">
        {closed.length === 0 ? (
          <div style={{ color: '#555', fontSize: 14, textAlign: 'center', padding: '24px 0' }}>No closed positions yet</div>
        ) : (
          <table>
            <thead>
              <tr><th>Symbol</th><th>Notional</th><th>Entry Rate</th><th>Periods</th><th>P/L</th><th>Closed</th><th>Reason</th></tr>
            </thead>
            <tbody>
              {closed.map(t => (
                <tr key={t._id}>
                  <td><strong style={{ color: '#14b8a6' }}>{t.symbol}</strong></td>
                  <td>${t.amount?.toFixed(2)}</td>
                  <td style={{ color: '#00c853' }}>+{t.fundingRateAtEntry?.toFixed(4)}%</td>
                  <td style={{ color: '#888' }}>{t.fundingPeriodsAccrued || 0}</td>
                  <td style={{ fontWeight: 700, color: (t.profitLoss || 0) >= 0 ? '#00c853' : '#ff3d3d' }}>
                    {(t.profitLoss || 0) >= 0 ? '+' : ''}${(t.profitLoss || 0).toFixed(2)}
                  </td>
                  <td style={{ color: '#888', fontSize: 12 }}>{formatDateTime(t.closedAt)}</td>
                  <td style={{ color: '#555', fontSize: 11 }}>{t.closeReason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Funding-Rate Arbitrage Settings">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
          <EnableToggle
            enabled={settings.fundingArbEnabled}
            onToggle={() => update('fundingArbEnabled', !settings.fundingArbEnabled)}
            onLabel="Funding-Arb Simulator ENABLED"
            offLabel="Funding-Arb Simulator DISABLED"
            onSub="Bot scans every 30 min and opens paper positions when funding rate clears threshold"
            offSub="Permanently paper-only — never places a real order regardless of this setting"
          />
          <NumField label="Capital per Leg ($)" value={settings.fundingArbCapitalPerLeg} onChange={v => update('fundingArbCapitalPerLeg', v)} sub="Notional simulated per position" />
          <NumField label="Min Entry Rate (%)" value={settings.fundingArbMinRatePercent} step={0.001} onChange={v => update('fundingArbMinRatePercent', v)} sub="Skip if published rate is below this" />
          <NumField label="Max Positions" value={settings.fundingArbMaxPositions} onChange={v => update('fundingArbMaxPositions', v)} />
          <NumField label="Max Hold (days)" value={settings.fundingArbMaxHoldDays} onChange={v => update('fundingArbMaxHoldDays', v)} sub="Hygiene exit — no auto-exit on rate flip" />
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#888' }}>Symbols (must have a CoinGecko-tracked perp)</span>
            <TagInput symbols={settings.fundingArbSymbols || []} onChange={v => update('fundingArbSymbols', v)} placeholder="e.g. BTC/USDT" />
          </label>
        </div>
        <SaveButton onClick={saveSettings} saving={saving} />
      </Section>
    </div>
  );
}

// ─── Options Income Tab ──────────────────────────────────────────────────

function OptionsIncomeTab() {
  const [open, setOpen] = useState([]);
  const [closed, setClosed] = useState([]);
  const [settings, setSettings] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(async () => {
    try {
      const [tradesRes, settingsRes, statusRes] = await Promise.all([
        axios.get(`${API}/options-income/trades`),
        axios.get(`${API}/options-income/settings`),
        axios.get(`${API}/options-income/status`)
      ]);
      setOpen(tradesRes.data.open || []);
      setClosed(tradesRes.data.closed || []);
      setSettings(settingsRes.data);
      setStatus(statusRes.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  async function saveSettings() {
    setSaving(true);
    try {
      await axios.post(`${API}/options-income/settings`, settings);
    } catch {}
    setSaving(false);
  }

  function update(key, val) { setSettings(prev => ({ ...prev, [key]: val })); }

  if (loading || !settings) return <div style={{ color: '#555', padding: 20 }}>Loading...</div>;

  const totalPL = closed.reduce((s, t) => s + (t.profitLoss || 0), 0);
  const totalOpenMarked = open.reduce((s, t) => s + (t.profitLoss || 0), 0);
  const totalCreditCollected = [...open, ...closed].reduce((s, t) => s + (t.creditReceived || 0), 0);
  const wins = closed.filter(t => (t.profitLoss || 0) > 0).length;
  const winRate = closed.length > 0 ? Math.round(wins / closed.length * 100) : null;

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <StatCard
          label="Marked P/L (Open)"
          value={open.length === 0 ? '—' : `${totalOpenMarked >= 0 ? '+' : ''}$${totalOpenMarked.toFixed(2)}`}
          sub={`${open.length} open spread${open.length !== 1 ? 's' : ''}`}
          color={totalOpenMarked >= 0 ? '#00c853' : '#ff3d3d'}
        />
        <StatCard
          label="Realized P/L"
          value={closed.length === 0 ? '—' : `${totalPL >= 0 ? '+' : ''}$${totalPL.toFixed(2)}`}
          sub={`${closed.length} expired/closed`}
          color={totalPL >= 0 ? '#00c853' : '#ff3d3d'}
        />
        <StatCard
          label="Win Rate"
          value={winRate !== null ? `${winRate}%` : '—'}
          sub={closed.length > 0 ? `${wins}W / ${closed.length - wins}L` : 'No closed spreads yet'}
          color={winRate !== null ? (winRate >= 50 ? '#00c853' : '#ff3d3d') : '#fff'}
        />
        <StatCard
          label="Total Credit Collected"
          value={`$${totalCreditCollected.toFixed(2)}`}
          sub="Across open + closed spreads"
          color="#a855f7"
        />
        <StatCard
          label="Tastytrade Session"
          value={status?.sessionOk ? 'Connected' : status?.configured ? 'Reconnecting' : 'Not Configured'}
          sub="Reuses existing futures account — no new signup"
          color={status?.sessionOk ? '#00c853' : '#888'}
        />
      </div>

      <Section
        title="Open Spreads"
        badge={<span style={{ background: open.length > 0 ? '#0a2e1a' : '#1a1d2e', border: `1px solid ${open.length > 0 ? '#00c853' : '#2a2d3e'}`, color: open.length > 0 ? '#00c853' : '#555', borderRadius: 20, padding: '2px 10px', fontSize: 12 }}>{open.length} open</span>}
      >
        {open.length === 0 ? (
          <div style={{ color: '#555', fontSize: 14, textAlign: 'center', padding: '24px 0' }}>
            No open credit spreads — enable below and the bot will scan once daily (10am ET) using the latest bias signal for each symbol
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Symbol</th><th>Type</th><th>Short/Long</th><th>Credit</th>
                <th>Max Loss</th><th>Marked P/L</th><th>DTE Left</th><th></th>
              </tr>
            </thead>
            <tbody>
              {open.map(t => {
                const dteLeft = t.expirationDate ? Math.max(0, Math.ceil((new Date(t.expirationDate) - Date.now()) / 86400000)) : null;
                return (
                  <React.Fragment key={t._id}>
                    <tr onClick={() => setExpandedId(expandedId === t._id ? null : t._id)} style={{ cursor: 'pointer' }}>
                      <td><strong>{t.symbol}</strong></td>
                      <td><span className={`badge ${t.type?.toLowerCase()}`}>{t.type === 'PUT_CREDIT_SPREAD' ? 'PUT' : 'CALL'}</span></td>
                      <td style={{ color: '#888' }}>${t.shortStrike} / ${t.longStrike}</td>
                      <td style={{ color: '#a855f7' }}>${t.creditReceived?.toFixed(2)}</td>
                      <td style={{ color: '#ff6b35' }}>${t.amount?.toFixed(2)}</td>
                      <td style={{ fontWeight: 700, color: (t.profitLoss || 0) >= 0 ? '#00c853' : '#ff3d3d' }}>
                        {(t.profitLoss || 0) >= 0 ? '+' : ''}${(t.profitLoss || 0).toFixed(2)}
                      </td>
                      <td style={{ color: '#888' }}>{dteLeft != null ? `${dteLeft}d` : '—'}</td>
                      <td style={{ color: '#555', fontSize: 12 }}>{expandedId === t._id ? '▲' : '▼'}</td>
                    </tr>
                    {expandedId === t._id && (
                      <tr>
                        <td colSpan={8} style={{ background: '#0d0f1a', padding: '14px 18px' }}>
                          <div style={{ marginBottom: 12 }}>
                            <PriceChart
                              symbol={t.symbol}
                              market="stock"
                              entryPrice={t.price}
                              extraLines={[
                                { value: t.shortStrike, color: '#ff3d3d', label: `Short $${t.shortStrike}` },
                                { value: t.longStrike, color: '#00c853', label: `Long $${t.longStrike}` }
                              ]}
                            />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                            <div style={{ gridColumn: '1 / -1' }}>
                              <div style={{ fontSize: 11, color: '#555', marginBottom: 3 }}>HOW P/L IS CALCULATED (APPROXIMATE UNTIL EXPIRY)</div>
                              <div style={{ fontSize: 12, color: '#888', lineHeight: 1.6 }}>
                                Marked P/L = (deterministic payoff if {t.symbol} settled at today's price right now) × (% of the way through the hold period). This is a linear time-decay approximation — it does not model vega/IV-crush/gamma. At expiry it's replaced by the exact payoff: full credit (${t.creditReceived?.toFixed(2)}) if {t.symbol} settles {t.type === 'PUT_CREDIT_SPREAD' ? 'above' : 'below'} ${t.shortStrike}, max loss (${(t.creditReceived - t.spreadWidth * 100 * t.quantity).toFixed(2)}) if beyond ${t.longStrike}, linear between.
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: 11, color: '#555', marginBottom: 3 }}>CONTRACTS</div>
                              <div style={{ fontSize: 13, color: '#fff' }}>{t.quantity}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 11, color: '#555', marginBottom: 3 }}>SPREAD WIDTH</div>
                              <div style={{ fontSize: 13, color: '#fff' }}>${t.spreadWidth}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 11, color: '#555', marginBottom: 3 }}>BIAS CONFIDENCE</div>
                              <div style={{ fontSize: 13, color: '#fff' }}>{t.confidence}%</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 11, color: '#555', marginBottom: 3 }}>EXPIRES</div>
                              <div style={{ fontSize: 13, color: '#fff' }}>{formatDateTime(t.expirationDate)}</div>
                            </div>
                            {t.aiReason && (
                              <div style={{ gridColumn: '1 / -1' }}>
                                <div style={{ fontSize: 11, color: '#555', marginBottom: 3 }}>REASONING</div>
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

      <Section title="Spread History">
        {closed.length === 0 ? (
          <div style={{ color: '#555', fontSize: 14, textAlign: 'center', padding: '24px 0' }}>No closed spreads yet</div>
        ) : (
          <table>
            <thead>
              <tr><th>Symbol</th><th>Type</th><th>Short/Long</th><th>Credit</th><th>P/L</th><th>Closed</th><th>Reason</th></tr>
            </thead>
            <tbody>
              {closed.map(t => (
                <tr key={t._id}>
                  <td><strong>{t.symbol}</strong></td>
                  <td><span className={`badge ${t.type?.toLowerCase()}`}>{t.type === 'PUT_CREDIT_SPREAD' ? 'PUT' : 'CALL'}</span></td>
                  <td style={{ color: '#888' }}>${t.shortStrike} / ${t.longStrike}</td>
                  <td style={{ color: '#a855f7' }}>${t.creditReceived?.toFixed(2)}</td>
                  <td style={{ fontWeight: 700, color: (t.profitLoss || 0) >= 0 ? '#00c853' : '#ff3d3d' }}>
                    {(t.profitLoss || 0) >= 0 ? '+' : ''}${(t.profitLoss || 0).toFixed(2)}
                  </td>
                  <td style={{ color: '#888', fontSize: 12 }}>{formatDateTime(t.closedAt)}</td>
                  <td style={{ color: '#555', fontSize: 11 }}>{t.closeReason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Options Income Settings">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
          <EnableToggle
            enabled={settings.optionsIncomeEnabled}
            onToggle={() => update('optionsIncomeEnabled', !settings.optionsIncomeEnabled)}
            onLabel="Options Income Simulator ENABLED"
            offLabel="Options Income Simulator DISABLED"
            onSub="Bot scans once daily (10am ET) and sells paper credit spreads based on the latest bias signal"
            offSub="Permanently paper-only — never places a real order regardless of this setting"
          />
          <NumField label="Max Risk per Trade ($)" value={settings.optionsMaxRiskPerTrade} onChange={v => update('optionsMaxRiskPerTrade', v)} sub="Caps contracts so max loss never exceeds this" />
          <NumField label="Min Bias Confidence (%)" value={settings.optionsMinConfidence} onChange={v => update('optionsMinConfidence', v)} sub="From the bot's most recent signal for that symbol" />
          <NumField label="Short Strike OTM (%)" value={settings.optionsShortStrikeOtmPercent} onChange={v => update('optionsShortStrikeOtmPercent', v)} />
          <NumField label="Spread Width ($)" value={settings.optionsSpreadWidthDollars} onChange={v => update('optionsSpreadWidthDollars', v)} />
          <NumField label="Target DTE Min" value={settings.optionsTargetDTEMin} onChange={v => update('optionsTargetDTEMin', v)} />
          <NumField label="Target DTE Max" value={settings.optionsTargetDTEMax} onChange={v => update('optionsTargetDTEMax', v)} />
          <NumField label="Max Open Spreads" value={settings.optionsMaxPositions} onChange={v => update('optionsMaxPositions', v)} />
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#888' }}>Symbols (empty = use your stock watchlist)</span>
            <TagInput symbols={settings.optionsSymbols || []} onChange={v => update('optionsSymbols', v)} placeholder="e.g. AAPL" />
          </label>
        </div>
        <SaveButton onClick={saveSettings} saving={saving} />
      </Section>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────

function PassiveIncome() {
  const [tab, setTab] = useState('funding');

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Passive Income</h1>
        <span style={{ background: '#1a1d2e', border: '1px solid #2a2d3e', borderRadius: 20, padding: '3px 12px', fontSize: 12, color: '#888' }}>
          Market-neutral strategies — funding-rate arbitrage &amp; options credit spreads
        </span>
        <PaperBadge />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[
          { key: 'funding', label: 'Funding-Rate Arbitrage' },
          { key: 'options', label: 'Options Credit Spreads' }
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 18px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700,
              border: `1px solid ${tab === t.key ? '#5865f2' : '#2a2d3e'}`,
              background: tab === t.key ? '#1a1d2e' : 'transparent',
              color: tab === t.key ? '#5865f2' : '#888'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'funding' ? <FundingArbTab /> : <OptionsIncomeTab />}
    </div>
  );
}

export default PassiveIncome;
