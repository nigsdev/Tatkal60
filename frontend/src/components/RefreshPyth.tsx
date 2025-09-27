import { useState } from 'react';
import { CloudDownload, RefreshCcw } from 'lucide-react';
import Button from './ui/Button';
import Card from './ui/Card';
import { ONE_TINYBAR, postUpdateAndRead } from '../lib/pyth';
import { useWalletStore } from '../lib/hedera';


function tinybarFmt(wei: bigint) { return `${Number(wei / ONE_TINYBAR)} tinybar`; }

export default function RefreshPyth() {
  const { isConnected, connect } = useWalletStore();
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState<string>('');
  const [fee, setFee] = useState<string>('');
  const [tx, setTx] = useState<string>('');
  const [err, setErr] = useState<string>('');
  const [postedPrice, setPostedPrice] = useState<string>('');

  const onClick = async () => {
    setLoading(true); setOk(''); setErr(''); setTx(''); setPostedPrice(''); setFee('');
    try {
      if (!isConnected) await connect();
      const r = await postUpdateAndRead();
      setFee(`Last fee: ${tinybarFmt(r.feeWei)} (sent: ${tinybarFmt(r.sentValue)})`);
      setTx(r.txHash);
      setOk('Update posted successfully!');
      if (r.read) setPostedPrice(`On-chain price: ${(Number(r.read.price)/1e8).toFixed(2)} @ ${new Date(r.read.lastTs*1000).toLocaleTimeString()}`);
      else setPostedPrice('Posted update. If price still shows stale, wait a second and click Refresh again.');
    } catch (e: any) {
      const m = e?.code === -32602 && /tinybar/i.test(e?.message ?? '') ? 'Node rejected msg.value < 1 tinybar. We automatically send ≥ 1 tinybar; try again.' : (e?.message ?? String(e));
      setErr(m);
    } finally { setLoading(false); }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CloudDownload size={18} className="text-cyan-400" />
          <div>
            <div className="text-white font-semibold">Refresh Pyth (BTC/USD)</div>
            <div className="text-xs text-gray-400">Fetch Hermes update → post on-chain. Hedera requires ≥ 1 tinybar if non-zero.</div>
          </div>
        </div>
        <Button 
          onClick={onClick} 
          disabled={loading}
          className={`px-6 py-3 font-bold transition-all duration-200 ${
            loading 
              ? 'opacity-75 cursor-not-allowed' 
              : 'hover:shadow-lg hover:shadow-cyan-500/25'
          }`}
        >
          <RefreshCcw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Updating...' : (isConnected ? 'Refresh Now' : 'Connect & Refresh')}
        </Button>
      </div>
      {ok && <div className="mt-3 text-sm rounded-md bg-emerald-500/15 text-emerald-300 px-3 py-2">✅ {ok}</div>}
      {fee && <div className="mt-2 text-sm text-gray-300">{fee}</div>}
      {postedPrice && <div className="mt-1 text-sm text-cyan-400">{postedPrice}</div>}
      {tx && <div className="mt-1 text-sm text-gray-300">Tx: <span className="text-cyan-400 break-all">{tx}</span></div>}
      {err && <div className="mt-3 text-sm rounded-md bg-red-500/15 text-red-300 px-3 py-2"><strong>Error:</strong> {err}</div>}
    </Card>
  );
}
