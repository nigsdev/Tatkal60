// src/lib/pyth.ts
import { Contract } from 'ethers';
import { getSigner } from './hedera';
import { readOnchainPrice, PRICE_MAX_AGE_SECS } from './price';

const env = (k: string, d = '') => (import.meta as any)?.env?.[k] ?? d;

// Fallback values for Pyth configuration
const FALLBACK_PYTH_ADDRESS = '0xA2aa501b19aff244D90cc15a4Cf739D2725B5729';
const FALLBACK_BTC_PRICE_ID = '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43';

export const PYTH_ADDRESS = env('VITE_PYTH_ADDRESS') || FALLBACK_PYTH_ADDRESS;
export const BTC_PRICE_ID = env('VITE_BTC_PRICE_ID') || FALLBACK_BTC_PRICE_ID;



// Hedera non-zero msg.value must be >= 1 tinybar
export const ONE_TINYBAR = 10_000_000_000n;

const PYTH_ABI = [
  'function getUpdateFee(bytes[] calldata updateData) view returns (uint256)',
  'function updatePriceFeeds(bytes[] calldata updateData) payable',
] as const;

const HERMES_UPDATES_URL = 'https://hermes.pyth.network/v2/updates/price/latest';

export async function fetchHermesUpdate(ids: string[]): Promise<string[]> {
  try {
    // Ensure we have valid price IDs
    if (!ids || ids.length === 0) {
      throw new Error('No price IDs provided');
    }

    // Try POST method first (recommended for Hermes API)
    const body = {
      ids: ids,
      encoding: 'hex'
    };

    let res = await fetch(HERMES_UPDATES_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    });

    // If POST fails, try GET method as fallback
    if (!res.ok) {
      console.warn(`POST failed with ${res.status}, trying GET method`);
      const params = new URLSearchParams();
      params.append('encoding', 'hex');
      for (const id of ids) {
        params.append('ids[]', id);
      }
      
      res = await fetch(`${HERMES_UPDATES_URL}?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
    }

    if (!res.ok) {
      const errorText = await res.text();
      console.error('Hermes API Error:', {
        status: res.status,
        statusText: res.statusText,
        body: errorText,
        url: HERMES_UPDATES_URL,
        ids: ids
      });
      throw new Error(`Hermes updates fetch failed: ${res.status} ${res.statusText}. ${errorText}`);
    }

    const json = await res.json();
    console.log('Hermes response:', json);

    // Handle different response formats
    let data: string[] | undefined;
    if (json?.binary?.data) {
      data = json.binary.data;
    } else if (json?.data) {
      data = json.data;
    } else if (Array.isArray(json)) {
      data = json;
    }

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Hermes returned no update data');
    }

    return data.map((d: string) => d.startsWith('0x') ? d : `0x${d}`);
  } catch (error) {
    console.error('fetchHermesUpdate error:', error);
    throw error;
  }
}

export async function postUpdateAndRead(): Promise<{
  txHash: string; sentValue: bigint; feeWei: bigint;
  read?: { price: bigint; decimals: number; lastTs: number } | null;
}> {
  try {
    // Validate environment variables (with fallbacks)
    if (!PYTH_ADDRESS) {
      throw new Error('PYTH_ADDRESS not configured. Please set VITE_PYTH_ADDRESS in your .env file.');
    }
    if (!BTC_PRICE_ID) {
      throw new Error('BTC_PRICE_ID not configured. Please set VITE_BTC_PRICE_ID in your .env file.');
    }

    console.log('Starting Pyth update process...', { PYTH_ADDRESS, BTC_PRICE_ID });

    const signer = await getSigner();
    const pyth = new Contract(PYTH_ADDRESS as string, PYTH_ABI, signer);
    
    // First, check if the Pyth contract is working
    console.log('Checking Pyth contract status...');
    try {
      await pyth.getPrice(BTC_PRICE_ID);
      console.log('✅ Pyth contract is accessible');
    } catch (contractError: any) {
      console.warn('⚠️ Pyth contract check failed:', contractError.message);
      if (contractError.message.includes('0x19abf40e') || contractError.message.includes('unknown custom error')) {
        throw new Error('Pyth contract is not properly configured on Hedera testnet. The contract may not be deployed or the price ID may be incorrect. Please check the Pyth Network documentation for the correct Hedera testnet configuration.');
      }
    }
    
    // Fetch update data from Hermes
    console.log('Fetching update data from Hermes...');
    const updateData = await fetchHermesUpdate([BTC_PRICE_ID]);
    console.log('Update data received:', updateData.length, 'updates');

    // Calculate fee
    let feeWeiBig = 0n;
    try { 
      const fee = await pyth.getUpdateFee(updateData); 
      feeWeiBig = BigInt(fee.toString()); 
      console.log('Update fee calculated:', feeWeiBig.toString());
    } catch (feeError) { 
      console.warn('Failed to get update fee, using 0:', feeError);
      feeWeiBig = 0n; 
    }
    
    const sentValue = feeWeiBig > 0n && feeWeiBig < ONE_TINYBAR ? ONE_TINYBAR : feeWeiBig;
    console.log('Sending value:', sentValue.toString(), 'wei');

    // Post update to Pyth contract
    console.log('Posting update to Pyth contract...');
    const tx = await pyth.updatePriceFeeds(updateData, { value: sentValue });
    console.log('Transaction sent:', tx.hash);
    
    const rec = await tx.wait();
    console.log('Transaction confirmed:', rec.hash);

    // Try to read back the updated price
    try {
      const r = await readOnchainPrice(PRICE_MAX_AGE_SECS());
      if (r.source === 'onchain') {
        console.log('Successfully read updated price:', r.price.toString());
        return { txHash: rec.hash, sentValue, feeWei: feeWeiBig, read: { price: r.price, decimals: r.decimals, lastTs: r.lastTs } };
      }
    } catch (readError) {
      console.warn('Failed to read updated price:', readError);
    }
    
    return { txHash: rec.hash, sentValue, feeWei: feeWeiBig, read: null };
  } catch (error) {
    console.error('postUpdateAndRead error:', error);
    throw error;
  }
}

