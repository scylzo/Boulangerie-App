/**
 * Formate un nom de produit pour l'affichage : MAJUSCULES par défaut.
 * Purement visuel — ne pas utiliser pour comparer/rechercher/stocker.
 */
export const formatNomProduit = (nom?: string | null): string =>
  (nom ?? '').toLocaleUpperCase('fr-FR');
