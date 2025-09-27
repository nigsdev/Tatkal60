import { ethers } from "ethers";
import dotenv from "dotenv";
import fs from "fs";

// Load environment variables
dotenv.config();

// Minimal Pyth EVM ABI (we only need update + fee)
const PYTH_ABI = [
  "function getUpdateFee(bytes[] calldata updateData) view returns (uint256)",
  "function updatePriceFeeds(bytes[] calldata updateData) payable",
];

/**
 * Fetch latest Pyth price update data (Hermes) for given feed ids.
 * Requires Node >= 18 for global fetch. If using older Node, install node-fetch.
 */
async function fetchPythUpdateData(feedIds) {
  const base = "https://hermes.pyth.network/v2/updates/price/latest";
  const params = new URLSearchParams({ encoding: "hex" });
  for (const id of feedIds) params.append("ids[]", id);
  const url = `${base}?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Hermes fetch failed: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  // Hermes returns: { binary: { data: ["0x...","0x..."] }, ... }
  const data = json?.binary?.data;
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("Hermes returned no update data");
  }
  // Ensure 0x prefix on each element
  return data.map((d) => (d.startsWith("0x") ? d : "0x" + d));
}

// Pyth (Hedera) configuration
const PYTH_ADDRESS = "0xA2aa501b19aff244D90cc15a4Cf739D2725B5729"; // Hedera Pyth contract
const BTC_PRICE_ID =
  "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"; // BTC/USD feed id

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
    const provider = new ethers.JsonRpcProvider(
      "https://testnet.hashio.io/api"
    );
    const signer = wallet.connect(provider);

    // Set gas settings for Hedera (minimum gas price is 410 gwei)
    const gasSettings = {
      gasLimit: 8000000, // 8M gas limit
      gasPrice: 410000000000, // 410 gwei (minimum for Hedera)
    };

    console.log("Deploying with account:", wallet.address);

    // Check balance
    const balance = await provider.getBalance(wallet.address);
    console.log("Account balance:", ethers.formatEther(balance), "HBAR");

    // Read the compiled contracts
    const oracleAdapterPath =
      "./artifacts/contracts/OracleAdapter.sol/OracleAdapter.json";
    const escrowGamePath =
      "./artifacts/contracts/EscrowGame.sol/EscrowGame.json";
    const ccipReceiverPath =
      "./artifacts/contracts/CCIPReceiver.sol/CCIPReceiver.json";

    if (
      !fs.existsSync(oracleAdapterPath) ||
      !fs.existsSync(escrowGamePath) ||
      !fs.existsSync(ccipReceiverPath)
    ) {
      throw new Error("Contracts not compiled. Run 'npm run compile' first.");
    }

    const oracleAdapterData = JSON.parse(
      fs.readFileSync(oracleAdapterPath, "utf8")
    );
    const escrowGameData = JSON.parse(fs.readFileSync(escrowGamePath, "utf8"));
    const ccipReceiverData = JSON.parse(
      fs.readFileSync(ccipReceiverPath, "utf8")
    );

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

    // Configure Pyth and BTC/USD mapping
    console.log("\n⚙️  Configuring OracleAdapter (Pyth + BTC/USD)...");
    const setPythTx = await oracleAdapter.setPyth(PYTH_ADDRESS, gasSettings);
    await setPythTx.wait();

    const btcMarket = ethers.keccak256(ethers.toUtf8Bytes("BTC/USD"));
    const mapTx = await oracleAdapter.setMarketPriceId(
      btcMarket,
      BTC_PRICE_ID,
      gasSettings
    );
    await mapTx.wait();
    console.log("✅ OracleAdapter configured: Pyth set & BTC/USD mapped");

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
      wallet.address, // feeSink (deployer for now)
      500, // feeBps (5%)
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
      mockRouter, // trustedRouter (mock for MVP)
      escrowGameAddress, // escrowGame
      sepoliaChainId, // trustedSourceChain (Sepolia)
      gasSettings
    );

    await ccipReceiver.waitForDeployment();

    const ccipReceiverAddress = await ccipReceiver.getAddress();
    console.log("✅ CCIPReceiver deployed to:", ccipReceiverAddress);

    // Set trusted source sender (MVP: deployer address)
    const setSourceSenderTx = await ccipReceiver.setTrustedSourceSender(
      wallet.address,
      gasSettings
    );
    await setSourceSenderTx.wait();
    console.log("✅ CCIPReceiver trustedSourceSender set to:", wallet.address);

    // Set CCIP receiver in EscrowGame
    console.log("\n📋 Configuring EscrowGame...");
    const escrowGameContract = new ethers.Contract(
      escrowGameAddress,
      escrowGameData.abi,
      signer
    );

    const setCCIPTx = await escrowGameContract.setCCIPReceiver(
      ccipReceiverAddress
    );
    await setCCIPTx.wait();
    console.log("✅ CCIPReceiver configured in EscrowGame");

    // Push fresh Pyth BTC/USD update on-chain (Hermes -> Pyth contract), then read via OracleAdapter
    console.log(
      "\n🔄 Fetching Pyth Hermes update for BTC/USD and posting on-chain..."
    );
    const pyth = new ethers.Contract(PYTH_ADDRESS, PYTH_ABI, signer);
    const updateData = await fetchPythUpdateData([BTC_PRICE_ID]);
    // Hedera requires msg.value to be 0 or >= 1 tinybar (1e10 wei)
    const ONE_TINYBAR = 10_000_000_000n;
    const updateFeeRaw = await pyth.getUpdateFee(updateData);
    const updateFee =
      updateFeeRaw > 0n && updateFeeRaw < ONE_TINYBAR
        ? ONE_TINYBAR
        : updateFeeRaw;

    console.log(
      "Pyth update fee (wei):",
      updateFeeRaw.toString(),
      "| sending:",
      updateFee.toString()
    );

    const updTx = await pyth.updatePriceFeeds(updateData, {
      ...gasSettings,
      value: updateFee,
    });
    await updTx.wait();
    console.log("✅ Pyth price update posted. Reading via OracleAdapter...");

    const btcMarketTest = ethers.keccak256(ethers.toUtf8Bytes("BTC/USD"));
    const [btcPrice, btcDecimals, btcLastUpdate] = await oracleAdapter.getPrice(
      btcMarketTest
    );

    console.log(
      "BTC/USD Price:",
      ethers.formatUnits(btcPrice, btcDecimals),
      "(dec:",
      btcDecimals + ", t:",
      btcLastUpdate.toString() + ")"
    );

    // Test EscrowGame
    const nextRoundId = await escrowGame.nextRoundId();
    console.log("Next Round ID:", nextRoundId.toString());

    console.log("\n🎉 Deployment completed successfully!");
    console.log("\n🔗 View on Hashscan:");
    console.log(
      `OracleAdapter: https://hashscan.io/testnet/contract/${oracleAdapterAddress}`
    );
    console.log(
      `EscrowGame: https://hashscan.io/testnet/contract/${escrowGameAddress}`
    );
    console.log(
      `CCIPReceiver: https://hashscan.io/testnet/contract/${ccipReceiverAddress}`
    );
    console.log("Pyth Address:", PYTH_ADDRESS);
    console.log("BTC/USD Price ID:", BTC_PRICE_ID);

    // Save deployment info
    const deploymentInfo = {
      network: "hedera_testnet",
      timestamp: new Date().toISOString(),
      deployer: wallet.address,
      contracts: {
        OracleAdapter: {
          address: oracleAdapterAddress,
          abi: oracleAdapterData.abi,
        },
        EscrowGame: {
          address: escrowGameAddress,
          abi: escrowGameData.abi,
        },
        CCIPReceiver: {
          address: ccipReceiverAddress,
          abi: ccipReceiverData.abi,
        },
      },
      configuration: {
        feeSink: wallet.address,
        feeBps: 500,
        oracle: oracleAdapterAddress,
        ccipReceiver: ccipReceiverAddress,
        trustedRouter: mockRouter,
        trustedSourceChain: sepoliaChainId,
        pyth: PYTH_ADDRESS,
        btcPriceId: BTC_PRICE_ID,
      },
    };

    console.log("\n📋 Deployment Summary:");
    console.log("======================");
    console.log("Network: Hedera Testnet");
    console.log("Deployer:", wallet.address);
    console.log("OracleAdapter:", oracleAdapterAddress);
    console.log("EscrowGame:", escrowGameAddress);
    console.log("CCIPReceiver:", ccipReceiverAddress);
    console.log("Pyth Address:", PYTH_ADDRESS);
    console.log("BTC/USD Price ID:", BTC_PRICE_ID);
    console.log("Fee Sink:", wallet.address);
    console.log("Fee Rate: 5%");
    console.log("Trusted Router:", mockRouter);
    console.log("Source Chain (Sepolia):", sepoliaChainId);

    // Save to file
    fs.writeFileSync(
      "deployment.json",
      JSON.stringify(deploymentInfo, null, 2)
    );
    console.log("\n💾 Deployment info saved to deployment.json");

    // Test the contracts
    console.log("\n🧪 Testing contracts...");

    // Test EscrowGame
    // (already tested above)
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
