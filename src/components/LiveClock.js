import { useState, useEffect } from 'react';

export default function LiveClock({ timeZone, options, style }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span style={style}>
      {now.toLocaleString('en-US', { timeZone, ...options })}
    </span>
  );
}
