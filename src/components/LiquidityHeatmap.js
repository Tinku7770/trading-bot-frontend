import React, { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL;

const SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT', 'BNB/USDT'];

// Heat gradient: black → navy → blue → cyan → yellow → white
// Maps a 0-1 intensity to an RGB color
function heatColor(intensity) {
  const stops = [
    [0.00, [10,  10,  20 ]],
    [0.20, [10,  20,  80 ]],
    [0.40, [20,  60,  200]],
    [0.60, [0,   200, 220]],
    [0.80, [240, 220, 0  ]],
    [1.00, [255, 255, 255]],
  ];
  for (let i = 1; i < stops.length; i++) {
    const [t0, c0] = stops[i - 1];
    const [t1, c1] = stops[i];
    if (intensity <= t1) {
      const frac = (intensity - t0) / (t1 - t0);
      const r = Math.round(c0[0] + frac * (c1[0] - c0[0]));
      const g = Math.round(c0[1] + frac * (c1[1] - c0[1]));
      const b = Math.round(c0[2] + frac * (c1[2] - c0[2]));
      return `rgb(${r},${g},${b})`;
    }
  }
  return 'rgb(255,255,255)';
}

function formatPrice(p) {
  if (p >= 1000) return p.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (p >= 1)    return p.toFixed(2);
  return p.toFixed(4);
}

function formatUSD(v) {
  if (v >= 1e6)  return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3)  return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export default function LiquidityHeatmap() {
  const [symbol, setSymbol]     = useState('BTC/USDT');
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);
  const [countdown, setCountdown] = useState(120);
  const timerRef = useRef(null);

  const fetchData = useCallback(async (sym) => {
    setLoading(true);
    setError(false);
    try {
      const encoded = encodeURIComponent(sym);
      const res = await axios.get(`${API}/market/liquidity/${encoded}`, { timeout: 15000 });
      setData(res.data);
      setCountdown(120);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(symbol);
  }, [symbol, fetchData]);

  // 2-minute auto-refresh with countdown
  useEffect(() => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { fetchData(symbol); return 120; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [symbol, fetchData]);

  if (loading) return (
    <div style={styles.card}>
      <div style={styles.header}>
        <span style={styles.title}>Liquidity Heatmap</span>
      </div>
      <div style={styles.loading}>Loading order book depth...</div>
    </div>
  );

  if (error || !data) return (
    <div style={styles.card}>
      <div style={styles.header}>
        <span style={styles.title}>Liquidity Heatmap</span>
      </div>
      <div style={styles.errorMsg}>Order book unavailable</div>
    </div>
  );

  const { currentPrice, levels = [], support = [], resistance = [], longLiquidations = [], shortLiquidations = [], hasCoinglass } = data;

  // Build a map of liquidation clusters keyed by price (approximate)
  const liqMap = {};
  longLiquidations.forEach(l => { liqMap[l.price] = { ...liqMap[l.price], long: l.volume }; });
  shortLiquidations.forEach(l => { liqMap[l.price] = { ...liqMap[l.price], short: l.volume }; });

  // Normalize bar widths: max value = 100%
  const maxValue = Math.max(...levels.map(l => l.volume), 1);

  // Split levels into above/below price, sorted for display
  const aboveLevels = levels.filter(l => l.price > currentPrice).sort((a, b) => a.price - b.price);
  const belowLevels = levels.filter(l => l.price <= currentPrice).sort((a, b) => b.price - a.price);

  // Support/resistance info
  const topSupport    = support[0];
  const topResistance = resistance[0];

  return (
    <div style={styles.card}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.title}>Liquidity Heatmap</span>
        <div style={styles.headerRight}>
          <select
            value={symbol}
            onChange={e => setSymbol(e.target.value)}
            style={styles.select}
          >
            {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <span style={styles.countdown}>↺ {countdown}s</span>
        </div>
      </div>

      {/* Key levels summary */}
      <div style={styles.summary}>
        <div style={styles.summaryItem}>
          <span style={styles.summaryLabel}>Price</span>
          <span style={styles.summaryValue}>${formatPrice(currentPrice)}</span>
        </div>
        {topSupport && (
          <div style={styles.summaryItem}>
            <span style={{ ...styles.summaryLabel, color: '#4ade80' }}>Top Support</span>
            <span style={styles.summaryValue}>
              ${formatPrice(topSupport.price)} ({formatUSD(topSupport.volume)})
            </span>
          </div>
        )}
        {topResistance && (
          <div style={styles.summaryItem}>
            <span style={{ ...styles.summaryLabel, color: '#f87171' }}>Top Resistance</span>
            <span style={styles.summaryValue}>
              ${formatPrice(topResistance.price)} ({formatUSD(topResistance.volume)})
            </span>
          </div>
        )}
        {hasCoinglass && (
          <div style={styles.summaryItem}>
            <span style={{ ...styles.summaryLabel, color: '#facc15' }}>Liq Clusters</span>
            <span style={styles.summaryValue}>{longLiquidations.length + shortLiquidations.length} zones</span>
          </div>
        )}
      </div>

      {/* Heatmap price ladder */}
      <div style={styles.ladder}>
        {/* Resistance levels (above price) — top to bottom = high to low */}
        {aboveLevels.map((lvl, i) => {
          const intensity = lvl.volume / maxValue;
          const isTopResist = topResistance && Math.abs(lvl.price - topResistance.price) < 0.0001;
          const nearPrice   = Math.abs(lvl.price - currentPrice) / currentPrice < 0.005;
          const liqAtLevel  = longLiquidations.find(l => Math.abs(l.price - lvl.price) / currentPrice < 0.002);
          return (
            <LevelRow
              key={`r-${i}`}
              lvl={lvl}
              intensity={intensity}
              maxValue={maxValue}
              side="resistance"
              isKeyLevel={isTopResist}
              nearPrice={nearPrice}
              liquidation={liqAtLevel}
            />
          );
        })}

        {/* Current price separator */}
        <div style={styles.priceSeparator}>
          <div style={styles.priceLineLeft} />
          <span style={styles.priceLabel}>${formatPrice(currentPrice)}</span>
          <div style={styles.priceLineRight} />
        </div>

        {/* Support levels (below price) — top to bottom = high to low */}
        {belowLevels.map((lvl, i) => {
          const intensity = lvl.volume / maxValue;
          const isTopSupport = topSupport && Math.abs(lvl.price - topSupport.price) < 0.0001;
          const nearPrice    = Math.abs(lvl.price - currentPrice) / currentPrice < 0.005;
          const liqAtLevel   = shortLiquidations.find(l => Math.abs(l.price - lvl.price) / currentPrice < 0.002);
          return (
            <LevelRow
              key={`s-${i}`}
              lvl={lvl}
              intensity={intensity}
              maxValue={maxValue}
              side="support"
              isKeyLevel={isTopSupport}
              nearPrice={nearPrice}
              liquidation={liqAtLevel}
            />
          );
        })}
      </div>

      {/* Coinglass liquidation legend */}
      {hasCoinglass && (
        <div style={styles.legend}>
          <span style={{ color: '#facc15', fontSize: 11 }}>■</span>
          <span style={styles.legendText}>Long liquidation cluster</span>
          <span style={{ color: '#a78bfa', fontSize: 11, marginLeft: 10 }}>■</span>
          <span style={styles.legendText}>Short liquidation cluster</span>
        </div>
      )}

      <div style={styles.updatedAt}>
        Updated {new Date(data.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        {!hasCoinglass && <span style={{ color: '#6b7280', marginLeft: 8 }}>(No Coinglass key)</span>}
      </div>
    </div>
  );
}

function LevelRow({ lvl, intensity, maxValue, side, isKeyLevel, nearPrice, liquidation }) {
  const barWidth = `${Math.max(2, (lvl.volume / maxValue) * 100)}%`;
  const color    = heatColor(intensity);
  const isAsk    = side === 'resistance';

  return (
    <div style={{ ...styles.row, borderLeft: isKeyLevel ? `2px solid ${isAsk ? '#f87171' : '#4ade80'}` : '2px solid transparent' }}>
      {/* Price label */}
      <span style={{ ...styles.priceCell, color: isKeyLevel ? (isAsk ? '#f87171' : '#4ade80') : '#9ca3af' }}>
        ${formatPrice(lvl.price)}
        {nearPrice && <span style={styles.nearTag}> ⚠</span>}
      </span>

      {/* Bar */}
      <div style={styles.barContainer}>
        <div style={{ ...styles.bar, width: barWidth, background: color, opacity: isAsk ? 0.7 : 0.85 }} />
        {liquidation && (
          <div style={{ ...styles.liqMarker, background: isAsk ? '#facc15' : '#a78bfa' }} title={`${isAsk ? 'Long' : 'Short'} liquidations: ${formatUSD(liquidation.volume)}`} />
        )}
      </div>

      {/* Value label */}
      <span style={styles.valueCell}>{formatUSD(lvl.volume)}</span>
    </div>
  );
}

const styles = {
  card: {
    background: '#111827',
    borderRadius: 12,
    border: '1px solid #1f2937',
    padding: '16px',
    fontFamily: 'monospace',
    color: '#e5e7eb',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: 700,
    color: '#f3f4f6',
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
    padding: '4px 8px',
    fontSize: 12,
    cursor: 'pointer',
    outline: 'none',
  },
  countdown: {
    fontSize: 11,
    color: '#6b7280',
  },
  summary: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px 20px',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottom: '1px solid #1f2937',
  },
  summaryItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  summaryLabel: {
    fontSize: 10,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  summaryValue: {
    fontSize: 12,
    color: '#e5e7eb',
    fontWeight: 600,
  },
  ladder: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    maxHeight: 480,
    overflowY: 'auto',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '2px 4px',
    borderRadius: 3,
  },
  priceCell: {
    width: 90,
    fontSize: 11,
    textAlign: 'right',
    flexShrink: 0,
  },
  nearTag: {
    color: '#f59e0b',
    fontWeight: 700,
  },
  barContainer: {
    flex: 1,
    height: 14,
    background: '#0d0f1a',
    borderRadius: 2,
    position: 'relative',
    overflow: 'visible',
  },
  bar: {
    height: '100%',
    borderRadius: 2,
    transition: 'width 0.3s ease',
  },
  liqMarker: {
    position: 'absolute',
    right: -3,
    top: 1,
    width: 6,
    height: 12,
    borderRadius: 2,
  },
  valueCell: {
    width: 52,
    fontSize: 10,
    color: '#9ca3af',
    textAlign: 'right',
    flexShrink: 0,
  },
  priceSeparator: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    margin: '6px 0',
  },
  priceLineLeft: {
    flex: 1,
    height: 1,
    background: 'rgba(255,255,255,0.35)',
  },
  priceLineRight: {
    flex: 1,
    height: 1,
    background: 'rgba(255,255,255,0.35)',
  },
  priceLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: '#ffffff',
    padding: '2px 8px',
    background: '#1f2937',
    borderRadius: 4,
    border: '1px solid rgba(255,255,255,0.2)',
    whiteSpace: 'nowrap',
  },
  legend: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    paddingTop: 8,
    borderTop: '1px solid #1f2937',
  },
  legendText: {
    fontSize: 10,
    color: '#6b7280',
  },
  updatedAt: {
    fontSize: 10,
    color: '#4b5563',
    marginTop: 6,
    textAlign: 'right',
  },
  loading: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 13,
    padding: '40px 0',
  },
  errorMsg: {
    textAlign: 'center',
    color: '#ef4444',
    fontSize: 13,
    padding: '40px 0',
  },
};
