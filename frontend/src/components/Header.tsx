import { useState } from 'react';
import { Wallet, Copy, LogOut } from 'lucide-react';
import Button from './ui/Button';
import { useWalletStore } from '../lib/hedera';
import { shortAddress } from '../lib/format';
import logo from '../assets/logo.png';

type HeaderProps = { centerBrand?: boolean };

function BrandLogo() {
  const [errored, setErrored] = useState(false);
  if (errored) {
    return (
      <div className="h-10 w-10 grid place-items-center rounded-md bg-teal-400 text-black font-extrabold">
        T60
      </div>
    );
  }
  return (
    <img
      src={logo}
      alt="Tatkal60 logo"
      width={40}
      height={40}
      className="h-10 w-10 object-contain rounded-md bg-white/5"
      onError={() => setErrored(true)}
    />
  );
}

export default function Header({ centerBrand = false }: HeaderProps) {
  const { isConnected, connect, disconnect, address, balance, connecting } = useWalletStore();

  const handleCopy = async () => {
    try { if (address) await navigator.clipboard.writeText(address); } catch {}
  };

  return (
    <header className="sticky top-0 z-50 bg-black/80 backdrop-blur supports-[backdrop-filter]:bg-black/60 border-b border-white/10">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="h-16 flex items-center justify-between" aria-label="Primary">
          {/* Left or Center brand */}
          <div className={`flex items-center gap-3 ${centerBrand ? 'mx-auto' : ''}`}>
            <BrandLogo />
            <div className="leading-tight">
              <span className="block text-white font-extrabold tracking-wide text-lg sm:text-xl">Tatkal60</span>
              <span className="hidden sm:block text-xs text-teal-400/80">60-Second Price Pulse</span>
            </div>
          </div>

          {/* Right controls */}
          <div className={`flex items-center gap-3 ${centerBrand ? 'absolute right-4 sm:right-6' : ''}`}>
            {isConnected ? (
              <div className="flex items-center gap-2">
                {/* Balance + Address pill */}
                <div className="hidden sm:flex items-center gap-2 rounded-lg bg-white/10 border border-white/10 px-3 py-2">
                  <span className="inline-flex items-center gap-1 text-white text-sm">
                    <Wallet size={16} className="opacity-80" />
                    {balance} HBAR
                  </span>
                  <span className="text-gray-400">•</span>
                  <span className="text-white text-sm font-medium">{shortAddress(address || undefined)}</span>
                  <button onClick={handleCopy} className="text-gray-300 hover:text-teal-400" aria-label="Copy address">
                    <Copy size={16} />
                  </button>
                </div>
                {/* Mobile: condensed chip */}
                <div className="sm:hidden inline-flex items-center gap-1 rounded-md bg-white/10 text-white text-xs px-2 py-1">
                  <Wallet size={14} />
                  {balance} • {shortAddress(address || undefined)}
                </div>
                <Button variant="ghost" onClick={disconnect} className="px-4 py-2">
                  <LogOut size={16} className="mr-2" />
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button 
                variant="primary" 
                onClick={connect} 
                disabled={connecting}
                className="px-6 py-3 text-base font-bold"
              >
                <Wallet size={20} className="mr-2" />
                {connecting ? 'Connecting...' : 'Connect Wallet'}
              </Button>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}