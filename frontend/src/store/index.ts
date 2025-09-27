import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { WalletState, AppState, Round } from '../types';

// Wallet store
interface WalletStore extends WalletState {
  connect: () => Promise<void>;
  disconnect: () => void;
  updateBalance: (balance: string) => void;
  setChainId: (chainId: number) => void;
}

export const useWalletStore = create<WalletStore>()(
  devtools(
    set => ({
      address: null,
      balance: '0',
      isConnected: false,
      chainId: null,

      connect: async () => {
        try {
          // TODO: Implement wallet connection logic
          console.log('Connecting wallet...');
          set({ isConnected: true });
        } catch (error) {
          console.error('Failed to connect wallet:', error);
        }
      },

      disconnect: () => {
        set({
          address: null,
          balance: '0',
          isConnected: false,
          chainId: null,
        });
      },

      updateBalance: (balance: string) => {
        set({ balance });
      },

      setChainId: (chainId: number) => {
        set({ chainId });
      },
    }),
    {
      name: 'wallet-store',
    }
  )
);

// App store
interface AppStore extends AppState {
  setRounds: (rounds: Round[]) => void;
  setCurrentRound: (round: Round | null) => void;
  updateUserBets: (roundId: number, up: bigint, down: bigint) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useAppStore = create<AppStore>()(
  devtools(
    set => ({
      rounds: [],
      currentRound: null,
      userBets: {},
      loading: false,
      error: null,

      setRounds: (rounds: Round[]) => {
        set({ rounds });
      },

      setCurrentRound: (round: Round | null) => {
        set({ currentRound: round });
      },

      updateUserBets: (roundId: number, up: bigint, down: bigint) => {
        set(state => ({
          userBets: {
            ...state.userBets,
            [roundId]: { up, down },
          },
        }));
      },

      setLoading: (loading: boolean) => {
        set({ loading });
      },

      setError: (error: string | null) => {
        set({ error });
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'app-store',
    }
  )
);
