import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import axios from 'axios';

const API = 'https://trading-bot-backend-production-9a53.up.railway.app/api';

function PriceChart({ symbol, entryPrice, market }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPrice, setCurrentPrice] = useState(null);

  // Fetch 24h historical chart — every 5 minutes is enough
  useEffect(() => {
    fetchChart(); // eslint-disable-line react-hooks/exhaustive-deps
    const interval = setInterval(fetchChart, 300000);
    return () => clearInterval(interval);
  }, [symbol]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchLivePrice(); // eslint-disable-line react-hooks/exhaustive-deps
    const interval = setInterval(fetchLivePrice, 10000);
    return () => clearInterval(interval);
  }, [symbol]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchChart() {
    try {
      const encoded = encodeURIComponent(symbol);
      const res = await axios.get(`${API}/dashboard/chart/${encoded}`);
      setData(res.data);
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  }

  async function fetchLivePrice() {
    try {
      const isCrypto = symbol.includes('/');
      if (isCrypto) {
        const ticker = symbol.replace('/', '');
        const res = await axios.get(`https://api.binance.us/api/v3/ticker/price?symbol=${ticker}`);
        setCurrentPrice(parseFloat(res.data.price));
      } else {
        const res = await axios.get(
          `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`,
          { headers: { 'User-Agent': 'Mozilla/5.0' } }
        );
        const price = res.data.chart.result[0].meta.regularMarketPrice;
        setCurrentPrice(price);
      }
    } catch (err) {
      // silently fail — keep last known price
    }
  }

  const pnl = currentPrice && entryPrice
    ? ((currentPrice - entryPrice) / entryPrice * 100).toFixed(2)
    : null;

  const isProfit = pnl >= 0;
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
            {isProfit ? '+' : ''}{pnl}%
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
