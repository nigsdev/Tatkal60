// Contract types
export interface Round {
  id: number;
  market: string;
  startTs: number;
  lockTs: number;
  resolveTs: number;
  refPrice: bigint;
  settlePrice: bigint;
  upPool: bigint;
  downPool: bigint;
  resolved: boolean;
  outcome: number; // 0 = NONE, 1 = UP, 2 = DOWN, 3 = FLAT
}

export interface PriceData {
  price: bigint;
  decimals: number;
  lastUpdate: number;
}

// Wallet types
export interface WalletState {
  address: string | null;
  balance: string;
  isConnected: boolean;
  chainId: number | null;
}

// App state types
export interface AppState {
  rounds: Round[];
  currentRound: Round | null;
  userBets: Record<number, { up: bigint; down: bigint }>;
  loading: boolean;
  error: string | null;
}

// Market types
export type MarketType = 'HBAR/USD' | 'ETH/USD' | 'BTC/USD';

export interface Market {
  id: string;
  name: MarketType;
  priceId: string;
  currentPrice: PriceData | null;
}
