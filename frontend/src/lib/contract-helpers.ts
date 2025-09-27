// src/lib/contract-helpers.ts
// Helper functions for contract interactions using the factory system

import { parseHBAR } from './tx';
import { escrow, oracle, ccip } from './contracts';
import { getProvider } from './hedera';

// Example: Read contract data (no wallet needed)
export async function getRoundInfo(roundId: number) {
  try {
    const eg = escrow(); // uses env address by default
    const contract = eg.read();
    
    // Example method calls (adjust based on your actual contract methods)
    // const roundInfo = await contract.getRound(roundId);
    // const isActive = await contract.isRoundActive(roundId);
    
    console.log(`Reading round ${roundId} from contract at ${eg.address}`);
    console.log('Contract instance:', contract);
    
    return {
      roundId,
      address: eg.address,
      // startTime: Number(roundInfo.startTime),
      // endTime: Number(roundInfo.endTime),
      // upPool: roundInfo.upPool.toString(),
      // downPool: roundInfo.downPool.toString(),
    };
  } catch (error) {
    console.error('Error reading round info:', error);
    throw error;
  }
}

// Example: Write contract transaction (wallet required)
export async function placeBet(roundId: number, betType: 'up' | 'down', amount: string) {
  try {
    const eg = escrow();
    const contract = await eg.write();
    
    // Parse the amount to wei (Hedera EVM uses wei format for transactions)
    const amountWei = parseHBAR(amount);
    
    console.log(`Placing ${betType} bet for round ${roundId} with ${amount} HBAR`);
    console.log('Write contract instance:', contract);
    
    // Execute the transaction
    let tx;
    if (betType === 'up') {
      // tx = await contract.betUp(roundId, { value: amountTinybars });
    } else {
      // tx = await contract.betDown(roundId, { value: amountTinybars });
    }
    
    console.log('Transaction:', tx);
    
    // Wait for confirmation
    // const receipt = await tx.wait();
    
    return {
      // transactionHash: receipt.hash,
      // blockNumber: receipt.blockNumber,
      // gasUsed: receipt.gasUsed.toString(),
      success: true,
      amount: amountWei.toString(),
    };
  } catch (error) {
    console.error('Error placing bet:', error);
    throw error;
  }
}

// Example: Oracle price reading
export async function getBTCPrice() {
  try {
    const o = oracle();
    const contract = o.read();
    
    // BTC/USD price ID (from your constants)
    const BTC_USD_ID = '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43';
    
    console.log(`Reading BTC price from oracle at ${o.address}`);
    console.log('Oracle contract instance:', contract);
    
    // Get price from oracle
    // const [price, confidence, timestamp] = await contract.getPrice(BTC_USD_ID);
    
    return {
      // price: price.toString(),
      // confidence: confidence.toString(),
      // timestamp: Number(timestamp),
      symbol: 'BTC/USD',
      priceId: BTC_USD_ID,
      address: o.address,
    };
  } catch (error) {
    console.error('Error getting BTC price:', error);
    throw error;
  }
}

// Example: CCIP operations (if you expose admin/testing functions)
export async function getCCIPInfo() {
  try {
    const r = ccip();
    const contract = r.read();
    
    console.log(`Reading CCIP info from contract at ${r.address}`);
    console.log('CCIP contract instance:', contract);
    
    // Example: Get trusted source sender
    // const trustedSender = await contract.getTrustedSourceSender();
    
    return {
      // trustedSender,
      address: r.address,
    };
  } catch (error) {
    console.error('Error getting CCIP info:', error);
    throw error;
  }
}

// Example: Using custom addresses
export async function useCustomEscrowAddress(customAddress: string) {
  try {
    const eg = escrow(customAddress); // Override the env address
    const contract = eg.read();
    
    console.log(`Using custom escrow address: ${eg.address}`);
    console.log('Custom contract instance:', contract);
    
    // Use the contract with custom address
    // const info = await contract.getInfo();
    
    return {
      address: eg.address,
      // info,
    };
  } catch (error) {
    console.error('Error using custom escrow address:', error);
    throw error;
  }
}

// Example: Batch operations
export async function getContractAddresses() {
  return {
    escrow: escrow().address,
    oracle: oracle().address,
    ccip: ccip().address,
  };
}

// Example: Check if contracts are deployed
export async function checkContractDeployment() {
  const results = {
    escrow: false,
    oracle: false,
    ccip: false,
  };
  
  try {
    // Try to read from each contract
    const provider = getProvider();
    const code = await provider.getCode(escrow().address);
    results.escrow = code !== '0x';
  } catch (error) {
    console.warn('Escrow contract not deployed or not accessible');
  }
  
  try {
    const provider = getProvider();
    const code = await provider.getCode(oracle().address);
    results.oracle = code !== '0x';
  } catch (error) {
    console.warn('Oracle contract not deployed or not accessible');
  }
  
  try {
    const provider = getProvider();
    const code = await provider.getCode(ccip().address);
    results.ccip = code !== '0x';
  } catch (error) {
    console.warn('CCIP contract not deployed or not accessible');
  }
  
  return results;
}