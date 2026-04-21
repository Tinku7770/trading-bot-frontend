import React, { createContext, useContext, useState, useEffect } from 'react';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [botStatus, setBotStatus] = useState(false);
  const [tradeMode, setTradeMode] = useState('paper');
  const [liveSignals, setLiveSignals] = useState([]);
  const [liveTrades, setLiveTrades] = useState([]);
  const [ws, setWs] = useState(null); // eslint-disable-line no-unused-vars

  useEffect(() => {
    const socket = new WebSocket('wss://trading-bot-backend-production-9a53.up.railway.app');

    socket.onopen = () => console.log('WebSocket connected');

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'BOT_STATUS') setBotStatus(data.isRunning);
      if (data.type === 'NEW_SIGNAL') setLiveSignals(prev => [data.signal, ...prev].slice(0, 20));
      if (data.type === 'NEW_TRADE') setLiveTrades(prev => [data.trade, ...prev].slice(0, 20));
    };

    socket.onclose = () => console.log('WebSocket disconnected');
    setWs(socket);

    return () => socket.close();
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
