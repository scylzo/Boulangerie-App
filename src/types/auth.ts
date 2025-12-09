export interface User {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  role: 'admin' | 'gestionnaire' | 'boulanger' | 'livreur' | 'vendeuse';
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export type UserRole = 'admin' | 'gestionnaire' | 'boulanger' | 'livreur' | 'vendeuse';