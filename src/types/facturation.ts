export interface LigneFacture {
  produitId: string;
  produit?: Produit;
  quantiteLivree: number;
  quantiteRetournee: number;
  quantiteFacturee: number; // quantiteLivree - quantiteRetournee
  prixUnitaire: number;
  montantLigne: number; // quantiteFacturee * prixUnitaire
}

export interface Facture {
  id: string;
  numeroFacture: string; // Format: FACT-YYYYMMDD-001
  clientId: string;
  client?: Client;
  dateLivraison: Date;
  dateFacture: Date;

  // Données de base
  lignes: LigneFacture[];

  // Totaux
  totalHT: number;
  tauxTVA: number;
  montantTVA: number;
  totalTTC: number;

  // État de la facture
  statut: 'brouillon' | 'en_attente_retours' | 'validee' | 'envoyee' | 'payee' | 'annulee';
  retoursCompletes: boolean; // true si tous les retours ont été saisis

  // Métadonnées
  createdAt: Date;
  updatedAt: Date;
  validatedAt?: Date;
  paidAt?: Date;

  // Informations complémentaires
  notes?: string;
  conditionsPaiement?: string;
  echeance?: Date;
}

export interface ParametresFacturation {
  id: string;
  tauxTVADefaut: number; // Taux TVA par défaut (0% = désactivée)
  conditionsPaiementDefaut: string; // "Payable à 30 jours"
  mentionsLegales: string;
  numeroFactureProchain: number;
  prefixeFacture: string; // "FACT"
}

// Import des types existants
import type { Produit, Client } from './production';