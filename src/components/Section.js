import React, { useState } from 'react';

export default function Section({ title, subtitle, children, defaultOpen = true, badge = null }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="section">
      <div
        onClick={() => setOpen(o => !o)}
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: open ? 16 : 0 }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h3 style={{ margin: 0 }}>{title}</h3>
            {badge}
          </div>
          {subtitle && <div style={{ color: '#555', fontSize: 12, marginTop: 3 }}>{subtitle}</div>}
        </div>
        <span style={{ color: '#555', fontSize: 13, userSelect: 'none', flexShrink: 0, marginLeft: 12 }}>{open ? '▼' : '▶'}</span>
      </div>
      {open && children}
    </div>
  );
}
