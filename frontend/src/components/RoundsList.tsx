import { useState, useEffect } from 'react';
import { Clock, TrendingUp, TrendingDown, Minus, Wallet } from 'lucide-react';
import Card from './ui/Card';
import Button from './ui/Button';
import RoundCard from './RoundCard';
import { loadRounds, loadMyRounds, type RoundVM } from '../lib/readModel';
import { hbar } from '../lib/format';
import { 
  formatTimestamp, 
  getTimeRemaining, 
  getStatusColor, 
  getStatusBgColor,
  getResultText,
  getResultColor,
  hasUserStake,
  isRoundActive,
  isRoundFinished,
  getUserWinningSide,
  getRoundsStats
} from '../lib/round-helpers';
import { useWalletStore } from '../lib/hedera';

export default function RoundsList() {
  const { isConnected } = useWalletStore();
  const [rounds, setRounds] = useState<RoundVM[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [showMyRounds, setShowMyRounds] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const data = showMyRounds ? await loadMyRounds() : await loadRounds();
      setRounds(data);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load rounds');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [showMyRounds, isConnected]);

  const stats = getRoundsStats(rounds);

  const getWinningIcon = (resultSide: number) => {
    switch (resultSide) {
      case 1: return <TrendingUp size={16} className="text-green-400" />;
      case 2: return <TrendingDown size={16} className="text-red-400" />;
      default: return <Minus size={16} className="text-gray-400" />;
    }
  };

  const getUserStakeIcon = (round: RoundVM) => {
    if (!hasUserStake(round)) return null;
    
    const winningSide = getUserWinningSide(round);
    if (winningSide === 'up') return <TrendingUp size={16} className="text-green-400" />;
    if (winningSide === 'down') return <TrendingDown size={16} className="text-red-400" />;
    return <Wallet size={16} className="text-gray-400" />;
  };

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Rounds</h2>
          <div className="flex items-center gap-2">
            <Button
              variant={showMyRounds ? 'primary' : 'outline'}
              onClick={() => setShowMyRounds(false)}
              className="px-4 py-2"
            >
              All Rounds
            </Button>
            <Button
              variant={!showMyRounds ? 'primary' : 'outline'}
              onClick={() => setShowMyRounds(true)}
              className="px-4 py-2"
            >
              My Rounds
            </Button>
            <Button onClick={loadData} disabled={loading} className="px-4 py-2">
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div className="text-center">
            <div className="text-2xl font-bold text-teal-400">{stats.total}</div>
            <div className="text-gray-400">Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">{stats.betting}</div>
            <div className="text-gray-400">Betting</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">{stats.resolved}</div>
            <div className="text-gray-400">Resolved</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400">{stats.claimableRounds}</div>
            <div className="text-gray-400">Claimable</div>
          </div>
        </div>
      </Card>

      {/* Error message */}
      {error && (
        <Card className="p-4 border-red-400/50">
          <div className="text-red-400">Error: {error}</div>
        </Card>
      )}

      {/* Demo RoundCard */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-4">RoundCard Demo</h3>
        <div className="grid gap-4">
          {/* Demo with different statuses */}
          <RoundCard 
            r={{
              id: 1,
              status: 'Betting',
              lockTs: Math.floor(Date.now()/1000) + 45,
              resolveTs: Math.floor(Date.now()/1000) + 60,
              poolUp: BigInt('1000000000000000000'), // 1 HBAR
              poolDown: BigInt('2000000000000000000'), // 2 HBAR
              userUp: BigInt('500000000000000000'), // 0.5 HBAR
              userDown: BigInt('0'),
              claimable: BigInt('0'),
              canClaim: false,
              resultSide: 0
            }}
            onChanged={() => {
              console.log('Round changed - refreshing data...');
              // In a real app, this would trigger a data refresh
            }}
          />
          <RoundCard 
            r={{
              id: 2,
              status: 'Resolved',
              lockTs: Math.floor(Date.now()/1000) - 30,
              resolveTs: Math.floor(Date.now()/1000) - 10,
              poolUp: BigInt('5000000000000000000'), // 5 HBAR
              poolDown: BigInt('3000000000000000000'), // 3 HBAR
              userUp: BigInt('1000000000000000000'), // 1 HBAR
              userDown: BigInt('0'),
              claimable: BigInt('1500000000000000000'), // 1.5 HBAR
              canClaim: true,
              resultSide: 1
            }}
            onChanged={() => {
              console.log('Round changed - refreshing data...');
              // In a real app, this would trigger a data refresh
            }}
          />
        </div>
      </div>

      {/* Rounds list */}
      {rounds.length === 0 && !loading ? (
        <Card className="p-8 text-center">
          <div className="text-gray-400">
            {showMyRounds ? 'No rounds with your participation found' : 'No rounds found'}
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {rounds.map((round) => (
            <Card key={round.id} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="text-2xl font-bold text-white">#{round.id}</div>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBgColor(round.status)} ${getStatusColor(round.status)}`}>
                    {round.status}
                  </div>
                  {isRoundFinished(round) && (
                    <div className="flex items-center gap-1">
                      {getWinningIcon(round.resultSide)}
                      <span className={`text-sm font-medium ${getResultColor(round.resultSide)}`}>
                        {getResultText(round.resultSide)}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {getUserStakeIcon(round)}
                  {round.canClaim && (
                    <div className="text-sm text-yellow-400 font-medium">
                      Claim: {hbar(round.claimable)}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-gray-400 mb-1">Time</div>
                  <div className="flex items-center gap-1">
                    <Clock size={14} />
                    <span className="text-white">
                      {isRoundActive(round) ? getTimeRemaining(round.resolveTs) : formatTimestamp(round.resolveTs)}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 mb-1">Total Pool</div>
                  <div className="text-white font-medium">
                    {hbar(round.poolUp + round.poolDown)} HBAR
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 mb-1">Your Stake</div>
                  <div className="text-white font-medium">
                    {hbar(round.userUp + round.userDown)} HBAR
                  </div>
                </div>
              </div>

              {/* Pool breakdown */}
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <TrendingUp size={14} className="text-green-400" />
                    <span className="text-gray-400">UP Pool</span>
                  </div>
                  <span className="text-white">{hbar(round.poolUp)} HBAR</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <TrendingDown size={14} className="text-red-400" />
                    <span className="text-gray-400">DOWN Pool</span>
                  </div>
                  <span className="text-white">{hbar(round.poolDown)} HBAR</span>
                </div>
              </div>

              {/* User stakes breakdown */}
              {hasUserStake(round) && (
                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <TrendingUp size={14} className="text-green-400" />
                      <span className="text-gray-400">Your UP</span>
                    </div>
                    <span className="text-white">{hbar(round.userUp)} HBAR</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <TrendingDown size={14} className="text-red-400" />
                      <span className="text-gray-400">Your DOWN</span>
                    </div>
                    <span className="text-white">{hbar(round.userDown)} HBAR</span>
                  </div>
                </div>
              )}

              {/* Claimable info */}
              {round.canClaim && (
                <div className="mt-4 p-3 bg-yellow-400/10 border border-yellow-400/20 rounded-lg">
                  <div className="text-yellow-400 text-sm font-medium">
                    🎉 You can claim {hbar(round.claimable)} HBAR
                  </div>
                  {round.reason && (
                    <div className="text-yellow-300 text-xs mt-1">{round.reason}</div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
