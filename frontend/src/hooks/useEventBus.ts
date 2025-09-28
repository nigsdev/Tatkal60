// src/hooks/useEventBus.ts
import { useEffect, useRef } from 'react';
import { eventBus, type EventBusEvent } from '../lib/eventBus';

// Re-export EventBusEvent for use in other hooks
export type { EventBusEvent };

export interface UseEventBusOptions {
  onBetPlaced?: (event: EventBusEvent) => void;
  onRoundResolved?: (event: EventBusEvent) => void;
  onClaimed?: (event: EventBusEvent) => void;
  enabled?: boolean;
}

export function useEventBus(options: UseEventBusOptions = {}) {
  const {
    onBetPlaced,
    onRoundResolved,
    onClaimed,
    enabled = true
  } = options;

  const unsubscribeRefs = useRef<(() => void)[]>([]);

  useEffect(() => {
    if (!enabled) return;

    const unsubscribers: (() => void)[] = [];

    // Subscribe to BetPlaced events
    if (onBetPlaced) {
      const unsubscribe = eventBus.on('BetPlaced', onBetPlaced);
      unsubscribers.push(unsubscribe);
    }

    // Subscribe to RoundResolved events
    if (onRoundResolved) {
      const unsubscribe = eventBus.on('RoundResolved', onRoundResolved);
      unsubscribers.push(unsubscribe);
    }

    // Subscribe to Claimed events
    if (onClaimed) {
      const unsubscribe = eventBus.on('Claimed', onClaimed);
      unsubscribers.push(unsubscribe);
    }

    unsubscribeRefs.current = unsubscribers;

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
      unsubscribeRefs.current = [];
    };
  }, [enabled, onBetPlaced, onRoundResolved, onClaimed]);

  return {
    status: eventBus.getStatus(),
    destroy: () => {
      unsubscribeRefs.current.forEach(unsubscribe => unsubscribe());
      unsubscribeRefs.current = [];
    }
  };
}
