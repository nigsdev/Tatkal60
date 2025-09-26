import { ethers } from "ethers";
import dotenv from "dotenv";
import fs from "fs";

// Load environment variables
dotenv.config();

async function main() {
  console.log("🚀 Deploying Tatkal60 contracts to Hedera testnet...");
  
  try {
    // Get private key from environment
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      throw new Error("PRIVATE_KEY not found in environment variables");
    }
    
    // Create wallet and provider
    const wallet = new ethers.Wallet(privateKey);
    const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
    const signer = wallet.connect(provider);
    
    // Set gas settings for Hedera (minimum gas price is 410 gwei)
    const gasSettings = {
      gasLimit: 8000000, // 8M gas limit
      gasPrice: 410000000000 // 410 gwei (minimum for Hedera)
    };
    
    console.log("Deploying with account:", wallet.address);
    
    // Check balance
    const balance = await provider.getBalance(wallet.address);
    console.log("Account balance:", ethers.formatEther(balance), "HBAR");
    
    // Read the compiled contracts
    const oracleAdapterPath = "./artifacts/contracts/OracleAdapter.sol/OracleAdapter.json";
    const escrowGamePath = "./artifacts/contracts/EscrowGame.sol/EscrowGame.json";
    const ccipReceiverPath = "./artifacts/contracts/CCIPReceiver.sol/CCIPReceiver.json";
    
    if (!fs.existsSync(oracleAdapterPath) || !fs.existsSync(escrowGamePath) || !fs.existsSync(ccipReceiverPath)) {
      throw new Error("Contracts not compiled. Run 'npm run compile' first.");
    }
    
    const oracleAdapterData = JSON.parse(fs.readFileSync(oracleAdapterPath, "utf8"));
    const escrowGameData = JSON.parse(fs.readFileSync(escrowGamePath, "utf8"));
    const ccipReceiverData = JSON.parse(fs.readFileSync(ccipReceiverPath, "utf8"));
    
    console.log("\n📋 Deploying OracleAdapter...");
    
    // Deploy OracleAdapter
    const oracleAdapterFactory = new ethers.ContractFactory(
      oracleAdapterData.abi,
      oracleAdapterData.bytecode,
      signer
    );
    
    const oracleAdapter = await oracleAdapterFactory.deploy(gasSettings);
    await oracleAdapter.waitForDeployment();
    
    const oracleAdapterAddress = await oracleAdapter.getAddress();
    console.log("✅ OracleAdapter deployed to:", oracleAdapterAddress);
    
    console.log("\n📋 Deploying EscrowGame...");
    
    // Deploy EscrowGame
    const escrowGameFactory = new ethers.ContractFactory(
      escrowGameData.abi,
      escrowGameData.bytecode,
      signer
    );
    
    // Deploy with parameters: oracle, feeSink, feeBps (500 = 5%)
    const escrowGame = await escrowGameFactory.deploy(
      oracleAdapterAddress, // oracle
      wallet.address,       // feeSink (deployer for now)
      500,                  // feeBps (5%)
      gasSettings
    );
    
    await escrowGame.waitForDeployment();
    
    const escrowGameAddress = await escrowGame.getAddress();
    console.log("✅ EscrowGame deployed to:", escrowGameAddress);
    
    console.log("\n📋 Deploying CCIPReceiver...");
    
    // Deploy CCIPReceiver
    const ccipReceiverFactory = new ethers.ContractFactory(
      ccipReceiverData.abi,
      ccipReceiverData.bytecode,
      signer
    );
    
    // Deploy with parameters: router (mock for now), escrowGame, sourceChain (Sepolia = 11155111)
    const mockRouter = wallet.address; // Mock router for MVP
    const sepoliaChainId = 11155111; // Sepolia chain ID (fits in uint64)
    
    const ccipReceiver = await ccipReceiverFactory.deploy(
      mockRouter,           // trustedRouter (mock for MVP)
      escrowGameAddress,    // escrowGame
      sepoliaChainId,       // trustedSourceChain (Sepolia)
      gasSettings
    );
    
    await ccipReceiver.waitForDeployment();
    
    const ccipReceiverAddress = await ccipReceiver.getAddress();
    console.log("✅ CCIPReceiver deployed to:", ccipReceiverAddress);
    
    // Set CCIP receiver in EscrowGame
    console.log("\n📋 Configuring EscrowGame...");
    const escrowGameContract = new ethers.Contract(
      escrowGameAddress,
      escrowGameData.abi,
      signer
    );
    
    const setCCIPTx = await escrowGameContract.setCCIPReceiver(ccipReceiverAddress);
    await setCCIPTx.wait();
    console.log("✅ CCIPReceiver configured in EscrowGame");
    
    // Save deployment info
    const deploymentInfo = {
      network: "hedera_testnet",
      timestamp: new Date().toISOString(),
      deployer: wallet.address,
      contracts: {
        OracleAdapter: {
          address: oracleAdapterAddress,
          abi: oracleAdapterData.abi
        },
        EscrowGame: {
          address: escrowGameAddress,
          abi: escrowGameData.abi
        },
        CCIPReceiver: {
          address: ccipReceiverAddress,
          abi: ccipReceiverData.abi
        }
      },
      configuration: {
        feeSink: wallet.address,
        feeBps: 500,
        oracle: oracleAdapterAddress,
        ccipReceiver: ccipReceiverAddress,
        trustedRouter: mockRouter,
        trustedSourceChain: sepoliaChainId
      }
    };
    
    console.log("\n📋 Deployment Summary:");
    console.log("======================");
    console.log("Network: Hedera Testnet");
    console.log("Deployer:", wallet.address);
    console.log("OracleAdapter:", oracleAdapterAddress);
    console.log("EscrowGame:", escrowGameAddress);
    console.log("CCIPReceiver:", ccipReceiverAddress);
    console.log("Fee Sink:", wallet.address);
    console.log("Fee Rate: 5%");
    console.log("Trusted Router:", mockRouter);
    console.log("Source Chain (Sepolia):", sepoliaChainId);
    
    // Save to file
    fs.writeFileSync("tatkal60-deployment.json", JSON.stringify(deploymentInfo, null, 2));
    console.log("\n💾 Deployment info saved to tatkal60-deployment.json");
    
    // Test the contracts
    console.log("\n🧪 Testing contracts...");
    
    // Test OracleAdapter
    const hbarUsdMarket = ethers.keccak256(ethers.toUtf8Bytes("HBAR/USD"));
    const [price, decimals, lastUpdate] = await oracleAdapter.getPrice(hbarUsdMarket);
    console.log("HBAR/USD Price:", ethers.formatUnits(price, decimals));
    
    // Test EscrowGame
    const nextRoundId = await escrowGame.nextRoundId();
    console.log("Next Round ID:", nextRoundId.toString());
    
    console.log("\n🎉 Deployment completed successfully!");
    console.log("\n🔗 View on Hashscan:");
    console.log(`OracleAdapter: https://hashscan.io/testnet/contract/${oracleAdapterAddress}`);
    console.log(`EscrowGame: https://hashscan.io/testnet/contract/${escrowGameAddress}`);
    console.log(`CCIPReceiver: https://hashscan.io/testnet/contract/${ccipReceiverAddress}`);
    
  } catch (error) {
    console.error("❌ Deployment failed:", error.message);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
