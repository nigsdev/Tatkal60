// Contract addresses from deployment
export const CONTRACT_ADDRESSES = {
  ORACLE_ADAPTER: '0xE02Fd36d82017c719E341F317428B5920E0fAC77',
  ESCROW_GAME: '0xb62f0F041BDC50465201Cca3EdDDd073c5E7a70F',
  CCIP_RECEIVER: '0x22B6e83A32A920663fC6CEB3f44D45277F7b213D',
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
