import { useEffect, useState, useCallback, useRef } from 'react';
import { loadRounds } from '../lib/readModel';
import { useWalletStore } from '../lib/hedera';

export function useRounds(pollMs = 6000) {
  const { address } = useWalletStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [rounds, setRounds] = useState<any[]>([]);
  const [lastUpdated, setLastUpdated] = useState<number>(0);

  const mounted = useRef(true);
  const timerRef = useRef<any>(null);
  const tokenRef = useRef(0); // prevents stale/out-of-order writes

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const fetchRounds = useCallback(
    async (isInitial = false) => {
      setError('');
      if (isInitial) setLoading(true);

      const myToken = ++tokenRef.current;
      try {
        const data = await loadRounds(address ?? undefined);
        // ignore stale/out-of-order responses
        if (myToken !== tokenRef.current || !mounted.current) return;
        setRounds(data);
        setLastUpdated(Math.floor(Date.now() / 1000));
      } catch (e: any) {
        if (myToken !== tokenRef.current || !mounted.current) return;
        setError(e?.message ?? String(e));
      } finally {
        if (isInitial && mounted.current) setLoading(false);
      }
    },
    [address]
  );

  useEffect(() => {
    mounted.current = true;

    // initial fetch
    fetchRounds(true);

    const startPolling = () => {
      clearTimer();
      // don't hammer the node when tab isn't visible
      if (typeof document !== 'undefined' && document.hidden) return;
      timerRef.current = setInterval(() => fetchRounds(false), pollMs);
    };

    startPolling();

    const onVis = () => {
      if (document.hidden) {
        clearTimer();
      } else {
        fetchRounds(false);
        startPolling();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVis);
    }

    return () => {
      mounted.current = false;
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVis);
      }
      clearTimer();
      // invalidate any in-flight fetch so it won't overwrite state after unmount
      tokenRef.current++;
    };
  }, [fetchRounds, pollMs]);

  const refetch = useCallback(() => {
    clearTimer();
    fetchRounds(true);
    if (typeof document === 'undefined' || !document.hidden) {
      timerRef.current = setInterval(() => fetchRounds(false), pollMs);
    }
  }, [fetchRounds, pollMs]);

  return { rounds, loading, error, lastUpdated, refetch };
}
