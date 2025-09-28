// frontend/src/components/RoundCard.tsx
import { useEffect, useState } from 'react';
import Card from './ui/Card';
import Button from './ui/Button';
import StatusPill from './StatusPill';
import { hbar } from '../lib/format';
import { sendTx, parseHBAR } from '../lib/tx';
import { escrow } from '../lib/contracts';
import { useChainTime } from '../hooks/useChainTime';
import { parseContractError, showErrorToast, validateBetAmount } from '../lib/errorHandler';
import { switchToHederaTestnet, ensureCorrectNetwork } from '../lib/networkUtils';
import { refreshPythPrice } from '../lib/pythUtils';

export default function RoundCard({
  r,
  onChanged,
  mode = 'active',
}: {
  r: any;
  onChanged?: () => void;
  mode?: 'active' | 'past';
}) {
  const [amt, setAmt] = useState('0.1');
  const { skewSeconds, skewDirection } = useChainTime(); // chainTime not used, but hook provides skew info
  const [currentTime, setCurrentTime] = useState<number>(Math.floor(Date.now() / 1000));
  
  // Update current time every second for countdown display
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Math.floor(Date.now() / 1000));
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Note: We now use currentTime for real-time status updates instead of chainTime

  const fmtDur = (secs: number) => {
    const s = Math.max(0, Math.floor(secs));
    const m = Math.floor(s / 60);
    const r = s % 60;
    
    // Show more precise formatting for countdown
    if (s <= 0) return '0s';
    if (m > 0) return `${m}m ${r}s`;
    return `${r}s`;
  };

  // --- Defensive normalization (ms -> s) ------------------------------------
  const norm = (t: any) => {
    const n = Number(t || 0);
    return n > 2_000_000_000 ? Math.floor(n / 1000) : n; // if looks like ms
  };

  // normalized core timestamps from the round
  const start = norm(r.startTs);
  const lock = norm(r.lockTs);
  const resolve = norm(r.resolveTs);

  // Status calculation using currentTime for real-time updates
  const deriveStatus = (timeToUse: number) => {
    if (mode === 'past') {
      if (r.resolved) return 'Resolved';
      if (resolve > 0 && timeToUse >= resolve) return 'Expired';
      // fallback: treat as resolved in past context
      return 'Resolved';
    }

    if (r.resolved) return 'Resolved';
    if (start > 0 && timeToUse < start) return 'Upcoming';

    // If lock is missing/zero, treat [start, resolve) as Betting
    if ((!lock || lock === 0) && resolve > timeToUse && timeToUse >= start)
      return 'Betting';

    if (lock > 0 && timeToUse < lock) return 'Betting';
    if (resolve > 0 && timeToUse < resolve) return 'Locked';
    return 'Resolving';
  };

  // Use currentTime for real-time status updates
  const status = deriveStatus(currentTime) as
    | 'Upcoming'
    | 'Betting'
    | 'Locked'
    | 'Resolving'
    | 'Resolved'
    | 'Expired';

  // Countdown labels: show "--" if timestamp is 0/unknown
  // Use currentTime for display (updates every second) but nowTs for status calculations
  const lockRemaining = lock > 0 ? lock - currentTime : 0;
  const resolveRemaining = resolve > 0 ? resolve - currentTime : 0;
  const startRemaining = start > 0 ? start - currentTime : 0;
  
  const lockLabel = lock > 0 ? fmtDur(lockRemaining) : '--';
  const resolveLabel = resolve > 0 ? fmtDur(resolveRemaining) : '--';
  const startLabel = start > 0 ? fmtDur(startRemaining) : '--';
  
  // Color coding for urgency
  const getTimeColor = (remaining: number) => {
    if (remaining <= 0) return 'text-red-400';
    if (remaining <= 10) return 'text-orange-400';
    if (remaining <= 30) return 'text-yellow-400';
    return 'text-white';
  };
  
  const getTimeClasses = (remaining: number) => {
    const baseColor = getTimeColor(remaining);
    const isCritical = remaining <= 10 && remaining > 0;
    return `${baseColor} font-medium ml-1 ${isCritical ? 'animate-pulse' : ''}`;
  };
  
  const lockClasses = getTimeClasses(lockRemaining);
  const resolveClasses = getTimeClasses(resolveRemaining);

  const isBetting = mode === 'active' && status === 'Betting';
  const isResolving = mode === 'active' && status === 'Resolving';
  const isResolved = status === 'Resolved';
  
  // Enhanced bet amount validation
  const betValidation = validateBetAmount(amt);
  const amtOk = betValidation.valid;

  const addChip = (v: string) => setAmt(v);

  const onBet = async (isUp: boolean) => {
    if (!isBetting || !amtOk) return;
    
    try {
      // Ensure correct network before proceeding
      const networkOk = await ensureCorrectNetwork();
      if (!networkOk) {
        const parsedError = parseContractError(
          { code: 4902, message: 'Wrong network' },
          { action: 'bet', roundId: r.id, amount: amt }
        );
        showErrorToast(parsedError, { action: 'bet', roundId: r.id, amount: amt });
        return;
      }

      const c = await escrow().write();
      const v = parseHBAR(amt);
      
      await sendTx(
        isUp ? 'Bet Up' : 'Bet Down',
        () =>
          isUp
            ? (c as any).betUp(r.id, { value: v })
            : (c as any).betDown(r.id, { value: v }),
        {
          pending: `Confirm ${isUp ? 'Bet Up' : 'Bet Down'}`,
          submitted: `${isUp ? 'Bet Up' : 'Bet Down'} submitted`,
          success: `Bet ${isUp ? 'Up' : 'Down'} executed`,
          error: `Bet ${isUp ? 'Up' : 'Down'} failed`,
        },
        onChanged
      );
    } catch (error: any) {
      // Enhanced error handling
      const parsedError = parseContractError(error, { 
        action: 'bet', 
        roundId: r.id, 
        amount: amt 
      });
      
      // Handle specific error types
      if (parsedError.type === 'pyth_stale') {
        // Override the action to refresh Pyth
        parsedError.action = {
          type: 'refresh_pyth',
          label: 'Refresh Pyth',
          action: async () => {
            const refreshed = await refreshPythPrice();
            if (refreshed) {
              // Retry the bet after refreshing
              setTimeout(() => onBet(isUp), 2000);
            }
          }
        };
      } else if (parsedError.type === 'min_bet' || parsedError.type === 'max_bet') {
        // Override the action to adjust amount
        parsedError.action = {
          type: 'adjust_amount',
          label: parsedError.type === 'min_bet' ? 'Set to 0.001 HBAR' : 'Set to 1000 HBAR',
          action: () => {
            setAmt(parsedError.type === 'min_bet' ? '0.001' : '1000');
          }
        };
      } else if (parsedError.type === 'wrong_chain') {
        // Override the action to switch network
        parsedError.action = {
          type: 'switch_network',
          label: 'Switch Network',
          action: async () => {
            const switched = await switchToHederaTestnet();
            if (switched) {
              // Retry the bet after switching
              setTimeout(() => onBet(isUp), 1000);
            }
          }
        };
      }
      
      showErrorToast(parsedError, { action: 'bet', roundId: r.id, amount: amt });
    }
  };

  const onResolve = async () => {
    if (!isResolving) return;
    
    try {
      // Ensure correct network before proceeding
      const networkOk = await ensureCorrectNetwork();
      if (!networkOk) {
        const parsedError = parseContractError(
          { code: 4902, message: 'Wrong network' },
          { action: 'resolve', roundId: r.id }
        );
        showErrorToast(parsedError, { action: 'resolve', roundId: r.id });
        return;
      }

      const c = await escrow().write();
      const fn = (c as any).resolveRound ?? (c as any).resolve;
      
      await sendTx(
        'Resolve',
        () => fn(r.id),
        {
          pending: 'Confirm Resolve',
          submitted: 'Resolve submitted',
          success: 'Round resolved',
          error: 'Resolve failed',
        },
        onChanged
      );
    } catch (error: any) {
      // Enhanced error handling for resolve
      const parsedError = parseContractError(error, { 
        action: 'resolve', 
        roundId: r.id 
      });
      
      // Handle Pyth stale error for resolve
      if (parsedError.type === 'pyth_stale') {
        parsedError.action = {
          type: 'refresh_pyth',
          label: 'Refresh Pyth',
          action: async () => {
            const refreshed = await refreshPythPrice();
            if (refreshed) {
              // Retry the resolve after refreshing
              setTimeout(() => onResolve(), 2000);
            }
          }
        };
      } else if (parsedError.type === 'wrong_chain') {
        parsedError.action = {
          type: 'switch_network',
          label: 'Switch Network',
          action: async () => {
            const switched = await switchToHederaTestnet();
            if (switched) {
              setTimeout(() => onResolve(), 1000);
            }
          }
        };
      }
      
      showErrorToast(parsedError, { action: 'resolve', roundId: r.id });
    }
  };

  const onClaim = async () => {
    if (!isResolved || !r.canClaim) return;
    const c = await escrow().write();
    const fn = (c as any).claim ?? (c as any).claimWinnings;
    const action = r.resultSide === 0 ? 'Refund' : 'Claim';
    await sendTx(
      action,
      () => fn(r.id),
      {
        pending: `Confirm ${action}`,
        submitted: `${action} submitted`,
        success: `${action} completed`,
        error: `${action} failed`,
      },
      onChanged
    );
  };

  const outcomeLabel = () => {
    switch (Number(r.resultSide ?? -1)) {
      case 1:
        return {
          text: 'UP won',
          cls: 'text-emerald-300',
          dot: 'bg-emerald-400',
        };
      case 2:
        return { text: 'DOWN won', cls: 'text-red-300', dot: 'bg-red-400' };
      case 0:
      case 3:
        return {
          text: 'FLAT — Refundable',
          cls: 'text-purple-300',
          dot: 'bg-purple-400',
        };
      default:
        return { text: '—', cls: 'text-gray-300', dot: 'bg-gray-400' };
    }
  };

  const outcome = outcomeLabel();

  return (
    <Card className="p-6 border border-white/10 hover:border-white/20 transition-all duration-300 overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="text-white font-semibold text-lg">
            BTC/USD — Round #{r.id}
          </div>
          <div className="mt-2">
            <StatusPill key={`${r.id}-${status}-${currentTime}`} status={status} />
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-400 mb-1">Time Remaining</div>
          <div className="space-y-1 text-sm">
            {status === 'Upcoming' && startLabel !== '--' && (
              <div>
                <span className="text-gray-300">Start:</span>
                <span className={getTimeClasses(startRemaining)}>{startLabel}</span>
              </div>
            )}
            <div>
              <span className="text-gray-300">Lock:</span>
              <span className={lockClasses}>{lockLabel}</span>
            </div>
            <div>
              <span className="text-gray-300">Resolve:</span>
              <span className={resolveClasses}>
                {resolveLabel}
              </span>
            </div>
            {skewSeconds > 2 && (
              <div className="text-xs text-yellow-400 mt-1">
                Chain skew: {skewDirection}{skewSeconds}s
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pools */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-xl p-4 border border-emerald-500/20">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <div className="text-emerald-300 text-sm font-medium">UP Pool</div>
          </div>
          <div className="text-white text-xl font-bold">
            {hbar(r.upPool)} HBAR
          </div>
        </div>
        <div className="bg-gradient-to-br from-red-500/10 to-pink-500/10 rounded-xl p-4 border border-red-500/20">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-red-400" />
            <div className="text-red-300 text-sm font-medium">DOWN Pool</div>
          </div>
          <div className="text-white text-xl font-bold">
            {hbar(r.downPool)} HBAR
          </div>
        </div>
      </div>

      {/* Outcome (only in past) */}
      {mode === 'past' && (
        <div className="mb-6 p-4 rounded-lg border border-white/10 bg-white/5">
          <div className="text-sm text-gray-300 mb-2">Outcome</div>
          <div
            className={`flex items-center gap-2 font-semibold ${outcome.cls}`}
          >
            <div className={`w-2 h-2 rounded-full ${outcome.dot}`} />
            <div>{outcome.text}</div>
          </div>
        </div>
      )}

      {/* Amount (hidden in past) */}
      {mode === 'active' && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <label className="text-gray-300 text-sm font-medium">
              Bet Amount (HBAR)
            </label>
            {isBetting && amtOk && (
              <div className="text-xs text-cyan-400 font-medium">
                Total: {amt} HBAR
              </div>
            )}
            {!betValidation.valid && amt && (
              <div className="text-xs text-red-400 font-medium">
                {betValidation.error}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 min-w-0">
            <input
              value={amt}
              onChange={e => setAmt(e.target.value)}
              className={`flex-1 min-w-0 px-4 py-3 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-all duration-200 ${
                !betValidation.valid && amt
                  ? 'bg-red-500/10 border border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50'
                  : isBetting && amtOk
                  ? 'bg-white/10 border border-cyan-500/50 focus:ring-cyan-500/50 focus:border-cyan-500/50'
                  : 'bg-white/5 border border-white/10 focus:ring-cyan-500/50 focus:border-cyan-500/50'
              }`}
              placeholder="0.1"
              inputMode="decimal"
            />
            <div className="flex gap-2">
              {['0.1', '0.5', '1'].map(v => (
                <button
                  key={v}
                  onClick={() => addChip(v)}
                  disabled={!isBetting}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    amt === v
                      ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20'
                      : 'bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      {mode === 'active' ? (
        <div className="space-y-4">
          {/* Betting Status Indicator */}
          {!isBetting && (
            <div className="text-center py-3 px-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <div className="text-yellow-400 text-sm font-medium">
                {status === 'Upcoming' ? (
                  <div className="space-y-1">
                    <div>Betting will start soon</div>
                    {startLabel !== '--' && (
                      <div className="text-xs text-yellow-300">
                        Starts in: <span className="font-mono">{startLabel}</span>
                      </div>
                    )}
                  </div>
                ) : 
                 status === 'Locked' ? 'Betting period has ended' :
                 status === 'Resolving' ? 'Round is being resolved' :
                 'Betting not available'}
              </div>
            </div>
          )}

          {/* Betting Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Button
              disabled={!isBetting || !amtOk}
              onClick={() => onBet(true)}
              className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all duration-200 transform ${
                isBetting && amtOk
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/20 hover:scale-[1.02]'
                  : 'bg-white/5 text-gray-500 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center justify-center gap-3">
                <div className="w-3 h-3 rounded-full bg-emerald-400" />
                <span>Bet Up</span>
                {isBetting && amtOk && (
                  <div className="text-xs opacity-80">
                    {amt} HBAR
                  </div>
                )}
              </div>
            </Button>
            <Button
              disabled={!isBetting || !amtOk}
              onClick={() => onBet(false)}
              className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all duration-200 transform ${
                isBetting && amtOk
                  ? 'bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white shadow-lg shadow-red-500/20 hover:scale-[1.02]'
                  : 'bg-white/5 text-gray-500 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center justify-center gap-3">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <span>Bet Down</span>
                {isBetting && amtOk && (
                  <div className="text-xs opacity-80">
                    {amt} HBAR
                  </div>
                )}
              </div>
            </Button>
          </div>

          {/* Admin Actions (only show for resolving status) */}
          {isResolving && (
            <div className="pt-2 border-t border-white/10">
              <div className="text-center mb-3">
                <div className="text-xs text-gray-400">Admin Action</div>
              </div>
              <Button
                onClick={onResolve}
                className="w-full py-3 px-4 rounded-xl font-semibold bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white shadow-lg shadow-cyan-500/10 transition-all duration-200"
              >
                <div className="flex items-center justify-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-cyan-400" />
                  Resolve Round
                </div>
              </Button>
            </div>
          )}
        </div>
      ) : (
        // Past mode: only claim/refund if available
        <div className="space-y-3">
          {isResolved && r.canClaim ? (
            <Button
              onClick={onClaim}
              className="w-full py-4 px-6 rounded-xl font-bold text-lg bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white shadow-lg shadow-purple-500/20 transition-all duration-200 transform hover:scale-[1.02]"
            >
              <div className="flex items-center justify-center gap-3">
                <div className="w-3 h-3 rounded-full bg-purple-400" />
                <span>{r.resultSide === 0 || r.resultSide === 3 ? 'Refund' : 'Claim'}</span>
                <div className="text-xs opacity-80">
                  {hbar(r.claimable ?? 0n)} HBAR
                </div>
              </div>
            </Button>
          ) : (
            <div className="text-center py-4 px-6 rounded-xl bg-white/5 border border-white/10">
              {(() => {
                // Check if user has any stakes in this round
                const userHasStakes = (r.userUp ?? 0n) > 0n || (r.userDown ?? 0n) > 0n;
                const totalPool = (r.upPool ?? 0n) + (r.downPool ?? 0n);
                const hasAnyBets = totalPool > 0n;
                
                let message = '';
                let icon = '';
                let color = 'text-gray-400';
                
                if (!isResolved) {
                  if (!hasAnyBets) {
                    message = 'No bets placed - round inactive';
                    icon = '⏸️';
                    color = 'text-gray-500';
                  } else if (!userHasStakes) {
                    message = 'Round active but you didn\'t participate';
                    icon = '👀';
                    color = 'text-blue-400';
                  } else {
                    message = 'Round not yet resolved';
                    icon = '⏳';
                    color = 'text-yellow-400';
                  }
                } else if (!r.canClaim) {
                  if (!userHasStakes) {
                    message = 'You didn\'t participate in this round';
                    icon = '👋';
                    color = 'text-gray-400';
                  } else if (hasAnyBets) {
                    message = 'No winnings to claim';
                    icon = '😔';
                    color = 'text-orange-400';
                  } else {
                    message = 'Round had no activity';
                    icon = '📭';
                    color = 'text-gray-500';
                  }
                } else {
                  message = 'No action available';
                  icon = 'ℹ️';
                  color = 'text-gray-400';
                }
                
                return (
                  <div className={`${color} text-sm`}>
                    <div className="text-lg mb-1">{icon}</div>
                    <div>{message}</div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {isResolved && (
        <div className="mt-6 p-4 bg-white/5 rounded-lg border border-white/10">
          <div className="text-sm text-gray-300 mb-2">Round Summary</div>
          {(() => {
            const userStake = (r.userUp ?? 0n) + (r.userDown ?? 0n);
            const claimable = r.claimable ?? 0n;
            const totalPool = (r.upPool ?? 0n) + (r.downPool ?? 0n);
            
            if (userStake > 0n) {
              // User participated
              return (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-400">Your Stake</div>
                    <div className="text-white font-semibold">
                      {hbar(userStake)} HBAR
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400">Claimable</div>
                    <div className="text-cyan-400 font-semibold">
                      {hbar(claimable)} HBAR
                    </div>
                  </div>
                </div>
              );
            } else if (totalPool > 0n) {
              // Round had activity but user didn't participate
              return (
                <div className="text-center py-2">
                  <div className="text-gray-400 text-sm">
                    You didn't participate in this round
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Total pool: {hbar(totalPool)} HBAR
                  </div>
                </div>
              );
            } else {
              // Round had no activity
              return (
                <div className="text-center py-2">
                  <div className="text-gray-400 text-sm">
                    No bets were placed in this round
                  </div>
                </div>
              );
            }
          })()}
        </div>
      )}
    </Card>
  );
}
