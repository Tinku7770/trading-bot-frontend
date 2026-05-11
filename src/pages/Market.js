import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const API = process.env.REACT_APP_API_URL;

const CRYPTO_SYMBOLS = [
  { symbol: 'BTC/USDT', name: 'Bitcoin',  ticker: 'BTCUSDT' },
  { symbol: 'ETH/USDT', name: 'Ethereum', ticker: 'ETHUSDT' },
  { symbol: 'SOL/USDT', name: 'Solana',   ticker: 'SOLUSDT' },
  { symbol: 'BNB/USDT', name: 'BNB',      ticker: 'BNBUSDT' },
  { symbol: 'XRP/USDT', name: 'Ripple',   ticker: 'XRPUSDT' },
];

const STOCK_SYMBOLS = [
  { symbol: 'AAPL', name: 'Apple' },
  { symbol: 'TSLA', name: 'Tesla' },
  { symbol: 'NVDA', name: 'NVIDIA' },
  { symbol: 'MSFT', name: 'Microsoft' },
  { symbol: 'GOOGL', name: 'Google' },
];

function SymbolCard({ symbol, name, isCrypto, ticker, selected, onClick }) {
  const [chartData, setChartData] = useState([]);
  const [price, setPrice]         = useState(null);
  const [change, setChange]       = useState(null);
  const [loadingChart, setLoadingChart] = useState(true);

  const fetchChart = useCallback(async () => {
    try {
      const encoded = encodeURIComponent(symbol);
      const res = await axios.get(`${API}/dashboard/chart/${encoded}`);
      setChartData(res.data || []);
      setLoadingChart(false);
    } catch {
      setLoadingChart(false);
    }
  }, [symbol]);

  const fetchPrice = useCallback(async () => {
    try {
      if (isCrypto) {
        const [priceRes, statsRes] = await Promise.all([
          axios.get(`https://api.binance.us/api/v3/ticker/price?symbol=${ticker}`),
          axios.get(`https://api.binance.us/api/v3/ticker/24hr?symbol=${ticker}`)
        ]);
        setPrice(parseFloat(priceRes.data.price));
        setChange(parseFloat(statsRes.data.priceChangePercent).toFixed(2));
      } else {
        const res = await axios.get(
          `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`,
          { headers: { 'User-Agent': 'Mozilla/5.0' } }
        );
        const meta = res.data.chart.result[0].meta;
        setPrice(meta.regularMarketPrice);
        const chg = (((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100).toFixed(2);
        setChange(chg);
      }
    } catch {
      // keep last known price
    }
  }, [symbol, isCrypto, ticker]);

  useEffect(() => {
    fetchChart();
    fetchPrice();
    const chartInterval = setInterval(fetchChart, 5 * 60 * 1000);  // every 5 min
    const priceInterval = setInterval(fetchPrice, 30 * 1000);       // every 30 sec
    return () => { clearInterval(chartInterval); clearInterval(priceInterval); };
  }, [fetchChart, fetchPrice]);

  const isUp      = parseFloat(change) >= 0;
  const lineColor = isUp ? '#00c853' : '#ff3d3d';
  const chartH    = selected ? 220 : 90;

  const minP = chartData.length ? Math.min(...chartData.map(d => d.price)) * 0.999 : 0;
  const maxP = chartData.length ? Math.max(...chartData.map(d => d.price)) * 1.001 : 0;

  return (
    <div
      onClick={onClick}
      style={{
        background: selected ? '#1e2235' : '#1a1d27',
        border: `1px solid ${selected ? '#5865f2' : '#2a2d3e'}`,
        borderRadius: 12,
        padding: 16,
        cursor: 'pointer',
        transition: 'all 0.2s',
        boxShadow: selected ? '0 0 0 2px #5865f230' : 'none'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>{symbol}</div>
          <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{name}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>
            {price ? `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: price > 100 ? 2 : 4 })}` : '—'}
          </div>
          {change !== null && (
            <div style={{ fontSize: 13, color: lineColor, fontWeight: 600 }}>
              {isUp ? '+' : ''}{change}%
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      {loadingChart ? (
        <div style={{ height: chartH, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', fontSize: 12 }}>
          Loading chart...
        </div>
      ) : chartData.length === 0 ? (
        <div style={{ height: chartH, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', fontSize: 12 }}>
          No data
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={chartH}>
          <LineChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2130" />
            {selected && (
              <XAxis
                dataKey="time"
                stroke="#333"
                tick={{ fontSize: 10, fill: '#555' }}
                interval="preserveStartEnd"
              />
            )}
            <YAxis
              domain={[minP, maxP]}
              hide={!selected}
              stroke="#333"
              tick={{ fontSize: 10, fill: '#555' }}
              width={selected ? 65 : 0}
              tickFormatter={v => '$' + v.toLocaleString()}
            />
            <Tooltip
              contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3e', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#888' }}
              formatter={v => ['$' + v.toLocaleString(), 'Price']}
            />
            <Line
              type="monotone"
              dataKey="price"
              stroke={lineColor}
              strokeWidth={selected ? 2 : 1.5}
              dot={false}
              activeDot={{ r: 3, fill: lineColor }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}

      {selected && (
        <div style={{ fontSize: 11, color: '#555', marginTop: 6, textAlign: 'right' }}>
          24h history · price updates every 30s
        </div>
      )}
    </div>
  );
}

function Market() {
  const [selected, setSelected] = useState('BTC/USDT');

  function toggle(symbol) {
    setSelected(prev => prev === symbol ? null : symbol);
  }

  return (
    <div>
      <h1 className="page-title">Live Market</h1>
      <p style={{ color: '#666', fontSize: 13, marginBottom: 24 }}>
        Click any symbol to expand its chart · Price updates every 30 seconds
      </p>

      {/* Crypto */}
      <div className="section">
        <h3>Crypto</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {CRYPTO_SYMBOLS.map(c => (
            <SymbolCard
              key={c.symbol}
              symbol={c.symbol}
              name={c.name}
              ticker={c.ticker}
              isCrypto={true}
              selected={selected === c.symbol}
              onClick={() => toggle(c.symbol)}
            />
          ))}
        </div>
      </div>

      {/* Stocks */}
      <div className="section">
        <h3>Stocks</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {STOCK_SYMBOLS.map(s => (
            <SymbolCard
              key={s.symbol}
              symbol={s.symbol}
              name={s.name}
              ticker={null}
              isCrypto={false}
              selected={selected === s.symbol}
              onClick={() => toggle(s.symbol)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default Market;
