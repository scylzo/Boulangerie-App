export interface Ingredient {
  matiereId: string;
  quantite: number; // Quantité de matière première nécessaire pour 1 unité de produit
}

export interface Produit {
  id: string;
  nom: string;
  description?: string;
  unite: 'piece' | 'kg' | 'g';
  prixClient?: number; // Prix avec réduction pour les clients
  prixBoutique?: number; // Prix normal pour la boutique
  categorie?: 'boulangerie' | 'viennoiserie';
  saveur?: 'sale' | 'sucre'; // Catégorie salé/sucré — suivi des ventes vs coût d'investissement
  imageUrl?: string; // Photo du produit (data URL base64 redimensionnée, ou URL)
  reconduisible?: boolean; // Si true, les invendus peuvent être reconduits le lendemain
  productionQuotidienne?: boolean; // Produit fabriqué tous les jours pour la boutique (rappelé dans le programme)
  quantiteBoutiqueDefaut?: number; // Quantité boutique par défaut totale (= somme des cars)
  quantiteBoutiqueDefautCars?: { car1_matin: number; car2_matin: number; car_soir: number }; // Répartition par défaut sur les cars
  prixUnitaire?: number; // Pour compatibilité avec l'ancien code (à supprimer progressivement)
  recette?: Ingredient[]; // Liste des ingrédients nécessaires
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Client {
  id: string;
  nom: string;
  prenom?: string; // Prénom du client
  adresse: string;
  telephone?: string;
  email?: string;
  typeClient: 'client' | 'boutique'; // Type pour déterminer le prix à appliquer
  livreurId?: string; // Livreur assigné à ce client
  livreursParCar?: {
    car1_matin?: string;
    car2_matin?: string;
    car_soir?: string;
  };
  conditionsPaiement?: string; // Conditions spécifiques au client (ex: "Payable à 15 jours", "Comptant")
  eligibleRistourne?: boolean; // Si true, le client accumule une ristourne (Différence Prix Boutique - Prix Client)
  aKiosque?: boolean; // Si true, le client a un kiosque
  latitude?: number; // Coordonnée GPS Latitude
  longitude?: number; // Coordonnée GPS Longitude
  solde?: number; // Solde positif = Avoir (crédit) à déduire des prochaines factures. Négatif = Dette (non géré pour l'instant)

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
  estRegulier?: boolean; // Le client commande-t-il tous les jours ?
  modePaiementPreference?: 'espece' | 'om' | 'wave' | 'cheque' | 'virement';
  neTravaillePasDimanche?: boolean; // Le client ne travaille pas le dimanche
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

export interface RedistributionData {
  type: 'boutique' | 'client' | 'mixte';
  clientId?: string;
  repartition: Array<{
    produitId: string;
    quantiteVersBoutique: number;
    quantiteVersClient: number;
    clientDestinataireId?: string;
  }>;
  motif: string;
}

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
  notes?: string;
  motifAnnulation?: string;
  redistribution?: RedistributionData;
  createdAt: Date;
  updatedAt: Date;
}



export interface QuantiteBoutique {
  produitId: string;
  produit?: Produit;
  quantite: number;
  // Répartition par car de livraison pour la boutique
  repartitionCars?: {
    car1_matin: number;
    car2_matin: number;
    car_soir: number;
  };
}

export interface ProgrammeProduction {
  id: string;
  dateProduction: Date; // Date effective de production (lendemain de la création)
  dateCreation: Date;   // Date de création du programme (sans heure)
  commandesClients: CommandeClient[];
  quantitesBoutique: QuantiteBoutique[];
  // Saisie réelle de production (optionnel, si différent du prévu)
  productionReelle?: Array<{
    produitId: string;
    quantite: number;
  }>;
  totauxParProduit: Array<{
    produitId: string;
    produit?: Produit;
    totalClient: number;
    totalBoutique: number;
    totalGlobal: number;
    // Quantité réellement produite (si saisie, sinon égal à totalGlobal ou undefined)
    quantiteProduiteReelle?: number;
    // Répartition par car de livraison
    repartitionCar1Matin: number;
    repartitionCar2Matin: number;
    repartitionCarSoir: number;
  }>;
  statut: 'brouillon' | 'envoye' | 'modifie' | 'produit';
  createdAt: Date;
  updatedAt: Date;
}