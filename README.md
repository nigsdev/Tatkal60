# Tatkal60 - Fast Prediction Markets on Hedera

**Tatkal60** is a high-speed prediction market platform built on Hedera Hashgraph, featuring 60-second betting rounds with real-time price feeds from Pyth Network. Users can bet on BTC/USD price movements with instant settlements and automated payouts.

## 🚀 Features

- **⚡ 60-Second Rounds**: Ultra-fast betting windows with 50-second betting periods
- **📊 Real-Time Price Feeds**: Live BTC/USD prices from Pyth Network
- **🔒 Secure Escrow**: Smart contract-based fund management with automatic payouts
- **🌐 Hedera Integration**: Built on Hedera Testnet for fast, low-cost transactions
- **📱 Modern UI**: React-based frontend with real-time updates
- **🔄 Event-Driven**: WebSocket and polling-based real-time data synchronization
- **🛡️ Error Handling**: Comprehensive error management with user-friendly messages

## 🏗️ Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Tatkal60 Platform                        │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (React + TypeScript)                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Dashboard     │  │  Admin Panel    │  │   Live Price    │ │
│  │   - Active      │  │  - Create Rounds│  │   - BTC/USD     │ │
│  │   - Past Rounds │  │  - Schedule     │  │   - Real-time   │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Round Cards   │  │   Event Bus     │  │   Error Handler │ │
│  │   - Betting     │  │   - WebSocket   │  │   - Validation  │ │
│  │   - Countdown   │  │   - Polling     │  │   - Recovery    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Hedera Testnet Layer                         │
├─────────────────────────────────────────────────────────────────┤
│  Smart Contracts (Solidity)                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   EscrowGame    │  │  OracleAdapter  │  │  CCIPReceiver   │ │
│  │   - Betting     │  │   - Pyth Feeds  │  │   - Cross-chain │ │
│  │   - Resolution  │  │   - Price Data  │  │   - Credits     │ │
│  │   - Payouts     │  │   - Validation  │  │   - Transfers   │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    External Services                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  Pyth Network   │  │  MetaMask       │  │  HashScan       │ │
│  │  - Price Feeds  │  │  - Wallet       │  │  - Explorer     │ │
│  │  - BTC/USD      │  │  - Transactions │  │  - Verification │ │
│  │  - Real-time    │  │  - Network      │  │  - Monitoring   │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Smart Contract Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        EscrowGame Contract                      │
├─────────────────────────────────────────────────────────────────┤
│  Core Functions:                                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  createRound()  │  │   betUp()       │  │   betDown()     │ │
│  │  - 60s rounds   │  │   - UP betting  │   │   - DOWN betting│ │
│  │  - Time locks   │  │   - HBAR stake  │   │   - HBAR stake  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   resolve()     │  │    claim()      │  │  getUserStakes()│ │
│  │   - Price check │  │   - Payouts     │  │   - User data   │ │
│  │   - Outcome     │  │   - Refunds     │  │   - Balances    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  Round Structure:                                               │
│  • Start Time: Round begins                                     │
│  • Lock Time: Betting ends (50s betting window)                │
│  • Resolve Time: Round ends (60s total)                        │
│  • Outcome: UP (1), DOWN (2), or FLAT (3)                      │
└─────────────────────────────────────────────────────────────────┘
```

## 🛠️ Technology Stack

### Smart Contracts
- **Solidity** ^0.8.24
- **OpenZeppelin** Contracts for security
- **Hardhat** for development and testing
- **Hedera Hashgraph** for blockchain infrastructure

### Frontend
- **React** 19.1.1 with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **Ethers.js** for blockchain interaction
- **Zustand** for state management
- **Lucide React** for icons

### External Services
- **Pyth Network** for price feeds
- **MetaMask** for wallet integration
- **Hedera Testnet** for blockchain network

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- MetaMask wallet
- HBAR tokens on Hedera Testnet

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd tatkal60
   ```

2. **Install dependencies**
   ```bash
   # Install contract dependencies
   cd contracts
   npm install
   
   # Install frontend dependencies
   cd ../frontend
   npm install
   ```

3. **Configure environment**
   ```bash
   # Copy environment template
   cp frontend/.env.example frontend/.env
   
   # Edit with your configuration
   nano frontend/.env
   ```

4. **Deploy contracts**
   ```bash
   cd contracts
   npm run deploy
   ```

5. **Start development server**
   ```bash
   cd frontend
   npm run dev
   ```

## 📋 Usage

