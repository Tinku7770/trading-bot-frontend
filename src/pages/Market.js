import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const API = process.env.REACT_APP_API_URL;

const CRYPTO_NAME_MAP = {
  BTC: 'Bitcoin', ETH: 'Ethereum', SOL: 'Solana', BNB: 'BNB',
  XRP: 'Ripple', ADA: 'Cardano', DOGE: 'Dogecoin', AVAX: 'Avalanche',
  MATIC: 'Polygon', DOT: 'Polkadot', LINK: 'Chainlink', UNI: 'Uniswap',
  LTC: 'Litecoin', ATOM: 'Cosmos', FIL: 'Filecoin'
};
const STOCK_NAME_MAP = {
  AAPL: 'Apple', TSLA: 'Tesla', NVDA: 'NVIDIA', MSFT: 'Microsoft',
  GOOGL: 'Google', GOOG: 'Google', XOM: 'Exxon', CVX: 'Chevron',
  AMZN: 'Amazon', META: 'Meta', NFLX: 'Netflix', AMD: 'AMD',
  INTC: 'Intel', JPM: 'JPMorgan', BAC: 'Bank of America',
  WMT: 'Walmart', DIS: 'Disney', BABA: 'Alibaba', V: 'Visa', MA: 'Mastercard'
};

// DST-aware Eastern Time market session — mirrors backend logic
function nthWeekday(year, month, weekday, n) {
  const d = new Date(Date.UTC(year, month, 1));
  let count = 0;
  while (d.getUTCMonth() === month) {
    if (d.getUTCDay() === weekday) { count++; if (count === n) return d; }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return null;
}

function getETOffsetMinutes(now) {
  const year = now.getUTCFullYear();
  const dstStart = nthWeekday(year, 2, 0, 2);
  const dstEnd   = nthWeekday(year, 10, 0, 1);
  dstStart.setUTCHours(7);
  dstEnd.setUTCHours(6);
  return (now >= dstStart && now < dstEnd) ? -4 * 60 : -5 * 60;
}

function getStockMarketSession() {
  const now = new Date();
  const day = now.getUTCDay();
  if (day === 0 || day === 6) return 'closed';
  const etOffsetMins = getETOffsetMinutes(now);
  const utcMins = now.getUTCHours() * 60 + now.getUTCMinutes();
  const localMins = (utcMins + etOffsetMins + 24 * 60) % (24 * 60);
  if (localMins < 4 * 60)       return 'closed';
  if (localMins < 9 * 60 + 30)  return 'pre-market';
  if (localMins < 16 * 60)      return 'open';
  if (localMins < 20 * 60)      return 'after-hours';
  return 'closed';
}

const SESSION_STYLE = {
  open:         { color: '#00c853', label: 'Market Open' },
  'pre-market': { color: '#ffd600', label: 'Pre-Market' },
  'after-hours':{ color: '#f5a623', label: 'After-Hours' },
  closed:       { color: '#ff3d3d', label: 'Market Closed' },
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const mins = Math.floor((Date.now() - new Date(dateStr)) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function SignalBadge({ signal }) {
  if (!signal) return null;
  const colors = { BUY: '#00c853', SELL: '#ff3d3d', HOLD: '#888' };
  const color = colors[signal.decision] || '#888';
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: `${color}18`, border: `1px solid ${color}40`,
      borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 600, color
    }}>
      {signal.decision} {signal.confidence}%
      <span style={{ opacity: 0.6, fontWeight: 400 }}>· {timeAgo(signal.createdAt)}</span>
    </div>
  );
}

