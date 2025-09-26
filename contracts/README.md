# Tatkal60 Smart Contracts

This directory contains the smart contracts for the Tatkal60 project, built using Hardhat.

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

# Deploy to local network (if needed)
npm run deploy:local
```

## Project Structure

- `contracts/` - Solidity smart contracts
- `test/` - Test files
- `scripts/` - Deployment scripts
  - `deploy.js` - Main deployment script (works with Hedera testnet)
  - `generate-wallet.js` - Wallet generation utility
- `hardhat.config.js` - Hardhat configuration

## Available Scripts

- `npm run compile` - Compile smart contracts
- `npm run test` - Run tests
- `npm run deploy` - Deploy to Hedera testnet
- `npm run deploy:local` - Deploy to local network
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

### Lock.sol
A simple time-locked contract that holds ETH until a specified unlock time.
