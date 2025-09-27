import { useState, useEffect } from 'react';
import { escrow } from '../lib/contracts';

export function useChainTime() {
  const [chainTime, setChainTime] = useState<number>(Math.floor(Date.now() / 1000));
  const [localTime, setLocalTime] = useState<number>(Math.floor(Date.now() / 1000));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const updateTime = async () => {
      try {
        const provider = escrow().read().runner?.provider;
        if (provider) {
          const block = await provider.getBlock('latest');
          setChainTime(block?.timestamp || Math.floor(Date.now() / 1000));
        } else {
          setChainTime(Math.floor(Date.now() / 1000));
        }
      } catch (e) {
        console.warn('[useChainTime] Failed to get chain time, using local time', e);
        setChainTime(Math.floor(Date.now() / 1000));
      }
      setLocalTime(Math.floor(Date.now() / 1000));
      setIsLoading(false);
    };

    // Update immediately
    updateTime();

    // Update every 5 seconds
    const interval = setInterval(updateTime, 5000);
    return () => clearInterval(interval);
  }, []);

  const skew = chainTime - localTime;
  const skewSeconds = Math.abs(skew);
  const skewDirection = skew > 0 ? '+' : '-';

  return {
    chainTime,
    localTime,
    skew,
    skewSeconds,
    skewDirection,
    isLoading,
  };
}
