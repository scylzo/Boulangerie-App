import type { Client, Produit } from './production';

export interface LivraisonClient {
  id: string;
  clientId: string;
  client?: Client;
  dateLivraison: Date;
  produits: Array<{
    produitId: string;
    produit?: Produit;
    quantiteLivree: number;
    invendus: number;
    vendu: number; // calculé automatiquement: quantiteLivree - invendus
  }>;
  statut: 'a_livrer' | 'en_cours' | 'termine';
  createdAt: Date;
  updatedAt: Date;
}

export interface InvendusClient {
  id?: string;
  clientId: string;
  client?: Client;
  dateLivraison: Date;
  produits: Array<{
    produitId: string;
    produit?: Produit;
    quantiteLivree: number;
    invendus: number;
    vendu: number;
  }>;
  retoursCompletes?: boolean; // Indique si tous les retours ont été finalisés
  createdAt: Date;
  updatedAt: Date;
}