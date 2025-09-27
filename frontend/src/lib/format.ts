import { formatEther, parseEther } from 'ethers';

export function hbar(n: bigint | number | string): string {
  const b = typeof n === 'bigint' ? n : BigInt(String(n));
  // Hedera uses tinybars as base unit (1 HBAR = 100,000,000 tinybars)
  // NOT wei like standard Ethereum (1 ETH = 10^18 wei)
  const s = Number(b) / 100000000;
  
  // For very small amounts, show more decimal places
  if (s > 0 && s < 0.000001) {
    return s.toLocaleString(undefined, { maximumFractionDigits: 10 });
  }
  
  return s.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

export { formatEther, parseEther };

export function short(addr?: string, head = 6, tail = 4) {
  if (!addr) return '';
  return addr.length > head + tail ? `${addr.slice(0, head)}…${addr.slice(-tail)}` : addr;
}

// Legacy functions for backward compatibility
export function shortAddress(addr?: string, head = 6, tail = 4) {
  return short(addr, head, tail);
}

export function formatHBAR(v?: bigint | number | string) {
  const n = typeof v === 'bigint' ? Number(v) : Number(v ?? 0);
  if (!isFinite(n)) return '0';
  if (n >= 1) return n.toFixed(3);
  if (n === 0) return '0';
  return n.toPrecision(3);
}

