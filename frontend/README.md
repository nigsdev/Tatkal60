# Tatkal60 Frontend

A React + TypeScript frontend for the Tatkal60 oracle-settled UP/DOWN micro-market platform.

## Features

- **React 19** with TypeScript for type safety
- **Vite** for fast development and building
- **Tailwind CSS** for utility-first styling
- **Zustand** for state management
- **Ethers.js v6** for blockchain interactions
- **Viem** for additional blockchain utilities
- **date-fns** for date formatting
- **Prettier** for code formatting

## Tech Stack

- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Blockchain**: Ethers.js v6, Viem
- **Date Handling**: date-fns
- **Code Quality**: Prettier, ESLint

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Install dependencies:

```bash
npm install
```

2. Start development server:

```bash
npm run dev
```

3. Open [http://localhost:5173](http://localhost:5173) in your browser

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run abi:copy` - Copy contract ABIs from Hardhat artifacts

## Project Structure

```
src/
├── abi/                # Contract ABIs (auto-copied from Hardhat)
├── components/         # React components
├── constants/          # App constants and configuration
├── lib/                # Core utilities (hedera, contracts, helpers)
├── store/              # Zustand stores
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
├── App.tsx             # Main app component
└── main.tsx            # App entry point
```

## Configuration

### Environment Variables

1. Copy the environment template:
```bash
cp .env.example .env
```

2. Update the `.env` file with your contract addresses and network configuration:

```ini
# Chain configuration
VITE_CHAIN_ID=296
VITE_CHAIN_NAME=Hedera Testnet
VITE_RPC_URL=https://testnet.hashio.io/api
VITE_BLOCK_EXPLORER_URL=https://hashscan.io/testnet
VITE_CURRENCY_NAME=HBAR
VITE_CURRENCY_SYMBOL=HBAR

# Contract addresses
VITE_ESCROW_GAME=0xYourEscrowGameAddress
VITE_ORACLE_ADAPTER=0xYourOracleAdapterAddress
VITE_CCIP_RECEIVER=0xYourCCIPReceiverAddress
```

### Contract System

The app uses a factory-based contract system in `src/lib/contracts.ts`:

```typescript
import { escrow, oracle, ccip } from '../lib/contracts';

// Read contract data
const eg = escrow();
const roundInfo = await eg.read().getRound(0);

// Write transactions
const writeContract = await eg.write();
const tx = await writeContract.betUp(0, { value: parseEther('0.5') });
```

### ABI Management

Contract ABIs are automatically copied from Hardhat artifacts:

```bash
npm run abi:copy
```

## Development

### Code Formatting

The project uses Prettier for consistent code formatting. Run:

```bash
npm run format
```

### State Management

The app uses Zustand for state management with two main stores:

- `useWalletStore` - Wallet connection and account state
- `useAppStore` - Application state (rounds, bets, loading, etc.)

### Styling

The project uses Tailwind CSS with custom components defined in `src/index.css`:

- `.btn-primary` - Primary button style
- `.btn-secondary` - Secondary button style
- `.card` - Card container style

## Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Contributing

1. Follow the existing code style
2. Run `npm run format` before committing
3. Ensure all TypeScript types are properly defined
4. Test wallet connections and contract interactions

## License

MIT
