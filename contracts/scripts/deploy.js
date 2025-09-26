import { ethers } from "ethers";
import dotenv from "dotenv";
import fs from "fs";

// Load environment variables
dotenv.config();

async function main() {
  console.log("🚀 Deploying to Hedera testnet...");
  
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
    
    console.log("Deploying with account:", wallet.address);
    
    // Check balance
    const balance = await provider.getBalance(wallet.address);
    console.log("Account balance:", ethers.formatEther(balance), "HBAR");
    
    // Read the compiled contract
    const contractPath = "./artifacts/contracts/Lock.sol/Lock.json";
    if (!fs.existsSync(contractPath)) {
      throw new Error("Contract not compiled. Run 'npm run compile' first.");
    }
    
    const contractData = JSON.parse(fs.readFileSync(contractPath, "utf8"));
    const contractABI = contractData.abi;
    const contractBytecode = contractData.bytecode;
    
    // Deploy the contract
    const currentTimestampInSeconds = Math.round(Date.now() / 1000);
    const unlockTime = currentTimestampInSeconds + 60; // 1 minute from now
    const lockedAmount = ethers.parseEther("0.001"); // 0.001 HBAR
    
    console.log("Deploying Lock contract...");
    console.log("Unlock time:", unlockTime);
    console.log("Locked amount:", ethers.formatEther(lockedAmount), "HBAR");
    
    const contractFactory = new ethers.ContractFactory(contractABI, contractBytecode, signer);
    const contract = await contractFactory.deploy(unlockTime, { value: lockedAmount });
    
    console.log("Transaction hash:", contract.deploymentTransaction().hash);
    console.log("Waiting for deployment...");
    
    await contract.waitForDeployment();
    
    const contractAddress = await contract.getAddress();
    
    console.log("✅ Contract deployed successfully!");
    console.log("Contract address:", contractAddress);
    
    // Verify deployment
    const contractBalance = await provider.getBalance(contractAddress);
    console.log("Contract balance:", ethers.formatEther(contractBalance), "HBAR");
    
    // Save deployment info
    const deploymentInfo = {
      network: "hedera_testnet",
      contractAddress: contractAddress,
      deployer: wallet.address,
      unlockTime: unlockTime,
      lockedAmount: ethers.formatEther(lockedAmount),
      transactionHash: contract.deploymentTransaction().hash,
      timestamp: new Date().toISOString()
    };
    
    console.log("\n📋 Deployment Summary:");
    console.log(JSON.stringify(deploymentInfo, null, 2));
    
    // Save to file
    fs.writeFileSync("deployment.json", JSON.stringify(deploymentInfo, null, 2));
    console.log("\n💾 Deployment info saved to deployment.json");
    
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
