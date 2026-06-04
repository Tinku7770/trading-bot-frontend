import React, { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL;
const SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT', 'BNB/USDT'];

// Heat gradient: near-black → deep navy → blue → cyan → yellow → white
function heatColor(t) {
  const stops = [
    [0.00, [8,   10,  20 ]],
    [0.15, [10,  18,  70 ]],
    [0.35, [15,  50,  180]],
    [0.55, [0,   180, 220]],
    [0.75, [230, 200, 0  ]],
    [1.00, [255, 255, 255]],
  ];
  for (let i = 1; i < stops.length; i++) {
    const [t0, c0] = stops[i - 1];
    const [t1, c1] = stops[i];
    if (t <= t1) {
      const f = (t - t0) / (t1 - t0);
      return [
        Math.round(c0[0] + f * (c1[0] - c0[0])),
        Math.round(c0[1] + f * (c1[1] - c0[1])),
        Math.round(c0[2] + f * (c1[2] - c0[2])),
      ];
    }
  }
  return [255, 255, 255];
}

function fmtPrice(p) {
  if (p >= 10000) return p.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (p >= 100)   return p.toLocaleString(undefined, { maximumFractionDigits: 1 });
  if (p >= 1)     return p.toFixed(2);
  return p.toFixed(4);
}

function fmtVol(v) {
  if (!v && v !== 0) return '—';
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export default function LiquidityHeatmap() {
  const [symbol, setSymbol]   = useState('BTC/USDT');
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const [countdown, setCountdown] = useState(120);
  const timerRef = useRef(null);

  const load = useCallback(async (sym) => {
    setLoading(true);
    setError(false);
    try {
      const res = await axios.get(`${API}/market/liquidity/${encodeURIComponent(sym)}`, { timeout: 15000 });
      setData(res.data);
      setCountdown(120);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(symbol); }, [symbol, load]);

  useEffect(() => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { load(symbol); return 120; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [symbol, load]);

  const renderInner = () => {
    if (loading) return <div style={s.center}>Loading order book…</div>;
    if (error || !data) return <div style={{ ...s.center, color: '#ef4444' }}>Order book unavailable</div>;

    const { currentPrice, levels = [], support = [], resistance = [], longLiquidations = [], shortLiquidations = [], hasCoinglass } = data;

    // Build lookup for liquidation clusters by price proximity (within 0.3%)
    const liqLookup = (price) => {
      const long  = longLiquidations.find(l  => Math.abs(l.price  - price) / currentPrice < 0.003);
      const short = shortLiquidations.find(s => Math.abs(s.price  - price) / currentPrice < 0.003);
      return { long, short };
    };

    // Key wall prices for highlighting
    const topSupportPrice    = support[0]?.price;
    const topResistPrice     = resistance[0]?.price;

    // Normalize: map volume to 0-1 intensity using sqrt scale (makes mid-range walls visible)
    const maxVol = Math.max(...levels.map(l => l.volume || 0), 1);
    const intensity = (vol) => Math.sqrt((vol || 0) / maxVol);

    // Sort all levels high → low for display
    const sorted = [...levels].sort((a, b) => b.price - a.price);

    // Split into above/below price
    const above = sorted.filter(l => l.price > currentPrice);
    const below = sorted.filter(l => l.price <= currentPrice);

    const topSupp = support[0];
    const topRes  = resistance[0];

    return (
      <>
        {/* Summary pills */}
        <div style={s.pills}>
          <div style={s.pill}>
            <span style={s.pillLabel}>Price</span>
            <span style={s.pillVal}>${fmtPrice(currentPrice)}</span>
          </div>
          {topRes && (
            <div style={{ ...s.pill, borderColor: '#ef444440' }}>
              <span style={{ ...s.pillLabel, color: '#f87171' }}>Resistance</span>
              <span style={s.pillVal}>${fmtPrice(topRes.price)} <span style={{ color: '#6b7280', fontSize: 10 }}>{fmtVol(topRes.volume)}</span></span>
            </div>
          )}
          {topSupp && (
            <div style={{ ...s.pill, borderColor: '#22c55e40' }}>
              <span style={{ ...s.pillLabel, color: '#4ade80' }}>Support</span>
              <span style={s.pillVal}>${fmtPrice(topSupp.price)} <span style={{ color: '#6b7280', fontSize: 10 }}>{fmtVol(topSupp.volume)}</span></span>
            </div>
          )}
        </div>

        {/* Grid */}
        <div style={s.grid}>
          {/* ASK rows — resistance (above price), high → low */}
          {above.map((lvl, i) => {
            const t     = intensity(lvl.volume);
            const [r, g, b] = heatColor(t);
            const isKey = topResistPrice && Math.abs(lvl.price - topResistPrice) / currentPrice < 0.001;
            const near  = (lvl.price - currentPrice) / currentPrice < 0.005;
            const { long: liq } = liqLookup(lvl.price);
            return (
              <GridRow
                key={`a${i}`} lvl={lvl} r={r} g={g} b={b} t={t}
                side="ask" isKey={isKey} near={near} liq={liq} liqColor="#facc15"
              />
            );
          })}

          {/* Current price divider */}
          <div style={s.divider}>
            <div style={s.divLine} />
            <span style={s.divPrice}>${fmtPrice(currentPrice)}</span>
            <div style={s.divLine} />
          </div>

          {/* BID rows — support (below price), high → low */}
          {below.map((lvl, i) => {
            const t     = intensity(lvl.volume);
            const [r, g, b] = heatColor(t);
            const isKey = topSupportPrice && Math.abs(lvl.price - topSupportPrice) / currentPrice < 0.001;
            const near  = (currentPrice - lvl.price) / currentPrice < 0.005;
            const { short: liq } = liqLookup(lvl.price);
            return (
              <GridRow
                key={`b${i}`} lvl={lvl} r={r} g={g} b={b} t={t}
                side="bid" isKey={isKey} near={near} liq={liq} liqColor="#a78bfa"
              />
            );
          })}
        </div>

        {/* Color scale legend */}
        <div style={s.legendRow}>
          <div style={s.scaleBar} />
          <div style={s.scaleLabels}>
            <span>Low liquidity</span>
            <span>High liquidity</span>
          </div>
        </div>

        {hasCoinglass && (
          <div style={s.liqLegend}>
            <span style={{ color: '#facc15' }}>▐</span> Long liq cluster &nbsp;
            <span style={{ color: '#a78bfa' }}>▐</span> Short liq cluster
          </div>
        )}
      </>
    );
  };

  return (
    <div style={s.card}>
      <div style={s.header}>
        <span style={s.title}>Liquidity Heatmap</span>
        <div style={s.headerRight}>
          <select value={symbol} onChange={e => setSymbol(e.target.value)} style={s.select}>
            {SYMBOLS.map(sym => <option key={sym} value={sym}>{sym}</option>)}
          </select>
          <span style={s.cdown}>↺ {countdown}s</span>
        </div>
      </div>
      {renderInner()}
    </div>
  );
}

function GridRow({ lvl, r, g, b, t, side, isKey, near, liq, liqColor }) {
  const isAsk = side === 'ask';
  const alpha = isAsk ? 0.75 : 0.88;
  const bgColor = `rgba(${r},${g},${b},${alpha})`;

  // Text color: white on dark cells, dark on very bright cells
  const bright = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
  const textCol = bright > 0.65 ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.9)';

  // Box shadow glow on key/bright levels
  const glow = t > 0.7 ? `0 0 8px rgba(${r},${g},${b},0.6)` : 'none';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      height: 22,
      marginBottom: 1,
      borderLeft: isKey ? `3px solid ${isAsk ? '#f87171' : '#4ade80'}` : '3px solid transparent',
      position: 'relative',
    }}>
      {/* Price label */}
      <span style={{
        width: 82,
        fontSize: 10.5,
        textAlign: 'right',
        paddingRight: 6,
        color: isKey ? (isAsk ? '#f87171' : '#4ade80') : '#9ca3af',
        flexShrink: 0,
        fontFamily: 'monospace',
      }}>
        ${fmtPrice(lvl.price)}
        {near && <span style={{ color: '#f59e0b', marginLeft: 2 }}>!</span>}
      </span>

      {/* Heat cell — full width */}
      <div style={{
        flex: 1,
        height: '100%',
        background: bgColor,
        boxShadow: glow,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingRight: 6,
        borderRadius: 2,
        transition: 'background 0.4s',
      }}>
        <span style={{ fontSize: 10, color: textCol, fontFamily: 'monospace', fontWeight: t > 0.5 ? 700 : 400 }}>
          {fmtVol(lvl.volume)}
        </span>
      </div>

      {/* Liquidation cluster dot */}
      {liq && (
        <div style={{
          position: 'absolute',
          right: -8,
          width: 5,
          height: 16,
          background: liqColor,
          borderRadius: 2,
          boxShadow: `0 0 4px ${liqColor}`,
        }} title={`Liquidation cluster: ${fmtVol(liq.volume)}`} />
      )}
    </div>
  );
}

