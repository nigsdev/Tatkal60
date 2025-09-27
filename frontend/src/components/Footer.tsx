import { ExternalLink, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import Card from './ui/Card';
import { CONTRACT_ADDRESSES } from '../constants';
import { short } from '../lib/format';

const NETWORK = import.meta.env.VITE_HEDERA_NETWORK?.toLowerCase?.() ?? 'testnet';
const HASHSCAN = `https://hashscan.io/${NETWORK}`;

function ContractLink({ name, addr }: { name: string; addr?: string }) {
  const [copied, setCopied] = useState(false);
  
  if (!addr) return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
      <div>
        <div className="text-teal-400 font-medium text-sm">{name}</div>
        <div className="text-xs text-gray-500">Not deployed</div>
      </div>
    </div>
  );
  
  const url = `${HASHSCAN}/contract/${addr}`;
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };
  
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="text-teal-400 font-medium text-sm mb-1">{name}</div>
        <div className="text-xs text-gray-300 font-mono">{short(addr, 8, 6)}</div>
      </div>
      <div className="flex items-center gap-2 ml-3">
        <button
          onClick={handleCopy}
          className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 transition-colors"
          title="Copy address"
        >
          {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-gray-400" />}
        </button>
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 transition-colors"
          title="View on Hashscan"
        >
          <ExternalLink size={14} className="text-gray-400" />
        </a>
      </div>
    </div>
  );
}

export default function Footer() {
  return (
    <footer className="bg-black border-t border-white/10">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="p-6">
            <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-teal-400"></div>
              Contracts ({NETWORK})
            </h4>
            <div className="space-y-3">
              <ContractLink name="OracleAdapter" addr={CONTRACT_ADDRESSES.ORACLE_ADAPTER} />
              <ContractLink name="EscrowGame" addr={CONTRACT_ADDRESSES.ESCROW_GAME} />
              <ContractLink name="CCIPReceiver" addr={CONTRACT_ADDRESSES.CCIP_RECEIVER} />
            </div>
          </Card>
          
          <Card className="p-6">
            <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
              Resources
            </h4>
            <div className="space-y-3">
              <a 
                href="https://github.com/nigsdev/Tatkal60" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
              >
                <span className="text-gray-300">GitHub Repository</span>
                <ExternalLink size={14} className="text-gray-400" />
              </a>
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10 opacity-60">
                <span className="text-gray-400">Documentation</span>
                <span className="text-xs text-gray-500">Coming soon</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10 opacity-60">
                <span className="text-gray-400">Demo Video</span>
                <span className="text-xs text-gray-500">Coming soon</span>
              </div>
            </div>
          </Card>
          
          <Card className="p-6">
            <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-400"></div>
              About Tatkal60
            </h4>
            <p className="text-sm text-gray-300 leading-relaxed">
              60-second BTC/USD rounds on Hedera. Place UP/DOWN bets, Pyth oracle resolves, winners claim instantly. CCIP cross-chain funding from Sepolia → Hedera coming next.
            </p>
            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>Powered by</span>
                <span className="px-2 py-1 rounded bg-teal-500/20 text-teal-300">Hedera</span>
                <span className="px-2 py-1 rounded bg-cyan-500/20 text-cyan-300">Pyth</span>
              </div>
            </div>
          </Card>
        </div>
        
        <div className="mt-8 pt-6 border-t border-white/10 text-center">
          <div className="text-gray-400 text-sm">
            © {new Date().getFullYear()} Tatkal60 — Built with Hedera + Pyth
          </div>
        </div>
      </div>
    </footer>
  );
}