import type { Produit } from './production';

export interface RapportJournalier {
  id: string;
  date: Date;
  produits: Array<{
    produitId: string;
    produit?: Produit;
    destineClients: boolean;
    destineBoutique: boolean;
    quantitePrevue: number;      // du programme
    quantiteProduite: number;    // saisie production
    quantiteVendueClients: number; // calculé des livraisons
    quantiteVendueBoutique: number; // calculé boutique
    quantiteVendueTotal: number;   // clients + boutique
    invendusClients: number;       // calculé des livraisons
    invendusBoutique: number;      // calculé boutique (restants + pertes)
    restantsBoutique: number;      // produits à reconduire le lendemain
    pertesBoutique: number;        // pertes réelles
    invendusTotal: number;         // clients + boutique

    // Indicateurs financiers
    valeurVenteClients: number;
    valeurVenteBoutique: number;
    valeurVenteTotal: number;

    // Indicateurs de performance
    tauxVenteClients: number;      // vendu / livré * 100
    tauxVenteBoutique: number;     // vendu / stock * 100
    tauxVenteGlobal: number;       // vendu total / produit * 100

    // Écarts
    ecartPrevuProduit: number;     // produit - prévu
    ecartProduitVendu: number;     // produit - vendu total
  }>;

  // Totaux globaux
  totaux: {
    quantitePrevue: number;
    quantiteProduite: number;
    quantiteVendueTotal: number;
    invendusTotal: number;
    tauxVenteGlobal: number;
    pertesTotales: number; // invendus total
    valeurVenteClients: number;
    valeurVenteBoutique: number;
    valeurVenteTotal: number;
  };

  statut: 'genere' | 'valide';
  createdAt: Date;
  updatedAt: Date;
}

export interface IndicateursPerformance {
  date: Date;
  tauxVenteClients: number;
  tauxVenteBoutique: number;
  tauxVenteGlobal: number;
  pertesClients: number;
  pertesBoutique: number;
  restantsBoutique: number;
  restantsTotaux: number;
  pertesTotales: number;
  valeurVenteClients: number;
  valeurVenteBoutique: number;
  valeurVenteTotal: number;
}