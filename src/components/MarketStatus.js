import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'https://trading-bot-backend-production-9a53.up.railway.app/api';

const SESSION_CONFIG = {
  open:       { label: 'Market Open',    color: '#00c853', hint: '6:30 AM – 1:00 PM PT' },
  premarket:  { label: 'Pre-Market',     color: '#f5a623', hint: '1:00 AM – 6:30 AM PT' },
  afterhours: { label: 'After-Hours',    color: '#5865f2', hint: '1:00 PM – 5:00 PM PT' },
  closed:     { label: 'Market Closed',  color: '#555',    hint: 'Opens 1:00 AM PT (Pre-Market)' },
  holiday:    { label: 'Market Holiday', color: '#888',    hint: '' },
};

const NEXT_LABEL = {
  open:       'Opens',
  premarket:  'Pre-Market starts',
  afterhours: 'After-Hours starts',
  closed:     'Closes',
  holiday:    'Opens',
};

function formatCountdown(targetISO) {
  const ms = new Date(targetISO) - new Date();
  if (ms <= 0) return '00:00:00';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600).toString().padStart(2, '0');
  const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${h}:${m}:${sec}`;
}

function FearGreedGauge({ value, label }) {
  const color =
    value <= 25 ? '#ff3d3d' :
    value <= 45 ? '#f5a623' :
    value <= 55 ? '#ffd600' :
    value <= 75 ? '#00c853' : '#00e676';

  return (
    <div style={{ minWidth: 200 }}>
      <div style={{ color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
        Fear &amp; Greed Index
      </div>
      {/* Gauge bar */}
      <div style={{ position: 'relative', height: 8, borderRadius: 4, background: 'linear-gradient(90deg, #ff3d3d 0%, #f5a623 25%, #ffd600 50%, #00c853 75%, #00e676 100%)' }}>
        <div style={{
          position: 'absolute',
          left: `${Math.min(98, Math.max(2, value))}%`,
          transform: 'translateX(-50%)',
          top: -5,
          width: 18, height: 18,
          background: '#0d0f1a',
          borderRadius: '50%',
          border: `3px solid ${color}`,
          boxShadow: `0 0 6px ${color}`,
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#444', marginTop: 4 }}>
        <span>Fear</span>
        <span>Neutral</span>
        <span>Greed</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
        <span style={{ color, fontWeight: 700, fontSize: 26 }}>{value}</span>
        <span style={{ color: '#888', fontSize: 13 }}>{label}</span>
      </div>
    </div>
  );
}

function MarketStatus() {
  const [status, setStatus] = useState(null);
  const [countdown, setCountdown] = useState('--:--:--');

  const fetchStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/market/status`);
      setStatus(res.data);
    } catch (err) {
      console.error('Failed to fetch market status:', err);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Refetch when countdown expires
  useEffect(() => {
    if (!status?.nextChange) return;
    const timer = setInterval(() => {
      const ms = new Date(status.nextChange) - new Date();
      if (ms <= 0) {
        fetchStatus();
      } else {
        setCountdown(formatCountdown(status.nextChange));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [status?.nextChange, fetchStatus]);

  const session = status ? SESSION_CONFIG[status.session] : null;
  const nextLabel = status ? NEXT_LABEL[status.nextSession] : null;

  return (
    <div style={{
      background: '#13151f',
      border: '1px solid #2a2d3e',
      borderRadius: 12,
      padding: '16px 20px',
      marginBottom: 24,
      display: 'flex',
      gap: 32,
      flexWrap: 'wrap',
      alignItems: 'center'
    }}>

      {/* Crypto */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Crypto</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00c853', boxShadow: '0 0 6px #00c853' }} />
          <span style={{ color: '#00c853', fontWeight: 700, fontSize: 15 }}>24 / 7 Open</span>
        </div>
        <div style={{ color: '#555', fontSize: 11 }}>Always trading</div>
      </div>

      <div style={{ width: 1, height: 48, background: '#2a2d3e' }} />

      {/* US Stock Market */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200 }}>
        <div style={{ color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>US Stock Market</div>
        {session ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: session.color, boxShadow: `0 0 6px ${session.color}` }} />
              <span style={{ color: session.color, fontWeight: 700, fontSize: 15 }}>
                {status.session === 'holiday' ? status.holiday : session.label}
              </span>
            </div>
            {status.session === 'holiday'
              ? <div style={{ color: '#888', fontSize: 11 }}>Market Holiday — Opens {status.nextTradingDay}</div>
              : <div style={{ color: '#555', fontSize: 11 }}>{session.hint}</div>
            }
          </>
        ) : (
          <div style={{ color: '#555' }}>Loading...</div>
        )}
      </div>

      {/* Countdown */}
      {status && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
            {nextLabel} in
          </div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 22, fontVariantNumeric: 'tabular-nums', letterSpacing: 1 }}>
            {countdown}
          </div>
        </div>
      )}

      <div style={{ width: 1, height: 48, background: '#2a2d3e' }} />

      {/* Fear & Greed */}
      {status?.fearGreed && (
        <FearGreedGauge value={status.fearGreed.value} label={status.fearGreed.label} />
      )}
    </div>
  );
}

export default MarketStatus;
