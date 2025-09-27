import { parseEther, ContractTransactionResponse } from 'ethers';
import { useWalletStore } from './hedera';

const env = (k: string, d = '') => (import.meta as any)?.env?.[k] ?? d;
const EXPLORER = env('VITE_BLOCK_EXPLORER_URL', 'https://hashscan.io/testnet');

export function txUrl(hash: string) {
  // Hashscan uses /transaction/<hash>
  const base = EXPLORER.replace(/\/+$/, '');
  return `${base}/transaction/${hash}`;
}

// ---- HBAR utils ----
export function formatHBAR(input: bigint | string | number): string {
  const v = typeof input === 'bigint' ? input : BigInt(String(input));
  // Hedera uses tinybars as base unit (1 HBAR = 100,000,000 tinybars)
  // NOT wei like standard Ethereum (1 ETH = 10^18 wei)
  return (Number(v) / 100000000).toLocaleString(undefined, { maximumFractionDigits: 6 });
}
export function parseHBAR(input: string | number): bigint {
  const s = (Number(input) || 0).toString();
  // Hedera EVM uses wei format for transactions (1 HBAR = 10^18 wei)
  // This is different from native Hedera tinybars (1 HBAR = 10^8 tinybars)
  const hbarAmount = Number(s);
  return BigInt(Math.floor(hbarAmount * 1000000000000000000)); // Convert HBAR to wei
}

export function shortAddr(addr?: string, head = 6, tail = 4): string {
  if (!addr) return '';
  return addr.length > head + tail ? `${addr.slice(0, head)}…${addr.slice(-tail)}` : addr;
}

// ---- Toast plumbing (thin wrapper around our lightweight ToastHost) ----
type ToastKind = 'info' | 'success' | 'error';
type ToastPayload = { kind: ToastKind; title: string; message?: string; linkText?: string; href?: string; persistMs?: number };
type ToastBus = { push: (t: ToastPayload) => void };

let toastBus: ToastBus | null = null;
export function __registerToastBus(bus: ToastBus) { toastBus = bus; }
function toast(p: ToastPayload) { toastBus?.push(p); }

// ---- sendTx helper ----
type SendTxOpts = {
  pending?: string;      // shown before user signs
  submitted?: string;    // shown when tx hash is available
  success?: string;      // shown after mined
  error?: string;        // prefix for error toast
};

export async function sendTx(
  label: string,
  fn: () => Promise<ContractTransactionResponse>,
  opts: SendTxOpts = {},
  onMined?: (receipt: any) => void
) {
  try {
    toast({ kind: 'info', title: opts.pending ?? `Confirm ${label}`, message: 'Confirm in your wallet…', persistMs: 4000 });

    const tx = await fn(); // user signs here
    const hash = tx.hash;
    toast({
      kind: 'info',
      title: opts.submitted ?? `${label} submitted`,
      message: `Tx: ${hash.slice(0, 10)}…`,
      linkText: 'View on Hashscan',
      href: txUrl(hash),
      persistMs: 8000,
    });

    const receipt = await tx.wait();
    toast({
      kind: 'success',
      title: opts.success ?? `${label} confirmed`,
      message: `Block #${receipt?.blockNumber ?? ''}`,
      linkText: 'View on Hashscan',
      href: txUrl(hash),
      persistMs: 8000,
    });
    
    // Refresh wallet balance after successful transaction
    try {
      await useWalletStore.getState().refreshBalance();
    } catch (error) {
      console.warn('Failed to refresh balance after transaction:', error);
    }
    
    onMined?.(receipt);
    return receipt;
  } catch (e: any) {
    const msg =
      e?.shortMessage ??
      e?.reason ??
      e?.message ??
      'Transaction failed';
    toast({
      kind: 'error',
      title: opts.error ?? `${label} failed`,
      message: msg,
      persistMs: 9000,
    });
    throw e;
  }
}

// Legacy function for backward compatibility
export async function runTx<T>(label: string, fn: () => Promise<T>, onDone?: () => void) {
  try {
    const tx: any = await fn();
    const rec = await tx.wait?.();
    console.log(`[${label}]`, rec?.hash ?? tx?.hash ?? tx);
    onDone?.();
    return rec ?? tx;
  } catch (e: any) {
    console.error(`[${label}] failed:`, e?.message ?? e);
    throw e;
  }
}