### For Users
1. **Connect Wallet**: Connect MetaMask to Hedera Testnet
2. **View Rounds**: Browse active and past betting rounds
3. **Place Bets**: Bet UP or DOWN on BTC/USD price movements
4. **Claim Winnings**: Automatically claim winnings after round resolution

### For Admins
1. **Create Rounds**: Use Admin Panel to create new betting rounds
2. **Schedule Rounds**: Set custom start times for future rounds
3. **Monitor Activity**: Track round activity and user participation

## 🔧 Configuration

### Environment Variables
```env
# Frontend (.env)
VITE_ESCROW_GAME=0x...     # EscrowGame contract address
VITE_ORACLE_ADAPTER=0x...  # OracleAdapter contract address
VITE_CCIP_RECEIVER=0x...   # CCIPReceiver contract address
VITE_OWNER=0x...           # Admin wallet address
VITE_BLOCK_EXPLORER_URL=https://hashscan.io/testnet
```

### Network Configuration
- **Hedera Testnet**: Chain ID 296
- **RPC URL**: https://testnet.hashio.io/api
- **Currency**: HBAR (18 decimals)

## 🧪 Testing

### Smart Contracts
```bash
cd contracts
npm test                    # Run all tests
npm run test:coverage      # Run with coverage
```

### Frontend
```bash
cd frontend
npm run build              # Build for production
npm run lint               # Run ESLint
npm run format             # Format code
```

## 📊 Round Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                        Round Lifecycle                         │
├─────────────────────────────────────────────────────────────────┤
│  Phase 1: Creation (Admin)                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Create Round  │  │   Set Times     │  │   Deploy        │ │
│  │   - 60s total   │  │   - Start       │  │   - Contract    │ │
│  │   - BTC/USD     │  │   - Lock (50s)  │  │   - Events      │ │
│  │   - Market      │  │   - Resolve     │  │   - Ready       │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                │                               │
│                                ▼                               │
│  Phase 2: Betting (Users)                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Round Start   │  │   Place Bets    │  │   Lock Time     │ │
│  │   - Price lock  │  │   - UP/DOWN     │  │   - Betting end │ │
│  │   - Betting     │  │   - HBAR stake  │  │   - Pool final  │ │
│  │   - 50s window  │  │   - Real-time   │  │   - Wait        │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                │                               │
│                                ▼                               │
│  Phase 3: Resolution (System)                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Resolve Time  │  │   Get Price     │  │   Determine     │ │
│  │   - 60s elapsed │  │   - Pyth feed   │  │   - UP/DOWN/    │ │
│  │   - Auto/Manual │  │   - Compare     │  │   - FLAT        │ │
│  │   - Trigger     │  │   - Validate    │  │   - Outcome     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                │                               │
│                                ▼                               │
│  Phase 4: Payouts (Users)                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Claim Ready   │  │   User Claims   │  │   Payouts       │ │
│  │   - Winnings    │  │   - Manual      │  │   - HBAR        │ │
│  │   - Refunds     │  │   - Auto        │  │   - Complete    │ │
│  │   - Available   │  │   - Transaction │  │   - Final       │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 🔒 Security Features

- **Reentrancy Protection**: OpenZeppelin ReentrancyGuard
- **Access Control**: Owner-only admin functions
- **Price Validation**: Oracle freshness checks
- **Amount Limits**: Maximum bet limits (1000 HBAR)
- **Time Validation**: Strict round timing enforcement
- **Fund Safety**: Escrow-based fund management

## 🚨 Error Handling

The platform includes comprehensive error handling for:

- **Pyth Stale Prices**: Automatic refresh with retry mechanism
- **Bet Amount Validation**: Min/max bet enforcement with UI feedback
- **Network Issues**: Wrong chain detection with auto-switch
- **Transaction Failures**: User-friendly error messages with recovery actions
- **Oracle Failures**: Fallback mechanisms and manual intervention

## 📈 Performance

- **Real-time Updates**: WebSocket + polling fallback
- **Optimized Builds**: Vite-based fast builds
- **Efficient State**: Zustand for minimal re-renders
- **Smart Caching**: Contract data caching
- **Responsive UI**: Mobile-first design

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🔗 Links

- **Hedera Testnet**: https://portal.hedera.com/
- **Pyth Network**: https://pyth.network/
- **HashScan Explorer**: https://hashscan.io/testnet
- **MetaMask**: https://metamask.io/

## 📞 Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the test files for examples

---

**Built with ❤️ on Hedera Hashgraph**