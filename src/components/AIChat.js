import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useApp } from '../context/AppContext';

const API = 'https://trading-bot-backend-production-9a53.up.railway.app/api';
const API_KEY = 'TradingBot2025!Soheb#SecureKey';

const SUGGESTED = [
  'What are my open positions?',
  "Why did the bot enter today's trades?",
  'What is my current P/L and win rate?',
  'Which symbols are on cooldown right now?',
  'Close all my open positions',
];

function ActionCard({ action, onConfirm, onCancel, executing }) {
  const colors = {
    close_position:           { bg: '#2a1500', border: '#f5a623', text: '#f5a623', icon: '⚡' },
    close_all_positions:      { bg: '#2a0000', border: '#ff3d3d', text: '#ff3d3d', icon: '🔴' },
    set_price_target:         { bg: '#0d1a2a', border: '#5865f2', text: '#5865f2', icon: '🎯' },
    cancel_price_target:      { bg: '#1a1500', border: '#888',    text: '#888',    icon: '✕'  },
    bulk_conditional_entry:   { bg: '#0d1a2a', border: '#5865f2', text: '#5865f2', icon: '📋' },
    set_conditional_entry:    { bg: '#0d1a2a', border: '#5865f2', text: '#5865f2', icon: '📌' },
    cancel_conditional_entry: { bg: '#1a1500', border: '#888',    text: '#888',    icon: '✕'  },
    adjust_setting:           { bg: '#1a1a2a', border: '#a78bfa', text: '#a78bfa', icon: '⚙️' },
    manage_symbols:           { bg: '#1a1a2a', border: '#a78bfa', text: '#a78bfa', icon: '📝' },
    control_bot:              { bg: '#0d1a0d', border: '#00c853', text: '#00c853', icon: '🤖' },
    send_telegram:            { bg: '#0d1a2a', border: '#29b6f6', text: '#29b6f6', icon: '📨' },
    manual_trade:             { bg: '#1a2a0d', border: '#76c442', text: '#76c442', icon: '📈' },
    modify_trade:             { bg: '#1a1a2a', border: '#a78bfa', text: '#a78bfa', icon: '✏️' },
    flip_position:            { bg: '#2a1a00', border: '#f5a623', text: '#f5a623', icon: '🔄' },
    schedule_bot:             { bg: '#0d1a2a', border: '#29b6f6', text: '#29b6f6', icon: '📅' },
    set_autopilot:            { bg: '#0d1a1a', border: '#00c853', text: '#00c853', icon: '🤖' },
    cancel_autopilot:         { bg: '#2a1500', border: '#f5a623', text: '#f5a623', icon: '⏹' },
  };
  const c = colors[action.type] || colors.close_position;

  return (
    <div style={{
      background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: 10, padding: '12px 14px', marginTop: 4
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 16 }}>{c.icon}</span>
        <span style={{ color: c.text, fontWeight: 700, fontSize: 13 }}>Action Required</span>
      </div>
      <div style={{ color: '#ccc', fontSize: 13, marginBottom: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
        {action.label}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onConfirm}
          disabled={executing}
          style={{
            flex: 1, padding: '8px 0', borderRadius: 7, border: 'none',
            background: executing ? '#333' : c.border,
            color: executing ? '#666' : '#fff',
            fontWeight: 700, fontSize: 13,
            cursor: executing ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s'
          }}
        >
          {executing ? 'Executing...' : 'Confirm'}
        </button>
        <button
          onClick={onCancel}
          disabled={executing}
          style={{
            flex: 1, padding: '8px 0', borderRadius: 7,
            border: '1px solid #2a2d3e', background: 'transparent',
            color: '#888', fontWeight: 600, fontSize: 13,
            cursor: executing ? 'not-allowed' : 'pointer'
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function AIChat() {
  const { scannerCryptoPicks } = useApp();
  const [pickPrices, setPickPrices] = useState({});
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem('ai_chat_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Filter out any messages with non-string content (corrupted tool_use blocks)
        const clean = parsed.filter(m =>
          (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim()
        );
        if (clean.length > 0) return clean;
      }
    } catch {}
    return [{
      role: 'assistant',
      content: "Hi! I'm your bot assistant. I can answer questions about your trades AND execute actions — like closing a position or setting a price target.\n\nTry: \"close COIN\" or \"sell PYPL at $45\""
    }];
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState('');
  // pending action waiting for confirmation
  const [pendingAction, setPendingAction] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, pendingAction]);

  useEffect(() => {
    try {
      localStorage.setItem('ai_chat_history', JSON.stringify(messages.slice(-50)));
    } catch {}
  }, [messages]);

  // Fetch live prices for scanner picks every 30s
  useEffect(() => {
    if (!scannerCryptoPicks.length) return;
    async function fetchPrices() {
      try {
        const tickers = scannerCryptoPicks.map(p => p.symbol.replace('/', ''));
        const res = await axios.get(`${API}/market/crypto-prices`, {
          params: { tickers: JSON.stringify(tickers), mode: '24hr' }
        });
        const map = {};
        (res.data || []).forEach(t => {
          map[t.symbol] = {
            price: parseFloat(t.lastPrice || t.price || 0),
            change: parseFloat(t.priceChangePercent || 0)
          };
        });
        setPickPrices(map);
      } catch { /* keep previous */ }
    }
    fetchPrices();
    const iv = setInterval(fetchPrices, 30000);
    return () => clearInterval(iv);
  }, [scannerCryptoPicks]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send(text) {
    const msg = (text || input).trim();
    if (!msg || loading || executing) return;
    setInput('');
    setError('');
    setPendingAction(null);

    const userMsg = { role: 'user', content: msg };
    const history = [...messages, userMsg];
    setMessages(history);
    setLoading(true);

    try {
      const res = await axios.post(`${API}/chat`, {
        message: msg,
        history: messages.filter(m => m.role !== 'system')
      }, {
        headers: { 'x-api-key': API_KEY }
      });

      const assistantMsg = { role: 'assistant', content: res.data.reply };
      setMessages(prev => [...prev, assistantMsg]);

      if (res.data.requiresConfirm && res.data.action) {
        setPendingAction(res.data.action);
      }
    } catch (err) {
      const status = err?.response?.status;
      const msg2 = err?.response?.data?.error || err?.message || 'unknown error';
      setError(`Error ${status ? `(${status})` : ''}: ${msg2}`);
    } finally {
      setLoading(false);
    }
  }

  async function confirmAction() {
    if (!pendingAction || executing) return;
    setExecuting(true);
    setError('');

    try {
      const res = await axios.post(`${API}/chat/execute`, { action: pendingAction }, { headers: { 'x-api-key': API_KEY } });
      const resultMsg = {
        role: 'assistant',
        content: res.data.success
          ? `✅ ${res.data.message}`
          : `❌ ${res.data.message}`
      };
      setMessages(prev => [...prev, resultMsg]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ Action failed — please try again or use the dashboard.' }]);
    } finally {
      setPendingAction(null);
      setExecuting(false);
    }
  }

  function cancelAction() {
    setPendingAction(null);
    setMessages(prev => [...prev, { role: 'assistant', content: 'Action cancelled. Let me know if you need anything else.' }]);
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const showSuggestions = messages.length <= 1;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Ask your bot AI"
        style={{
          position: 'fixed', bottom: 28, right: 16, zIndex: 9999,
          width: 56, height: 56, borderRadius: '50%',
          background: open ? '#2a2d3e' : '#5865f2',
          border: open ? '1px solid #5865f2' : 'none',
          boxShadow: '0 4px 20px rgba(88,101,242,0.5)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, transition: 'all 0.2s', color: '#fff'
        }}
      >
        {open ? '×' : '🤖'}
      </button>

      {/* Chat panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 96, right: 12, zIndex: 9998,
          width: 'min(390px, calc(100vw - 24px))',
          maxHeight: 'min(580px, calc(100dvh - 120px))',
          background: '#0d0f1a', border: '1px solid #2a2d3e',
          borderRadius: 14, display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 18px', borderBottom: '1px solid #1a1d27',
            background: '#111320', flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>🤖</span>
              <div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>Bot AI Assistant</div>
                <div style={{ color: '#555', fontSize: 11 }}>Ask questions · Close trades · Set price targets</div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  onClick={() => {
                    localStorage.removeItem('ai_chat_history');
                    setMessages([{ role: 'assistant', content: "Chat cleared. What can I help you with?" }]);
                    setError('');
                    setPendingAction(null);
                  }}
                  title="Clear chat history"
                  style={{
                    background: '#2a1a1a', border: '1px solid #ff3d3d',
                    borderRadius: 6, color: '#ff3d3d', fontSize: 13,
                    cursor: 'pointer', padding: '3px 8px', lineHeight: 1
                  }}
                >
                  🗑 Clear
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#00c853' }} />
                  <span style={{ color: '#00c853', fontSize: 10, fontWeight: 700 }}>LIVE</span>
                </div>
              </div>
            </div>
          </div>

          {/* Scanner Picks Bar */}
          {scannerCryptoPicks.length > 0 && (
            <div style={{
              borderBottom: '1px solid #1a1d27', background: '#0a0c17',
              padding: '8px 12px', flexShrink: 0
            }}>
              <div style={{ color: '#555', fontSize: 10, fontWeight: 700, letterSpacing: 0.8, marginBottom: 6, textTransform: 'uppercase' }}>
                📡 Scanner Picks — click to analyze
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {scannerCryptoPicks.map((pick, idx) => {
                  const ticker  = pick.symbol.replace('/', '');
                  const live    = pickPrices[ticker];
                  const price   = live?.price || pick.price || 0;
                  const change  = live?.change ?? pick.changePct ?? 0;
                  const isLong  = pick.direction === 'LONG';
                  const dirColor = isLong ? '#00c853' : '#ff6b35';
                  const chgColor = change >= 0 ? '#00c853' : '#ff3d3d';
                  const fmtPrice = price < 0.01 ? price.toFixed(6) : price < 1 ? price.toFixed(4) : price.toFixed(3);
                  return (
                    <button
                      key={idx}
                      onClick={() => send(`Analyze ${pick.symbol} from the scanner picks — current price $${fmtPrice}, it's a ${pick.direction} at ${pick.conviction}% conviction. Should I enter now? Give me a specific trade plan with entry, stop loss, and target.`)}
                      title={`${pick.conviction}% conviction · ${pick.reason?.slice(0, 80)}...`}
                      style={{
                        background: '#111320', border: `1px solid ${dirColor}33`,
                        borderRadius: 8, padding: '5px 10px', cursor: 'pointer',
                        display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left',
                        transition: 'all 0.15s', minWidth: 90
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = dirColor; e.currentTarget.style.background = '#1a1d27'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = `${dirColor}33`; e.currentTarget.style.background = '#111320'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ color: '#e6e8ef', fontSize: 11, fontWeight: 700 }}>{pick.symbol.replace('/USDT', '')}</span>
                        <span style={{ color: dirColor, fontSize: 9, fontWeight: 700 }}>{pick.direction}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ color: '#aaa', fontSize: 10 }}>${fmtPrice}</span>
                        <span style={{ color: chgColor, fontSize: 10, fontWeight: 600 }}>
                          {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                        </span>
                      </div>
                      <div style={{ color: '#555', fontSize: 9 }}>{pick.conviction}% conv</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '16px 14px',
            display: 'flex', flexDirection: 'column', gap: 12,
            scrollbarWidth: 'thin', scrollbarColor: '#2a2d3e #0d0f1a'
          }}>
            {messages.filter(m => m.content?.trim()).map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '88%',
                  background: m.role === 'user' ? '#5865f2' : '#1a1d27',
                  border: m.role === 'assistant' ? '1px solid #2a2d3e' : 'none',
                  borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  padding: '10px 13px',
                  color: m.content?.startsWith('✅') ? '#00c853' : m.content?.startsWith('❌') ? '#ff3d3d' : '#e6e8ef',
                  fontSize: 13, lineHeight: 1.55,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word'
                }}>
                  {m.content}
                </div>
              </div>
            ))}

            {/* Pending action confirmation card */}
            {pendingAction && (
              <ActionCard
                action={pendingAction}
                onConfirm={confirmAction}
                onCancel={cancelAction}
                executing={executing}
              />
            )}

            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  background: '#1a1d27', border: '1px solid #2a2d3e',
                  borderRadius: '14px 14px 14px 4px', padding: '10px 16px',
                  display: 'flex', gap: 5, alignItems: 'center'
                }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 7, height: 7, borderRadius: '50%', background: '#5865f2',
                      animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`
                    }} />
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div style={{
                background: '#2a1a1a', border: '1px solid #ff3d3d',
                borderRadius: 8, padding: '8px 12px', color: '#ff3d3d', fontSize: 12
              }}>
                {error}
              </div>
            )}

            {/* Suggested questions */}
            {showSuggestions && !loading && (
              <div style={{ marginTop: 4 }}>
                <div style={{ color: '#444', fontSize: 11, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  {scannerCryptoPicks.length > 0 ? 'Scanner actions:' : 'Try asking:'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(scannerCryptoPicks.length > 0 ? [
                    `Which of the ${scannerCryptoPicks.length} scanner picks should I trade first?`,
                    'Set conditional orders for all scanner picks',
                    `Give me a full trade plan for ${scannerCryptoPicks[0]?.symbol || 'the top pick'}`,
                    "Play devil's advocate — why could these picks fail?",
                  ] : SUGGESTED).map((q, i) => (
                    <button key={i} onClick={() => send(q)} style={{
                      background: '#111320', border: '1px solid #2a2d3e',
                      borderRadius: 8, padding: '7px 12px', color: '#aaa',
                      fontSize: 12, cursor: 'pointer', textAlign: 'left',
                      transition: 'all 0.15s'
                    }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#5865f2'; e.currentTarget.style.color = '#fff'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2d3e'; e.currentTarget.style.color = '#aaa'; }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '10px 12px', borderTop: '1px solid #1a1d27',
            background: '#111320', flexShrink: 0,
            display: 'flex', gap: 8, alignItems: 'flex-end'
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder='Ask or say "close COIN" / "sell PYPL at $45"...'
              rows={1}
              disabled={loading || executing}
              style={{
                flex: 1, background: '#1a1d27', border: '1px solid #2a2d3e',
                borderRadius: 8, padding: '9px 12px', color: '#e6e8ef',
                fontSize: 13, resize: 'none', outline: 'none',
                fontFamily: 'inherit', lineHeight: 1.4,
                maxHeight: 100, overflowY: 'auto',
                opacity: (loading || executing) ? 0.5 : 1
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#5865f2'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#2a2d3e'; }}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading || executing}
              style={{
                background: (!input.trim() || loading || executing) ? '#1a1d27' : '#5865f2',
                border: 'none', borderRadius: 8,
                width: 38, height: 38, flexShrink: 0,
                cursor: (!input.trim() || loading || executing) ? 'not-allowed' : 'pointer',
                color: (!input.trim() || loading || executing) ? '#444' : '#fff',
                fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s'
              }}
            >
              ↑
            </button>
          </div>

          <style>{`
            @keyframes bounce {
              0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
              40% { transform: scale(1); opacity: 1; }
            }
          `}</style>
        </div>
      )}
    </>
  );
}
