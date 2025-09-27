import { ExternalLink } from 'lucide-react';
import Card from './ui/Card';
import { CONTRACT_ADDRESSES } from '../constants';

const NETWORK = (import.meta as any)?.env?.VITE_HEDERA_NETWORK?.toLowerCase?.() ?? 'testnet';
const HASHSCAN = `https://hashscan.io/${NETWORK}`;

function HashscanLink({ addr }: { addr?: string }) {
  if (!addr) return <span className="text-xs text-gray-500">Not deployed</span>;
  const url = `${HASHSCAN}/contract/${addr}`;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
       className="inline-flex items-center gap-1 text-sm text-gray-300 hover:text-teal-400 underline decoration-transparent hover:decoration-teal-400">
      {addr}<ExternalLink size={14} />
    </a>
  );
}

export default function Footer() {
  return (
    <footer className="bg-black border-t border-white/10">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Card className="p-5">
            <h4 className="text-white font-semibold mb-3">Contracts ({NETWORK})</h4>
            <ul className="space-y-2">
              <li><span className="text-teal-400">OracleAdapter</span><br/><HashscanLink addr={CONTRACT_ADDRESSES.ORACLE_ADAPTER} /></li>
              <li><span className="text-teal-400">EscrowGame</span><br/><HashscanLink addr={CONTRACT_ADDRESSES.ESCROW_GAME} /></li>
              <li><span className="text-teal-400">CCIPReceiver</span><br/><HashscanLink addr={CONTRACT_ADDRESSES.CCIP_RECEIVER} /></li>
            </ul>
          </Card>
          <Card className="p-5">
            <h4 className="text-white font-semibold mb-3">Resources</h4>
            <ul className="space-y-2 text-sm">
              <li><a className="hover:text-teal-400 text-gray-300" href="https://github.com/..." target="_blank">GitHub <ExternalLink size={14} className="inline ml-1"/></a></li>
              <li><a className="hover:text-teal-400 text-gray-300" href="#" target="_blank">Docs (coming soon)</a></li>
              <li><a className="hover:text-teal-400 text-gray-300" href="#" target="_blank">Demo video (coming soon)</a></li>
            </ul>
          </Card>
          <Card className="p-5">
            <h4 className="text-white font-semibold mb-3">Tatkal60</h4>
            <p className="text-sm text-gray-300">
              60-second BTC/USD rounds on Hedera. Place UP/DOWN bets, Pyth oracle resolves, winners claim instantly. CCIP cross-chain funding from Sepolia → Hedera coming next.
            </p>
          </Card>
        </div>
        <div className="mt-8 text-center text-gray-400 text-sm">
          © {new Date().getFullYear()} Tatkal60 — Built with Hedera + Pyth
        </div>
      </div>
    </footer>
  );
}