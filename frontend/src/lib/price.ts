import { keccak256, toUtf8Bytes } from 'ethers';
import { oracle } from './contracts';

const env = (k: string, d = '') => (import.meta as any)?.env?.[k] ?? d;
export const BTC_MARKET = keccak256(toUtf8Bytes('BTC/USD'));

export function PRICE_MAX_AGE_SECS(): number {
  const n = Number(env('VITE_PRICE_MAX_AGE', '75'));
  return Number.isFinite(n) && n > 0 ? n : 75;
}

export type PriceResult =
  | { source: 'onchain'; price: bigint; decimals: number; lastTs: number }
  | { source: 'hermes'; price: number; conf: number; ts: number };

export function isPythStaleError(e: any): boolean {
  const data = (e as any)?.data;
  const msg = (e as any)?.message || '';
  return data === '0x19abf40e' || /stale|no price|not available/i.test(msg);
}

export async function readOnchainPrice(maxAgeSecs: number = PRICE_MAX_AGE_SECS()): Promise<PriceResult> {
  const o = oracle();
  try {
    const [p, dec, ts] = await o.read().getPrice(BTC_MARKET);
    const lastTs = Number(ts);
    const now = Math.floor(Date.now() / 1000);
    if (now - lastTs > maxAgeSecs) throw Object.assign(new Error('STALE_OR_MISSING'), { code: 'STALE' });
    return { source: 'onchain', price: BigInt(p.toString()), decimals: Number(dec), lastTs };
  } catch (e) {
    if (isPythStaleError(e)) throw Object.assign(new Error('STALE_OR_MISSING'), { code: 'STALE' });
    throw e;
  }
}

// Hermes direct price (not updates)
const HERMES_PRICE_URL = 'https://hermes.pyth.network/v2/price/latest';
export async function readHermesPrice(): Promise<PriceResult> {
  const id = env('VITE_BTC_PRICE_ID');
  const params = new URLSearchParams({ ids: id, verbose: 'true' });
  const res = await fetch(`${HERMES_PRICE_URL}?${params.toString()}`);
  if (!res.ok) throw new Error(`Hermes price fetch failed: ${res.status} ${res.statusText}`);
  const j = await res.json();
  const item = Array.isArray(j?.parsed) ? j.parsed[0] : j?.parsed;
  const price = Number(item?.price?.price ?? item?.price);
  const conf = Number(item?.price?.conf ?? 0);
  const ts = Number(item?.publishTime ?? item?.timestamp ?? Math.floor(Date.now() / 1000));
  return { source: 'hermes', price, conf, ts };
}
