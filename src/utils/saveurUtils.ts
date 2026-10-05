import type { Saveur } from '../store/saveurStore';

/**
 * Mots-clés désignant sans ambiguïté des produits salés dans la boulangerie/pâtisserie/snacking.
 */
export const MOTS_CLES_SALE = [
  'samoussa', 'samossa', 'samosa',
  'pastel', 'pastels',
  'fataya', 'fatayas',
  'nem', 'nems',
  'croissant sale', 'croissant salé', 'croissant jambon', 'croissant fromage',
  'feuilleté', 'feuillete',
  'quiche', 'quiches',
  'pizza', 'mini-pizza', 'mini pizza', 'pizzas',
  'sandwich', 'sandwiches', 'panini', 'hot dog', 'hot-dog',
  'friand', 'chausson salé', 'chausson sale',
  'farcie', 'farcis',
  'salé', 'sale'
];

/**
 * Mots-clés désignant des produits sucrés.
 */
export const MOTS_CLES_SUCRE = [
  'chocolat', 'pain au chocolat', 'chocolatine',
  'croissant sucre', 'croissant sucré',
  'beignet', 'muffin', 'cake', 'cookie', 'cookies',
  'brioche', 'chausson aux pommes', 'tarte', 'tartelette',
  'eclair', 'éclair', 'religieuse', 'mille-feuille', 'millefeuille',
  'pain aux raisins', 'suisse', 'palmier',
  'sucre', 'sucré', 'sucree', 'sucrée'
];

/**
 * Normalise une chaîne (supprime accents et minuscules) pour la comparaison.
 */
export function normaliserTexte(txt?: string | null): string {
  if (!txt) return '';
  return txt
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

const MOTS_CLES_SALE_NORM = MOTS_CLES_SALE.map(m => normaliserTexte(m));
const MOTS_CLES_SUCRE_NORM = MOTS_CLES_SUCRE.map(m => normaliserTexte(m));

/**
 * Détermine la saveur ('sale' ou 'sucre') d'un produit.
 * 1. Priorité absolue au champ `saveur` explicite du produit ('sale' | 'sucre').
 *    Si configuré sur 'aucun' ou 'none' : renvoie toujours undefined (aucun suivi).
 * 2. Si non défini ou vide : détection automatique intelligente d'après le nom du produit.
 * Ultra-rapide : utilise les listes de mots-clés pré-normalisées en mémoire.
 */
export function determinerSaveur(
  saveurExplicite?: string | null,
  nomProduit?: string | null
): Saveur | undefined {
  if (saveurExplicite === 'sale' || saveurExplicite === 'sucre') {
    return saveurExplicite;
  }
  // Si l'utilisateur a explicitement configuré 'aucun', on ne devine rien
  if (saveurExplicite === 'aucun' || saveurExplicite === 'none') {
    return undefined;
  }
  const norm = normaliserTexte(nomProduit);
  if (!norm) return undefined;

  // Pains bruts de boulangerie & emballages : ne pas confondre avec du snacking salé
  if (
    norm.includes('pain hamburger') ||
    norm.includes('pain burger') ||
    norm.includes('sac pain') ||
    norm.includes('sac a pain')
  ) {
    return undefined;
  }

  // Détection Salé (ex: samoussa, pastels, pizza, quiche, etc.)
  for (let i = 0; i < MOTS_CLES_SALE_NORM.length; i++) {
    if (norm.includes(MOTS_CLES_SALE_NORM[i])) {
      return 'sale';
    }
  }

  // Détection Sucré
  for (let i = 0; i < MOTS_CLES_SUCRE_NORM.length; i++) {
    if (norm.includes(MOTS_CLES_SUCRE_NORM[i])) {
      return 'sucre';
    }
  }

  return undefined;
}

/**
 * Vérifie si un nom correspond spécifiquement au samoussa sous toutes ses variantes
 * (samoussa, samoussas, samoussa viande, samoussa poulet, samossa, samosa...).
 */
export function estSamoussa(nom?: string | null): boolean {
  const norm = normaliserTexte(nom);
  return norm.includes('samoussa') || norm.includes('samossa') || norm.includes('samosa');
}
