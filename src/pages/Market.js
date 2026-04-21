import React, { useEffect, useState } from 'react';
import axios from 'axios';

const CRYPTO_COINS = [
  { symbol: 'BTC' },
  { symbol: 'ETH' },
  { symbol: 'SOL' },
  { symbol: 'BNB' },
  { symbol: 'XRP' }
];

const STOCK_SYMBOLS = ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'GOOGL'];

function Market() {
  const [cryptoPrices, setCryptoPrices] = useState([]);
  const [stockPrices, setStockPrices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMarketData();
    const interval = setInterval(fetchMarketData, 60000);
    return () => clearInterval(interval);
  }, []);

  async function fetchMarketData() {
    try {
      const cryptoData = await Promise.all(
        CRYPTO_COINS.map(async (c) => {
          try {
            const ticker = `${c.symbol}USDT`;
            const [priceRes, statsRes] = await Promise.all([
              axios.get(`https://api.binance.us/api/v3/ticker/price?symbol=${ticker}`),
              axios.get(`https://api.binance.us/api/v3/ticker/24hr?symbol=${ticker}`)
            ]);
            return {
              symbol: c.symbol,
              price: parseFloat(priceRes.data.price),
              change: parseFloat(statsRes.data.priceChangePercent).toFixed(2)
            };
          } catch {
            return { symbol: c.symbol, price: 0, change: 0 };
          }
        })
      );
      setCryptoPrices(cryptoData);

      // Fetch stock prices
      const stockData = await Promise.all(
        STOCK_SYMBOLS.map(async (sym) => {
          try {
            const r = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=1d`);
            const meta = r.data.chart.result[0].meta;
            const change = (((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100).toFixed(2);
            return { symbol: sym, price: meta.regularMarketPrice, change };
          } catch {
            return { symbol: sym, price: 0, change: 0 };
          }
        })
      );
      setStockPrices(stockData);
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  }

  if (loading) return <div className="page-title">Loading market data...</div>;

  return (
    <div>
      <h1 className="page-title">Live Market</h1>
      <p style={{ color: '#888', marginBottom: 20 }}>Refreshes every 60 seconds</p>

      {/* Crypto */}
      <div className="section">
        <h3>Crypto Prices</h3>
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Price (USD)</th>
              <th>24h Change</th>
            </tr>
          </thead>
          <tbody>
            {cryptoPrices.map((c, i) => (
              <tr key={i}>
                <td><strong>{c.symbol}</strong></td>
                <td>${c.price?.toLocaleString()}</td>
                <td style={{ color: c.change >= 0 ? '#00c853' : '#ff3d3d', fontWeight: 600 }}>
                  {c.change >= 0 ? '+' : ''}{c.change}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Stocks */}
      <div className="section">
        <h3>Stock Prices</h3>
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Price (USD)</th>
              <th>24h Change</th>
            </tr>
          </thead>
          <tbody>
            {stockPrices.map((s, i) => (
              <tr key={i}>
                <td><strong>{s.symbol}</strong></td>
                <td>${s.price?.toFixed(2)}</td>
                <td style={{ color: s.change >= 0 ? '#00c853' : '#ff3d3d', fontWeight: 600 }}>
                  {s.change >= 0 ? '+' : ''}{s.change}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Market;
