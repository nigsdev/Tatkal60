// src/lib/eventBus.ts
import { ethers } from 'ethers';
import { escrow } from './contracts';

export type EventType = 'BetPlaced' | 'RoundResolved' | 'Claimed';

export interface EventBusEvent {
  type: EventType;
  roundId: number;
  blockNumber: number;
  transactionHash: string;
  data?: any;
}

export type EventBusCallback = (event: EventBusEvent) => void;

class EventBus {
  private provider: ethers.Provider | null = null;
  private wsProvider: ethers.WebSocketProvider | null = null;
  private listeners: Map<EventType, Set<EventBusCallback>> = new Map();
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // 1 second
  private contract: ethers.Contract | null = null;
  private fallbackTimer: NodeJS.Timeout | null = null;
  private lastBlockNumber = 0;

  constructor() {
    this.initializeProvider();
  }

  private async initializeProvider() {
    try {
      // Try to create WebSocket provider first
      const wsUrl = this.getWebSocketUrl();
      if (wsUrl) {
        console.log('[EventBus] Attempting WebSocket connection...');
        this.wsProvider = new ethers.WebSocketProvider(wsUrl);
        
        // Test the connection
        await this.wsProvider.getBlockNumber();
        this.provider = this.wsProvider;
        this.isConnected = true;
        console.log('[EventBus] WebSocket connected successfully');
        
        this.setupWebSocketListeners();
        this.startEventListening();
      } else {
        throw new Error('No WebSocket URL available');
      }
    } catch (error) {
      console.warn('[EventBus] WebSocket connection failed, falling back to polling:', error);
      this.fallbackToPolling();
    }
  }

  private getWebSocketUrl(): string | null {
    // Check for Hedera WebSocket endpoints
    // const wsUrls = [
    //   'wss://testnet.hashio.io/ws', // Hedera testnet WebSocket
    //   'wss://mainnet.hashio.io/ws', // Hedera mainnet WebSocket
    // ];

    // For now, return null to use polling fallback
    // WebSocket support can be enabled when available
    return null;
  }

  private fallbackToPolling() {
    console.log('[EventBus] Using polling fallback (every 4 seconds)');
    this.provider = escrow().read().runner?.provider || null;
    
    if (this.provider) {
      this.contract = escrow().read();
      this.startPolling();
    } else {
      console.error('[EventBus] No provider available for polling');
    }
  }

  private setupWebSocketListeners() {
    if (!this.wsProvider) return;

    this.wsProvider.on('error', (error) => {
      console.error('[EventBus] WebSocket error:', error);
      this.handleReconnection();
    });

    this.wsProvider.on('close', () => {
      console.warn('[EventBus] WebSocket connection closed');
      this.isConnected = false;
      this.handleReconnection();
    });
  }

