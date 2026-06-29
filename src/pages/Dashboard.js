import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useApp } from '../context/AppContext';
import PriceChart from '../components/PriceChart';
import MarketStatus from '../components/MarketStatus';
import LiquidityHeatmap from '../components/LiquidityHeatmap';
import AIChat from '../components/AIChat';

const API = process.env.REACT_APP_API_URL || 'https://trading-bot-backend-production-9a53.up.railway.app/api';

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
  const { botStatus, setBotStatus, tradeMode, liveSignals, liveTrades, livePrices, scannerCryptoPicks, setScannerCryptoPicks } = useApp();
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(false);
  const [running, setRunning]     = useState(false);
  const [toggling, setToggling]   = useState(false);
  const [closingId, setClosingId] = useState(null);
  const [closingAll, setClosingAll] = useState(false);
  const [selectedTradeId, setSelectedTradeId] = useState(null);
  const [selectedConditionalSymbol, setSelectedConditionalSymbol] = useState(null);
  const [closeModal, setCloseModal] = useState(null);
  const [closeAllModal, setCloseAllModal] = useState(false);
  const [actionError, setActionError] = useState('');
  const [refreshing, setRefreshing]   = useState(false);
  const [sendingReport, setSendingReport] = useState(false);
  const [countdown, setCountdown] = useState('');
  const [nextRunTime, setNextRunTime] = useState(null);
  const [currentPrices, setCurrentPrices] = useState({});
  const [priceUpdatedAt, setPriceUpdatedAt] = useState({});
  const [scannedStocks, setScannedStocks]           = useState([]);
  const [preMarketFlags, setPreMarketFlags]         = useState([]);
  const [conditionalOrders, setConditionalOrders]   = useState([]);
  const [cryptoScannerLastAt, setCryptoScannerLastAt] = useState(null);
  const [expandedPickId, setExpandedPickId]         = useState(null);
  const [scanningNow, setScanningNow]               = useState(false);
  const [scanningStocks, setScanningStocks]         = useState(false);
  const [cryptoHealth, setCryptoHealth]         = useState(null);
  const [plBySymbolExpanded, setPlBySymbolExpanded] = useState(false);
  const [cooldownsExpanded, setCooldownsExpanded] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const openTradesRef = useRef([]);
  const runNowTimerRef = useRef(null);
  const binanceWsRef = useRef(null);
  const binanceSymbolsKeyRef = useRef('');
  const [wsConnected, setWsConnected] = useState(false);

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
        const [scannedRes, preRes] = await Promise.all([
          axios.get(`${API}/bot/scanned-stocks`),
          axios.get(`${API}/bot/pre-market-flags`)
        ]);
        setScannedStocks(scannedRes.data || []);
        setPreMarketFlags(preRes.data || []);
      } catch { setScannedStocks([]); setPreMarketFlags([]); }
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
    async function fetchConditionalOrders() {
      try {
        const res = await axios.get(`${API}/bot/conditional-orders`);
        setConditionalOrders(res.data || []);
      } catch { /* keep previous */ }
    }
    fetchConditionalOrders();
    const interval = setInterval(fetchConditionalOrders, 15000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    async function fetchCryptoPicks() {
      try {
        const res = await axios.get(`${API}/scanner/crypto-picks`);
        const live = res.data?.live || [];
        if (live.length > 0) {
          setScannerCryptoPicks(live);
          setCryptoScannerLastAt(res.data?.recent?.[0]?.createdAt || null);
          setScanningNow(false);
        } else if (res.data?.recent?.length > 0) {
          // No live picks in memory (server restarted) — show most recent DB batch
          const latest = res.data.recent[0].createdAt;
          const latestBatch = res.data.recent.filter(p => {
            const diff = Math.abs(new Date(p.createdAt) - new Date(latest));
            return diff < 5 * 60 * 1000; // within 5 min of most recent
          });
          setScannerCryptoPicks(latestBatch);
          setCryptoScannerLastAt(latest);
        }
      } catch { /* keep previous */ }
    }
    fetchCryptoPicks();
    const interval = setInterval(fetchCryptoPicks, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function triggerCryptoScan() {
    if (scanningNow) return;
    setScanningNow(true);
    try {
      await axios.post(`${API}/scanner/crypto-scan-now`);
    } catch { /* backend returns 200 immediately even if scan takes time */ }
    // Keep spinner for ~60s — scan takes ~30-60s, WS update arrives when done
    setTimeout(() => setScanningNow(false), 60000);
  }

  async function triggerStockScan() {
    if (scanningStocks) return;
    setScanningStocks(true);
    try {
      await axios.post(`${API}/scanner/stock-scan-now`);
    } catch { /* backend returns 200 immediately */ }
    // Poll every 3s for up to 90s waiting for results
    const start = Date.now();
    const poll = setInterval(async () => {
      try {
        const res = await axios.get(`${API}/bot/scanned-stocks`);
        const stocks = res.data || [];
        if (stocks.length > 0) {
          setScannedStocks(stocks);
          setScanningStocks(false);
          clearInterval(poll);
        }
      } catch { /* ignore */ }
      if (Date.now() - start > 90000) {
        setScanningStocks(false);
        clearInterval(poll);
      }
    }, 3000);
  }

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

  // Direct Binance.US WebSocket — fastest possible crypto prices (fires on every trade)
  useEffect(() => {
    const cryptoTrades = (data?.openTrades || []).filter(t => t.market === 'crypto');
    const symbolsKey = cryptoTrades.map(t => t.symbol).sort().join(',');
    if (symbolsKey === binanceSymbolsKeyRef.current && binanceWsRef.current?.readyState === WebSocket.OPEN) return;
    binanceSymbolsKeyRef.current = symbolsKey;

    if (binanceWsRef.current) { binanceWsRef.current.close(1000); binanceWsRef.current = null; }
    setWsConnected(false);
    if (!cryptoTrades.length) return;

    const lastUpdate = {};
    function connect() {
      const streams = cryptoTrades.map(t => t.symbol.replace('/', '').toLowerCase() + '@aggTrade').join('/');
      const ws = new WebSocket(`wss://stream.binance.us:9443/stream?streams=${streams}`);
      binanceWsRef.current = ws;

      ws.onopen = () => setWsConnected(true);
      ws.onerror = () => setWsConnected(false);
      ws.onclose = (e) => {
        setWsConnected(false);
        if (e.code !== 1000 && binanceWsRef.current === ws && binanceSymbolsKeyRef.current === symbolsKey) {
          setTimeout(connect, 2000);
        }
      };
      ws.onmessage = (event) => {
        try {
          const trade = JSON.parse(event.data)?.data;
          if (!trade || trade.e !== 'aggTrade') return;
          const price = parseFloat(trade.p);
          if (!isFinite(price)) return;
          const ourTrade = cryptoTrades.find(t => t.symbol.replace('/', '') === trade.s);
          if (!ourTrade) return;
          // Throttle React updates to 50ms — snappy visually without overloading rendering
          const now = Date.now();
          if (lastUpdate[ourTrade.symbol] && now - lastUpdate[ourTrade.symbol] < 50) return;
          lastUpdate[ourTrade.symbol] = now;
          setCurrentPrices(prev => ({ ...prev, [ourTrade.symbol]: price }));
          setPriceUpdatedAt(prev => ({ ...prev, [ourTrade.symbol]: now }));
        } catch {}
      };
    }
    connect();

    return () => {
      binanceSymbolsKeyRef.current = '';
      if (binanceWsRef.current) { binanceWsRef.current.close(1000); binanceWsRef.current = null; }
      setWsConnected(false);
    };
  }, [data?.openTrades]); // eslint-disable-line react-hooks/exhaustive-deps

  // Backend PRICE_UPDATE as fallback when direct WS is down
  useEffect(() => {
    if (!Object.keys(livePrices).length) return;
    if (binanceWsRef.current?.readyState === WebSocket.OPEN) return;
    setCurrentPrices(prev => {
      const next = { ...prev };
      Object.entries(livePrices).forEach(([sym, { price }]) => { next[sym] = price; });
      return next;
    });
    setPriceUpdatedAt(prev => {
      const next = { ...prev };
      Object.entries(livePrices).forEach(([sym, { ts }]) => { next[sym] = ts; });
      return next;
    });
  }, [livePrices]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stock prices: refresh every 3s
  useEffect(() => {
    if (!data?.openTrades?.length) return;
    const interval = setInterval(() => fetchStockPrices(openTradesRef.current), 1500);
    return () => clearInterval(interval);
  }, [data?.openTrades?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Crypto price poll — always runs so symbols not on Binance.US still get live prices.
  // At 3s when WS is connected (WS already handles Binance.US coins at 50ms),
  // at 1s when WS is down (sole price source).
  useEffect(() => {
    if (!data?.openTrades?.length) return;
    const interval = setInterval(
      () => fetchCryptoPrices(openTradesRef.current),
      wsConnected ? 3000 : 1000
    );
    return () => clearInterval(interval);
  }, [data?.openTrades?.length, wsConnected]); // eslint-disable-line react-hooks/exhaustive-deps

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
                    <th>Live Price</th>
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
                        {trade.chatOwned && (
                          <span title="Chat-owned — bot SL/TP disabled" style={{ marginLeft: 6, fontSize: 10, background: '#1a1d2e', border: '1px solid #5865f2', color: '#5865f2', borderRadius: 4, padding: '1px 5px', fontWeight: 700 }}>CHAT</span>
                        )}
                        {selectedTradeId === trade._id && (
                          <span style={{ marginLeft: 6, fontSize: 8, color: '#5865f2' }}>●</span>
                        )}
                      </td>
                      <td><span className={`badge ${trade.type?.toLowerCase()}`}>{trade.type}</span></td>
                      <td>{(() => { const p = trade.price; if (!p) return '—'; const d = trade.market === 'crypto' && p < 1 ? 5 : p < 100 ? 4 : 2; return `$${p.toFixed(d)}`; })()}</td>
                      <td>{(() => {
                        const cur = currentPrices[trade.symbol];
                        const justUpdated = priceUpdatedAt[trade.symbol] && Date.now() - priceUpdatedAt[trade.symbol] < 15000;
                        if (!cur) return <span style={{ color: '#555' }}>—</span>;
                        const isShort = trade.type === 'SHORT';
                        const chgPct = (cur - trade.price) / trade.price * 100 * (isShort ? -1 : 1);
                        const color = chgPct > 0 ? '#00c853' : chgPct < 0 ? '#ff3d3d' : '#aaa';
                        const decimals = trade.market === 'crypto' && cur < 1 ? 5 : cur < 100 ? 4 : 2;
                        return (
                          <span style={{ color, fontWeight: 700, fontSize: 13 }}>
                            {justUpdated && <span style={{
                              display: 'inline-block', width: 6, height: 6,
                              borderRadius: '50%', background: color,
                              marginRight: 5, verticalAlign: 'middle',
                              animation: 'price-pulse 1.2s ease-in-out infinite'
                            }} />}
                            ${cur.toFixed(decimals)}
                            <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.75 }}>
                              ({chgPct >= 0 ? '+' : ''}{chgPct.toFixed(2)}%)
                            </span>
                          </span>
                        );
                      })()}</td>
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
              livePrice={currentPrices[trade.symbol] || null}
            />
          </div>
        );
      })()}

      {/* Crypto Scanner Picks — always visible so Scan Now button is accessible */}
      <div className="section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <h3 style={{ margin: 0 }}>Crypto Scanner</h3>
              <p style={{ color: '#888', fontSize: 12, margin: '4px 0 0' }}>
                AI-ranked opportunities across 250+ coins · refreshes every hour · 24/7
                {cryptoScannerLastAt && (
                  <span style={{ marginLeft: 8, color: '#555' }}>
                    · Last scan: {new Date(cryptoScannerLastAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={triggerCryptoScan}
                disabled={scanningNow}
                style={{
                  background: scanningNow ? '#1a1d27' : '#0a1a2e',
                  color: scanningNow ? '#555' : '#00b4d8',
                  border: '1px solid ' + (scanningNow ? '#333' : '#00b4d8'),
                  borderRadius: 8, padding: '5px 14px', fontSize: 12,
                  fontWeight: 600, cursor: scanningNow ? 'default' : 'pointer'
                }}
              >
                {scanningNow ? '⏳ Scanning...' : '⚡ Scan Now'}
              </button>
              <span style={{
                background: '#0a1a2e', color: '#00b4d8',
                border: '1px solid #00b4d8',
                borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700
              }}>
                {scannerCryptoPicks.length} live picks
              </span>
            </div>
          </div>

          {scanningNow && scannerCryptoPicks.length === 0 && (
            <div style={{ color: '#555', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
              Scanning 250+ coins — AI is analyzing and ranking opportunities. This takes ~30-60 seconds...
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {scannerCryptoPicks.map((pick, idx) => {
              const isLong     = pick.direction === 'LONG';
              const dirColor   = isLong ? '#00c853' : '#ff6b35';
              const dirBg      = isLong ? '#0d2a0d' : '#2a1500';
              const expanded   = expandedPickId === idx;
              const convColor  = pick.conviction >= 80 ? '#00c853' : pick.conviction >= 65 ? '#f5a623' : '#aaa';

              return (
                <div key={idx} className="card" style={{
                  padding: '14px 16px',
                  borderLeft: `3px solid ${dirColor}`,
                  cursor: 'pointer',
                  transition: 'background 0.15s'
                }} onClick={() => setExpandedPickId(expanded ? null : idx)}>

                  {/* Header row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <strong style={{ fontSize: 15 }}>{pick.symbol}</strong>
                      <span style={{
                        background: dirBg, color: dirColor,
                        border: `1px solid ${dirColor}`,
                        borderRadius: 4, padding: '2px 7px', fontSize: 10, fontWeight: 700
                      }}>{pick.direction}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: convColor, fontSize: 13, fontWeight: 700 }}>
                        {pick.conviction}%
                      </span>
                      <span style={{ color: '#444', fontSize: 11 }}>{expanded ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {/* Price + momentum row */}
                  <div style={{ display: 'flex', gap: 16, marginTop: 8, alignItems: 'center' }}>
                    <span style={{ color: '#ccc', fontSize: 13 }}>
                      ${pick.price < 0.01 ? pick.price.toFixed(6) : pick.price < 1 ? pick.price.toFixed(4) : pick.price.toFixed(2)}
                    </span>
                    <span style={{ color: pick.changePct >= 0 ? '#00c853' : '#ff3d3d', fontWeight: 700, fontSize: 14 }}>
                      {pick.changePct >= 0 ? '+' : ''}{pick.changePct?.toFixed(2)}%
                    </span>
                    {pick.change7d !== undefined && (
                      <span style={{ color: pick.change7d >= 0 ? '#00b4d8' : '#ff6b35', fontSize: 11 }}>
                        7d: {pick.change7d >= 0 ? '+' : ''}{pick.change7d?.toFixed(1)}%
                      </span>
                    )}
                  </div>

                  {/* Volume + market cap */}
                  <div style={{ color: '#666', fontSize: 11, marginTop: 4 }}>
                    {pick.volRatio ? `Vol ${pick.volRatio}x avg` : pick.volume24h ? `Vol $${(pick.volume24h / 1e6).toFixed(1)}M` : ''}
                    {pick.marketCap > 0 && (
                      <span style={{ marginLeft: 8 }}>· MCap ${pick.marketCap >= 1e9 ? (pick.marketCap / 1e9).toFixed(1) + 'B' : (pick.marketCap / 1e6).toFixed(0) + 'M'}</span>
                    )}
                  </div>

                  {/* AI reason — always show first line, expand for full */}
                  {pick.reason && (
                    <div style={{
                      marginTop: 10, fontSize: 12, color: '#aaa', lineHeight: 1.5,
                      display: '-webkit-box', WebkitLineClamp: expanded ? 'unset' : 2,
                      WebkitBoxOrient: 'vertical', overflow: expanded ? 'visible' : 'hidden'
                    }}>
                      {pick.reason}
                    </div>
                  )}

                  {/* Expanded: entry + risk notes */}
                  {expanded && (
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {pick.entryNote && (
                        <div style={{ fontSize: 11, padding: '6px 10px', background: '#0d1f12', borderRadius: 6, color: '#00c853' }}>
                          <strong>Entry:</strong> {pick.entryNote}
                        </div>
                      )}
                      {pick.riskNote && (
                        <div style={{ fontSize: 11, padding: '6px 10px', background: '#1f0d0d', borderRadius: 6, color: '#ff6b35' }}>
                          <strong>Risk:</strong> {pick.riskNote}
                        </div>
                      )}
                      {pick.ta && (
                        <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>
                          {pick.ta.rsi != null && `RSI ${pick.ta.rsi}`}
                          {pick.ta.rsi4h != null && ` · 4H RSI ${pick.ta.rsi4h}`}
                          {pick.ta.aboveMa50 != null && ` · ${pick.ta.aboveMa50 ? '↑' : '↓'} MA50`}
                          {pick.ta.aboveMa200 != null && ` · ${pick.ta.aboveMa200 ? '↑' : '↓'} MA200`}
                          {pick.ta.macd && ` · MACD ${pick.ta.macd.bullishCrossover ? '🟢 CROSS' : pick.ta.macd.bearishCrossover ? '🔴 CROSS' : pick.ta.macd.bullish ? 'bullish' : 'bearish'}`}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

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

      {/* Today's Scanner Picks (Stocks) */}
      <div className="section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h3 style={{ margin: 0 }}>📈 Stock Scanner</h3>
            <p style={{ color: '#888', fontSize: 12, margin: '4px 0 0' }}>
              Top movers from Tech, Semiconductors &amp; Energy — scans Yahoo Finance (free)
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={triggerStockScan}
              disabled={scanningStocks}
              style={{
                background: scanningStocks ? '#1a1d27' : '#0a1a0a',
                color: scanningStocks ? '#555' : '#00c853',
                border: '1px solid ' + (scanningStocks ? '#333' : '#00c853'),
                borderRadius: 8, padding: '5px 14px', fontSize: 12,
                fontWeight: 600, cursor: scanningStocks ? 'default' : 'pointer'
              }}
            >
              {scanningStocks ? '⏳ Scanning...' : '⚡ Scan Now'}
            </button>
            <span style={{
              background: scannedStocks.length > 0 ? '#0d2a0d' : '#1a1d27',
              color: scannedStocks.length > 0 ? '#00c853' : '#555',
              border: `1px solid ${scannedStocks.length > 0 ? '#00c853' : '#2a2d3e'}`,
              borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 600
            }}>
              {scannedStocks.length > 0 ? `${scannedStocks.length} picks` : 'No picks'}
            </span>
          </div>
        </div>

        {scanningStocks && scannedStocks.length === 0 && (
          <div style={{ color: '#555', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
            Scanning Yahoo Finance for top movers — this takes ~15-30 seconds...
          </div>
        )}

        {!scanningStocks && scannedStocks.length === 0 && (
          <div style={{ color: '#555', fontSize: 13, padding: '16px 0' }}>
            No scanner picks — click ⚡ Scan Now or wait for market open (9:30 AM ET Mon–Fri)
          </div>
        )}

        {scannedStocks.length > 0 && (
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
      </div>

      {/* Conditional Entry Orders */}
      {conditionalOrders.length > 0 && (() => {
        const cryptoOrders = conditionalOrders
          .filter(o => o.symbol.includes('/'))
          .sort((a, b) => a.symbol.localeCompare(b.symbol));
        const stockOrders = conditionalOrders
          .filter(o => !o.symbol.includes('/'))
          .sort((a, b) => a.symbol.localeCompare(b.symbol));

        // which symbols have both LONG and SHORT (hedge pairs)
        const buildHedgeSet = (orders) => {
          const counts = {};
          orders.forEach(o => { counts[o.symbol] = (counts[o.symbol] || new Set()).add(o.direction); });
          const hedged = new Set();
          Object.entries(counts).forEach(([sym, dirs]) => { if (dirs.size === 2) hedged.add(sym); });
          return hedged;
        };
        const cryptoHedged = buildHedgeSet(cryptoOrders);
        const stockHedged  = buildHedgeSet(stockOrders);

        const renderTable = (orders, hedgedSet) => (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Direction</th>
                  <th>Trigger</th>
                  <th>Condition</th>
                  <th>Auto-Close</th>
                  <th>Set At</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => {
                  const dir      = order.direction === 'BUY' ? 'LONG' : 'SHORT';
                  const dirColor = order.direction === 'BUY' ? '#00c853' : '#ff6b35';
                  const condStr  = order.triggerType === 'above'
                    ? `Price ≥ $${order.triggerPrice}`
                    : `Price ≤ $${order.triggerPrice}`;
                  const setAt = new Date(order.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                  const isHedge = hedgedSet.has(order.symbol);
                  return (
                    <tr key={order._id} style={isHedge ? { borderLeft: '3px solid #5865f2' } : {}}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button
                            onClick={() => setSelectedConditionalSymbol(selectedConditionalSymbol === order.symbol ? null : order.symbol)}
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit' }}
                          >
                            <strong style={{ textDecoration: 'underline dotted', color: '#5865f2' }}>{order.symbol}</strong>
                          </button>
                          {isHedge && order.direction === 'BUY' && (
                            <span style={{ fontSize: 9, background: '#1a1a3a', color: '#5865f2', border: '1px solid #5865f2', borderRadius: 3, padding: '1px 5px', fontWeight: 700, letterSpacing: 0.5 }}>HEDGE</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span style={{
                          background: order.direction === 'BUY' ? '#0d2a0d' : '#2a1500',
                          color: dirColor, border: `1px solid ${dirColor}`,
                          borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700
                        }}>{dir}</span>
                      </td>
                      <td style={{ color: '#5865f2', fontWeight: 600 }}>${order.triggerPrice}</td>
                      <td style={{ color: '#aaa', fontSize: 12 }}>{condStr}</td>
                      <td style={{ color: order.closeAfterMinutes ? '#f5a623' : '#444', fontSize: 12 }}>
                        {order.closeAfterMinutes ? `${order.closeAfterMinutes}m` : '—'}
                      </td>
                      <td style={{ color: '#555', fontSize: 12 }}>{setAt}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );

        return (
          <div className="section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0 }}>Conditional Entry Orders</h3>
                <p style={{ color: '#888', fontSize: 12, margin: '4px 0 0' }}>Auto-executes when price hits the trigger · checks every 30s</p>
              </div>
              <span style={{
                background: '#0d1a2a', color: '#5865f2', border: '1px solid #5865f2',
                borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700
              }}>{conditionalOrders.length} pending</span>
            </div>

            {/* Chart appears ABOVE the tables so it's visible without scrolling */}
            {selectedConditionalSymbol && (() => {
              const orders = conditionalOrders.filter(o => o.symbol === selectedConditionalSymbol);
              if (!orders.length) return null;
              const market = orders[0].symbol.includes('/') ? 'crypto' : 'stock';
              const longOrder  = orders.find(o => o.direction === 'BUY'  || o.direction === 'LONG');
              const shortOrder = orders.find(o => o.direction === 'SELL' || o.direction === 'SHORT');
              const primary = longOrder || shortOrder || orders[0];
              const isHedgePair = !!(longOrder && shortOrder);
              return (
                <div style={{ marginBottom: 16 }}>
                  <PriceChart
                    key={primary.symbol}
                    symbol={primary.symbol}
                    entryPrice={isHedgePair ? longOrder.triggerPrice : primary.triggerPrice}
                    hedgePrice={isHedgePair ? shortOrder.triggerPrice : undefined}
                    market={market}
                    type={primary.direction}
                    livePrice={currentPrices[primary.symbol] || null}
                  />
                </div>
              );
            })()}

            {cryptoOrders.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#f0b429' }}>Crypto</span>
                  <span style={{ fontSize: 11, color: '#555' }}>{cryptoOrders.length} order{cryptoOrders.length !== 1 ? 's' : ''} · {cryptoHedged.size} hedge pair{cryptoHedged.size !== 1 ? 's' : ''}</span>
                </div>
                {renderTable(cryptoOrders, cryptoHedged)}
              </div>
            )}

            {stockOrders.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#00c853' }}>Stocks</span>
                  <span style={{ fontSize: 11, color: '#555' }}>{stockOrders.length} order{stockOrders.length !== 1 ? 's' : ''} · {stockHedged.size} hedge pair{stockHedged.size !== 1 ? 's' : ''}</span>
                </div>
                {renderTable(stockOrders, stockHedged)}
              </div>
            )}

            <p style={{ color: '#555', fontSize: 11, marginTop: 8 }}>
              To cancel: tell AI Chat "cancel my conditional entry for [symbol]"
            </p>
          </div>
        );
      })()}

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
                  <span style={{ color: '#aaa' }}>{(() => { const p = trade.price; if (!p) return '—'; const d = trade.market === 'crypto' && p < 1 ? 5 : p < 100 ? 4 : 2; return `$${p.toFixed(d)}`; })()}</span>
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
