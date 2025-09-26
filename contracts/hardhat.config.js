import "dotenv/config";

/** @type import('hardhat/config').HardhatUserConfig */
export default {
  solidity: "0.8.20",
  networks: {
    hardhat: {
      type: "edr-simulated",
      chainId: 1337
    },
    localhost: {
      type: "http",
      url: "http://127.0.0.1:8545"
    },
    hedera_testnet: {
      type: "http",
      url: "https://testnet.hashio.io/api",
      chainId: 296,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gas: 1000000,
      gasPrice: 100000000,
      timeout: 60000,
      httpHeaders: {
        "Content-Type": "application/json"
      }
    },
    hedera_mainnet: {
      type: "http",
      url: "https://mainnet.hashio.io/api",
      chainId: 295,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gas: 1000000,
      gasPrice: 100000000,
      timeout: 60000,
      httpHeaders: {
        "Content-Type": "application/json"
      }
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};
