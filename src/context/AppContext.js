import React, { createContext, useContext, useState, useEffect } from 'react';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [botStatus, setBotStatus] = useState(false);
  const [tradeMode, setTradeMode] = useState('paper');
  const [liveSignals, setLiveSignals] = useState([]);
  const [liveTrades, setLiveTrades] = useState([]);

  useEffect(() => {
    let socket;
    let retryTimeout;
    let retryDelay = 1000;

    function connect() {
      socket = new WebSocket(process.env.REACT_APP_WS_URL || 'wss://trading-bot-backend-production-9a53.up.railway.app');

      socket.onopen = () => {
        console.log('WebSocket connected');
        retryDelay = 1000;
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'BOT_STATUS') setBotStatus(data.isRunning);
          if (data.type === 'NEW_SIGNAL') setLiveSignals(prev => [data.signal, ...prev].slice(0, 20));
          if (data.type === 'NEW_TRADE') setLiveTrades(prev => [data.trade, ...prev].slice(0, 20));
        } catch {}
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
