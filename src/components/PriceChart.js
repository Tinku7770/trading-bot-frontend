import React, { useEffect, useState, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'https://trading-bot-backend-production-9a53.up.railway.app/api';

// Custom label rendered on the right edge of the chart for a reference line
function RightLabel({ viewBox, value, color, bg }) {
  const { x, y, width } = viewBox;
  return (
    <g>
      <rect x={x + width - 1} y={y - 10} width={70} height={20} rx={4} fill={bg} />
      <text
        x={x + width + 34} y={y + 4}
        textAnchor="middle" fill={color}
        fontSize={10} fontWeight={700}
      >
        {value}
      </text>
    </g>
  );
}

function PriceChart({ symbol, entryPrice, hedgePrice, market, type = 'BUY', livePrice = null }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [polledPrice, setPolledPrice] = useState(null);

  // Prefer the live price streamed in from the parent (WebSocket / 5s poll)
  // Fall back to our own slower poll if parent hasn't provided one yet
  const currentPrice = livePrice || polledPrice;

  const fetchChart = useCallback(async () => {
    try {
      const encoded = encodeURIComponent(symbol);
      const res = await axios.get(`${API}/dashboard/chart/${encoded}`);
      const points = res.data || [];
      setData(points);
      if (market !== 'crypto' && points.length > 0 && !livePrice) {
        setPolledPrice(points[points.length - 1].price);
      }
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, [symbol, market, livePrice]);

  const fetchLivePrice = useCallback(async () => {
    if (livePrice) return; // parent is providing live price — no need to poll
    try {
      if (market === 'crypto') {
        const ticker = symbol.replace('/', '');
        const res = await axios.get(`${API}/market/crypto-prices?tickers=${encodeURIComponent(JSON.stringify([ticker]))}`);
        const entry = (res.data || []).find(d => d.symbol === ticker);
        if (entry) setPolledPrice(parseFloat(entry.price));
      } else {
        const res = await axios.get(`${API}/market/stock-prices?tickers=${encodeURIComponent(JSON.stringify([symbol]))}`);
        const entry = (res.data || []).find(d => d.symbol === symbol);
        if (entry) setPolledPrice(parseFloat(entry.price));
      }
    } catch { /* keep previous */ }
  }, [symbol, market, livePrice]);

  useEffect(() => {
    fetchChart();
    const interval = setInterval(fetchChart, 300000);
    return () => clearInterval(interval);
  }, [fetchChart]);

  useEffect(() => {
    fetchLivePrice();
    const interval = setInterval(fetchLivePrice, market === 'crypto' ? 10000 : 15000);
    return () => clearInterval(interval);
  }, [fetchLivePrice, market]);

  const isShort = type === 'SHORT';
  const rawPnlPct = currentPrice && entryPrice
    ? (currentPrice - entryPrice) / entryPrice * 100
    : null;
  const pnl = rawPnlPct !== null ? (isShort ? -rawPnlPct : rawPnlPct).toFixed(2) : null;
  const isProfit = parseFloat(pnl) >= 0;
  const lineColor = isProfit ? '#00c853' : '#ff3d3d';
  const liveColor = isProfit ? '#00c853' : '#ff3d3d';

  const allPrices = data.map(d => d.price);
  if (currentPrice) allPrices.push(currentPrice);
  if (entryPrice)   allPrices.push(entryPrice);
  if (hedgePrice)   allPrices.push(hedgePrice);
  const minPrice = allPrices.length ? Math.min(...allPrices) * 0.999 : 0;
  const maxPrice = allPrices.length ? Math.max(...allPrices) * 1.001 : 0;

  const decimals = market === 'crypto' && currentPrice && currentPrice < 1 ? 5
    : currentPrice && currentPrice < 100 ? 4 : 2;

  const fmtPrice = (p) => p != null ? `$${p.toFixed(decimals)}` : '—';

  return (
    <div style={{
      background: '#1a1d27',
      border: '1px solid #2a2d3e',
      borderRadius: 12,
      padding: 16,
      marginBottom: 16
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>{symbol}</span>
          <span style={{
            marginLeft: 8, fontSize: 12, padding: '2px 8px',
            borderRadius: 4, background: '#2a2d3e', color: '#888'
          }}>
            {market}
          </span>
          {isShort && (
            <span style={{
              marginLeft: 6, fontSize: 11, padding: '2px 8px',
              borderRadius: 4, background: '#3d1a00', color: '#ff6b35', fontWeight: 600
            }}>
              SHORT
            </span>
          )}
          {livePrice && (
            <span style={{
              marginLeft: 8, fontSize: 10, padding: '2px 7px',
              borderRadius: 10, background: '#0d2a0d', border: '1px solid #00c853',
              color: '#00c853', fontWeight: 700
            }}>
              ● LIVE
            </span>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700, fontSize: 20, color: liveColor, transition: 'color 0.3s' }}>
            {fmtPrice(currentPrice)}
          </div>
          {pnl !== null && (
            <div style={{ fontSize: 13, color: isProfit ? '#00c853' : '#ff3d3d', fontWeight: 600 }}>
              {isProfit ? '+' : ''}{pnl}% from entry
            </div>
          )}
        </div>
      </div>

      {/* Entry / Live price info row */}
      {(entryPrice || hedgePrice) && (
        <div style={{ fontSize: 12, color: '#666', marginBottom: 10, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {entryPrice && (
            <span>
              <span style={{ color: hedgePrice ? '#00c853' : '#5865f2', fontWeight: 600 }}>
                {hedgePrice ? '── LONG' : '── Entry'}
              </span>
              {' '}{fmtPrice(entryPrice)}
            </span>
          )}
          {hedgePrice && (
            <span>
              <span style={{ color: '#ff6b35', fontWeight: 600 }}>── SHORT</span>
              {' '}{fmtPrice(hedgePrice)}
            </span>
          )}
          {!hedgePrice && entryPrice && (
            <span>
              <span style={{ color: liveColor, fontWeight: 600 }}>── Live</span>
              {' '}{fmtPrice(currentPrice)}
            </span>
          )}
          {!hedgePrice && pnl !== null && (
            <span style={{ color: isProfit ? '#00c853' : '#ff3d3d', fontWeight: 600 }}>
              P/L: {isProfit ? '+' : ''}{pnl}%
            </span>
          )}
          {hedgePrice && currentPrice && (
            <span>
              <span style={{ color: liveColor, fontWeight: 600 }}>── Live</span>
              {' '}{fmtPrice(currentPrice)}
            </span>
          )}
        </div>
      )}

      {/* Chart */}
      {loading ? (
        <div style={{ color: '#666', textAlign: 'center', padding: 20 }}>Loading chart...</div>
      ) : data.length === 0 ? (
        <div style={{ color: '#666', textAlign: 'center', padding: 20 }}>No chart data available</div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data} margin={{ right: 72 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2130" />
            <XAxis
              dataKey="time"
              stroke="#444"
              tick={{ fontSize: 10, fill: '#666' }}
              interval="preserveStartEnd"
            />
            <YAxis
              stroke="#444"
              tick={{ fontSize: 10, fill: '#666' }}
              domain={[minPrice, maxPrice]}
              tickFormatter={v => '$' + v.toLocaleString()}
              width={70}
            />
            <Tooltip
              contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3e', borderRadius: 8 }}
              labelStyle={{ color: '#888', fontSize: 12 }}
              formatter={(value) => ['$' + value.toLocaleString(), 'Price']}
            />

            {/* Entry price line — green for LONG trigger, purple for open trade entry */}
            {entryPrice && (
              <ReferenceLine
                y={entryPrice}
                stroke={hedgePrice ? '#00c853' : '#5865f2'}
                strokeDasharray="5 4"
                strokeWidth={1.5}
                label={<RightLabel value={fmtPrice(entryPrice)} color={hedgePrice ? '#00c853' : '#5865f2'} bg="#0d0f1a" />}
              />
            )}

            {/* Hedge (SHORT) trigger line */}
            {hedgePrice && (
              <ReferenceLine
                y={hedgePrice}
                stroke="#ff6b35"
                strokeDasharray="5 4"
                strokeWidth={1.5}
                label={<RightLabel value={fmtPrice(hedgePrice)} color="#ff6b35" bg="#0d0f1a" />}
              />
            )}

            {/* Live price line */}
            {currentPrice && (
              <ReferenceLine
                y={currentPrice}
                stroke={liveColor}
                strokeDasharray="0"
                strokeWidth={2}
                label={<RightLabel value={fmtPrice(currentPrice)} color={liveColor} bg="#0d0f1a" />}
              />
            )}

            <Line
              type="monotone"
              dataKey="price"
              stroke={lineColor}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: lineColor }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default PriceChart;
