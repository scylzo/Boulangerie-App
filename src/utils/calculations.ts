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

import { formaterNomUnite } from './conditionnementStock';

// Formatage
export const formaterPourcentage = (valeur: number): string => {
  return `${valeur.toFixed(1)}%`;
};

export const formaterQuantite = (quantite: number, unite: string = ''): string => {
  const libelleUnite = unite ? ' ' + formaterNomUnite(unite, Math.abs(quantite) > 1) : '';
  if (quantite === undefined || quantite === null || isNaN(quantite)) {
    return `0${libelleUnite}`;
  }
  // Arrondir à 2 décimales pour éviter les problèmes de précision flottante (ex: -32.900000000000006 -> -32,9)
  const signe = quantite < 0 ? -1 : 1;
  const abs = Math.abs(quantite);
  const arrondie = signe * (Math.round((abs + Number.EPSILON) * 100) / 100);
  return `${arrondie.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}${libelleUnite}`;
};

export interface ParametresRendement {
  poidsBaguetteGr: number; // Défaut : 300 g
  coeffRendement: number;  // Défaut : 1366 (g par kg de farine → 50 × 1366 = 68 300 g / sac de 50 kg)
}

const RENDEMENT_STORAGE_KEY = 'boulangerie_rendement_params';

export const DEFAULT_RENDEMENT_PARAMS: ParametresRendement = {
  poidsBaguetteGr: 300,
  coeffRendement: 1366,
};

export const getParametresRendement = (): ParametresRendement => {
  try {
    const raw = localStorage.getItem(RENDEMENT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        poidsBaguetteGr: Number(parsed.poidsBaguetteGr) > 0 ? Number(parsed.poidsBaguetteGr) : DEFAULT_RENDEMENT_PARAMS.poidsBaguetteGr,
        coeffRendement: Number(parsed.coeffRendement) > 0 ? Number(parsed.coeffRendement) : DEFAULT_RENDEMENT_PARAMS.coeffRendement,
      };
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_RENDEMENT_PARAMS;
};

export const saveParametresRendement = (params: ParametresRendement): void => {
  try {
    localStorage.setItem(RENDEMENT_STORAGE_KEY, JSON.stringify(params));
  } catch {
    // ignore storage errors
  }
};

/**
 * Rendement théorique en pièces par sac de 50 kg :
 * (50 × coeffRendement) ÷ poidsBaguetteGr
 * Ex : (50 × 1366) ÷ 300 = 228 pièces / sac
 */
export const calculerRendementTheoriqueParSac = (
  poidsBaguetteGr: number,
  coeffRendement: number = 1366
): number => {
  if (!poidsBaguetteGr || poidsBaguetteGr <= 0 || !coeffRendement || coeffRendement <= 0) return 0;
  return Math.round((50 * coeffRendement) / poidsBaguetteGr);
};