// externalPrice / externalChange are passed from the parent for crypto (batched fetch).
// Stocks derive price and change from their own chart data.
function SymbolCard({ symbol, name, isCrypto, ticker, selected, onClick, lastSignal, externalPrice, externalChange }) {
  const [chartData, setChartData]     = useState([]);
  const [stockPrice, setStockPrice]   = useState(null);
  const [stockChange, setStockChange] = useState(null);
  const [loadingChart, setLoadingChart] = useState(true);

  const fetchChart = useCallback(async () => {
    try {
      const encoded = encodeURIComponent(symbol);
      const res = await axios.get(`${API}/dashboard/chart/${encoded}`);
      const points = res.data || [];
      setChartData(points);
      if (!isCrypto && points.length > 0) {
        const latest   = points[points.length - 1].price;
        const earliest = points[0].price;
        setStockPrice(latest);
        setStockChange(earliest > 0 ? (((latest - earliest) / earliest) * 100).toFixed(2) : '0.00');
      }
      setLoadingChart(false);
    } catch {
      setLoadingChart(false);
    }
  }, [symbol, isCrypto]);

  useEffect(() => {
    fetchChart();
    const interval = setInterval(fetchChart, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchChart]);

  const price     = isCrypto ? (externalPrice  ?? null) : stockPrice;
  const change    = isCrypto ? (externalChange ?? null) : stockChange;
  const isUp      = change !== null && parseFloat(change) >= 0;
  const lineColor = change !== null ? (isUp ? '#00c853' : '#ff3d3d') : '#5865f2';
  const chartH    = selected ? 220 : 90;

  const minP = chartData.length ? Math.min(...chartData.map(d => d.price)) * 0.999 : 0;
  const maxP = chartData.length ? Math.max(...chartData.map(d => d.price)) * 1.001 : 0;

  return (
    <div
      onClick={onClick}
      style={{
        background: selected ? '#1e2235' : '#1a1d27',
        border: `1px solid ${selected ? '#5865f2' : '#2a2d3e'}`,
        borderRadius: 12, padding: 16, cursor: 'pointer',
        transition: 'all 0.2s',
        boxShadow: selected ? '0 0 0 2px #5865f230' : 'none'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>{symbol}</div>
          <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{name}</div>
          <div style={{ marginTop: 5 }}>
            <SignalBadge signal={lastSignal} />
          </div>
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
          {!isCrypto && (
            <div style={{ fontSize: 10, color: '#444', marginTop: 3 }}>up to 5m delay</div>
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
          {isCrypto ? '24h history · live price every 30s' : 'Intraday chart · change from market open · updates every 5m'}
        </div>
      )}
    </div>
  );
}

function Market() {
  const [selected, setSelected]       = useState(null);
  const [cryptoSymbols, setCryptoSymbols] = useState([
    { symbol: 'BTC/USDT', name: 'Bitcoin',  ticker: 'BTCUSDT' },
    { symbol: 'ETH/USDT', name: 'Ethereum', ticker: 'ETHUSDT' },
    { symbol: 'SOL/USDT', name: 'Solana',   ticker: 'SOLUSDT' },
    { symbol: 'BNB/USDT', name: 'BNB',      ticker: 'BNBUSDT' },
    { symbol: 'XRP/USDT', name: 'Ripple',   ticker: 'XRPUSDT' },
  ]);
  const [stockSymbols, setStockSymbols] = useState([
    { symbol: 'AAPL', name: 'Apple' },
    { symbol: 'TSLA', name: 'Tesla' },
    { symbol: 'NVDA', name: 'NVIDIA' },
    { symbol: 'XOM',  name: 'Exxon' },
    { symbol: 'CVX',  name: 'Chevron' },
  ]);
  const [cryptoPrices, setCryptoPrices] = useState({});
  const [latestSignals, setLatestSignals] = useState({});
  const [session, setSession] = useState(getStockMarketSession());
  const [fearGreed, setFearGreed] = useState(null);

  // Batch-fetch all crypto prices in one Binance call instead of one call per card
  const fetchAllCryptoPrices = useCallback(async () => {
    if (!cryptoSymbols.length) return;
    try {
      const tickers = JSON.stringify(cryptoSymbols.map(c => c.ticker));
      const res = await axios.get(
        `https://api.binance.us/api/v3/ticker/24hr?symbols=${encodeURIComponent(tickers)}`
      );
      const prices = {};
      res.data.forEach(item => {
        prices[item.symbol] = {
          price:  parseFloat(item.lastPrice),
          change: parseFloat(item.priceChangePercent).toFixed(2)
        };
      });
      setCryptoPrices(prices);
    } catch {}
  }, [cryptoSymbols]);

  useEffect(() => {
    fetchAllCryptoPrices();
    const interval = setInterval(fetchAllCryptoPrices, 30000);
    return () => clearInterval(interval);
  }, [fetchAllCryptoPrices]);

  // Load bot symbols from settings
  useEffect(() => {
    axios.get(`${API}/bot/status`).then(res => {
      if (res.data?.cryptoSymbols?.length) {
        setCryptoSymbols(res.data.cryptoSymbols.map(s => {
          const base = s.replace('/USDT', '').replace('/', '');
          return { symbol: s, name: CRYPTO_NAME_MAP[base] || base, ticker: s.replace('/', '') };
        }));
      }
      if (res.data?.stockSymbols?.length) {
        setStockSymbols(res.data.stockSymbols.map(s => ({
          symbol: s, name: STOCK_NAME_MAP[s] || s
        })));
      }
    }).catch(() => {});
  }, []);

  // Fetch latest signal per symbol
  useEffect(() => {
    axios.get(`${API}/signals`).then(res => {
      const map = {};
      for (const signal of res.data) {
        if (!map[signal.symbol]) map[signal.symbol] = signal;
      }
      setLatestSignals(map);
    }).catch(() => {});
  }, []);

  // Update stock market session every minute
  useEffect(() => {
    const interval = setInterval(() => setSession(getStockMarketSession()), 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Fear & Greed index
  useEffect(() => {
    axios.get('https://api.alternative.me/fng/')
      .then(res => {
        const d = res.data?.data?.[0];
        if (d) setFearGreed({ value: parseInt(d.value), label: d.value_classification });
      })
      .catch(() => {});
  }, []);

  function toggle(symbol) {
    setSelected(prev => prev === symbol ? null : symbol);
  }

  const sessionStyle = SESSION_STYLE[session] || SESSION_STYLE.closed;

  return (
    <div>
      <h1 className="page-title">Live Market</h1>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <p style={{ color: '#666', fontSize: 13, margin: 0 }}>
          Click any symbol to expand its chart · Crypto updates every 30s · Stocks update every 5m
        </p>
        {fearGreed && (() => {
          const v = fearGreed.value;
          const color = v >= 75 ? '#ff3d3d' : v >= 55 ? '#f5a623' : v >= 45 ? '#ffd600' : v >= 25 ? '#00c853' : '#00e676';
          return (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: '#1a1d27', border: '1px solid #2a2d3e',
              borderRadius: 10, padding: '8px 16px'
            }}>
              <div style={{ fontSize: 12, color: '#888' }}>Fear & Greed</div>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: `${color}20`, border: `2px solid ${color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 14, color
              }}>{v}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color }}>{fearGreed.label}</div>
            </div>
          );
        })()}
      </div>

      {/* Crypto */}
      <div className="section">
        <h3>Crypto</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {cryptoSymbols.map(c => (
            <SymbolCard
              key={c.symbol}
              symbol={c.symbol}
              name={c.name}
              ticker={c.ticker}
              isCrypto={true}
              selected={selected === c.symbol}
              onClick={() => toggle(c.symbol)}
              lastSignal={latestSignals[c.symbol] || null}
              externalPrice={cryptoPrices[c.ticker]?.price}
              externalChange={cryptoPrices[c.ticker]?.change}
            />
          ))}
        </div>
      </div>

      {/* Stocks */}
      <div className="section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Stocks</h3>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: `${sessionStyle.color}15`,
            border: `1px solid ${sessionStyle.color}40`,
            borderRadius: 20, padding: '4px 12px'
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: sessionStyle.color }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: sessionStyle.color }}>{sessionStyle.label}</span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {stockSymbols.map(s => (
            <SymbolCard
              key={s.symbol}
              symbol={s.symbol}
              name={s.name}
              ticker={null}
              isCrypto={false}
              selected={selected === s.symbol}
              onClick={() => toggle(s.symbol)}
              lastSignal={latestSignals[s.symbol] || null}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default Market;
