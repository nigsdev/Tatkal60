// Contract addresses (update these with your deployed contracts)
export const CONTRACT_ADDRESSES = {
  ORACLE_ADAPTER: '0x134D1A3ed1d558c10E2f2b59672Eb661172E2Ec4',
  ESCROW_GAME: '0xdD1F5E939147d1ab95151100794dc7F5E4A7E61c',
  CCIP_RECEIVER: '0xA44c57068069690504Ca6F4434dAfdd120e23756',
} as const;

// Network configuration
export const NETWORK_CONFIG = {
  HEDERA_TESTNET: {
    chainId: 296,
    name: 'Hedera Testnet',
    rpcUrl: 'https://testnet.hashio.io/api',
    blockExplorer: 'https://hashscan.io/testnet',
  },
} as const;

// Market configuration
export const MARKETS = {
  'HBAR/USD': {
    id:
      '0x' +
      'HBAR/USD'
        .split('')
        .map(c => c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    name: 'HBAR/USD' as const,
    priceId:
      '0x0000000000000000000000000000000000000000000000000000000000000000', // Mock
  },
  'ETH/USD': {
    id:
      '0x' +
      'ETH/USD'
        .split('')
        .map(c => c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    name: 'ETH/USD' as const,
    priceId:
      '0x0000000000000000000000000000000000000000000000000000000000000000', // Mock
  },
  'BTC/USD': {
    id:
      '0x' +
      'BTC/USD'
        .split('')
        .map(c => c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    name: 'BTC/USD' as const,
    priceId:
      '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43', // Pyth BTC/USD
  },
} as const;

// UI constants
export const UI_CONFIG = {
  REFRESH_INTERVAL: 30000, // 30 seconds
  MAX_BET_AMOUNT: '1000', // 1000 HBAR
  MIN_BET_AMOUNT: '0.1', // 0.1 HBAR
  ROUND_DURATION: 3600, // 1 hour in seconds
} as const;
