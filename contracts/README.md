# Tatkal60 Smart Contracts

Oracle-settled UP/DOWN micro-market on Hedera with optional cross-chain CCIP integration.

## Overview

Tatkal60 is a decentralized prediction market platform that allows users to bet on price movements of various assets (HBAR, ETH, BTC) using oracle-settled rounds. The platform features:

- **EscrowGame**: Core betting contract that manages rounds, handles bets, and distributes payouts
- **OracleAdapter**: Price feed adapter supporting multiple markets with mock data for MVP
- **Cross-chain Integration**: Optional CCIP support for cross-chain credit system

## Prerequisites

- Node.js 22.20.0 or later
- npm 10.9.3 or later
- Hedera account with HBAR for gas fees
- Private key from your Hedera wallet

## Setup

1. Install dependencies:
```bash
npm install
```

2. Generate a new wallet and configure environment:
```bash
# Generate a new EVM wallet for Hedera
npm run generate-wallet

# OR manually configure .env file
cp .env.example .env
# Edit .env with your Hedera private key
```

3. Compile contracts:
```bash
npm run compile
```

4. Run tests:
```bash
npm test
```

5. Deploy contracts:
```bash
# Deploy to Hedera testnet
npm run deploy
```

## Project Structure

- `contracts/` - Solidity smart contracts
  - `EscrowGame.sol` - Main betting contract
  - `OracleAdapter.sol` - Price feed adapter
  - `CCIPReceiver.sol` - Cross-chain message receiver
- `test/` - Test files (to be added)
- `scripts/` - Deployment scripts
  - `deploy-tatkal60.js` - Main deployment script for Tatkal60 contracts
  - `generate-wallet.js` - Wallet generation utility
- `hardhat.config.js` - Hardhat configuration

## Available Scripts

- `npm run compile` - Compile smart contracts
- `npm run test` - Run tests
- `npm run deploy` - Deploy Tatkal60 contracts to Hedera testnet
- `npm run test-ccip` - Test CCIPReceiver functionality
- `npm run generate-wallet` - Generate new EVM wallet for Hedera
- `npm run node` - Start local Hardhat node
- `npm run clean` - Clean build artifacts

## Network Configuration

- **Hardhat Network**: Local development network (Chain ID: 1337)
- **Localhost**: Connect to local node (http://127.0.0.1:8545)
- **Hedera Testnet**: Hedera testnet (Network ID: 296, Chain ID: 296)
- **Hedera Mainnet**: Hedera mainnet (Network ID: 295, Chain ID: 295)

## Hedera Setup

### Option 1: Generate New Wallet (Recommended for Development)
1. Run `npm run generate-wallet` to create a new EVM wallet
2. The script will automatically create a `.env` file with your private key
3. Fund the generated wallet address with testnet HBAR from [Hedera Portal](https://portal.hedera.com/)

### Option 2: Use Existing Wallet
1. Create a Hedera account using [HashPack](https://hashpack.app/) or [Blade Wallet](https://bladewallet.io/)
2. Get testnet HBAR from [Hedera Portal](https://portal.hedera.com/)
3. Export your private key from your wallet
4. Add your private key to the `.env` file

## Environment Variables

Create a `.env` file with the following variables:
```
# Hedera Configuration
# Generated wallet for Tatkal60 project
PRIVATE_KEY=your_private_key_here
HEDERA_ACCOUNT_ID=0.0.0
HEDERA_NETWORK=testnet

# Wallet Details (for reference)
WALLET_ADDRESS=your_wallet_address_here
WALLET_MNEMONIC="your_mnemonic_phrase_here"
```

## Smart Contracts

### EscrowGame.sol
Main betting contract that manages:
- Round creation and management
- UP/DOWN betting functionality
- Oracle-based price resolution
- Winner payouts with platform fees
- Cross-chain credit system integration

### OracleAdapter.sol
Price feed adapter that provides:
- Standardized price data interface
- Support for multiple markets (HBAR/USD, ETH/USD, BTC/USD)
- Mock price data for MVP testing
- Extensible design for real oracle integration

### CCIPReceiver.sol
Cross-chain message receiver that handles:
- Incoming cross-chain messages from Sepolia
- Credit message validation and processing
- Replay attack prevention
- Statistics tracking and monitoring
- Emergency controls and recovery functions

## Contract Features

- **Oracle Settlement**: Uses price feeds to determine round outcomes
- **UP/DOWN Betting**: Simple binary prediction on price movements
- **Platform Fees**: Configurable fees on winning pools
- **Reentrancy Protection**: Secure against reentrancy attacks
- **Owner Controls**: Admin functions for oracle and fee management
- **Cross-chain Ready**: Full CCIP integration with message validation
- **Replay Protection**: Prevents duplicate message processing
- **Statistics Tracking**: Comprehensive monitoring and analytics

## Testing

### Unit Tests
Run comprehensive tests:
```bash
npm test
```

### CCIP Testing
Test CCIP functionality after deployment:
```bash
npm run test-ccip
```

### Test Coverage
- **EscrowGame**: Round creation, betting, resolution, claiming, admin functions
- **OracleAdapter**: Price feed functionality, market support, data validation
- **CCIPReceiver**: Cross-chain message handling, statistics, admin controls
