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
      let errorMessage = e?.message ?? String(e);
      
      // Handle specific Pyth contract errors
      if (errorMessage.includes('0x19abf40e') || errorMessage.includes('Pyth contract is not properly configured')) {
        errorMessage = 'Pyth contract is not properly configured on Hedera testnet. Please check the Pyth Network documentation for the correct configuration.';
      } else if (errorMessage.includes('0x025dbdd4')) {
        errorMessage = 'Pyth update failed. The contract may not be properly deployed or the price ID may be incorrect for Hedera testnet.';
      } else if (e?.code === -32602 && /tinybar/i.test(e?.message ?? '')) {
        errorMessage = 'Node rejected msg.value < 1 tinybar. We automatically send ≥ 1 tinybar; try again.';
      }
      
      setErr(errorMessage);
    } finally { setLoading(false); }
  };

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 flex-1">
          <CloudDownload size={18} className="text-cyan-400 flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-white font-semibold">Refresh Pyth (BTC/USD)</div>
            <div className="text-xs text-gray-400">Fetch Hermes update → post on-chain. Hedera requires ≥ 1 tinybar if non-zero.</div>
          </div>
        </div>
        <Button 
          onClick={onClick} 
          disabled={loading}
          variant="primary"
          className={`px-6 py-3 font-bold transition-all duration-200 flex-shrink-0 ${
            loading 
              ? 'opacity-75 cursor-not-allowed' 
              : 'hover:shadow-lg hover:shadow-cyan-500/25'
          }`}
        >
          <RefreshCcw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Updating...' : (isConnected ? 'Refresh Now' : 'Connect & Refresh')}
        </Button>
      </div>
      {ok && <div className="mb-3 text-sm rounded-md bg-emerald-500/15 text-emerald-300 px-3 py-2">✅ {ok}</div>}
      {fee && <div className="mb-2 text-sm text-gray-300">{fee}</div>}
      {postedPrice && <div className="mb-1 text-sm text-cyan-400">{postedPrice}</div>}
      {tx && <div className="mb-1 text-sm text-gray-300">Tx: <span className="text-cyan-400 break-all">{tx}</span></div>}
      {err && <div className="text-sm rounded-md bg-red-500/15 text-red-300 px-3 py-2"><strong>Error:</strong> {err}</div>}
    </Card>
  );
}
