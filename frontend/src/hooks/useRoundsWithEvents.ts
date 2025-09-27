// src/hooks/useRoundsWithEvents.ts
import { useEffect, useState, useCallback, useRef } from 'react';
import { loadRounds } from '../lib/readModel';
import { useWalletStore } from '../lib/hedera';
import { useEventBus, EventBusEvent } from './useEventBus';

export function useRoundsWithEvents(pollMs = 6000) {
  const { address } = useWalletStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [rounds, setRounds] = useState<any[]>([]);
  const [lastUpdated, setLastUpdated] = useState<number>(0);
  const [eventBusStatus, setEventBusStatus] = useState<{ connected: boolean; mode: 'websocket' | 'polling' }>({
    connected: false,
    mode: 'polling'
  });

  const mounted = useRef(true);
  const timerRef = useRef<any>(null);
  const tokenRef = useRef(0);
  const lastEventRef = useRef<{ [key: number]: number }>({}); // Track last event block per round

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const fetchRounds = useCallback(
    async (isInitial = false, reason = 'manual') => {
      setError('');
      if (isInitial) setLoading(true);

      const myToken = ++tokenRef.current;
      try {
        const data = await loadRounds(address ?? undefined);
        // ignore stale/out-of-order responses
        if (myToken !== tokenRef.current || !mounted.current) return;
        setRounds(data);
        setLastUpdated(Math.floor(Date.now() / 1000));
        
        if (!isInitial) {
          console.log(`[useRoundsWithEvents] Rounds updated (${reason})`);
        }
      } catch (e: any) {
        if (myToken !== tokenRef.current || !mounted.current) return;
        setError(e?.message ?? String(e));
      } finally {
        if (isInitial && mounted.current) setLoading(false);
      }
    },
    [address]
  );

  // Event handlers
  const handleBetPlaced = useCallback((event: EventBusEvent) => {
    console.log('[useRoundsWithEvents] BetPlaced event:', event);
    
    // Check if this is a new event (not already processed)
    const lastBlock = lastEventRef.current[event.roundId] || 0;
    if (event.blockNumber > lastBlock) {
      lastEventRef.current[event.roundId] = event.blockNumber;
      fetchRounds(false, `BetPlaced on round ${event.roundId}`);
    }
  }, [fetchRounds]);

  const handleRoundResolved = useCallback((event: EventBusEvent) => {
    console.log('[useRoundsWithEvents] RoundResolved event:', event);
    
    // Check if this is a new event (not already processed)
    const lastBlock = lastEventRef.current[event.roundId] || 0;
    if (event.blockNumber > lastBlock) {
      lastEventRef.current[event.roundId] = event.blockNumber;
      fetchRounds(false, `RoundResolved for round ${event.roundId}`);
    }
  }, [fetchRounds]);

  const handleClaimed = useCallback((event: EventBusEvent) => {
    console.log('[useRoundsWithEvents] Claimed event:', event);
    
    // Check if this is a new event (not already processed)
    const lastBlock = lastEventRef.current[event.roundId] || 0;
    if (event.blockNumber > lastBlock) {
      lastEventRef.current[event.roundId] = event.blockNumber;
      fetchRounds(false, `Claimed on round ${event.roundId}`);
    }
  }, [fetchRounds]);

  // Set up EventBus
  const { status } = useEventBus({
    onBetPlaced: handleBetPlaced,
    onRoundResolved: handleRoundResolved,
    onClaimed: handleClaimed,
    enabled: true
  });

  // Update EventBus status
  useEffect(() => {
    setEventBusStatus(status);
  }, [status]);

  useEffect(() => {
    mounted.current = true;

    // initial fetch
    fetchRounds(true);

    const startPolling = () => {
      clearTimer();
      // Only poll if EventBus is not connected or in polling mode
      if (status.mode === 'polling' || !status.connected) {
        // don't hammer the node when tab isn't visible
        if (typeof document !== 'undefined' && document.hidden) return;
        timerRef.current = setInterval(() => fetchRounds(false, 'polling'), pollMs);
      }
    };

    startPolling();

    const onVis = () => {
      if (document.hidden) {
        clearTimer();
      } else {
        fetchRounds(false, 'visibility change');
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
  }, [fetchRounds, pollMs, status.connected, status.mode]);

  const refetch = useCallback(() => {
    clearTimer();
    fetchRounds(true, 'manual refetch');
    if (typeof document === 'undefined' || !document.hidden) {
      if (status.mode === 'polling' || !status.connected) {
        timerRef.current = setInterval(() => fetchRounds(false, 'polling'), pollMs);
      }
    }
  }, [fetchRounds, pollMs, status.connected, status.mode]);

  return { 
    rounds, 
    loading, 
    error, 
    lastUpdated, 
    refetch,
    eventBusStatus
  };
}
