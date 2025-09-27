import type { ReactNode } from 'react';
import Header from './Header';
import Footer from './Footer';
import banner from '../assets/banner.png';

interface LayoutProps {
  children: ReactNode;
  /** Show hero banner under the header (single-page UI) */
  showHero?: boolean;
  /** Optional hero title (only used when showHero = true) */
  heroTitle?: string;
  /** Optional hero subtitle (only used when showHero = true) */
  heroSubtitle?: string;
}

export default function Layout({
  children,
  showHero = true,
  heroTitle = '60‑Second Price Pulse',
  heroSubtitle = 'Oracle‑settled rounds on Hedera using Pyth BTC/USD',
}: LayoutProps) {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Skip link for accessibility */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-2 focus:rounded-md focus:bg-teal-400 focus:text-black"
      >
        Skip to content
      </a>

      <Header />

      {showHero && (
        <section aria-label="Hero" className="border-b border-white/10">
          <div className="relative">
            {/* Banner image */}
            <img
              src={banner}
              alt="Tatkal60 banner"
              className="w-full h-48 sm:h-64 lg:h-80 xl:h-96 object-cover"
            />
            {/* Subtle gradient overlay for legibility */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
            {/* Text overlay */}
            <div className="absolute inset-x-0 bottom-0">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <h2 className="text-xl sm:text-2xl font-extrabold tracking-wide">
                  {heroTitle}
                </h2>
                <p className="text-sm sm:text-base text-gray-300">
                  {heroSubtitle}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      <main id="main" role="main" className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {/* About / Hero section */}
          <div className="grid gap-6 lg:grid-cols-3 mb-6">
            <div className="lg:col-span-2">
              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <h2 className="text-white text-xl font-bold mb-2">What is Tatkal60?</h2>
                <p className="text-gray-300">
                  A 60-second micro-market on BTC/USD. Bet UP or DOWN. At T=60s, an on-chain Pyth price decides the outcome — claim instantly on Hedera.
                </p>
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-white text-lg font-semibold mb-2">How it works</h3>
              <ol className="list-decimal list-inside text-gray-300 space-y-1">
                <li>Create or join a 60s round</li>
                <li>Place UP/DOWN bet while betting is open</li>
                <li>Refresh Pyth & Resolve at T=60s</li>
                <li>Winners claim (losing pool − fee distributed)</li>
              </ol>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3 mb-6">
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h4 className="text-white font-semibold mb-2">Tech</h4>
              <ul className="text-gray-300 text-sm space-y-1">
                <li>Hedera EVM + HTS</li>
                <li>Pyth BTC/USD price feed</li>
                <li>Chainlink CCIP (Sepolia → Hedera) — coming</li>
              </ul>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h4 className="text-white font-semibold mb-2">Wallets</h4>
              <p className="text-gray-300 text-sm">MetaMask (MVP). HashPack / Kabila / Snap — planned.</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h4 className="text-white font-semibold mb-2">Fairness</h4>
              <p className="text-gray-300 text-sm">We fetch a fresh Pyth update before resolve and require recency on reads to prevent stale data.</p>
            </div>
          </div>

          {children}
        </div>
      </main>

      <Footer />
    </div>
  );
}