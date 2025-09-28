// src/lib/round-helpers.ts
// Helper functions for working with RoundVM data

import { hbar } from './format';
import type { RoundVM, RoundStatus } from './readModel';

// Format HBAR amounts for display (legacy function, use hbar from format.ts)
export function formatHBAR(wei: bigint): string {
  return hbar(wei);
}

// Format timestamp for display
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

// Get time remaining until a timestamp
export function getTimeRemaining(targetTs: number): string {
  const now = Math.floor(Date.now() / 1000);
  const remaining = targetTs - now;
  
  if (remaining <= 0) return 'Ended';
  
  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

// Get status color for UI
export function getStatusColor(status: RoundStatus): string {
  switch (status) {
    case 'Upcoming': return 'text-gray-400';
    case 'Betting': return 'text-green-400';
    case 'Locked': return 'text-yellow-400';
    case 'Resolving': return 'text-orange-400';
    case 'Resolved': return 'text-blue-400';
    default: return 'text-gray-400';
  }
}

// Get status background color for UI
export function getStatusBgColor(status: RoundStatus): string {
  switch (status) {
    case 'Upcoming': return 'bg-gray-400/10';
    case 'Betting': return 'bg-green-400/10';
    case 'Locked': return 'bg-yellow-400/10';
    case 'Resolving': return 'bg-orange-400/10';
    case 'Resolved': return 'bg-blue-400/10';
    default: return 'bg-gray-400/10';
  }
}

// Calculate total pool size
export function getTotalPool(round: RoundVM): bigint {
  return round.upPool + round.downPool;
}

// Calculate user's total stake
export function getUserTotalStake(round: RoundVM): bigint {
  return round.userUp + round.userDown;
}

// Check if user has any stake in this round
export function hasUserStake(round: RoundVM): boolean {
  return round.userUp > 0n || round.userDown > 0n;
}

// Get result text
export function getResultText(resultSide: number): string {
  switch (resultSide) {
    case 0: return 'FLAT';
    case 1: return 'UP';
    case 2: return 'DOWN';
    default: return 'UNKNOWN';
  }
}

// Get result color
export function getResultColor(resultSide: number): string {
  switch (resultSide) {
    case 0: return 'text-gray-400';
    case 1: return 'text-green-400';
    case 2: return 'text-red-400';
    default: return 'text-gray-400';
  }
}

// Check if round is active (betting or locked)
export function isRoundActive(round: RoundVM): boolean {
  return round.status === 'Betting' || round.status === 'Locked';
}

// Check if round is finished
export function isRoundFinished(round: RoundVM): boolean {
  return round.status === 'Resolved';
}

// Get user's winning side (if any)
export function getUserWinningSide(round: RoundVM): 'up' | 'down' | 'none' {
  if (!round.resolved) return 'none';
  
  if (round.resultSide === 1 && round.userUp > 0n) return 'up';
  if (round.resultSide === 2 && round.userDown > 0n) return 'down';
  
  return 'none';
}

// Calculate potential winnings (before fees)
export function getPotentialWinnings(round: RoundVM): bigint {
  if (!round.resolved) return 0n;
  
  const totalPool = getTotalPool(round);
  const fee = (totalPool * BigInt(round.feeBps)) / 10000n;
  const distributable = totalPool - fee;
  
  if (round.resultSide === 0) {
    // FLAT - refund all bets
    return getUserTotalStake(round);
  }
  
  if (round.resultSide === 1 && round.userUp > 0n) {
    // UP won
    const denom = round.upPool === 0n ? 1n : round.upPool;
    return (distributable * round.userUp) / denom;
  }
  
  if (round.resultSide === 2 && round.userDown > 0n) {
    // DOWN won
    const denom = round.downPool === 0n ? 1n : round.downPool;
    return (distributable * round.userDown) / denom;
  }
  
  return 0n;
}

// Get round summary for display
export function getRoundSummary(round: RoundVM): {
  id: number;
  status: RoundStatus;
  timeRemaining: string;
  totalPool: string;
  userStake: string;
  claimable: string;
  result: string;
} {
  return {
    id: round.id,
    status: round.status,
    timeRemaining: getTimeRemaining(round.resolveTs),
    totalPool: formatHBAR(getTotalPool(round)),
    userStake: formatHBAR(getUserTotalStake(round)),
    claimable: formatHBAR(round.claimable),
    result: getResultText(round.resultSide),
  };
}

// Filter rounds by status
export function filterRoundsByStatus(rounds: RoundVM[], status: RoundStatus): RoundVM[] {
  return rounds.filter(round => round.status === status);
}

// Filter rounds where user has stake
export function filterUserRounds(rounds: RoundVM[]): RoundVM[] {
  return rounds.filter(round => hasUserStake(round));
}

// Filter rounds where user can claim
export function filterClaimableRounds(rounds: RoundVM[]): RoundVM[] {
  return rounds.filter(round => round.canClaim);
}

// Sort rounds by ID (newest first)
export function sortRoundsByNewest(rounds: RoundVM[]): RoundVM[] {
  return [...rounds].sort((a, b) => b.id - a.id);
}

// Sort rounds by ID (oldest first)
export function sortRoundsByOldest(rounds: RoundVM[]): RoundVM[] {
  return [...rounds].sort((a, b) => a.id - b.id);
}

// Get rounds statistics
export function getRoundsStats(rounds: RoundVM[]): {
  total: number;
  upcoming: number;
  betting: number;
  locked: number;
  resolving: number;
  resolved: number;
  userRounds: number;
  claimableRounds: number;
  totalClaimable: bigint;
} {
  const stats = {
    total: rounds.length,
    upcoming: 0,
    betting: 0,
    locked: 0,
    resolving: 0,
    resolved: 0,
    userRounds: 0,
    claimableRounds: 0,
    totalClaimable: 0n,
  };
  
  for (const round of rounds) {
    stats[round.status.toLowerCase() as keyof typeof stats]++;
    
    if (hasUserStake(round)) {
      stats.userRounds++;
    }
    
    if (round.canClaim) {
      stats.claimableRounds++;
      stats.totalClaimable += round.claimable;
    }
  }
  
  return stats;
}
