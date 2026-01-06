import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../lib/api';
import type { User, AuthResponse } from '@dnd-voice/shared';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Actions
  login: (username: string, password: string) => Promise<void>;
  register: (
    username: string,
    password: string,
    role?: 'dm' | 'player'
  ) => Promise<void>;
  logout: () => void;
  initialize: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      isInitialized: false,
      error: null,

      login: async (username: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post<AuthResponse>('/auth/login', {
            username,
            password,
          });

          api.setToken(response.token);

          set({
            user: response.user,
            token: response.token,
            isLoading: false,
          });
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Login failed',
          });
          throw error;
        }
      },

      register: async (
        username: string,
        password: string,
        role: 'dm' | 'player' = 'player'
      ) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post<AuthResponse>('/auth/register', {
            username,
            password,
            role,
          });

          api.setToken(response.token);

          set({
            user: response.user,
            token: response.token,
            isLoading: false,
          });
        } catch (error) {
          set({
            isLoading: false,
            error:
              error instanceof Error ? error.message : 'Registration failed',
          });
          throw error;
        }
      },

      logout: () => {
        api.setToken(null);
        set({
          user: null,
          token: null,
          error: null,
        });
      },

      initialize: async () => {
        const { token } = get();

        if (!token) {
          set({ isInitialized: true });
          return;
        }

        // Set token in API client
        api.setToken(token);

        // Verify token is still valid by fetching current user
        set({ isLoading: true });
        try {
          const user = await api.get<User>('/auth/me');
          set({
            user,
            isLoading: false,
            isInitialized: true,
          });
        } catch {
          // Token is invalid or expired, clear auth state
          api.setToken(null);
          set({
            user: null,
            token: null,
            isLoading: false,
            isInitialized: true,
          });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'dnd-voice-auth',
      // Only persist token, not loading/error states
      partialize: (state) => ({ token: state.token }),
    }
  )
);
