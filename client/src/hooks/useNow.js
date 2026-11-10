import { useEffect, useState } from 'react';

/** The current time in ms, refreshed every second (display only; the server decides). */
export default function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
