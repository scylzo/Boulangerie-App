import type { Produit } from './production';

export interface StockBoutique {
  id: string;
  date: Date;
  produits: Array<{
    produitId: string;
    produit?: Produit;
    stockDebut: number; // quantité reçue de la production
    // Répartition par car de livraison pour la boutique
    repartitionCars?: {
      car1_matin: number;
      car2_matin: number;
      car_soir: number;
    };
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface EquipeBoutique {
  id: string;
  date: Date;
  periode: 'matin' | 'soir';
  vendeuse: string;
  produits: Array<{
    produitId: string;
    produit?: Produit;
    stockDebut: number;
    vendu: number;
    reste: number;
    // Pour le matin: reste = stock - vendu (transmis au soir)
    // Pour le soir: reste = invendu boutique final
  }>;
  statut: 'en_cours' | 'termine';
  createdAt: Date;
  updatedAt: Date;
}

export interface VentesBoutique {
  id: string;
  date: Date;
  produits: Array<{
    produitId: string;
    produit?: Produit;
    stockDebut: number;
    venduMatin: number;
    resteMidi: number;
    venduSoir: number;
    invenduBoutique: number; // reste final
    venduTotal: number; // venduMatin + venduSoir
  }>;
  createdAt: Date;
  updatedAt: Date;
}