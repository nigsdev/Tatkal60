import { formatUnits, parseUnits } from 'ethers';
import { format, formatDistanceToNow } from 'date-fns';
import { hbar } from '../lib/format';

// Format HBAR amounts (legacy function, use hbar from format.ts)
export const formatHBAR = (
  amount: bigint | string,
  _decimals: number = 18
): string => {
  return hbar(amount);
};

// Parse HBAR amounts
export const parseHBAR = (amount: string, decimals: number = 18): bigint => {
  try {
    return parseUnits(amount, decimals);
  } catch {
    return 0n;
  }
};

// Format price with proper decimals
export const formatPrice = (price: bigint, decimals: number): string => {
  const formatted = formatUnits(price, decimals);
  const num = parseFloat(formatted);
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  });
};

// Format timestamp
export const formatTimestamp = (timestamp: number): string => {
  return format(new Date(timestamp * 1000), 'MMM dd, yyyy HH:mm:ss');
};

// Format relative time
export const formatRelativeTime = (timestamp: number): string => {
  return formatDistanceToNow(new Date(timestamp * 1000), { addSuffix: true });
};

// Get outcome text
export const getOutcomeText = (outcome: number): string => {
  switch (outcome) {
    case 0:
      return 'None';
    case 1:
      return 'UP';
    case 2:
      return 'DOWN';
    case 3:
      return 'FLAT';
    default:
      return 'Unknown';
  }
};

// Get outcome color
export const getOutcomeColor = (outcome: number): string => {
  switch (outcome) {
    case 1:
      return 'text-green-600';
    case 2:
      return 'text-red-600';
    case 3:
      return 'text-gray-600';
    default:
      return 'text-gray-400';
  }
};

// Truncate address
export const truncateAddress = (
  address: string,
  start: number = 6,
  end: number = 4
): string => {
  if (!address) return '';
  return `${address.slice(0, start)}...${address.slice(-end)}`;
};

// Validate HBAR amount
export const isValidHBARAmount = (amount: string): boolean => {
  const num = parseFloat(amount);
  return !isNaN(num) && num > 0 && num <= 1000;
};

// Calculate payout
export const calculatePayout = (
  userStake: bigint,
  totalWinningPool: bigint,
  totalWinningStakes: bigint,
  feeBps: number
): bigint => {
  if (totalWinningStakes === 0n) return 0n;

  const feeMultiplier = (10000n - BigInt(feeBps)) / 10000n;
  const winningPoolAfterFee = (totalWinningPool * feeMultiplier) / 10000n;

  return (userStake * winningPoolAfterFee) / totalWinningStakes;
};
