// src/lib/hedera.ts
import { create } from 'zustand';
import {
  BrowserProvider,
  JsonRpcProvider,
  Contract,
  type Provider,
  type Eip1193Provider,
} from 'ethers';

declare global {
  interface Window { ethereum?: Eip1193Provider & { isMetaMask?: boolean } }
}

type Hex = `0x${string}`;
const env = (k: string, d = '') => (import.meta as any)?.env?.[k] ?? d;

const CHAIN_ID_NUM = Number(env('VITE_CHAIN_ID', '296')); // default testnet
const CHAIN_ID_HEX: Hex = `0x${CHAIN_ID_NUM.toString(16)}`;
const CHAIN_NAME = env('VITE_CHAIN_NAME', 'Hedera Testnet');
const RPC_URL = env('VITE_RPC_URL', 'https://testnet.hashio.io/api');
const EXPLORER = env('VITE_BLOCK_EXPLORER_URL', 'https://hashscan.io/testnet');
const CURRENCY_NAME = env('VITE_CURRENCY_NAME', 'HBAR');
const CURRENCY_SYMBOL = env('VITE_CURRENCY_SYMBOL', 'HBAR');

let _provider: BrowserProvider | JsonRpcProvider | null = null;

export function getProvider(): BrowserProvider | JsonRpcProvider {
  if (_provider) return _provider;
  if (typeof window !== 'undefined' && window.ethereum) {
    // BrowserProvider uses the injected MetaMask provider
    _provider = new BrowserProvider(window.ethereum);
  } else {
    // Read-only JSON-RPC fallback
    _provider = new JsonRpcProvider(RPC_URL, CHAIN_ID_NUM);
  }
  return _provider!;
}

export async function getSigner() {
  const p = getProvider();
  if (p instanceof BrowserProvider) {
    return await p.getSigner();
  }
  throw new Error('No browser wallet connected — cannot get signer.');
}

export async function switchOrAddChain(): Promise<void> {
  if (!window.ethereum) throw new Error('MetaMask not found.');
  try {
    // First try switching
    await window.ethereum.request?.({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: CHAIN_ID_HEX }],
    });
  } catch (err: any) {
    // If chain is unknown to MetaMask, add it
    const unrecognized =
      err?.code === 4902 ||
      /Unrecognized chain ID|Chain not added/i.test(err?.message ?? '');
    if (!unrecognized) throw err;

    await window.ethereum.request?.({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: CHAIN_ID_HEX,
          chainName: CHAIN_NAME,
          rpcUrls: [RPC_URL],
          nativeCurrency: { name: CURRENCY_NAME, symbol: CURRENCY_SYMBOL, decimals: 18 },
          blockExplorerUrls: [EXPLORER],
        },
      ],
    });
  }
}

async function getChainIdHexFromProvider(p: Provider): Promise<Hex> {
  try {
    const id = await (p as any).send?.('eth_chainId', []);
    if (typeof id === 'string') return id as Hex;
  } catch {}
  // fallback to numeric network call
  const net = await (p as any).getNetwork?.();
  const idNum = Number(net?.chainId ?? CHAIN_ID_NUM);
  return `0x${idNum.toString(16)}` as Hex;
}

type WalletState = {
  address: string | null;
  chainId: number | null;
  balance: string; // in HBAR (formatted)
  isConnected: boolean;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
};

export const useWalletStore = create<WalletState>((set, get) => ({
  address: null,
  chainId: null,
  balance: '0',
  isConnected: false,
  connecting: false,

  connect: async () => {
    if (!window.ethereum) throw new Error('MetaMask not detected.');
    set({ connecting: true });

    const provider = getProvider(); // BrowserProvider
    if (!(provider instanceof BrowserProvider)) {
      throw new Error('Browser wallet not available.');
    }

    // Ensure correct chain
    const currentHex = await getChainIdHexFromProvider(provider);
    if (currentHex.toLowerCase() !== CHAIN_ID_HEX.toLowerCase()) {
      await switchOrAddChain();
    }

    // Request accounts
    await window.ethereum.request?.({ method: 'eth_requestAccounts' });

    // Grab signer + address
    const signer = await provider.getSigner();
    const address = await signer.getAddress();

    // ChainId (post-switch to be sure)
    const net = await provider.getNetwork();
    const chainId = Number(net.chainId);

    // Balance
    const balWei = await provider.getBalance(address);
    // Hedera EVM returns balance in wei format (1 HBAR = 10^18 wei)
    // This is different from native Hedera tinybars (1 HBAR = 10^8 tinybars)
    const balance = (Number(balWei) / 1000000000000000000).toFixed(6);

    // Register listeners (once)
    const eth = window.ethereum as any;
    const onAccountsChanged = (accs: string[]) => {
      if (!accs?.length) {
        set({ address: null, isConnected: false, balance: '0' });
        return;
      }
      set({ address: accs[0] });
      get().refreshBalance().catch(() => {});
    };
    const onChainChanged = (_: any) => {
      // simplest is to reload to avoid stale providers
      location.reload();
    };
    eth.removeListener?.('accountsChanged', onAccountsChanged);
    eth.removeListener?.('chainChanged', onChainChanged);
    eth.on?.('accountsChanged', onAccountsChanged);
    eth.on?.('chainChanged', onChainChanged);

    set({ address, chainId, balance, isConnected: true, connecting: false });
  },

  disconnect: () => {
    // MetaMask doesn't support programmatic disconnect; clear app state
    set({ address: null, chainId: null, balance: '0', isConnected: false, connecting: false });
  },

  refreshBalance: async () => {
    const { address } = get();
    if (!address) return;
    const p = getProvider();
    const balWei = await p.getBalance(address);
    // Hedera EVM returns balance in wei format (1 HBAR = 10^18 wei)
    // This is different from native Hedera tinybars (1 HBAR = 10^8 tinybars)
    const balance = (Number(balWei) / 1000000000000000000).toFixed(6);
    set({ balance });
  },
}));

/** Read-only contract (provider) */
export function getReadContract<T = Contract>(address: string, abi: any): T {
  const p = getProvider();
  return new Contract(address, abi, p) as unknown as T;
}

/** Write-enabled contract (signer required) */
export async function getWriteContract<T = Contract>(address: string, abi: any): Promise<T> {
  const s = await getSigner();
  return new Contract(address, abi, s) as unknown as T;
}
