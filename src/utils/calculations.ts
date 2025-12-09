/**
 * Fonctions utilitaires pour les calculs métier de la boulangerie
 */

// Calculs Production
export const calculerTotalGlobal = (totalClient: number, totalBoutique: number): number => {
  return totalClient + totalBoutique;
};

// Calculs Livraison
export const calculerVenduClient = (quantiteLivree: number, invendus: number): number => {
  return Math.max(0, quantiteLivree - invendus);
};

export const calculerTauxVenteClient = (vendu: number, livre: number): number => {
  if (livre === 0) return 0;
  return Math.round((vendu / livre) * 100 * 100) / 100; // 2 décimales
};

// Calculs Boutique
export const calculerResteMidi = (stockDebut: number, venduMatin: number): number => {
  return Math.max(0, stockDebut - venduMatin);
};

export const calculerInvenduBoutique = (stockDebut: number, vendu: number): number => {
  return Math.max(0, stockDebut - vendu);
};

export const calculerVenduTotalBoutique = (venduMatin: number, venduSoir: number): number => {
  return venduMatin + venduSoir;
};

export const calculerTauxVenteBoutique = (venduTotal: number, stockDebut: number): number => {
  if (stockDebut === 0) return 0;
  return Math.round((venduTotal / stockDebut) * 100 * 100) / 100; // 2 décimales
};

// Calculs Rapport
export const calculerTauxVenteGlobal = (venduTotal: number, produit: number): number => {
  if (produit === 0) return 0;
  return Math.round((venduTotal / produit) * 100 * 100) / 100; // 2 décimales
};

export const calculerEcart = (valeur1: number, valeur2: number): number => {
  return valeur1 - valeur2;
};

export const calculerPertesTotales = (invendusClients: number, invendusBoutique: number): number => {
  return invendusClients + invendusBoutique;
};

export const calculerPourcentagePertes = (pertesTotales: number, quantiteProduite: number): number => {
  if (quantiteProduite === 0) return 0;
  return Math.round((pertesTotales / quantiteProduite) * 100 * 100) / 100; // 2 décimales
};

// Validation des données
export const validerQuantite = (quantite: number): boolean => {
  return quantite >= 0 && Number.isInteger(quantite);
};

export const validerInvendus = (invendus: number, quantiteLivree: number): boolean => {
  return invendus >= 0 && invendus <= quantiteLivree && Number.isInteger(invendus);
};

export const validerVente = (vendu: number, stockDebut: number): boolean => {
  return vendu >= 0 && vendu <= stockDebut && Number.isInteger(vendu);
};

// Formatage
export const formaterPourcentage = (valeur: number): string => {
  return `${valeur.toFixed(1)}%`;
};

export const formaterQuantite = (quantite: number, unite: string = ''): string => {
  return `${quantite}${unite ? ' ' + unite : ''}`;
};