  private async handleReconnection() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[EventBus] Max reconnection attempts reached, falling back to polling');
      this.fallbackToPolling();
      return;
    }

    this.reconnectAttempts++;
    console.log(`[EventBus] Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
    
    setTimeout(() => {
      this.initializeProvider();
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  private startEventListening() {
    if (!this.provider || !this.contract) return;

    try {
      // Listen for BetPlaced events
      this.contract.on('BetPlaced', (roundId, user, side, amount, event) => {
        this.emitEvent({
          type: 'BetPlaced',
          roundId: Number(roundId),
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          data: { user, side: Number(side), amount }
        });
      });

      // Listen for RoundResolved events
      this.contract.on('RoundResolved', (roundId, outcome, settlePrice, event) => {
        this.emitEvent({
          type: 'RoundResolved',
          roundId: Number(roundId),
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          data: { outcome: Number(outcome), settlePrice }
        });
      });

      // Listen for Claimed events
      this.contract.on('Claimed', (roundId, user, amount, event) => {
        this.emitEvent({
          type: 'Claimed',
          roundId: Number(roundId),
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          data: { user, amount }
        });
      });

      console.log('[EventBus] Event listeners set up successfully');
    } catch (error) {
      console.error('[EventBus] Failed to set up event listeners:', error);
      this.fallbackToPolling();
    }
  }

  private startPolling() {
    if (this.fallbackTimer) {
      clearInterval(this.fallbackTimer);
    }

    this.fallbackTimer = setInterval(async () => {
      try {
        if (!this.provider || !this.contract) return;

        const currentBlock = await this.provider.getBlockNumber();
        
        if (this.lastBlockNumber === 0) {
          this.lastBlockNumber = currentBlock;
          return;
        }

        if (currentBlock > this.lastBlockNumber) {
          // Check for events in the new blocks
          await this.checkForEvents(this.lastBlockNumber + 1, currentBlock);
          this.lastBlockNumber = currentBlock;
        }
      } catch (error) {
        console.error('[EventBus] Polling error:', error);
      }
    }, 4000); // Poll every 4 seconds
  }

  private async checkForEvents(fromBlock: number, toBlock: number) {
    if (!this.contract) return;

    try {
      // Get BetPlaced events using the contract interface
      const betPlacedFilter = this.contract.filters.BetPlaced();
      const betPlacedEvents = await this.contract.queryFilter(betPlacedFilter, fromBlock, toBlock);
      
      for (const event of betPlacedEvents) {
        if ('args' in event && event.args) {
          this.emitEvent({
            type: 'BetPlaced',
            roundId: Number(event.args[0]),
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash,
            data: { 
              user: event.args[1], 
              side: Number(event.args[2]), 
              amount: event.args[3] 
            }
          });
        }
      }

      // Get RoundResolved events
      const roundResolvedFilter = this.contract.filters.RoundResolved();
      const roundResolvedEvents = await this.contract.queryFilter(roundResolvedFilter, fromBlock, toBlock);
      
      for (const event of roundResolvedEvents) {
        if ('args' in event && event.args) {
          this.emitEvent({
            type: 'RoundResolved',
            roundId: Number(event.args[0]),
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash,
            data: { 
              outcome: Number(event.args[1]), 
              settlePrice: event.args[2] 
            }
          });
        }
      }

      // Get Claimed events
      const claimedFilter = this.contract.filters.Claimed();
      const claimedEvents = await this.contract.queryFilter(claimedFilter, fromBlock, toBlock);
      
      for (const event of claimedEvents) {
        if ('args' in event && event.args) {
          this.emitEvent({
            type: 'Claimed',
            roundId: Number(event.args[0]),
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash,
            data: { 
              user: event.args[1], 
              amount: event.args[2] 
            }
          });
        }
      }
    } catch (error) {
      console.error('[EventBus] Error checking for events:', error);
    }
  }

  private emitEvent(event: EventBusEvent) {
    console.log('[EventBus] Event received:', event);
    
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('[EventBus] Error in event callback:', error);
        }
      });
    }
  }

  public on(eventType: EventType, callback: EventBusCallback): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    
    this.listeners.get(eventType)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(eventType);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.listeners.delete(eventType);
        }
      }
    };
  }

  public off(eventType: EventType, callback: EventBusCallback): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        this.listeners.delete(eventType);
      }
    }
  }

  public destroy(): void {
    // Clean up WebSocket connection
    if (this.wsProvider) {
      this.wsProvider.removeAllListeners();
      this.wsProvider.destroy();
      this.wsProvider = null;
    }

    // Clean up contract listeners
    if (this.contract) {
      this.contract.removeAllListeners();
    }

    // Clean up polling timer
    if (this.fallbackTimer) {
      clearInterval(this.fallbackTimer);
      this.fallbackTimer = null;
    }

    // Clear all listeners
    this.listeners.clear();
    
    console.log('[EventBus] Destroyed');
  }

  public getStatus(): { connected: boolean; mode: 'websocket' | 'polling' } {
    return {
      connected: this.isConnected,
      mode: this.wsProvider ? 'websocket' : 'polling'
    };
  }
}

// Singleton instance
export const eventBus = new EventBus();

// Auto-cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    eventBus.destroy();
  });
}
