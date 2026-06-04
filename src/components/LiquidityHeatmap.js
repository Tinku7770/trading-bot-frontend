import React, { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';

const API     = process.env.REACT_APP_API_URL;
const SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT', 'BNB/USDT'];

const CELL_W  = 20;   // px per time column
const CELL_H  = 13;   // px per price row
const LABEL_W = 68;   // left price label area
const LABEL_H = 20;   // bottom time label area

// Heat gradient: near-black → deep navy → blue → cyan → yellow → white
function heatRGB(t) {
  const stops = [
    [0.00, [8,   10,  22 ]],
    [0.15, [10,  20,  80 ]],
    [0.35, [18,  55,  190]],
    [0.55, [0,   185, 225]],
    [0.75, [235, 205, 0  ]],
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

function volAtBin(levels, binCenter, binSize) {
  let total = 0;
  for (const l of levels) {
    if (Math.abs(l.price - binCenter) < binSize * 0.6) total += l.volume || 0;
  }
  return total;
}

function fmtPrice(p) {
  if (p >= 10000) return '$' + (p / 1000).toFixed(1) + 'K';
  if (p >= 100)   return '$' + p.toFixed(1);
  if (p >= 1)     return '$' + p.toFixed(2);
  return '$' + p.toFixed(4);
}

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function LiquidityHeatmap() {
  const [symbol,    setSymbol]    = useState('BTC/USDT');
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [countdown, setCountdown] = useState(120);
  const canvasRef = useRef(null);
  const timerRef  = useRef(null);

  const load = useCallback(async (sym) => {
    try {
      const res = await axios.get(
        `${API}/market/liquidity-matrix/${encodeURIComponent(sym)}`,
        { timeout: 10000 }
      );
      setData(res.data);
      setCountdown(120);
    } catch { /* keep previous */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    setLoading(true);
    setData(null);
    load(symbol);
  }, [symbol, load]);

  useEffect(() => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown(c => { if (c <= 1) { load(symbol); return 120; } return c - 1; });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [symbol, load]);

  // Redraw canvas whenever data changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;
    const { snapshots = [], bins = [], binSize = 0, currentPrice } = data;
    if (!snapshots.length || !bins.length) return;

    const N_COLS = snapshots.length;
    const N_ROWS = bins.length;
    const W = LABEL_W + N_COLS * CELL_W;
    const H = N_ROWS  * CELL_H + LABEL_H;

    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#080a14';
    ctx.fillRect(0, 0, W, H);

    // Precompute max vol for normalization
    let maxVol = 1;
    for (const snap of snapshots) {
      for (const bin of bins) {
        const v = volAtBin(snap.levels, bin, binSize);
        if (v > maxVol) maxVol = v;
      }
    }

    // Draw heat cells
    for (let col = 0; col < N_COLS; col++) {
      const snap = snapshots[col];
      for (let row = 0; row < N_ROWS; row++) {
        const bin = bins[row];
        const v   = volAtBin(snap.levels, bin, binSize);
        const t   = Math.sqrt(v / maxVol);
        const [r, g, b] = heatRGB(t);
        const alpha = bin < snap.price ? 0.9 : 0.72; // bids brighter than asks
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.fillRect(LABEL_W + col * CELL_W, row * CELL_H, CELL_W - 1, CELL_H - 1);
      }
    }

    // Current price dashed line
    const priceRowIdx = bins.findIndex(b => b <= currentPrice);
    if (priceRowIdx >= 0) {
      const y = priceRowIdx * CELL_H;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth   = 1.5;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(LABEL_W, y);
      ctx.lineTo(W, y);
      ctx.stroke();
      ctx.restore();

      // Price badge on the line
      const label = fmtPrice(currentPrice);
      const bw = label.length * 5.5 + 8;
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(2, y - 7, bw, 13);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(label, 4, y + 3);
    }

    // Price labels on the left every 4 rows
    ctx.font      = '9px monospace';
    ctx.textAlign = 'right';
    for (let row = 2; row < N_ROWS; row += 4) {
      const bin      = bins[row];
      const y        = row * CELL_H + CELL_H - 3;
      const isNear   = Math.abs(bin - currentPrice) / currentPrice < 0.006;
      ctx.fillStyle  = isNear ? 'rgba(255,255,255,0.85)' : 'rgba(107,114,128,0.8)';
      ctx.fillText(fmtPrice(bin), LABEL_W - 3, y);
    }

    // Time labels at bottom every ~5 columns
    ctx.font      = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(75,85,99,0.9)';
    const step = Math.max(1, Math.floor(N_COLS / 6));
    for (let col = 0; col < N_COLS; col += step) {
      const x = LABEL_W + col * CELL_W + CELL_W / 2;
      ctx.fillText(fmtTime(snapshots[col].ts), x, N_ROWS * CELL_H + 14);
    }
    // "now" label at last column
    ctx.fillStyle = 'rgba(156,163,175,0.9)';
    ctx.fillText('now', LABEL_W + (N_COLS - 1) * CELL_W + CELL_W / 2, N_ROWS * CELL_H + 14);

    // Column separator for "now"
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth   = 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(LABEL_W + (N_COLS - 1) * CELL_W, 0);
    ctx.lineTo(LABEL_W + (N_COLS - 1) * CELL_W, N_ROWS * CELL_H);
    ctx.stroke();

  }, [data]);

  const snapCount = data?.snapshots?.length || 0;
  const isBuilding = !data || data.building || snapCount < 3;

  return (
    <div style={s.card}>

      {/* Header */}
      <div style={s.header}>
        <div>
          <span style={s.title}>Liquidity Heatmap</span>
          <span style={s.subtitle}> · Order Book Depth</span>
        </div>
        <div style={s.headerRight}>
          <select value={symbol} onChange={e => setSymbol(e.target.value)} style={s.select}>
            {SYMBOLS.map(sym => <option key={sym} value={sym}>{sym}</option>)}
          </select>
          <span style={s.cdown}>↺ {countdown}s</span>
        </div>
      </div>

      {/* Loading */}
      {loading && <div style={s.center}>Loading order book…</div>}

      {/* Building history */}
      {!loading && isBuilding && (
        <div style={s.building}>
          <div style={s.buildIcon}>📊</div>
          Building history — {snapCount} / 30 snapshots collected
          <div style={s.buildSub}>
            Full 60-min view ready in ~{Math.max(0, (3 - snapCount) * 2)} min
          </div>
        </div>
      )}

      {/* Canvas heatmap */}
      {!loading && !isBuilding && (
        <>
          <div style={s.axisLabel}>Price ↑</div>
          <div style={s.canvasWrap}>
            <canvas ref={canvasRef} style={s.canvas} />
          </div>
          <div style={s.axisRight}>Time →</div>

          {/* Color scale */}
          <div style={s.scaleRow}>
            <span style={s.scaleLabel}>Low</span>
            <div style={s.scaleBar} />
            <span style={s.scaleLabel}>High liquidity</span>
          </div>

          <div style={s.footer}>
            {snapCount} snapshots · {Math.round((snapCount - 1) * 2)} min history
            · {data?.updatedAt ? new Date(data.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
          </div>
        </>
      )}
    </div>
  );
}

// Pre-build gradient CSS string for scale bar
const scaleCSS = (() => {
  const pts = [0, 0.15, 0.35, 0.55, 0.75, 1].map(t => {
    const [r, g, b] = heatRGB(t);
    return `rgb(${r},${g},${b}) ${(t * 100).toFixed(0)}%`;
  });
  return `linear-gradient(to right, ${pts.join(', ')})`;
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
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  title: {
    fontSize: 14, fontWeight: 700, color: '#f9fafb',
  },
  subtitle: {
    fontSize: 11, color: '#6b7280',
  },
  headerRight: {
    display: 'flex', alignItems: 'center', gap: 10,
  },
  select: {
    background: '#1f2937', border: '1px solid #374151', borderRadius: 6,
    color: '#e5e7eb', padding: '3px 8px', fontSize: 12, cursor: 'pointer', outline: 'none',
  },
  cdown: {
    fontSize: 11, color: '#4b5563',
  },
  axisLabel: {
    fontSize: 9, color: '#4b5563', marginBottom: 2, paddingLeft: 2,
  },
  axisRight: {
    fontSize: 9, color: '#4b5563', textAlign: 'right', marginTop: 2,
  },
  canvasWrap: {
    overflowX: 'auto',
    background: '#080a14',
    borderRadius: 6,
    border: '1px solid #1a1d2e',
  },
  canvas: {
    display: 'block',
    imageRendering: 'pixelated',
  },
  scaleRow: {
    display: 'flex', alignItems: 'center', gap: 8,
    marginTop: 10, paddingTop: 8, borderTop: '1px solid #1f2937',
  },
  scaleBar: {
    flex: 1, height: 8, borderRadius: 4, background: scaleCSS,
  },
  scaleLabel: {
    fontSize: 9, color: '#6b7280', whiteSpace: 'nowrap',
  },
  footer: {
    fontSize: 10, color: '#4b5563', marginTop: 6, textAlign: 'right',
  },
  center: {
    textAlign: 'center', color: '#6b7280', fontSize: 13, padding: '40px 0',
  },
  building: {
    textAlign: 'center', color: '#9ca3af', fontSize: 13, padding: '32px 0', lineHeight: 1.8,
  },
  buildIcon: {
    fontSize: 28, marginBottom: 8,
  },
  buildSub: {
    fontSize: 11, color: '#4b5563', marginTop: 4,
  },
};