// Color scale bar using inline gradient
const scaleGradient = (() => {
  const stops = [0, 0.15, 0.35, 0.55, 0.75, 1].map(t => {
    const [r, g, b] = heatColor(t);
    return `rgb(${r},${g},${b}) ${(t * 100).toFixed(0)}%`;
  });
  return `linear-gradient(to right, ${stops.join(', ')})`;
})();

const s = {
  card: {
    background: '#0d0f1a',
    borderRadius: 12,
    border: '1px solid #1f2937',
    padding: '14px 16px',
    fontFamily: '"Segoe UI", system-ui, sans-serif',
    color: '#e5e7eb',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: 700,
    color: '#f9fafb',
    letterSpacing: '0.02em',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  select: {
    background: '#1f2937',
    border: '1px solid #374151',
    borderRadius: 6,
    color: '#e5e7eb',
    padding: '3px 8px',
    fontSize: 12,
    cursor: 'pointer',
    outline: 'none',
  },
  cdown: {
    fontSize: 11,
    color: '#4b5563',
  },
  pills: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  pill: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    background: '#111827',
    border: '1px solid #1f2937',
    borderRadius: 8,
    padding: '5px 10px',
  },
  pillLabel: {
    fontSize: 9,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  pillVal: {
    fontSize: 12,
    fontWeight: 700,
    color: '#f3f4f6',
  },
  grid: {
    maxHeight: 520,
    overflowY: 'auto',
    paddingRight: 10,
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    margin: '5px 0 5px 85px',
  },
  divLine: {
    flex: 1,
    height: 1,
    background: 'rgba(255,255,255,0.3)',
  },
  divPrice: {
    fontSize: 11,
    fontWeight: 700,
    color: '#fff',
    background: '#1f2937',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 4,
    padding: '2px 8px',
    whiteSpace: 'nowrap',
    fontFamily: 'monospace',
  },
  legendRow: {
    marginTop: 12,
    paddingTop: 10,
    borderTop: '1px solid #1f2937',
    paddingLeft: 85,
  },
  scaleBar: {
    height: 8,
    borderRadius: 4,
    background: scaleGradient,
    marginBottom: 3,
  },
  scaleLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 9,
    color: '#6b7280',
  },
  liqLegend: {
    marginTop: 6,
    fontSize: 10,
    color: '#6b7280',
    paddingLeft: 85,
  },
  center: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 13,
    padding: '36px 0',
  },
};
