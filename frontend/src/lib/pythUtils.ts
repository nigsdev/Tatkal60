// src/lib/pythUtils.ts
import { postUpdateAndRead } from './pyth';
import { toast } from './toast';

export async function refreshPythPrice(): Promise<boolean> {
  try {
    toast('Refreshing Price: Updating BTC/USD price from Pyth network...');

    const result = await postUpdateAndRead();
    
    if (result.read) {
      const price = Number(result.read.price) / 1e8;
      toast(`Price Updated: BTC/USD price updated to $${price.toFixed(2)}`);
      return true;
    } else {
      toast('Price Update Pending: Price update submitted. Please wait a moment and try again.');
      return false;
    }
  } catch (error: any) {
    console.error('Failed to refresh Pyth price:', error);
    
    let errorMessage = 'Failed to refresh price data';
    if (error.message) {
      if (error.message.includes('tinybar')) {
        errorMessage = 'Price update requires a small fee. Please ensure you have HBAR in your wallet.';
      } else {
        errorMessage = error.message;
      }
    }
    
    toast(`Price Refresh Failed: ${errorMessage}`);
    
    return false;
  }
}
