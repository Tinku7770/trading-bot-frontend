import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AppContext = createContext();
const API = process.env.REACT_APP_API_URL;

// Set once — every axios call in the app inherits this header automatically
if (process.env.REACT_APP_DASHBOARD_API_KEY) {
  axios.defaults.headers.common['x-api-key'] = process.env.REACT_APP_DASHBOARD_API_KEY;
}

function notify(title, body) {
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.ico' });
  }
}

export function AppProvider({ children }) {
  const [botStatus, setBotStatus] = useState(false);
  const [tradeMode, setTradeMode] = useState('paper');
  const [liveSignals, setLiveSignals] = useState([]);
  const [liveTrades, setLiveTrades] = useState([]);

  // Initialize tradeMode from backend so the badge is correct on first load
  useEffect(() => {
    axios.get(`${API}/bot/status`)
      .then(res => { if (res.data?.tradeMode) setTradeMode(res.data.tradeMode); })
      .catch(err => console.error('Failed to fetch bot status:', err));
  }, []);

  // Request notification permission once on mount (not supported on iOS Safari)
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    let socket;
    let retryTimeout;
    let retryDelay = 1000;

    function connect() {
      const wsBase = process.env.REACT_APP_WS_URL || 'wss://trading-bot-backend-production-9a53.up.railway.app';
      const wsKey  = process.env.REACT_APP_DASHBOARD_API_KEY;
      socket = new WebSocket(wsKey ? `${wsBase}?key=${encodeURIComponent(wsKey)}` : wsBase);

      socket.onopen = () => {
        console.log('WebSocket connected');
        retryDelay = 1000;
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'BOT_STATUS') setBotStatus(data.isRunning);

          if (data.type === 'NEW_SIGNAL') {
            setLiveSignals(prev => [data.signal, ...prev].slice(0, 20));
          }

          if (data.type === 'NEW_TRADE') {
            setLiveTrades(prev => [data.trade, ...prev].slice(0, 20));
            notify(
              `Position Opened — ${data.trade.symbol}`,
              `${data.trade.type} at $${data.trade.price?.toFixed(2)} · $${data.trade.amount?.toFixed(2)}`
            );
          }

          if (data.type === 'TRADE_CLOSED') {
            setLiveTrades(prev =>
              prev.map(t => t._id === data.trade._id ? { ...t, ...data.trade } : t)
            );
            const pl = data.trade.profitLoss;
            const plStr = pl != null ? ` · ${pl >= 0 ? '+' : ''}$${pl.toFixed(2)}` : '';
            notify(
              `Position Closed — ${data.trade.symbol}`,
              `${data.trade.type} closed at $${data.trade.closePrice?.toFixed(2)}${plStr}`
            );
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      socket.onerror = () => socket.close();

      socket.onclose = () => {
        console.log(`WebSocket disconnected — reconnecting in ${retryDelay}ms`);
        retryTimeout = setTimeout(() => {
          retryDelay = Math.min(retryDelay * 2, 30000);
          connect();
        }, retryDelay);
      };
    }

    connect();

    return () => {
      clearTimeout(retryTimeout);
      if (socket) socket.close();
    };
  }, []);

  return (
    <AppContext.Provider value={{ botStatus, setBotStatus, tradeMode, setTradeMode, liveSignals, liveTrades }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
