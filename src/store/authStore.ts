import { create } from 'zustand';
import type { User, AuthState } from '../types';

interface AuthStore extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: {
    id: 'dev-user',
    email: 'admin@boulangerie.com',
    nom: 'Admin',
    prenom: 'Test',
    role: 'admin',
    active: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  isLoading: false,
  isAuthenticated: true, // Temporaire pour développement

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      // TODO: Implement Firebase authentication
      console.log('Login:', email, password);
      set({ isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      // TODO: Implement Firebase logout
      set({ user: null, isAuthenticated: false });
    } catch (error) {
      console.error('Logout error:', error);
    }
  },

  setUser: (user: User | null) => {
    set({
      user,
      isAuthenticated: user !== null
    });
  },

  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },
}));