import { ethers } from "ethers";
import fs from "fs";

async function generateWallet() {
  console.log("🔐 Generating new EVM wallet for Hedera...\n");
  
  // Generate a new random wallet
  const wallet = ethers.Wallet.createRandom();
  
  console.log("📋 Wallet Details:");
  console.log("==================");
  console.log(`Address: ${wallet.address}`);
  console.log(`Private Key: ${wallet.privateKey}`);
  console.log(`Mnemonic: ${wallet.mnemonic.phrase}`);
  console.log("");
  
  // Create .env content
  const envContent = `# Hedera Configuration
# Generated wallet for Tatkal60 project
PRIVATE_KEY=${wallet.privateKey}
HEDERA_ACCOUNT_ID=0.0.0
HEDERA_NETWORK=testnet

# Wallet Details (for reference)
WALLET_ADDRESS=${wallet.address}
WALLET_MNEMONIC="${wallet.mnemonic.phrase}"
`;
  
  // Write to .env file
  fs.writeFileSync('.env', envContent);
  console.log("✅ .env file created successfully!");
  console.log("");
  
  console.log("🚀 Next Steps:");
  console.log("==============");
  console.log("1. Fund this wallet with HBAR on Hedera testnet:");
  console.log(`   Address: ${wallet.address}`);
  console.log("");
  console.log("2. Get testnet HBAR from: https://portal.hedera.com/");
  console.log("");
  console.log("3. Deploy contracts to Hedera testnet:");
  console.log("   npm run deploy:hedera-testnet");
  console.log("");
  
  console.log("⚠️  IMPORTANT SECURITY NOTES:");
  console.log("=============================");
  console.log("• Keep your private key and mnemonic secure!");
  console.log("• Never share these with anyone");
  console.log("• This is for TESTNET only - do not use on mainnet");
  console.log("• Consider using a hardware wallet for mainnet");
  console.log("");
  
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    mnemonic: wallet.mnemonic.phrase
  };
}

generateWallet()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error generating wallet:", error);
    process.exit(1);
  });
