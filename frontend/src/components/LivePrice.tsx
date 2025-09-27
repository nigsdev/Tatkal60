import { useEffect, useState } from 'react';
import Card from './ui/Card';
import Button from './ui/Button';
import { readOnchainPrice, readHermesPrice, PRICE_MAX_AGE_SECS } from '../lib/price';

export default function LivePrice() {
  const [value, setValue] = useState<string>('-');
  const [source, setSource] = useState<'onchain' | 'hermes' | '-'>('-');
  const [ts, setTs] = useState<string>('-');
  const [warn, setWarn] = useState<string>('');
  const maxAge = PRICE_MAX_AGE_SECS();

  async function refresh() {
    setWarn('');
    try {
      const on = await readOnchainPrice(maxAge);
      if (on.source === 'onchain') {
        const priceNum = Number(on.price) / 1e8;
        setValue(priceNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        setSource('onchain');
        setTs(new Date(on.lastTs * 1000).toLocaleTimeString());
      }
    } catch {
      const h = await readHermesPrice();
      if (h.source === 'hermes') {
        setValue(Number(h.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        setSource('hermes');
        setTs(new Date(h.ts * 1000).toLocaleTimeString());
        setWarn(`Using Hermes API — on-chain price is older than ${maxAge}s or not available. Try "Refresh Pyth".`);
      }
    }
  }

  useEffect(() => { refresh(); const id = setInterval(refresh, 5000); return () => clearInterval(id); }, [maxAge]);

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="text-white text-lg font-semibold">Live BTC/USD Price</div>
          <div className="text-xs text-gray-400">Freshness threshold: {maxAge}s • Powered by Pyth</div>
        </div>
        <Button 
          onClick={refresh}
          variant="primary"
          className="px-4 py-2 font-semibold hover:shadow-lg hover:shadow-cyan-500/25 transition-all duration-200 flex-shrink-0"
        >
          Refresh
        </Button>
      </div>
      {warn && <div className="mb-4 text-sm rounded-md bg-yellow-500/15 text-yellow-300 px-3 py-2">Warning: {warn}</div>}
      <div className="text-4xl font-extrabold text-white mb-2">${value}</div>
      <div className="text-xs text-gray-400">Source: <span className={source === 'onchain' ? 'text-emerald-300' : 'text-cyan-300'}>{source}</span> • Last update: {ts}</div>
    </Card>
  );
}
