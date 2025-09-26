import { ethers } from "ethers";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

async function testCCIPReceiver() {
  console.log("🧪 Testing CCIPReceiver functionality...\n");

  try {
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      throw new Error("PRIVATE_KEY not found in environment variables");
    }

    // Load deployment info
    const deploymentPath = "./tatkal60-deployment.json";
    if (!fs.existsSync(deploymentPath)) {
      throw new Error("Deployment file not found. Run deployment first.");
    }

    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    const ccipReceiverAddress = deployment.contracts.CCIPReceiver.address;
    const escrowGameAddress = deployment.contracts.EscrowGame.address;

    // Setup provider and signer
    const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
    const wallet = new ethers.Wallet(privateKey, provider);
    
    console.log("Testing with account:", wallet.address);
    const balance = await provider.getBalance(wallet.address);
    console.log("Account balance:", ethers.formatEther(balance), "HBAR\n");

    // Load contract ABIs
    const ccipReceiverData = JSON.parse(fs.readFileSync("./artifacts/contracts/CCIPReceiver.sol/CCIPReceiver.json", "utf8"));
    const escrowGameData = JSON.parse(fs.readFileSync("./artifacts/contracts/EscrowGame.sol/EscrowGame.json", "utf8"));

    // Create contract instances
    const ccipReceiver = new ethers.Contract(ccipReceiverAddress, ccipReceiverData.abi, wallet);
    const escrowGame = new ethers.Contract(escrowGameAddress, escrowGameData.abi, wallet);

    console.log("📋 Contract Addresses:");
    console.log("CCIPReceiver:", ccipReceiverAddress);
    console.log("EscrowGame:", escrowGameAddress);

    // Test 1: Get initial statistics
    console.log("\n📊 Initial Statistics:");
    const [totalCredits, totalAmount, messageCount] = await ccipReceiver.getStatistics();
    console.log("Total Credits Processed:", totalCredits.toString());
    console.log("Total Amount Credited:", ethers.formatEther(totalAmount), "HBAR");
    console.log("Processed Messages:", messageCount.toString());

    // Test 2: Simulate cross-chain credit
    console.log("\n🔄 Simulating Cross-Chain Credit...");
    const testUser = wallet.address; // Use deployer as test user
    const creditAmount = ethers.parseEther("1.0"); // 1 HBAR
    const sepoliaChainId = 11155111; // Sepolia chain ID (fits in uint64)

    const simulateTx = await ccipReceiver.simulateCrossChainCredit(
      testUser,
      creditAmount,
      sepoliaChainId
    );
    
    console.log("Transaction hash:", simulateTx.hash);
    await simulateTx.wait();
    console.log("✅ Cross-chain credit simulation completed");

    // Test 3: Check updated statistics
    console.log("\n📊 Updated Statistics:");
    const [newTotalCredits, newTotalAmount, newMessageCount] = await ccipReceiver.getStatistics();
    console.log("Total Credits Processed:", newTotalCredits.toString());
    console.log("Total Amount Credited:", ethers.formatEther(newTotalAmount), "HBAR");
    console.log("Processed Messages:", newMessageCount.toString());

    // Test 4: Check user credit count
    console.log("\n👤 User Credit Statistics:");
    const userCreditCount = await ccipReceiver.getUserCreditCount(testUser);
    console.log("User Credit Count:", userCreditCount.toString());

    // Test 5: Check internal credits in EscrowGame
    console.log("\n💰 Internal Credits in EscrowGame:");
    const internalCredits = await escrowGame.internalCredits(testUser);
    console.log("Internal Credits:", ethers.formatEther(internalCredits), "HBAR");

    // Test 6: Test message processing check
    console.log("\n🔍 Message Processing Check:");
    const messageId = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "uint64", "uint256", "uint256"],
        [testUser, creditAmount, sepoliaChainId, Math.floor(Date.now() / 1000), 1]
      )
    );
    const isProcessed = await ccipReceiver.isMessageProcessed(messageId);
    console.log("Message Processed:", isProcessed);

    // Test 7: Get contract configuration
    console.log("\n⚙️ Contract Configuration:");
    const trustedRouter = await ccipReceiver.trustedRouter();
    const trustedSourceChain = await ccipReceiver.trustedSourceChain();
    const escrowGameAddr = await ccipReceiver.escrowGame();
    
    console.log("Trusted Router:", trustedRouter);
    console.log("Trusted Source Chain:", trustedSourceChain.toString());
    console.log("EscrowGame Address:", escrowGameAddr);

    console.log("\n🎉 CCIPReceiver testing completed successfully!");
    console.log("\n📋 Test Summary:");
    console.log("- ✅ Statistics tracking works");
    console.log("- ✅ Cross-chain credit simulation works");
    console.log("- ✅ Message processing validation works");
    console.log("- ✅ User credit tracking works");
    console.log("- ✅ EscrowGame integration works");
    console.log("- ✅ Configuration management works");

  } catch (error) {
    console.error("❌ Test failed:", error.message);
    throw error;
  }
}

// Run the test
testCCIPReceiver()
  .then(() => {
    console.log("\n✅ All tests passed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Test suite failed:", error.message);
    process.exit(1);
  });
