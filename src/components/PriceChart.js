import React, { useEffect, useState, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL;

function PriceChart({ symbol, entryPrice, market, type = 'BUY' }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPrice, setCurrentPrice] = useState(null);

  const fetchChart = useCallback(async () => {
    try {
      const encoded = encodeURIComponent(symbol);
      const res = await axios.get(`${API}/dashboard/chart/${encoded}`);
      const points = res.data || [];
      setData(points);
      // Stocks: derive current price from last chart point — avoids direct Yahoo Finance call
      if (market !== 'crypto' && points.length > 0) {
        setCurrentPrice(points[points.length - 1].price);
      }
      setLoading(false);
    } catch (err) {
      console.error(`Failed to fetch chart for ${symbol}:`, err);
      setLoading(false);
    }
  }, [symbol, market]);

  const fetchLivePrice = useCallback(async () => {
    try {
      if (market === 'crypto') {
        const ticker = symbol.replace('/', '');
        const res = await axios.get(`${API}/market/crypto-prices?tickers=${encodeURIComponent(JSON.stringify([ticker]))}`);
        const entry = (res.data || []).find(d => d.symbol === ticker);
        if (entry) setCurrentPrice(parseFloat(entry.price));
      } else {
        const res = await axios.get(`${API}/market/stock-prices?tickers=${encodeURIComponent(JSON.stringify([symbol]))}`);
        const entry = (res.data || []).find(d => d.symbol === symbol);
        if (entry) setCurrentPrice(parseFloat(entry.price));
      }
    } catch (err) {
      console.error(`Failed to fetch live price for ${symbol}:`, err);
    }
  }, [symbol, market]);

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
  // SHORT profits when price falls — invert direction
  const pnl = rawPnlPct !== null ? (isShort ? -rawPnlPct : rawPnlPct).toFixed(2) : null;

  const isProfit = parseFloat(pnl) >= 0;
  const lineColor = isProfit ? '#00c853' : '#ff3d3d';

  const minPrice = data.length ? Math.min(...data.map(d => d.price)) * 0.999 : 0;
  const maxPrice = data.length ? Math.max(...data.map(d => d.price)) * 1.001 : 0;

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
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#fff' }}>
            ${currentPrice?.toLocaleString() || '—'}
          </div>
          {pnl !== null && (
            <div style={{ fontSize: 13, color: isProfit ? '#00c853' : '#ff3d3d', fontWeight: 600 }}>
              {isProfit ? '+' : ''}{pnl}% from entry
            </div>
          )}
        </div>
      </div>

      {/* Entry price line info */}
      {entryPrice && (
        <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
          Entry: ${entryPrice?.toLocaleString()} &nbsp;|&nbsp;
          Current: ${currentPrice?.toLocaleString()} &nbsp;|&nbsp;
          P/L: <span style={{ color: isProfit ? '#00c853' : '#ff3d3d' }}>
            {pnl !== null ? `${isProfit ? '+' : ''}${pnl}%` : '—'}
          </span>
        </div>
      )}

      {/* Chart */}
      {loading ? (
        <div style={{ color: '#666', textAlign: 'center', padding: 20 }}>Loading chart...</div>
      ) : data.length === 0 ? (
        <div style={{ color: '#666', textAlign: 'center', padding: 20 }}>No chart data available</div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data}>
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
