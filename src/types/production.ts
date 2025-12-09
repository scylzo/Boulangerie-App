export interface Produit {
  id: string;
  nom: string;
  description?: string;
  unite: 'piece' | 'kg' | 'g';
  prixClient?: number; // Prix avec réduction pour les clients
  prixBoutique?: number; // Prix normal pour la boutique
  prixUnitaire?: number; // Pour compatibilité avec l'ancien code (à supprimer progressivement)
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Client {
  id: string;
  nom: string;
  adresse: string;
  telephone?: string;
  email?: string;
  typeClient: 'client' | 'boutique'; // Type pour déterminer le prix à appliquer
  livreurId?: string; // Livreur assigné à ce client
  conditionsPaiement?: string; // Conditions spécifiques au client (ex: "Payable à 15 jours", "Comptant")
  eligibleRistourne?: boolean; // Si true, le client accumule une ristourne (Différence Prix Boutique - Prix Client)
  commandeType?: Array<{
    produitId: string;
    quantiteCommandee: number;
    prixUnitaire?: number; // Optionnel, car le prix peut évoluer
    repartitionCars?: {
      car1_matin: number | string;
      car2_matin: number | string;
      car_soir: number | string;
    };
  }>;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Livreur {
  id: string;
  nom: string;
  telephone?: string;
  vehicule?: string; // Type de véhicule ou plaque
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CarLivraison = 'car1_matin' | 'car2_matin' | 'car_soir';

export const CARS_LIVRAISON = {
  car1_matin: 'Car 1 - Matin',
  car2_matin: 'Car 2 - Matin',
  car_soir: 'Car - Soir'
} as const;

export interface CommandeClient {
  id: string;
  clientId: string;
  client?: Client;
  produits: Array<{
    produitId: string;
    produit?: Produit;
    quantiteCommandee: number;
    prixUnitaire?: number;
    // Répartition par car pour ce produit spécifique
    repartitionCars?: {
      car1_matin: number;
      car2_matin: number;
      car_soir: number;
    };
  }>;
  dateCommande: Date;
  dateLivraison: Date;
  carLivraison?: CarLivraison; // Obsolète - remplacé par repartitionCars au niveau produit
  statut: 'prevue' | 'confirmee' | 'livree' | 'annulee';
  createdAt: Date;
  updatedAt: Date;
}

export interface QuantiteBoutique {
  produitId: string;
  produit?: Produit;
  quantite: number;
}

export interface ProgrammeProduction {
  id: string;
  date: Date;
  commandesClients: CommandeClient[];
  quantitesBoutique: QuantiteBoutique[];
  totauxParProduit: Array<{
    produitId: string;
    produit?: Produit;
    totalClient: number;
    totalBoutique: number;
    totalGlobal: number;
    // Répartition par car de livraison
    repartitionCar1Matin: number;
    repartitionCar2Matin: number;
    repartitionCarSoir: number;
  }>;
  statut: 'brouillon' | 'envoye' | 'produit';
  createdAt: Date;
  updatedAt: Date;
}