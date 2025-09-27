import { Info, Play, Cpu, Wallet, Shield, Zap, Clock, TrendingUp, Award } from 'lucide-react';
import Card from '../components/ui/Card';
import banner from '../assets/banner.png';

export default function About() {
  return (
    <div className="space-y-6">
      {/* Banner Section */}
      <section className="relative">
        <div className="relative h-48 sm:h-64 lg:h-80 overflow-hidden rounded-xl">
          <img
            src={banner}
            alt="Tatkal60 Banner"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute bottom-6 left-6 right-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-teal-500/20 border border-teal-500/30">
                <Info size={20} className="text-teal-400" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">About Tatkal60</h1>
            </div>
            <p className="text-gray-200 text-sm sm:text-base max-w-2xl">
              A revolutionary 60-second micro-market platform for BTC/USD price prediction on Hedera
            </p>
          </div>
        </div>
      </section>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* What is Tatkal60 */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30">
              <Zap size={20} className="text-emerald-400" />
            </div>
            <h2 className="text-white font-semibold text-lg">What is Tatkal60?</h2>
          </div>
          <p className="text-gray-300 leading-relaxed">
            A 60-second micro-market on BTC/USD. Bet UP or DOWN. At T=60s, an on-chain Pyth price decides the outcome — claim instantly on Hedera.
          </p>
        </Card>

        {/* How it works */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-cyan-500/20 border border-cyan-500/30">
              <Play size={20} className="text-cyan-400" />
            </div>
            <h2 className="text-white font-semibold text-lg">How it works</h2>
          </div>
          <ol className="list-decimal list-inside text-gray-300 space-y-2">
            <li>Create or join a 60s round</li>
            <li>Place UP/DOWN bet while betting is open</li>
            <li>Refresh Pyth & Resolve at T=60s</li>
            <li>Winners claim (losing pool − fee distributed)</li>
          </ol>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Tech */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-purple-500/20 border border-purple-500/30">
              <Cpu size={20} className="text-purple-400" />
            </div>
            <h3 className="text-white font-semibold">Tech</h3>
          </div>
          <ul className="text-gray-300 text-sm space-y-2">
            <li>• Hedera EVM + HTS</li>
            <li>• Pyth BTC/USD price feed</li>
            <li>• Chainlink CCIP (Sepolia → Hedera) — coming</li>
          </ul>
        </Card>

        {/* Wallets */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-blue-500/20 border border-blue-500/30">
              <Wallet size={20} className="text-blue-400" />
            </div>
            <h3 className="text-white font-semibold">Wallets</h3>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-400"></div>
              <span className="text-gray-300 text-sm">MetaMask (Currently supported)</span>
            </div>
            <div className="flex items-center gap-2 opacity-60">
              <div className="w-2 h-2 rounded-full bg-gray-500"></div>
              <span className="text-gray-400 text-sm">HashPack, Kabila, Snap — Coming soon</span>
            </div>
          </div>
        </Card>

        {/* Fairness */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-green-500/20 border border-green-500/30">
              <Shield size={20} className="text-green-400" />
            </div>
            <h3 className="text-white font-semibold">Fairness</h3>
          </div>
          <p className="text-gray-300 text-sm">
            We fetch a fresh Pyth update before resolve and require recency on reads to prevent stale data.
          </p>
        </Card>
      </div>

      {/* Why Tatkal60 Section */}
      <Card className="p-6">
        <div className="text-center mb-6">
          <h3 className="text-white font-semibold text-lg mb-2">Why Choose Tatkal60?</h3>
          <p className="text-gray-400 text-sm">Experience the future of decentralized prediction markets</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="text-center">
            <div className="p-3 rounded-xl bg-teal-500/20 border border-teal-500/30 w-fit mx-auto mb-3">
              <Clock size={24} className="text-teal-400" />
            </div>
            <div className="text-xl font-bold text-teal-400 mb-2">60s Rounds</div>
            <div className="text-gray-300 text-sm">Lightning-fast betting rounds for instant gratification</div>
          </div>
          <div className="text-center">
            <div className="p-3 rounded-xl bg-cyan-500/20 border border-cyan-500/30 w-fit mx-auto mb-3">
              <TrendingUp size={24} className="text-cyan-400" />
            </div>
            <div className="text-xl font-bold text-cyan-400 mb-2">Pyth Oracle</div>
            <div className="text-gray-300 text-sm">Real-time price feeds with institutional-grade accuracy</div>
          </div>
          <div className="text-center">
            <div className="p-3 rounded-xl bg-purple-500/20 border border-purple-500/30 w-fit mx-auto mb-3">
              <Zap size={24} className="text-purple-400" />
            </div>
            <div className="text-xl font-bold text-purple-400 mb-2">Hedera Network</div>
            <div className="text-gray-300 text-sm">Ultra-fast transactions with minimal fees</div>
          </div>
          <div className="text-center">
            <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 w-fit mx-auto mb-3">
              <Award size={24} className="text-emerald-400" />
            </div>
            <div className="text-xl font-bold text-emerald-400 mb-2">Instant Rewards</div>
            <div className="text-gray-300 text-sm">Claim your winnings immediately after resolution</div>
          </div>
        </div>
      </Card>

      {/* Getting Started Section */}
      <Card className="p-6">
        <div className="text-center mb-6">
          <h3 className="text-white font-semibold text-lg mb-2">Getting Started</h3>
          <p className="text-gray-400 text-sm">Ready to start your prediction journey?</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="text-center p-4 rounded-lg bg-white/5 border border-white/10">
            <div className="text-2xl font-bold text-teal-400 mb-2">1</div>
            <div className="text-white font-medium mb-1">Connect Wallet</div>
            <div className="text-gray-400 text-sm">Connect your MetaMask wallet to Hedera testnet</div>
          </div>
          <div className="text-center p-4 rounded-lg bg-white/5 border border-white/10">
            <div className="text-2xl font-bold text-cyan-400 mb-2">2</div>
            <div className="text-white font-medium mb-1">Place Bets</div>
            <div className="text-gray-400 text-sm">Bet UP or DOWN on BTC/USD price movements</div>
          </div>
          <div className="text-center p-4 rounded-lg bg-white/5 border border-white/10">
            <div className="text-2xl font-bold text-purple-400 mb-2">3</div>
            <div className="text-white font-medium mb-1">Win & Claim</div>
            <div className="text-gray-400 text-sm">Collect your rewards instantly when you win</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
