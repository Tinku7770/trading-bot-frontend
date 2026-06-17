import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL;

const SUGGESTED = [
  'What are my open positions?',
  "Why did the bot enter today's trades?",
  'What is my current P/L and win rate?',
  'Which symbols are on cooldown right now?',
  'How is the bot performing this week?',
];

export default function AIChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hi! I'm your bot assistant. Ask me anything about your trades, performance, settings, or why the bot made a specific decision."
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function send(text) {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');
    setError('');

    const userMsg = { role: 'user', content: msg };
    const history = [...messages, userMsg];
    setMessages(history);
    setLoading(true);

    try {
      const res = await axios.post(`${API}/chat`, {
        message: msg,
        history: messages.filter(m => m.role !== 'system')
      });
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.reply }]);
    } catch {
      setError('Failed to get a response — check your connection and try again.');
    } finally {
      setLoading(false);
    }
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
          position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
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
          position: 'fixed', bottom: 96, right: 28, zIndex: 9998,
          width: 380, maxHeight: 560,
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
                <div style={{ color: '#555', fontSize: 11 }}>Ask about trades, P/L, settings, decisions</div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#00c853' }} />
                <span style={{ color: '#00c853', fontSize: 10, fontWeight: 700 }}>LIVE</span>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '16px 14px',
            display: 'flex', flexDirection: 'column', gap: 12,
            scrollbarWidth: 'thin', scrollbarColor: '#2a2d3e #0d0f1a'
          }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start'
              }}>
                <div style={{
                  maxWidth: '85%',
                  background: m.role === 'user' ? '#5865f2' : '#1a1d27',
                  border: m.role === 'assistant' ? '1px solid #2a2d3e' : 'none',
                  borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  padding: '10px 13px',
                  color: '#e6e8ef', fontSize: 13, lineHeight: 1.55,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word'
                }}>
                  {m.content}
                </div>
              </div>
            ))}

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
                  Try asking:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {SUGGESTED.map((q, i) => (
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

          {/* Input area */}
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
              placeholder="Ask about your bot..."
              rows={1}
              style={{
                flex: 1, background: '#1a1d27', border: '1px solid #2a2d3e',
                borderRadius: 8, padding: '9px 12px', color: '#e6e8ef',
                fontSize: 13, resize: 'none', outline: 'none',
                fontFamily: 'inherit', lineHeight: 1.4,
                maxHeight: 100, overflowY: 'auto'
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#5865f2'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#2a2d3e'; }}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              style={{
                background: (!input.trim() || loading) ? '#1a1d27' : '#5865f2',
                border: 'none', borderRadius: 8,
                width: 38, height: 38, flexShrink: 0,
                cursor: (!input.trim() || loading) ? 'not-allowed' : 'pointer',
                color: (!input.trim() || loading) ? '#444' : '#fff',
                fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s'
              }}
            >
              ↑
            </button>
          </div>

          {/* Bounce animation */}
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
