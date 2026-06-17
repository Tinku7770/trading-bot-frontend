import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useApp } from '../context/AppContext';
import PriceChart from '../components/PriceChart';
import MarketStatus from '../components/MarketStatus';
import LiquidityHeatmap from '../components/LiquidityHeatmap';
import AIChat from '../components/AIChat';

const API = process.env.REACT_APP_API_URL;

function formatCountdown(ms) {
  if (ms <= 0) return '00:00';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
  const s = (totalSec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function formatDuration(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString([], {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function getMarketInfo(now) {
  const etDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = etDate.getDay();
  const h = etDate.getHours();
  const m = etDate.getMinutes();
  const s = etDate.getSeconds();
  const totalMins = h * 60 + m;
  const openMins = 9 * 60 + 30;
  const closeMins = 16 * 60;
  const isWeekday = day >= 1 && day <= 5;
  const isOpen = isWeekday && totalMins >= openMins && totalMins < closeMins;
  if (isOpen) {
    return { isOpen: true, ms: (closeMins - totalMins) * 60000 - s * 1000, sessionPct: Math.min(100, (totalMins - openMins) / 390 * 100) };
  }
  let minsToOpen;
  if (isWeekday && totalMins < openMins) {
    minsToOpen = openMins - totalMins;
  } else {
    let addDays = 1;
    while (((day + addDays) % 7) < 1 || ((day + addDays) % 7) > 5) addDays++;
    minsToOpen = (24 * 60 - totalMins) + (addDays - 1) * 24 * 60 + openMins;
  }
  return { isOpen: false, ms: Math.max(0, minsToOpen * 60000 - s * 1000), sessionPct: 0 };
}

function formatMarketCountdown(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const ss = s.toString().padStart(2, '0');
  const mm = m.toString().padStart(2, '0');
  if (h > 0) return `${h}h ${mm}m ${ss}s`;
  return `${mm}m ${ss}s`;
}

function Dashboard() {
  const { botStatus, setBotStatus, tradeMode, liveSignals, liveTrades } = useApp();
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(false);
  const [running, setRunning]     = useState(false);
  const [toggling, setToggling]   = useState(false);
  const [closingId, setClosingId] = useState(null);
  const [closingAll, setClosingAll] = useState(false);
  const [selectedTradeId, setSelectedTradeId] = useState(null);
  const [closeModal, setCloseModal] = useState(null);
  const [closeAllModal, setCloseAllModal] = useState(false);
  const [actionError, setActionError] = useState('');
  const [refreshing, setRefreshing]   = useState(false);
  const [sendingReport, setSendingReport] = useState(false);
  const [countdown, setCountdown] = useState('');
  const [nextRunTime, setNextRunTime] = useState(null);
  const [currentPrices, setCurrentPrices] = useState({});
  const [priceUpdatedAt, setPriceUpdatedAt] = useState({});
  const [scannedStocks, setScannedStocks]       = useState([]);
  const [scannedCrypto, setScannedCrypto]       = useState([]);
  const [preMarketFlags, setPreMarketFlags]     = useState([]);
  const [cryptoHealth, setCryptoHealth]         = useState(null);
  const [scannerPerf, setScannerPerf]           = useState(null);
  const [cryptoScanHistory, setCryptoScanHistory] = useState(null);
  const [scanHistoryExpanded, setScanHistoryExpanded] = useState(false);
  const [plBySymbolExpanded, setPlBySymbolExpanded] = useState(false);
  const [cooldownsExpanded, setCooldownsExpanded] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [wsConnected, setWsConnected] = useState(false);
  const openTradesRef = useRef([]);
  const runNowTimerRef = useRef(null);
  const binanceWsRef = useRef(null);
  const binanceSymbolsRef = useRef('');

  useEffect(() => {
    return () => { if (runNowTimerRef.current) clearTimeout(runNowTimerRef.current); };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    async function fetchScanned() {
      try {
        const [scannedRes, preRes, cryptoRes] = await Promise.all([
          axios.get(`${API}/bot/scanned-stocks`),
          axios.get(`${API}/bot/pre-market-flags`),
          axios.get(`${API}/bot/scanned-crypto`)
        ]);
        setScannedStocks(scannedRes.data || []);
        setPreMarketFlags(preRes.data || []);
        setScannedCrypto(cryptoRes.data || []);
      } catch { setScannedStocks([]); setPreMarketFlags([]); setScannedCrypto([]); }
    }
    fetchScanned();
    const interval = setInterval(fetchScanned, 60000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    async function fetchCryptoHealth() {
      try {
        const res = await axios.get(`${API}/market/crypto-health`);
        setCryptoHealth(res.data);
      } catch { /* keep previous data */ }
    }
    fetchCryptoHealth();
    const interval = setInterval(fetchCryptoHealth, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    async function fetchScannerPerf() {
      try {
        const res = await axios.get(`${API}/scanner/performance`);
        setScannerPerf(res.data);
      } catch { /* keep previous data */ }
    }
    fetchScannerPerf();
    const interval = setInterval(fetchScannerPerf, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    async function fetchCryptoHistory() {
      try {
        const res = await axios.get(`${API}/scanner/crypto-history`);
        setCryptoScanHistory(res.data);
      } catch { /* keep previous data */ }
    }
    fetchCryptoHistory();
    const interval = setInterval(fetchCryptoHistory, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchNextRun() {
    try {
      const res = await axios.get(`${API}/bot/next-run`);
      setNextRunTime(new Date(res.data.nextRun));
    } catch (err) {
      console.error('Failed to fetch next run time:', err);
    }
  }

  useEffect(() => {
    fetchNextRun();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!nextRunTime) return;
    function tick() {
      const ms = nextRunTime - new Date();
      if (ms <= 0) {
        setCountdown('00:00');
        fetchNextRun();
      } else {
        setCountdown(formatCountdown(ms));
      }
    }
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [nextRunTime]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep ref in sync so the stable interval below always reads the latest trades
  useEffect(() => {
    openTradesRef.current = data?.openTrades || [];
  }, [data?.openTrades]);

  // Auto-select first open trade so chart is always visible
  useEffect(() => {
    if (data?.openTrades?.length > 0 && !selectedTradeId) {
      setSelectedTradeId(data.openTrades[0]._id);
    }
  }, [data?.openTrades]); // eslint-disable-line react-hooks/exhaustive-deps

  // Binance.US WebSocket — real-time crypto prices (~1s tick)
  useEffect(() => {
    const cryptoTrades = (data?.openTrades || []).filter(t => t.market === 'crypto');
    const symbolsKey = cryptoTrades.map(t => t.symbol).sort().join(',');

    if (symbolsKey === binanceSymbolsRef.current && binanceWsRef.current?.readyState === WebSocket.OPEN) return;
    binanceSymbolsRef.current = symbolsKey;

    if (binanceWsRef.current) {
      binanceWsRef.current.close(1000);
      binanceWsRef.current = null;
    }
    setWsConnected(false);
    if (!cryptoTrades.length) return;

    function connect() {
      const streams = cryptoTrades
        .map(t => t.symbol.replace('/', '').toLowerCase() + '@miniTicker')
        .join('/');
      const ws = new WebSocket(`wss://stream.binance.us:9443/stream?streams=${streams}`);
      binanceWsRef.current = ws;

      ws.onopen = () => setWsConnected(true);
      ws.onclose = (e) => {
        setWsConnected(false);
        if (e.code !== 1000 && binanceWsRef.current === ws && binanceSymbolsRef.current === symbolsKey) {
          setTimeout(connect, 3000);
        }
      };
      ws.onerror = () => setWsConnected(false);
      ws.onmessage = (event) => {
        try {
          const ticker = JSON.parse(event.data)?.data;
          if (!ticker?.c) return;
          const trade = cryptoTrades.find(t => t.symbol.replace('/', '') === ticker.s);
          if (!trade) return;
          const price = parseFloat(ticker.c);
          if (!isFinite(price)) return;
          setCurrentPrices(prev => ({ ...prev, [trade.symbol]: price }));
          setPriceUpdatedAt(prev => ({ ...prev, [trade.symbol]: Date.now() }));
        } catch {}
      };
    }
    connect();

    return () => {
      binanceSymbolsRef.current = '';
      if (binanceWsRef.current) { binanceWsRef.current.close(1000); binanceWsRef.current = null; }
      setWsConnected(false);
    };
  }, [data?.openTrades]); // eslint-disable-line react-hooks/exhaustive-deps

  // Crypto prices: fallback polling every 10s (fires if WebSocket is down)
  useEffect(() => {
    if (!data?.openTrades?.length) return;
    const interval = setInterval(() => {
      if (!binanceWsRef.current || binanceWsRef.current.readyState !== WebSocket.OPEN) {
        fetchCryptoPrices(openTradesRef.current);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [data?.openTrades?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stock prices: refresh every 5s
  useEffect(() => {
    if (!data?.openTrades?.length) return;
    const interval = setInterval(() => fetchStockPrices(openTradesRef.current), 5000);
    return () => clearInterval(interval);
  }, [data?.openTrades?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchDashboard() {
    try {
      const res = await axios.get(`${API}/dashboard`);
      setData(res.data);
      setBotStatus(res.data.botStatus);
      setError(false);
      setLoading(false);
      fetchCurrentPrices(res.data.openTrades || []);
    } catch {
      setError(true);
      setLoading(false);
    }
  }

  async function fetchCryptoPrices(openTrades) {
    const cryptoTrades = (openTrades || []).filter(t => t.market === 'crypto');
    if (!cryptoTrades.length) return;
    try {
      const tickers = JSON.stringify(cryptoTrades.map(t => t.symbol.replace('/', '')));
      const res = await axios.get(`${API}/market/crypto-prices?tickers=${encodeURIComponent(tickers)}`);
      const results = {};
      res.data.forEach(item => {
        const trade = cryptoTrades.find(t => t.symbol.replace('/', '') === item.symbol);
        if (trade) results[trade.symbol] = parseFloat(item.price);
      });
      if (Object.keys(results).length) {
        const ts = Date.now();
        setCurrentPrices(prev => ({ ...prev, ...results }));
        setPriceUpdatedAt(prev => {
          const next = { ...prev };
          Object.keys(results).forEach(sym => { next[sym] = ts; });
          return next;
        });
      }
    } catch (err) {
      console.error('Failed to batch-fetch crypto prices:', err);
    }
  }

  async function fetchStockPrices(openTrades) {
    const stockTrades = (openTrades || []).filter(t => t.market !== 'crypto');
    if (!stockTrades.length) return;
    try {
      const tickers = JSON.stringify(stockTrades.map(t => t.symbol));
      const res = await axios.get(`${API}/market/stock-prices?tickers=${encodeURIComponent(tickers)}`);
      const results = {};
      (res.data || []).forEach(item => { results[item.symbol] = item.price; });
      if (Object.keys(results).length) {
        const ts = Date.now();
        setCurrentPrices(prev => ({ ...prev, ...results }));
        setPriceUpdatedAt(prev => {
          const next = { ...prev };
          Object.keys(results).forEach(sym => { next[sym] = ts; });
          return next;
        });
      }
    } catch (err) {
      console.error('Failed to fetch stock prices:', err);
    }
  }

  async function fetchCurrentPrices(openTrades) {
    await Promise.all([fetchCryptoPrices(openTrades), fetchStockPrices(openTrades)]);
  }

  async function toggleBot() {
    try {
      setToggling(true);
      setActionError('');
      if (botStatus) {
        await axios.post(`${API}/bot/stop`);
        setBotStatus(false);
      } else {
        await axios.post(`${API}/bot/start`);
        setBotStatus(true);
      }
    } catch {
      setActionError('Failed to toggle bot — check your connection');
    } finally {
      setToggling(false);
    }
  }

  function closePosition(tradeId) {
    const trade = data?.openTrades?.find(t => t._id === tradeId);
    if (!trade) return;
    setCloseModal(trade);
  }

  async function executeClose() {
    const trade = closeModal;
    setCloseModal(null);
    setActionError('');
    try {
      setClosingId(trade._id);
      await axios.post(`${API}/bot/close-position/${trade._id}`);
      await fetchDashboard();
    } catch {
      setActionError('Failed to close position');
    } finally {
      setClosingId(null);
    }
  }

  function closeAllPositions() {
    setCloseAllModal(true);
  }

  async function executeCloseAll() {
    setCloseAllModal(false);
    setActionError('');
    try {
      setClosingAll(true);
      await axios.post(`${API}/bot/close-all`);
      await fetchDashboard();
    } catch {
      setActionError('Failed to close all positions');
    } finally {
      setClosingAll(false);
    }
  }

  async function sendDailyReport() {
    try {
      setSendingReport(true);
      setActionError('');
      await axios.post(`${API}/bot/send-daily-report`);
    } catch {
      setActionError('Failed to send daily report');
    } finally {
      setSendingReport(false);
    }
  }

  async function runNow() {
    try {
      setRunning(true);
      setActionError('');
      await axios.post(`${API}/bot/run-now`);
      runNowTimerRef.current = setTimeout(() => {
        fetchDashboard();
        fetchNextRun();
        setRunning(false);
      }, 90000);
    } catch (err) {
      setActionError(err.response?.data?.error || 'Failed to trigger bot — check your connection');
      setRunning(false);
    }
  }

  if (loading) return <div className="page-title">Loading...</div>;

  if (error) return (
    <div>
      <h1 className="page-title">Dashboard</h1>
      <div style={{
        background: '#2a1a1a', border: '1px solid #ff3d3d', borderRadius: 8,
        padding: '16px 20px', color: '#ff3d3d', fontSize: 14
      }}>
        Could not load dashboard data — check your connection or try refreshing.
      </div>
    </div>
  );

  const stats = data?.stats || {};

  const seenTradeIds = new Set();
  const recentTrades = [...liveTrades, ...(data?.recentTrades || [])]
    .filter(t => { if (seenTradeIds.has(t._id)) return false; seenTradeIds.add(t._id); return true; })
    .slice(0, 8);

  const seenSignalIds = new Set();
  const recentSignals = [...liveSignals, ...(data?.recentSignals || [])]
    .filter(s => { if (seenSignalIds.has(s._id)) return false; seenSignalIds.add(s._id); return true; })
    .filter(s => (s.confidence || 0) > 0)
    .slice(0, 8);

  const capitalPctRaw = stats.totalCapital > 0
    ? (stats.capitalInTrades / stats.totalCapital) * 100
    : 0;
  const capitalPct = Math.min(100, Math.round(capitalPctRaw));

  return (
    <div>
      {/* Sticky summary bar — #4 */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: '#0d0f1a', borderBottom: '1px solid #2a2d3e',
        padding: '8px 16px', display: 'flex', alignItems: 'center',
        gap: 20, flexWrap: 'wrap', fontSize: 13
      }}>
        <span style={{ color: botStatus ? '#00c853' : '#ff3d3d', fontWeight: 700 }}>
          {botStatus ? '● RUNNING' : '● STOPPED'}
        </span>
        <span style={{ color: '#555' }}>|</span>
        <span style={{ color: '#888' }}>{tradeMode === 'paper' ? 'Paper' : 'Live'}</span>
        <span style={{ color: '#555' }}>|</span>
        <span>
          Today:{' '}
          <span style={{ fontWeight: 700, color: (data?.todayStats?.pl || 0) >= 0 ? '#00c853' : '#ff3d3d' }}>
            {(data?.todayStats?.pl || 0) >= 0 ? '+' : ''}${(data?.todayStats?.pl || 0).toFixed(2)}
          </span>
        </span>
        <span style={{ color: '#555' }}>|</span>
        <span style={{ color: '#aaa' }}>
          <span style={{ color: (stats.openPositions || 0) > 0 ? '#f5a623' : '#555', fontWeight: 600 }}>
            {stats.openPositions || 0}
          </span> open
        </span>
        <span style={{ color: '#555' }}>|</span>
        <span style={{ color: '#aaa' }}>
          <span style={{ color: '#00c853', fontWeight: 600 }}>${(stats.availableCapital || 0).toFixed(0)}</span> free
        </span>
        <span style={{ color: '#555' }}>|</span>
        <span style={{ color: '#aaa' }}>
          All-time: <span style={{ fontWeight: 700, color: (stats.totalProfitLoss || 0) >= 0 ? '#00c853' : '#ff3d3d' }}>
            {(stats.totalProfitLoss || 0) >= 0 ? '+' : ''}${(stats.totalProfitLoss || 0).toFixed(2)}
          </span>
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ color: '#aaa', fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>
            {currentTime.toLocaleString('en-US', {
              timeZone: 'America/Los_Angeles',
              weekday: 'short', month: 'short', day: 'numeric',
              hour: '2-digit', minute: '2-digit', second: '2-digit'
            })} <span style={{ color: '#555', fontSize: 11 }}>PT</span>
          </span>
          <span style={{ color: '#555' }}>|</span>
          <span style={{ color: '#888', fontVariantNumeric: 'tabular-nums' }}>
            Next run: <span style={{ color: botStatus ? '#00c853' : '#555', fontWeight: 600 }}>{botStatus ? countdown : '--:--'}</span>
          </span>
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Dashboard</h1>
        <button
          onClick={async () => {
            setRefreshing(true);
            await Promise.all([fetchDashboard(), fetchNextRun()]);
            setRefreshing(false);
          }}
          disabled={refreshing}
          title="Refresh dashboard"
          style={{
            background: 'none', border: '1px solid #2a2d3e', borderRadius: 8,
            padding: '6px 12px', color: refreshing ? '#5865f2' : '#888',
            fontSize: 13, cursor: refreshing ? 'not-allowed' : 'pointer',
            opacity: refreshing ? 0.7 : 1, transition: 'color 0.2s'
          }}
          onMouseEnter={e => { if (!refreshing) e.currentTarget.style.color = '#c9d1d9'; }}
          onMouseLeave={e => { if (!refreshing) e.currentTarget.style.color = '#888'; }}
        >
          {refreshing ? '↻ Refreshing...' : '↻ Refresh'}
        </button>
      </div>

      {actionError && (
        <div style={{
          background: '#2a1a1a', border: '1px solid #ff3d3d', borderRadius: 8,
          padding: '10px 14px', marginBottom: 16, color: '#ff3d3d', fontSize: 13,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          {actionError}
          <button onClick={() => setActionError('')} style={{ background: 'none', border: 'none', color: '#ff3d3d', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* Bot Control */}
      <div className="bot-toggle">
        <div>
          <h2>AI Trading Bot</h2>
          <div style={{ display: 'flex', gap: 16, marginTop: 4, flexWrap: 'wrap' }}>
            {recentSignals.length > 0 && (
              <p style={{ color: '#888', fontSize: 13, margin: 0 }}>
                Last run: <span style={{ color: '#aaa' }}>{new Date(recentSignals[0].createdAt).toLocaleTimeString()}</span>
              </p>
            )}
            <p style={{ color: '#888', fontSize: 13, margin: 0 }}>
              Next run in: <span style={{ color: botStatus ? '#00c853' : '#555', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                {botStatus ? countdown : '--:--'}
              </span>
            </p>
          </div>
          {/* Uptime / downtime */}
          <div style={{ marginTop: 8 }}>
            {botStatus && data?.botStartedAt && (() => {
              const ms = currentTime - new Date(data.botStartedAt);
              const d = Math.floor(ms / 86400000);
              const h = Math.floor((ms % 86400000) / 3600000);
              const m = Math.floor((ms % 3600000) / 60000);
              const dur = d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : `${m}m`;
              const since = new Date(data.botStartedAt).toLocaleString('en-US', {
                timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit'
              });
              return (
                <p style={{ color: '#888', fontSize: 13, margin: 0 }}>
                  <span style={{ color: '#00c853', fontWeight: 700 }}>↑ Running</span>
                  {' '}since <span style={{ color: '#aaa' }}>{since} PT</span>
                  <span style={{ color: '#555', marginLeft: 6 }}>({dur})</span>
                </p>
              );
            })()}
            {!botStatus && data?.botStoppedAt && (() => {
              const ms = currentTime - new Date(data.botStoppedAt);
              const d = Math.floor(ms / 86400000);
              const h = Math.floor((ms % 86400000) / 3600000);
              const m = Math.floor((ms % 3600000) / 60000);
              const ago = d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : `${m}m`;
              const stoppedAt = new Date(data.botStoppedAt).toLocaleString('en-US', {
                timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit'
              });
              return (
                <p style={{ color: '#888', fontSize: 13, margin: 0 }}>
                  <span style={{ color: '#ff3d3d', fontWeight: 700 }}>↓ Stopped</span>
                  {' '}at <span style={{ color: '#aaa' }}>{stoppedAt} PT</span>
                  <span style={{ color: '#555', marginLeft: 6 }}>({ago} ago)</span>
                </p>
              );
            })()}
          </div>
        </div>
        <button
          className={`toggle-btn ${botStatus ? 'stop' : 'start'}`}
          onClick={toggleBot}
          disabled={toggling}
          style={{ opacity: toggling ? 0.6 : 1, cursor: toggling ? 'not-allowed' : 'pointer' }}
        >
          {toggling ? (botStatus ? 'Stopping...' : 'Starting...') : (botStatus ? 'Stop Bot' : 'Start Bot')}
        </button>
        <span className="mode-badge">{tradeMode === 'paper' ? 'Paper Trading' : 'Live Trading'}</span>
        <span style={{ color: botStatus ? '#00c853' : '#ff3d3d', fontWeight: 600 }}>
          {botStatus ? 'RUNNING' : 'STOPPED'}
        </span>
        <button
          onClick={runNow}
          disabled={running || !botStatus}
          style={{
            marginLeft: 'auto', padding: '10px 20px', borderRadius: 8,
            border: 'none', background: (running || !botStatus) ? '#333' : '#5865f2',
            color: (running || !botStatus) ? '#666' : '#fff',
            fontWeight: 600, cursor: (running || !botStatus) ? 'not-allowed' : 'pointer', fontSize: 14
          }}
        >
          {running ? 'Analyzing...' : 'Run Now'}
        </button>
        <button
          onClick={sendDailyReport}
          disabled={sendingReport}
          style={{
            marginLeft: 8, padding: '10px 20px', borderRadius: 8,
            border: 'none', background: sendingReport ? '#333' : '#1a7f37',
            color: sendingReport ? '#666' : '#fff',
            fontWeight: 600, cursor: sendingReport ? 'not-allowed' : 'pointer', fontSize: 14
          }}
        >
          {sendingReport ? 'Sending...' : 'Send Daily Report'}
        </button>
      </div>

      <MarketStatus />

      {/* Market Session Clock + Close Reminder */}
      {(() => {
        const mkt = getMarketInfo(currentTime);
        const countdown = formatMarketCountdown(mkt.ms);
        const isUrgent = mkt.isOpen && mkt.ms < 30 * 60 * 1000;
        const isWarning = mkt.isOpen && mkt.ms < 10 * 60 * 1000;
        const color = mkt.isOpen ? (isWarning ? '#ff3d3d' : isUrgent ? '#f5a623' : '#00c853') : '#555';
        const borderColor = mkt.isOpen ? (isWarning ? '#ff3d3d' : isUrgent ? '#f5a623' : '#1a3a1a') : '#1a1d27';
        return (
          <div style={{
            background: '#0d0f1a', border: `1px solid ${borderColor}`,
            borderRadius: 10, padding: '14px 20px', marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap'
          }}>
            {/* PT Clock */}
            <div>
              <div style={{ color: '#555', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 }}>California (PT)</div>
              <div style={{ color: '#aaa', fontWeight: 600, fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>
                {currentTime.toLocaleString('en-US', {
                  timeZone: 'America/Los_Angeles',
                  weekday: 'long', month: 'short', day: 'numeric', year: 'numeric'
                })}
              </div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 22, fontVariantNumeric: 'tabular-nums', letterSpacing: 1 }}>
                {currentTime.toLocaleString('en-US', {
                  timeZone: 'America/Los_Angeles',
                  hour: '2-digit', minute: '2-digit', second: '2-digit'
                })}
              </div>
            </div>

            <div style={{ width: 1, height: 50, background: '#2a2d3e', flexShrink: 0 }} />

            {/* Market Status + Countdown */}
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ color, fontWeight: 700, fontSize: 14 }}>
                  {mkt.isOpen ? '● MARKET OPEN' : '○ MARKET CLOSED'}
                </span>
                <span style={{ color: '#444', fontSize: 11 }}>NYSE / NASDAQ</span>
                {isWarning && (
                  <span style={{
                    background: '#2a0000', border: '1px solid #ff3d3d', borderRadius: 20,
                    color: '#ff3d3d', fontSize: 10, fontWeight: 700, padding: '2px 8px'
                  }}>⚠ CLOSING SOON</span>
                )}
                {isUrgent && !isWarning && (
                  <span style={{
                    background: '#2a1500', border: '1px solid #f5a623', borderRadius: 20,
                    color: '#f5a623', fontSize: 10, fontWeight: 700, padding: '2px 8px'
                  }}>30 MIN WARNING</span>
                )}
              </div>
              {mkt.isOpen ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
                    <span style={{ color: '#888', fontSize: 12 }}>Closes in</span>
                    <span style={{ color, fontWeight: 800, fontSize: 20, fontVariantNumeric: 'tabular-nums' }}>
                      {countdown}
                    </span>
                    <span style={{ color: '#555', fontSize: 11 }}>(1:00 PM PT)</span>
                  </div>
                  <div style={{ background: '#1a1d27', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                    <div style={{
                      width: `${mkt.sessionPct}%`, height: '100%',
                      background: `linear-gradient(90deg, #00c853, ${color})`,
                      transition: 'width 1s linear'
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3, fontSize: 10, color: '#444' }}>
                    <span>6:30 AM PT open</span>
                    <span>{mkt.sessionPct.toFixed(0)}% of session elapsed</span>
                    <span>1:00 PM PT close</span>
                  </div>
                </>
              ) : (
                <div style={{ color: '#888', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
                  Opens in <strong style={{ color: '#aaa', fontWeight: 700 }}>{countdown}</strong>
                  <div style={{ color: '#555', fontSize: 11, marginTop: 3 }}>Mon – Fri · 6:30 AM – 1:00 PM PT</div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* High Leverage Warning */}
      {(data?.leverageMultiplier ?? 1) > 3 && data?.tradeMode === 'live' && (
        <div style={{
          background: '#2a1500', border: '1px solid #f5a623', borderRadius: 10,
          padding: '14px 20px', marginBottom: 24,
          display: 'flex', alignItems: 'flex-start', gap: 14
        }}>
          <span style={{ fontSize: 22, lineHeight: 1 }}>⚠️</span>
          <div>
            <div style={{ color: '#f5a623', fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
              High Leverage Active — {data.leverageMultiplier}x in Live Trading
            </div>
            <div style={{ color: '#c8852a', fontSize: 13, lineHeight: 1.6 }}>
              A <strong style={{ color: '#f5a623' }}>1% move against you</strong> = <strong style={{ color: '#f5a623' }}>{data.leverageMultiplier}% real loss</strong> per trade.
              A <strong style={{ color: '#ff3d3d' }}>{(100 / (data.leverageMultiplier || 1)).toFixed(0)}% move</strong> = full position liquidation.
              Make sure your stop loss is set tight and your trade amount is small.
            </div>
          </div>
        </div>
      )}

      {(data?.leverageMultiplier ?? 1) > 3 && data?.tradeMode === 'paper' && (
        <div style={{
          background: '#1a1500', border: '1px solid #555', borderRadius: 10,
          padding: '14px 20px', marginBottom: 24,
          display: 'flex', alignItems: 'flex-start', gap: 14
        }}>
          <span style={{ fontSize: 22, lineHeight: 1 }}>⚠️</span>
          <div>
            <div style={{ color: '#888', fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
              High Leverage ({data.leverageMultiplier}x) — Paper Trading Mode
            </div>
            <div style={{ color: '#666', fontSize: 13, lineHeight: 1.6 }}>
              You're testing {data.leverageMultiplier}x leverage safely in paper mode. Before switching to live,
              remember: a {(100 / (data.leverageMultiplier || 1)).toFixed(0)}% adverse move will liquidate your position.
            </div>
          </div>
        </div>
      )}

      {/* Today's Performance + Open Positions — 2-col */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16, alignItems: 'start' }}>
        {/* Today's Performance — #3 sparkline */}
        {(() => {
          const ts = data?.todayStats || { pl: 0, trades: 0, wins: 0, winRate: 0 };
          const sparkData = data?.todaySparkline || [];
          const plColor = (ts.pl || 0) > 0 ? '#00c853' : (ts.pl || 0) < 0 ? '#ff3d3d' : '#888';
          return (
            <div className="section">
              <h3>Today's Performance</h3>
              {ts.trades === 0 && (
                <p style={{ color: '#555', fontSize: 13, marginBottom: 12 }}>No trades closed today — bot is watching the market.</p>
              )}
              <div className="stats-grid">
                <div className="card" style={{ gridColumn: sparkData.length > 1 ? 'span 2' : undefined }}>
                  <h2>Today's P/L</h2>
                  <div className="value" style={{ color: plColor }}>
                    {(ts.pl || 0) > 0 ? '+' : ''}${(ts.pl || 0).toFixed(2)}
                  </div>
                  {sparkData.length > 1 && (
                    <div style={{ marginTop: 8 }}>
                      <ResponsiveContainer width="100%" height={60}>
                        <LineChart data={sparkData}>
                          <ReferenceLine y={0} stroke="#333" strokeDasharray="3 3" />
                          <XAxis dataKey="time" hide />
                          <YAxis hide />
                          <Tooltip
                            contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3e', borderRadius: 6, fontSize: 11 }}
                            formatter={(v) => [`${v >= 0 ? '+' : ''}$${v.toFixed(2)}`, 'Cumulative P/L']}
                          />
                          <Line type="monotone" dataKey="pl" stroke={plColor} strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
                <div className="card">
                  <h2>Trades Today</h2>
                  <div className="value">{ts.trades || 0}</div>
                </div>
                <div className="card">
                  <h2>Today's Wins</h2>
                  <div className="value" style={{ color: '#00c853' }}>{ts.wins || 0}</div>
                </div>
                <div className="card">
                  <h2>Today's Win Rate</h2>
                  <div className="value" style={{ color: (ts.winRate || 0) >= 50 ? '#00c853' : ts.trades > 0 ? '#ff3d3d' : '#555' }}>
                    {ts.trades > 0 ? `${ts.winRate}%` : '—'}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Open Positions (table only — charts are full-width below) */}
        {data?.openTrades?.length > 0 && (
          <div className="section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h3 style={{ margin: 0 }}>Open Positions</h3>
                {wsConnected ? (
                  <span style={{
                    background: '#0d2a0d', border: '1px solid #00c853', borderRadius: 20,
                    color: '#00c853', fontSize: 10, fontWeight: 700, padding: '2px 8px',
                    animation: 'pulse 2s infinite'
                  }}>● LIVE</span>
                ) : (
                  <span style={{
                    background: '#1a1d27', border: '1px solid #2a2d3e', borderRadius: 20,
                    color: '#555', fontSize: 10, fontWeight: 700, padding: '2px 8px'
                  }}>↻ 5s</span>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); closeAllPositions(); }}
                disabled={closingAll}
                style={{
                  padding: '6px 14px', borderRadius: 6,
                  border: '1px solid #ff3d3d',
                  background: closingAll ? '#2a1a1a' : 'transparent',
                  color: '#ff3d3d',
                  fontWeight: 600, cursor: closingAll ? 'not-allowed' : 'pointer',
                  fontSize: 12, transition: 'all 0.2s'
                }}
              >
                {closingAll ? 'Closing All...' : 'Close All Positions'}
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Type</th>
                    <th>Entry</th>
                    <th>Amount</th>
                    <th>Lev</th>
                    <th>Time Held</th>
                    <th>SL Distance</th>
                    <th>Unrealized P/L</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.openTrades.map((trade) => (
                    <tr
                      key={trade._id}
                      onClick={() => setSelectedTradeId(trade._id)}
                      style={{
                        cursor: 'pointer',
                        background: selectedTradeId === trade._id ? '#1a1d3a' : undefined,
                        transition: 'background 0.15s'
                      }}
                    >
                      <td>
                        <strong>{trade.symbol}</strong>
                        {selectedTradeId === trade._id && (
                          <span style={{ marginLeft: 6, fontSize: 8, color: '#5865f2' }}>●</span>
                        )}
                      </td>
                      <td><span className={`badge ${trade.type?.toLowerCase()}`}>{trade.type}</span></td>
                      <td>${trade.price?.toFixed(2)}</td>
                      <td>${trade.amount?.toFixed(2)}</td>
                      <td style={{ color: (trade.leverage || 1) > 1 ? '#f5a623' : '#555', fontWeight: (trade.leverage || 1) > 1 ? 700 : 400 }}>
                        {trade.leverage || 1}x
                      </td>
                      {/* Time in trade — #2 */}
                      <td>{(() => {
                        const maxMs = trade.market === 'crypto' ? 16 * 3600000 : 48 * 3600000;
                        const heldMs = Date.now() - new Date(trade.executedAt).getTime();
                        const pct = Math.min(100, heldMs / maxMs * 100);
                        const color = pct < 50 ? '#00c853' : pct < 80 ? '#f5a623' : '#ff3d3d';
                        const maxLabel = trade.market === 'crypto' ? '16h' : '48h';
                        return (
                          <span style={{ color, fontWeight: 600, fontSize: 12 }}>
                            {formatDuration(heldMs)}
                            <span style={{ color: '#555', fontWeight: 400 }}> / {maxLabel}</span>
                          </span>
                        );
                      })()}</td>
                      {/* SL distance — #1 */}
                      <td>{(() => {
                        const cur = currentPrices[trade.symbol];
                        if (!cur || !trade.price) return <span style={{ color: '#555' }}>—</span>;
                        const isShort = trade.type === 'SHORT';
                        const slPrice = isShort ? trade.price * 1.02 : trade.price * 0.98;
                        const distPct = isShort
                          ? (slPrice - cur) / trade.price * 100
                          : (cur - slPrice) / trade.price * 100;
                        const color = distPct > 1 ? '#00c853' : distPct > 0.5 ? '#f5a623' : '#ff3d3d';
                        return (
                          <span style={{ color, fontWeight: 600, fontSize: 12 }}>
                            {distPct > 0 ? `${distPct.toFixed(2)}%` : <span style={{ color: '#ff3d3d' }}>STOP HIT</span>}
                          </span>
                        );
                      })()}</td>
                      <td>{(() => {
                        const cur = currentPrices[trade.symbol];
                        if (!cur || !trade.price) return <span style={{ color: '#555' }}>—</span>;
                        const isShort = trade.type === 'SHORT';
                        const pnlPct = (cur - trade.price) / trade.price * 100 * (isShort ? -1 : 1);
                        const pnlDollar = pnlPct / 100 * (trade.amount || 0) * (trade.leverage || 1);
                        const color = pnlDollar >= 0 ? '#00c853' : '#ff3d3d';
                        const justUpdated = priceUpdatedAt[trade.symbol] && Date.now() - priceUpdatedAt[trade.symbol] < 15000;
                        return (
                          <span style={{ color, fontWeight: 600 }}>
                            {justUpdated && <span className="price-pulse-dot" />}
                            <span className={pnlDollar >= 0 ? 'pl-arrow-up' : 'pl-arrow-down'}>
                              {pnlDollar >= 0 ? '↑' : '↓'}
                            </span>
                            {pnlDollar >= 0 ? '+' : ''}${pnlDollar.toFixed(2)}
                            <span style={{ fontSize: 11, marginLeft: 4, opacity: 0.8 }}>
                              ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)
                            </span>
                          </span>
                        );
                      })()}</td>
                      <td>
                        <button
                          onClick={(e) => { e.stopPropagation(); closePosition(trade._id); }}
                          disabled={closingId === trade._id}
                          style={{
                            padding: '6px 14px', borderRadius: 6,
                            border: '1px solid #ff3d3d',
                            background: 'transparent',
                            color: '#ff3d3d',
                            fontWeight: 600, cursor: closingId === trade._id ? 'not-allowed' : 'pointer',
                            fontSize: 12, transition: 'all 0.2s'
                          }}
                        >
                          {closingId === trade._id ? 'Closing...' : 'Close'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Risk Gauge + Win/Loss Streak — 2-col */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16, marginBottom: 16 }}>

        {/* Risk Gauge — #1 */}
        {(() => {
          const limitPct = data?.maxDailyLossPercent || 5;
          const capital = stats.totalCapital || 2000;
          const limitDollar = capital * limitPct / 100;
          const todayPL = data?.todayStats?.pl || 0;
          const usedDollar = Math.abs(Math.min(0, todayPL));
          const usedPct = Math.min(100, limitDollar > 0 ? usedDollar / limitDollar * 100 : 0);
          const gaugeColor = usedPct < 50 ? '#00c853' : usedPct < 80 ? '#f5a623' : '#ff3d3d';
          const remaining = Math.max(0, limitDollar - usedDollar);
          return (
            <div className="section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>Daily Risk Gauge</h3>
                <span style={{
                  fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                  background: gaugeColor + '22', color: gaugeColor, border: `1px solid ${gaugeColor}`
                }}>
                  {usedPct.toFixed(1)}% used
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888', marginBottom: 6 }}>
                <span>Lost today: <strong style={{ color: usedDollar > 0 ? '#ff3d3d' : '#555' }}>${usedDollar.toFixed(2)}</strong></span>
                <span>Limit: <strong style={{ color: '#aaa' }}>${limitDollar.toFixed(2)} ({limitPct}%)</strong></span>
              </div>
              <div style={{ background: '#1a1d27', borderRadius: 8, overflow: 'hidden', height: 14, position: 'relative' }}>
                <div style={{
                  width: `${usedPct}%`, height: '100%',
                  background: `linear-gradient(90deg, #00c853, ${gaugeColor})`,
                  borderRadius: 8, transition: 'width 0.6s ease'
                }} />
                {[25, 50, 75].map(tick => (
                  <div key={tick} style={{
                    position: 'absolute', top: 0, left: `${tick}%`,
                    width: 1, height: '100%', background: '#0d0f1a', opacity: 0.6
                  }} />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12 }}>
                <span style={{ color: '#555' }}>$0</span>
                <span style={{ color: remaining > 0 ? '#00c853' : '#ff3d3d', fontWeight: 600 }}>
                  {remaining > 0 ? `$${remaining.toFixed(2)} remaining` : 'DAILY LIMIT HIT'}
                </span>
                <span style={{ color: '#555' }}>${limitDollar.toFixed(2)}</span>
              </div>
            </div>
          );
        })()}

        {/* Win/Loss Streak + Last 5 — #2 */}
        {(() => {
          const closed = recentTrades.filter(t => t.status === 'closed')
            .sort((a, b) => new Date(b.closedAt) - new Date(a.closedAt));
          const last5 = closed.slice(0, 5);
          let streak = 0, streakType = null;
          for (const t of closed) {
            const isWin = (t.profitLoss || 0) > 0;
            if (streakType === null) streakType = isWin ? 'win' : 'loss';
            if (isWin === (streakType === 'win')) streak++;
            else break;
          }
          const streakColor = streakType === 'win' ? '#00c853' : streakType === 'loss' ? '#ff3d3d' : '#555';
          return (
            <div className="section">
              <h3 style={{ marginBottom: 16 }}>Streak & Recent Form</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                <div style={{
                  background: streakColor + '18', border: `1px solid ${streakColor}`,
                  borderRadius: 10, padding: '10px 20px', textAlign: 'center', minWidth: 90
                }}>
                  <div style={{ fontSize: 32, fontWeight: 800, color: streakColor, lineHeight: 1 }}>{streak}</div>
                  <div style={{ fontSize: 11, color: streakColor, marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
                    {streakType === 'win' ? 'Win Streak' : streakType === 'loss' ? 'Loss Streak' : 'No Trades'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>Last {last5.length} closed trades</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {last5.length === 0
                      ? <span style={{ color: '#444', fontSize: 13 }}>No closed trades yet</span>
                      : last5.map((t, i) => {
                          const w = (t.profitLoss || 0) > 0;
                          return (
                            <div key={i} title={`${t.symbol} ${w ? '+' : ''}$${(t.profitLoss || 0).toFixed(2)}`} style={{
                              width: 32, height: 32, borderRadius: '50%',
                              background: w ? '#0d2a0d' : '#2a1a1a',
                              border: `2px solid ${w ? '#00c853' : '#ff3d3d'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 13, fontWeight: 700, color: w ? '#00c853' : '#ff3d3d',
                              cursor: 'default'
                            }}>
                              {w ? 'W' : 'L'}
                            </div>
                          );
                        })
                    }
                  </div>
                  {last5.length > 0 && (
                    <div style={{ marginTop: 8, fontSize: 11, color: '#666' }}>
                      {last5[0].symbol} — {(last5[0].profitLoss || 0) >= 0 ? '+' : ''}${(last5[0].profitLoss || 0).toFixed(2)} (most recent)
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Open Position Chart — shows when a row is clicked */}
      {selectedTradeId && (() => {
        const trade = data?.openTrades?.find(t => t._id === selectedTradeId);
        if (!trade) return null;
        return (
          <div style={{ marginBottom: 16 }}>
            <PriceChart
              key={trade._id}
              symbol={trade.symbol}
              entryPrice={trade.price}
              market={trade.market}
              type={trade.type}
            />
          </div>
        );
      })()}

      {/* Pre-Market Alerts */}
      {preMarketFlags.length > 0 && (
        <div className="section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <h3 style={{ margin: 0 }}>Pre-Market Alerts</h3>
              <p style={{ color: '#888', fontSize: 12, margin: '4px 0 0' }}>
                Flagged before market open — bot will trade these at 6:30 AM PT if AI confirms
              </p>
            </div>
            <span style={{
              background: '#2a1500', color: '#f5a623',
              border: '1px solid #f5a623',
              borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 600
            }}>
              {preMarketFlags.length} flagged
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
            {preMarketFlags.map(s => (
              <div key={s.symbol} className="card" style={{ padding: '12px 16px', borderLeft: '3px solid #f5a623' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <strong style={{ fontSize: 15 }}>{s.symbol}</strong>
                  <span style={{
                    background: '#2a1500', color: '#f5a623',
                    fontSize: 10, padding: '2px 6px', borderRadius: 10, fontWeight: 700
                  }}>PRE</span>
                </div>
                <div style={{ color: s.changePct >= 0 ? '#00c853' : '#ff3d3d', fontWeight: 700, fontSize: 18, marginTop: 6 }}>
                  {s.changePct >= 0 ? '+' : ''}{s.changePct.toFixed(2)}%
                </div>
                <div style={{ color: '#888', fontSize: 11, marginTop: 4 }}>
                  Vol: {s.volRatio.toFixed(1)}x avg &nbsp;·&nbsp; ${s.price?.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today's Scanner Picks */}
      {scannedStocks.length > 0 && <div className="section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h3 style={{ margin: 0 }}>Today's Scanner Picks</h3>
            <p style={{ color: '#888', fontSize: 12, margin: '4px 0 0' }}>
              Top movers from Tech, Semiconductors &amp; Energy — added to bot watchlist at market open
            </p>
          </div>
          <span style={{
            background: scannedStocks.length > 0 ? '#0d2a0d' : '#1a1d27',
            color: scannedStocks.length > 0 ? '#00c853' : '#555',
            border: `1px solid ${scannedStocks.length > 0 ? '#00c853' : '#2a2d3e'}`,
            borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 600
          }}>
            {scannedStocks.length > 0 ? `${scannedStocks.length} active` : 'Market closed'}
          </span>
        </div>
        {scannedStocks.length === 0 ? (
          <div style={{ color: '#555', fontSize: 13, padding: '16px 0' }}>
            No scanner picks yet — scanner runs automatically when market opens at 9:30 AM PT
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
            {scannedStocks.map(s => (
              <div key={s.symbol} className="card" style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <strong style={{ fontSize: 15 }}>{s.symbol}</strong>
                  <span style={{
                    background: '#1a2a0d', color: '#00c853',
                    fontSize: 10, padding: '2px 6px', borderRadius: 10, fontWeight: 700
                  }}>SCAN</span>
                </div>
                <div style={{ color: s.changePct >= 0 ? '#00c853' : '#ff3d3d', fontWeight: 700, fontSize: 18, marginTop: 6 }}>
                  {s.changePct >= 0 ? '+' : ''}{s.changePct.toFixed(2)}%
                </div>
                <div style={{ color: '#888', fontSize: 11, marginTop: 4 }}>
                  Vol: {s.volRatio.toFixed(1)}x avg &nbsp;·&nbsp; ${s.price?.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>}

      {/* Crypto Scanner Picks + History */}
      {cryptoScanHistory && (() => {
        const totalPicksFound = cryptoScanHistory.runs?.reduce((sum, r) => sum + r.picks.length, 0) || 0;
        const uniqueSymbols   = [...new Set((cryptoScanHistory.runs || []).flatMap(r => r.picks.map(p => p.symbol)))].length;
        return (
          <div className="section">
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0 }}>Crypto Scanner</h3>
                <p style={{ color: '#888', fontSize: 12, margin: '4px 0 0' }}>
                  Top movers on Binance.US · runs every 30m · 2%+ move · $200k+ volume
                </p>
              </div>
              <span style={{
                background: totalPicksFound > 0 ? '#0d2a0d' : '#0d1a2a',
                color: totalPicksFound > 0 ? '#00c853' : '#5865f2',
                border: `1px solid ${totalPicksFound > 0 ? '#00c853' : '#5865f2'}`,
                borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700
              }}>
                {totalPicksFound > 0 ? `+${totalPicksFound} picks (7d)` : 'No picks yet (7d)'}
              </span>
            </div>

            {/* Stats grid */}
            <div className="stats-grid" style={{ marginBottom: 20 }}>
              <div className="card">
                <h2>Runs (7d)</h2>
                <div className="value">{cryptoScanHistory.totalRuns}</div>
              </div>
              <div className="card">
                <h2>Picks Found</h2>
                <div className="value">{totalPicksFound}</div>
              </div>
              <div className="card">
                <h2>Unique Symbols</h2>
                <div className="value">{uniqueSymbols}</div>
              </div>
              <div className="card">
                <h2>Active in Memory</h2>
                <div className="value" style={{ color: scannedCrypto.length > 0 ? '#00c853' : '#555' }}>
                  {scannedCrypto.length > 0 ? scannedCrypto.length : '—'}
                </div>
              </div>
            </div>

            {/* Current in-memory picks or awaiting notice */}
            {scannedCrypto.length > 0 ? (
              <>
                <div style={{ color: '#aaa', fontSize: 12, marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Current Picks (this cycle)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 20 }}>
                  {scannedCrypto.map(c => (
                    <div key={c.symbol} className="card" style={{ padding: '12px 16px', border: c.shortFadeCandidate ? '1px solid #ff6b35' : undefined }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <strong style={{ fontSize: 14 }}>{c.symbol}</strong>
                        <span style={{ background: '#0d1a2a', color: '#5865f2', fontSize: 10, padding: '2px 6px', borderRadius: 10, fontWeight: 700 }}>LIVE</span>
                      </div>
                      {c.shortFadeCandidate && (
                        <div style={{ background: '#2a1500', color: '#ff6b35', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, display: 'inline-block', marginTop: 4 }}>
                          ⚡ SHORT FADE
                        </div>
                      )}
                      <div style={{ color: c.changePct >= 0 ? '#00c853' : '#ff3d3d', fontWeight: 700, fontSize: 18, marginTop: 6 }}>
                        {c.changePct >= 0 ? '+' : ''}{c.changePct.toFixed(2)}%
                      </div>
                      <div style={{ color: '#888', fontSize: 11, marginTop: 4 }}>
                        Vol: ${(c.volume24h / 1_000_000).toFixed(1)}M · ${c.price?.toFixed(4)}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ color: '#555', fontSize: 13, padding: '4px 0 16px', fontStyle: 'italic' }}>
                Awaiting next scan — picks will appear here after the next 2-hour cycle.
              </div>
            )}

            {/* Scan run history from DB */}
            {cryptoScanHistory.runs?.length > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ color: '#aaa', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                    Scan History (last 7 days · {cryptoScanHistory.totalRuns} runs)
                  </div>
                  <button
                    onClick={() => setScanHistoryExpanded(e => !e)}
                    style={{
                      background: 'none', border: '1px solid #2a2d3e', borderRadius: 6,
                      color: '#5865f2', fontSize: 12, padding: '3px 10px', cursor: 'pointer'
                    }}
                  >
                    {scanHistoryExpanded ? 'Collapse' : `Show all ${cryptoScanHistory.runs.length} runs`}
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(scanHistoryExpanded ? cryptoScanHistory.runs : cryptoScanHistory.runs.slice(0, 3)).map((run, i) => {
                    const runTime = new Date(run.runAt);
                    const minsAgo = Math.round((Date.now() - runTime) / 60000);
                    const timeLabel = minsAgo < 60
                      ? `${minsAgo}m ago`
                      : minsAgo < 1440
                        ? `${Math.round(minsAgo / 60)}h ago`
                        : runTime.toLocaleDateString([], { month: 'short', day: 'numeric' });
                    return (
                      <div key={i} className="card" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                        <div style={{ minWidth: 70 }}>
                          <div style={{ color: '#5865f2', fontWeight: 700, fontSize: 13 }}>{timeLabel}</div>
                          <div style={{ color: '#555', fontSize: 11 }}>
                            {runTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <div style={{ minWidth: 60 }}>
                          <div style={{ color: '#aaa', fontSize: 11 }}>Picks</div>
                          <div style={{ color: run.picks.length > 0 ? '#00c853' : '#555', fontWeight: 700, fontSize: 16 }}>
                            {run.picks.length}
                          </div>
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {run.picks.length === 0 ? (
                            <span style={{ color: '#444', fontSize: 12 }}>No qualifying movers</span>
                          ) : run.picks.map(p => (
                            <span key={p.symbol} style={{
                              background: '#0d1a2a', color: '#5865f2',
                              border: '1px solid #1a2a3e',
                              borderRadius: 6, padding: '3px 8px', fontSize: 12
                            }}>
                              {p.symbol} <span style={{ color: p.changePct >= 0 ? '#00c853' : '#ff3d3d' }}>{p.changePct >= 0 ? '+' : ''}{p.changePct}%</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* Scanner Performance */}
      {scannerPerf && (scannerPerf.summary.totalPicks > 0 || scannerPerf.summary.tradedPicks > 0) && (
        <div className="section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <h3 style={{ margin: 0 }}>Scanner Performance</h3>
              <p style={{ color: '#888', fontSize: 12, margin: '4px 0 0' }}>
                How scanner picks have performed as trades — last 30 days
              </p>
            </div>
            <span style={{
              background: (scannerPerf.summary.totalPL || 0) >= 0 ? '#0d2a0d' : '#2a1a1a',
              color: (scannerPerf.summary.totalPL || 0) >= 0 ? '#00c853' : '#ff3d3d',
              border: `1px solid ${(scannerPerf.summary.totalPL || 0) >= 0 ? '#00c853' : '#ff3d3d'}`,
              borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700
            }}>
              {(scannerPerf.summary.totalPL || 0) >= 0 ? '+' : ''}${(scannerPerf.summary.totalPL || 0).toFixed(2)} P/L
            </span>
          </div>

          {/* Summary cards */}
          <div className="stats-grid" style={{ marginBottom: 16 }}>
            <div className="card">
              <h2>Picks Found</h2>
              <div className="value">{scannerPerf.summary.totalPicks}</div>
            </div>
            <div className="card">
              <h2>Trades Taken</h2>
              <div className="value">{scannerPerf.summary.tradedPicks}</div>
            </div>
            <div className="card">
              <h2>Win Rate</h2>
              <div className="value" style={{ color: (scannerPerf.summary.winRate || 0) >= 40 ? '#00c853' : scannerPerf.summary.tradedPicks > 0 ? '#ff3d3d' : '#555' }}>
                {scannerPerf.summary.tradedPicks > 0 ? `${scannerPerf.summary.winRate}%` : '—'}
              </div>
            </div>
            <div className="card">
              <h2>Avg P/L per Trade</h2>
              <div className="value" style={{ color: (scannerPerf.summary.avgPL || 0) >= 0 ? '#00c853' : '#ff3d3d' }}>
                {scannerPerf.summary.tradedPicks > 0
                  ? `${(scannerPerf.summary.avgPL || 0) >= 0 ? '+' : ''}$${(scannerPerf.summary.avgPL || 0).toFixed(2)}`
                  : '—'}
              </div>
            </div>
          </div>

          {/* Per-symbol breakdown */}
          {scannerPerf.bySymbol.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ color: '#aaa', fontSize: 12, marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                By Symbol
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Trades</th>
                    <th>Win Rate</th>
                    <th>Total P/L</th>
                  </tr>
                </thead>
                <tbody>
                  {scannerPerf.bySymbol.map(s => (
                    <tr key={s.symbol}>
                      <td><strong>{s.symbol}</strong></td>
                      <td>{s.trades}</td>
                      <td style={{ color: s.winRate >= 40 ? '#00c853' : '#ff3d3d' }}>{s.winRate}%</td>
                      <td style={{ color: s.totalPL >= 0 ? '#00c853' : '#ff3d3d', fontWeight: 600 }}>
                        {s.totalPL >= 0 ? '+' : ''}${s.totalPL.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* No trades yet message */}
          {scannerPerf.summary.tradedPicks === 0 && scannerPerf.summary.totalPicks > 0 && (
            <p style={{ color: '#555', fontSize: 13 }}>
              Scanner has found {scannerPerf.summary.totalPicks} picks but no trades have been taken from them yet. Trades will appear here once the bot acts on a scanner pick.
            </p>
          )}
        </div>
      )}

      {/* Crypto Market Health */}
      {cryptoHealth && (
        <div className="section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <h3 style={{ margin: 0 }}>Crypto Market Health</h3>
              <p style={{ color: '#888', fontSize: 12, margin: '4px 0 0' }}>
                BTC dominance &amp; funding rates — refreshed every 10 min
              </p>
            </div>
          </div>

          {/* BTC Dominance */}
          {cryptoHealth.btcDominance && (() => {
            const dom = cryptoHealth.btcDominance;
            const domColors = {
              bearish_alts: '#ff3d3d',
              elevated: '#f5a623',
              altseason: '#00c853',
              declining: '#5ac8fa',
              neutral: '#888'
            };
            const domLabels = {
              bearish_alts: 'BTC Dominant — Alts Weak',
              elevated: 'Elevated Dominance',
              altseason: 'Alt Season',
              declining: 'Dominance Falling',
              neutral: 'Neutral'
            };
            const color = domColors[dom.signal] || '#888';
            return (
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: '#aaa', fontSize: 12, marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                  BTC Dominance
                </div>
                <div className="card" style={{ padding: '14px 20px', borderLeft: `3px solid ${color}`, display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ color: '#aaa', fontSize: 11, marginBottom: 2 }}>Dominance</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: color }}>{dom.value}%</div>
                  </div>
                  <div>
                    <div style={{ color: '#aaa', fontSize: 11, marginBottom: 2 }}>24h Change</div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: dom.change24h >= 0 ? '#00c853' : '#ff3d3d' }}>
                      {dom.change24h >= 0 ? '+' : ''}{dom.change24h}%
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#aaa', fontSize: 11, marginBottom: 4 }}>Signal</div>
                    <span style={{
                      background: color + '22', color: color,
                      border: `1px solid ${color}`,
                      borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700
                    }}>
                      {domLabels[dom.signal] || dom.signal}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Funding Rates */}
          {cryptoHealth.fundingRates && Object.keys(cryptoHealth.fundingRates).length > 0 && (
            <div>
              <div style={{ color: '#aaa', fontSize: 12, marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                Funding Rates
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                {Object.entries(cryptoHealth.fundingRates).map(([sym, fr]) => {
                  const frColors = {
                    overheated_longs: '#ff3d3d',
                    elevated_longs: '#f5a623',
                    overheated_shorts: '#00c853',
                    elevated_shorts: '#5ac8fa',
                    neutral: '#888'
                  };
                  const frLabels = {
                    overheated_longs: 'Longs Overheated',
                    elevated_longs: 'Elevated Longs',
                    overheated_shorts: 'Shorts Overheated',
                    elevated_shorts: 'Elevated Shorts',
                    neutral: 'Balanced'
                  };
                  const color = frColors[fr.signal] || '#888';
                  const ticker = sym.replace('/USDT', '');
                  return (
                    <div key={sym} className="card" style={{ padding: '12px 16px', borderLeft: `3px solid ${color}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <strong style={{ fontSize: 14 }}>{ticker}</strong>
                        <span style={{ color: '#555', fontSize: 10 }}>USDT</span>
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 700, marginTop: 6, color: fr.rate > 0 ? '#f5a623' : fr.rate < 0 ? '#5ac8fa' : '#888' }}>
                        {fr.rate > 0 ? '+' : ''}{fr.rate.toFixed(4)}%
                      </div>
                      <div style={{
                        marginTop: 6,
                        background: color + '22', color: color,
                        borderRadius: 10, padding: '2px 8px', fontSize: 10, fontWeight: 700,
                        display: 'inline-block'
                      }}>
                        {frLabels[fr.signal] || fr.signal}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* All-Time Stats + Account Balance — 2-col */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 16 }}>
        <div>
          <div className="section" style={{ paddingBottom: 0 }}>
            <h3>All-Time Performance</h3>
          </div>
          <div className="stats-grid" style={{ marginTop: 8 }}>
            <div className="card">
              <h2>Total Trades</h2>
              <div className="value">{stats.totalTrades || 0}</div>
            </div>
            <div className="card">
              <h2>Win Rate</h2>
              <div className="value" style={{ color: (parseFloat(stats.winRate) || 0) >= 50 ? '#00c853' : '#ff3d3d' }}>
                {stats.winRate || 0}%
              </div>
            </div>
            <div className="card">
              <h2>Open Positions</h2>
              <div className="value">{stats.openPositions || 0}</div>
            </div>
          </div>
          {/* All-time cumulative P/L chart — #6 */}
          {(data?.plHistory?.length > 1) && (() => {
            const plData = data.plHistory;
            const final = plData[plData.length - 1]?.pl || 0;
            const lineColor = final >= 0 ? '#00c853' : '#ff3d3d';
            return (
              <div className="card" style={{ marginTop: 8, padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h2 style={{ margin: 0 }}>Cumulative P/L</h2>
                  <span style={{ fontWeight: 700, color: lineColor, fontSize: 18 }}>
                    {final >= 0 ? '+' : ''}${final.toFixed(2)}
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={120}>
                  <LineChart data={plData}>
                    <ReferenceLine y={0} stroke="#333" strokeDasharray="3 3" />
                    <XAxis dataKey="date" hide />
                    <YAxis hide domain={['auto', 'auto']} />
                    <Tooltip
                      contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3e', borderRadius: 6, fontSize: 11 }}
                      formatter={(v) => [`${v >= 0 ? '+' : ''}$${v.toFixed(2)}`, 'Cumulative P/L']}
                    />
                    <Line type="monotone" dataKey="pl" stroke={lineColor} strokeWidth={2} dot={false} activeDot={{ r: 3, fill: lineColor }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            );
          })()}
        </div>

        {/* Max Drawdown + Best/Worst Trade — #10 */}
        <div className="section">
          <h3>Risk & Extremes</h3>
          <div className="stats-grid" style={{ marginBottom: 16 }}>
            <div className="card">
              <h2>Max Drawdown</h2>
              <div className="value" style={{ color: (data?.maxDrawdown || 0) > 0 ? '#ff3d3d' : '#888' }}>
                -${(data?.maxDrawdown || 0).toFixed(2)}
              </div>
            </div>
            <div className="card">
              <h2>Profit Factor</h2>
              {(() => {
                const wins = recentTrades.filter(t => t.status === 'closed' && (t.profitLoss || 0) > 0);
                const losses = recentTrades.filter(t => t.status === 'closed' && (t.profitLoss || 0) < 0);
                const grossWin = wins.reduce((s, t) => s + t.profitLoss, 0);
                const grossLoss = Math.abs(losses.reduce((s, t) => s + t.profitLoss, 0));
                const pf = grossLoss > 0 ? (grossWin / grossLoss).toFixed(2) : grossWin > 0 ? '∞' : '—';
                const pfNum = parseFloat(pf);
                return (
                  <div className="value" style={{ color: pfNum >= 1.5 ? '#00c853' : pfNum >= 1 ? '#f5a623' : '#ff3d3d' }}>
                    {pf}
                  </div>
                );
              })()}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data?.bestTrade && (
              <div style={{ background: '#0d2a0d', border: '1px solid #00c853', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#00c853', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Best Trade</div>
                  <div style={{ fontWeight: 700, marginTop: 2 }}>{data.bestTrade.symbol} <span style={{ color: '#888', fontWeight: 400, fontSize: 12 }}>{data.bestTrade.type}</span></div>
                  <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{formatDateTime(data.bestTrade.closedAt)}</div>
                </div>
                <div style={{ color: '#00c853', fontWeight: 800, fontSize: 20 }}>
                  +${(data.bestTrade.profitLoss || 0).toFixed(2)}
                </div>
              </div>
            )}
            {data?.worstTrade && (
              <div style={{ background: '#2a1a1a', border: '1px solid #ff3d3d', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#ff3d3d', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Worst Trade</div>
                  <div style={{ fontWeight: 700, marginTop: 2 }}>{data.worstTrade.symbol} <span style={{ color: '#888', fontWeight: 400, fontSize: 12 }}>{data.worstTrade.type}</span></div>
                  <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{formatDateTime(data.worstTrade.closedAt)}</div>
                </div>
                <div style={{ color: '#ff3d3d', fontWeight: 800, fontSize: 20 }}>
                  ${(data.worstTrade.profitLoss || 0).toFixed(2)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Account Balance */}
        <div className="section">
          <h3>Account Balance</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 16 }}>
            <div className="card">
              <h2>Total Capital</h2>
              <div className="value" style={{ color: '#5865f2' }}>${stats.totalCapital || 1000}</div>
            </div>
            <div className="card">
              <h2>In Trades</h2>
              <div className="value" style={{ color: '#f5a623' }}>${(stats.capitalInTrades || 0).toFixed(2)}</div>
            </div>
            <div className="card">
              <h2>Available</h2>
              <div className="value" style={{ color: '#00c853' }}>${(stats.availableCapital || 0).toFixed(2)}</div>
            </div>
          </div>
          <div style={{ background: '#1a1d27', borderRadius: 8, overflow: 'hidden', height: 12 }}>
            <div style={{
              width: `${capitalPct}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #5865f2, #f5a623)',
              borderRadius: 8,
              transition: 'width 0.5s ease'
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12, color: '#666' }}>
            <span>{capitalPct}% deployed in trades</span>
            <span>{100 - capitalPct}% available</span>
          </div>
        </div>
      </div>


      {/* P/L by Symbol + Active Cooldowns — 2-col */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16, marginBottom: 16 }}>

        {/* P/L by Symbol — collapsible */}
        {data?.plBySymbol?.length > 0 && (
          <div className="section" style={{ margin: 0 }}>
            <div
              onClick={() => setPlBySymbolExpanded(e => !e)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
            >
              <h3 style={{ margin: 0 }}>P/L by Symbol</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, color: '#888' }}>{data.plBySymbol.length} symbols</span>
                <span style={{ color: '#5865f2', fontSize: 14 }}>{plBySymbolExpanded ? '▲' : '▼'}</span>
              </div>
            </div>
            {plBySymbolExpanded && (
              <table style={{ marginTop: 12 }}>
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Trades</th>
                    <th>Win %</th>
                    <th>Total P/L</th>
                  </tr>
                </thead>
                <tbody>
                  {data.plBySymbol.map(s => (
                    <tr key={s.symbol}>
                      <td><strong>{s.symbol}</strong></td>
                      <td style={{ color: '#888' }}>{s.trades}</td>
                      <td style={{ color: s.winRate >= 50 ? '#00c853' : s.winRate >= 35 ? '#f5a623' : '#ff3d3d' }}>
                        {s.winRate}%
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: s.totalPL > 0 ? '#00c853' : s.totalPL < 0 ? '#ff3d3d' : '#888' }}>
                          {s.totalPL > 0 ? '+' : ''}${s.totalPL.toFixed(2)}
                        </span>
                        <div style={{
                          height: 3, borderRadius: 2, marginTop: 4,
                          width: `${Math.min(100, Math.abs(s.totalPL) / Math.max(...data.plBySymbol.map(x => Math.abs(x.totalPL))) * 100)}%`,
                          background: s.totalPL >= 0 ? '#00c853' : '#ff3d3d', opacity: 0.6
                        }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Active Cooldowns — collapsible */}
        <div className="section" style={{ margin: 0 }}>
          <div
            onClick={() => setCooldownsExpanded(e => !e)}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
          >
            <h3 style={{ margin: 0 }}>Active Cooldowns</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                background: (data?.activeCooldowns?.length || 0) > 0 ? '#2a1500' : '#1a1d27',
                color: (data?.activeCooldowns?.length || 0) > 0 ? '#f5a623' : '#555',
                border: `1px solid ${(data?.activeCooldowns?.length || 0) > 0 ? '#f5a623' : '#2a2d3e'}`
              }}>
                {data?.activeCooldowns?.length || 0} locked
              </span>
              <span style={{ color: '#5865f2', fontSize: 14 }}>{cooldownsExpanded ? '▲' : '▼'}</span>
            </div>
          </div>
          {cooldownsExpanded && (
            <div style={{ marginTop: 12 }}>
              {!data?.activeCooldowns?.length ? (
                <div style={{ color: '#444', fontSize: 13, padding: '8px 0', fontStyle: 'italic' }}>
                  No cooldowns active — bot can trade all symbols
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {data.activeCooldowns.map(cd => {
                    const msLeft = cd.expiresAt - Date.now();
                    const hLeft = Math.floor(msLeft / 3600000);
                    const mLeft = Math.floor((msLeft % 3600000) / 60000);
                    const urgency = msLeft < 30 * 60000 ? '#ff3d3d' : msLeft < 60 * 60000 ? '#f5a623' : '#888';
                    return (
                      <div key={cd.symbol} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        background: '#1a1d27', borderRadius: 8, padding: '10px 14px',
                        borderLeft: `3px solid ${urgency}`
                      }}>
                        <div>
                          <strong style={{ fontSize: 14 }}>{cd.symbol}</strong>
                          <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>re-entry blocked</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: urgency, fontWeight: 700, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
                            {hLeft > 0 ? `${hLeft}h ` : ''}{mLeft}m
                          </div>
                          <div style={{ fontSize: 10, color: '#555' }}>remaining</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Recent Signals */}
      <div className="section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Latest AI Signals</h3>
          <Link to="/signals" style={{ color: '#5865f2', fontSize: 13, textDecoration: 'none' }}>View All →</Link>
        </div>
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Decision</th>
              <th>Confidence</th>
              <th>Sentiment</th>
              <th>Result</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {recentSignals.length === 0 ? (
              <tr><td colSpan={6} style={{ color: '#666', textAlign: 'center' }}>No signals yet — start the bot</td></tr>
            ) : recentSignals.map((s) => {
              const isActionable = s.decision === 'BUY' || s.decision === 'SHORT';
              const traded = isActionable && recentTrades.some(t =>
                t.symbol === s.symbol &&
                Math.abs(new Date(t.executedAt) - new Date(s.createdAt)) < 10 * 60 * 1000
              );
              return (
                <tr key={s._id}>
                  <td><strong>{s.symbol}</strong></td>
                  <td><span className={`badge ${s.decision?.toLowerCase()}`}>{s.decision}</span></td>
                  <td>{s.confidence}%</td>
                  <td style={{ color: s.newsSentiment === 'positive' ? '#00c853' : s.newsSentiment === 'negative' ? '#ff3d3d' : '#888' }}>
                    {s.newsSentiment || '—'}
                  </td>
                  <td>
                    {isActionable ? (
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                        background: traded ? '#0d2a0d' : '#1a1d27',
                        color: traded ? '#00c853' : '#555',
                        border: `1px solid ${traded ? '#00c853' : '#2a2d3e'}`
                      }}>
                        {traded ? 'Traded' : 'Skipped'}
                      </span>
                    ) : (
                      <span style={{ color: '#444', fontSize: 11 }}>—</span>
                    )}
                  </td>
                  <td style={{ color: '#666', fontSize: 12 }}>{formatDateTime(s.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Liquidity Heatmap */}
      <div className="section">
        <LiquidityHeatmap />
      </div>

      {/* Close Position Modal */}
      {closeModal && (() => {
        const trade = closeModal;
        const cur = currentPrices[trade.symbol];
        const isShort = trade.type === 'SHORT';
        const pnlDollar = cur && trade.price
          ? (cur - trade.price) / trade.price * (isShort ? -1 : 1) * (trade.amount || 0) * (trade.leverage || 1)
          : null;
        const heldMs = Date.now() - new Date(trade.executedAt).getTime();
        return (
          <div
            onClick={() => setCloseModal(null)}
            style={{
              position: 'fixed', inset: 0, zIndex: 1000,
              background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: '#1a1d27', border: '1px solid #2a2d3e', borderRadius: 12,
                padding: '28px 32px', minWidth: 340, maxWidth: 440, width: '90%'
              }}
            >
              <h3 style={{ margin: '0 0 20px', fontSize: 18, color: '#fff' }}>Close Position?</h3>
              {tradeMode === 'live' && (
                <div style={{
                  background: '#2a1500', border: '1px solid #f5a623', borderRadius: 8,
                  padding: '10px 14px', marginBottom: 20, fontSize: 13, color: '#f5a623'
                }}>
                  ⚠️ Live mode — this will submit a real market order to your broker.
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#888', fontSize: 13 }}>Symbol</span>
                  <strong style={{ fontSize: 15 }}>{trade.symbol}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#888', fontSize: 13 }}>Direction</span>
                  <span className={`badge ${trade.type?.toLowerCase()}`}>{trade.type}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#888', fontSize: 13 }}>Entry Price</span>
                  <span style={{ color: '#aaa' }}>${trade.price?.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#888', fontSize: 13 }}>Amount</span>
                  <span style={{ color: '#aaa' }}>${trade.amount?.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#888', fontSize: 13 }}>Time Held</span>
                  <span style={{ color: '#aaa' }}>{formatDuration(heldMs)}</span>
                </div>
                {pnlDollar !== null && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#888', fontSize: 13 }}>Unrealized P/L</span>
                    <span style={{ fontWeight: 700, fontSize: 15, color: pnlDollar >= 0 ? '#00c853' : '#ff3d3d' }}>
                      {pnlDollar >= 0 ? '+' : ''}${pnlDollar.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => setCloseModal(null)}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 8,
                    border: '1px solid #2a2d3e', background: 'transparent',
                    color: '#888', fontWeight: 600, cursor: 'pointer', fontSize: 14
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={executeClose}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 8,
                    border: '1px solid #ff3d3d', background: '#2a1a1a',
                    color: '#ff3d3d', fontWeight: 700, cursor: 'pointer', fontSize: 14
                  }}
                >
                  Yes, Close Position
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Close All Modal */}
      {closeAllModal && (() => {
        const trades = data?.openTrades || [];
        const totalPnl = trades.reduce((sum, trade) => {
          const cur = currentPrices[trade.symbol];
          if (!cur || !trade.price) return sum;
          const isShort = trade.type === 'SHORT';
          return sum + (cur - trade.price) / trade.price * (isShort ? -1 : 1) * (trade.amount || 0) * (trade.leverage || 1);
        }, 0);
        return (
          <div
            onClick={() => setCloseAllModal(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 1000,
              background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: '#1a1d27', border: '1px solid #2a2d3e', borderRadius: 12,
                padding: '28px 32px', minWidth: 360, maxWidth: 480, width: '90%'
              }}
            >
              <h3 style={{ margin: '0 0 20px', fontSize: 18, color: '#fff' }}>Close All Positions?</h3>
              {tradeMode === 'live' && (
                <div style={{
                  background: '#2a1500', border: '1px solid #f5a623', borderRadius: 8,
                  padding: '10px 14px', marginBottom: 20, fontSize: 13, color: '#f5a623'
                }}>
                  ⚠️ Live mode — this will submit real market orders for all {trades.length} position{trades.length !== 1 ? 's' : ''}.
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16, maxHeight: 220, overflowY: 'auto' }}>
                {trades.map(trade => {
                  const cur = currentPrices[trade.symbol];
                  const isShort = trade.type === 'SHORT';
                  const pnlDollar = cur && trade.price
                    ? (cur - trade.price) / trade.price * (isShort ? -1 : 1) * (trade.amount || 0) * (trade.leverage || 1)
                    : null;
                  return (
                    <div key={trade._id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: '#0d0f1a', borderRadius: 8, padding: '8px 14px'
                    }}>
                      <div>
                        <strong style={{ fontSize: 14 }}>{trade.symbol}</strong>
                        <span style={{ marginLeft: 8, fontSize: 11, color: '#888' }}>{trade.type}</span>
                      </div>
                      {pnlDollar !== null ? (
                        <span style={{ fontWeight: 700, color: pnlDollar >= 0 ? '#00c853' : '#ff3d3d', fontSize: 13 }}>
                          {pnlDollar >= 0 ? '+' : ''}${pnlDollar.toFixed(2)}
                        </span>
                      ) : (
                        <span style={{ color: '#555', fontSize: 12 }}>—</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{
                display: 'flex', justifyContent: 'space-between', padding: '10px 14px',
                background: '#0d0f1a', borderRadius: 8, marginBottom: 24
              }}>
                <span style={{ color: '#888', fontSize: 13 }}>Total Unrealized P/L</span>
                <span style={{ fontWeight: 700, fontSize: 15, color: totalPnl >= 0 ? '#00c853' : '#ff3d3d' }}>
                  {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => setCloseAllModal(false)}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 8,
                    border: '1px solid #2a2d3e', background: 'transparent',
                    color: '#888', fontWeight: 600, cursor: 'pointer', fontSize: 14
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={executeCloseAll}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 8,
                    border: '1px solid #ff3d3d', background: '#2a1a1a',
                    color: '#ff3d3d', fontWeight: 700, cursor: 'pointer', fontSize: 14
                  }}
                >
                  Yes, Close All
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Recent Trades */}
      <div className="section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Recent Trades</h3>
          <Link to="/trades" style={{ color: '#5865f2', fontSize: 13, textDecoration: 'none' }}>View All →</Link>
        </div>
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Type</th>
              <th>Market</th>
              <th>Price</th>
              <th>Amount</th>
              <th>Leverage</th>
              <th>Status</th>
              <th>P/L</th>
              <th>Close Reason</th>
            </tr>
          </thead>
          <tbody>
            {recentTrades.length === 0 ? (
              <tr><td colSpan={9} style={{ color: '#666', textAlign: 'center' }}>No trades yet</td></tr>
            ) : recentTrades.map((t) => (
              <tr key={t._id}>
                <td><strong>{t.symbol}</strong></td>
                <td>
                  <span className={`badge ${t.type?.toLowerCase()}`}>{t.type}</span>
                  <span style={{ fontSize: 10, marginLeft: 6, color: t.type === 'SHORT' ? '#ff6b35' : '#00c853' }}>
                    {t.type === 'SHORT' ? '↓' : '↑'}
                  </span>
                </td>
                <td style={{ color: '#888' }}>{t.market}</td>
                <td>${t.price?.toFixed(2)}</td>
                <td>${t.amount?.toFixed(2)}</td>
                <td style={{ color: (t.leverage || 1) > 1 ? '#f5a623' : '#555', fontWeight: (t.leverage || 1) > 1 ? 700 : 400 }}>
                  {t.leverage || 1}x
                </td>
                <td><span className={`badge ${t.status}`}>{t.status}</span></td>
                <td style={{ color: t.status === 'open' ? '#888' : (t.profitLoss || 0) > 0 ? '#00c853' : (t.profitLoss || 0) < 0 ? '#ff3d3d' : '#888' }}>
                  {t.status === 'open' ? '—' : (
                    <>
                      <span className={(t.profitLoss || 0) >= 0 ? 'pl-arrow-up' : 'pl-arrow-down'}>
                        {(t.profitLoss || 0) >= 0 ? '↑' : '↓'}
                      </span>
                      {(t.profitLoss || 0) > 0 ? '+' : ''}${(t.profitLoss || 0).toFixed(2)}
                    </>
                  )}
                </td>
                <td style={{ fontSize: 12, maxWidth: 200 }}>
                  {t.closeReason ? (
                    <>
                      {t.closeReason.includes('candle') && (
                        <span style={{
                          display: 'inline-block',
                          background: '#1f1800', color: '#f5c518',
                          border: '1px solid #f5c518',
                          borderRadius: 8, padding: '1px 6px',
                          fontSize: 10, fontWeight: 700,
                          marginRight: 5, verticalAlign: 'middle'
                        }}>⚡ CANDLE</span>
                      )}
                      <span style={{ color: '#666' }}>{t.closeReason}</span>
                    </>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <AIChat />
    </div>
  );
}

export default Dashboard;
