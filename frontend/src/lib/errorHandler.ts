// src/lib/errorHandler.ts
import { toast } from './toast';

export interface ErrorContext {
  action: string;
  roundId?: number;
  amount?: string;
  userAddress?: string;
}

export interface ErrorAction {
  type: 'refresh_pyth' | 'switch_network' | 'retry' | 'adjust_amount' | 'none';
  label: string;
  action?: () => void;
}

export interface ParsedError {
  type: 'pyth_stale' | 'min_bet' | 'max_bet' | 'wrong_chain' | 'insufficient_funds' | 'unknown';
  message: string;
  userMessage: string;
  action?: ErrorAction;
}

export function parseContractError(error: any, _context: ErrorContext): ParsedError {
  const errorMessage = error?.message || error?.toString() || '';
  const errorCode = error?.code;

  // Pyth stale error
  if (errorMessage.includes('stale') || errorMessage.includes('Price not available')) {
    return {
      type: 'pyth_stale',
      message: errorMessage,
      userMessage: 'Price data is stale. Please refresh the price feed and try again.',
      action: {
        type: 'refresh_pyth',
        label: 'Refresh Pyth',
        action: () => {
          // This will be handled by the component
        }
      }
    };
  }

  // Min bet error
  if (errorMessage.includes('Bet amount must be positive') || 
      errorMessage.includes('amount too low') ||
      errorMessage.includes('minimum')) {
    return {
      type: 'min_bet',
      message: errorMessage,
      userMessage: 'Bet amount is too low. Minimum bet is 0.001 HBAR.',
      action: {
        type: 'adjust_amount',
        label: 'Set to 0.001 HBAR',
        action: () => {
          // This will be handled by the component
        }
      }
    };
  }

  // Max bet error
  if (errorMessage.includes('Bet amount too high') || 
      errorMessage.includes('maximum') ||
      errorMessage.includes('exceeds limit')) {
    return {
      type: 'max_bet',
      message: errorMessage,
      userMessage: 'Bet amount is too high. Maximum bet is 1000 HBAR.',
      action: {
        type: 'adjust_amount',
        label: 'Set to 1000 HBAR',
        action: () => {
          // This will be handled by the component
        }
      }
    };
  }

  // Wrong chain error
  if (errorCode === 4902 || 
      errorMessage.includes('Unsupported chain') ||
      errorMessage.includes('wrong network') ||
      errorMessage.includes('chain ID')) {
    return {
      type: 'wrong_chain',
      message: errorMessage,
      userMessage: 'Please switch to Hedera Testnet to continue.',
      action: {
        type: 'switch_network',
        label: 'Switch Network',
        action: () => {
          // This will be handled by the component
        }
      }
    };
  }

  // Insufficient funds error
  if (errorMessage.includes('insufficient funds') || 
      errorMessage.includes('insufficient balance') ||
      errorCode === -32603) {
    return {
      type: 'insufficient_funds',
      message: errorMessage,
      userMessage: 'Insufficient HBAR balance. Please add funds to your wallet.',
      action: {
        type: 'none',
        label: 'OK'
      }
    };
  }

  // Unknown error
  return {
    type: 'unknown',
    message: errorMessage,
    userMessage: `Transaction failed: ${errorMessage}`,
    action: {
      type: 'retry',
      label: 'Try Again',
      action: () => {
        // This will be handled by the component
      }
    }
  };
}

export function showErrorToast(parsedError: ParsedError, _context: ErrorContext) {
  const { type, userMessage, action } = parsedError;
  
  // For now, use simple string toast - can be enhanced later with proper toast component
  const title = getErrorTitle(type);
  const message = `${title}: ${userMessage}`;
  
  if (action?.type !== 'none' && action?.action) {
    // Show toast with action
    toast(`${message} [${action.label}]`);
    // Execute action after a short delay
    setTimeout(() => {
      if (action.action) {
        action.action();
      }
    }, 1000);
  } else {
    toast(message);
  }
}

function getErrorTitle(type: string): string {
  switch (type) {
    case 'pyth_stale':
      return 'Price Data Stale';
    case 'min_bet':
      return 'Bet Too Small';
    case 'max_bet':
      return 'Bet Too Large';
    case 'wrong_chain':
      return 'Wrong Network';
    case 'insufficient_funds':
      return 'Insufficient Funds';
    default:
      return 'Transaction Failed';
  }
}

// Validation helpers
export function validateBetAmount(amount: string): { valid: boolean; error?: string; suggested?: string } {
  const numAmount = parseFloat(amount);
  
  if (isNaN(numAmount) || numAmount <= 0) {
    return { valid: false, error: 'Please enter a valid amount' };
  }
  
  if (numAmount < 0.001) {
    return { valid: false, error: 'Minimum bet is 0.001 HBAR', suggested: '0.001' };
  }
  
  if (numAmount > 1000) {
    return { valid: false, error: 'Maximum bet is 1000 HBAR', suggested: '1000' };
  }
  
  return { valid: true };
}
