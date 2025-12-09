import { create } from 'zustand';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../firebase/config';
import type { User, AuthState } from '../types';

interface AuthStore extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Le state sera mis à jour via le listener onAuthStateChanged dans App.tsx
      set({ isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      await signOut(auth);
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