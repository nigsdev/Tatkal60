// src/lib/networkUtils.ts
import { useWalletStore } from './hedera';

export interface NetworkConfig {
  chainId: string;
  chainName: string;
  rpcUrls: string[];
  blockExplorerUrls: string[];
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

export const HEDERA_TESTNET_CONFIG: NetworkConfig = {
  chainId: '0x128', // 296 in hex
  chainName: 'Hedera Testnet',
  rpcUrls: ['https://testnet.hashio.io/api'],
  blockExplorerUrls: ['https://hashscan.io/testnet'],
  nativeCurrency: {
    name: 'HBAR',
    symbol: 'HBAR',
    decimals: 18
  }
};

export async function switchToHederaTestnet(): Promise<boolean> {
  const ethereum = (window as any).ethereum;
  
  if (!ethereum) {
    throw new Error('MetaMask not detected');
  }

  try {
    // Try to switch to Hedera Testnet
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: HEDERA_TESTNET_CONFIG.chainId }]
    });

    return true;
  } catch (error: any) {
    // If the chain doesn't exist, add it
    if (error.code === 4902) {
      try {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [HEDERA_TESTNET_CONFIG]
        });
        return true;
      } catch (addError) {
        console.error('Failed to add Hedera Testnet:', addError);
        return false;
      }
    }
    
    console.error('Failed to switch to Hedera Testnet:', error);
    return false;
  }
}

export function isCorrectNetwork(chainId: number | string): boolean {
  const targetChainId = typeof chainId === 'string' ? parseInt(chainId, 16) : chainId;
  return targetChainId === 296; // Hedera Testnet chain ID
}

export async function ensureCorrectNetwork(): Promise<boolean> {
  const { chainId } = useWalletStore.getState();
  
  if (!chainId) {
    return false;
  }
  
  if (isCorrectNetwork(chainId)) {
    return true;
  }
  
  return await switchToHederaTestnet();
}
