/**
 * Formate un nom de produit pour l'affichage : MAJUSCULES par défaut.
 * Purement visuel — ne pas utiliser pour comparer/rechercher/stocker.
 */
export const formatNomProduit = (nom?: string | null): string =>
  (nom ?? '').toLocaleUpperCase('fr-FR');

/**
 * Formate une quantité pour l'affichage : arrondit (max 2 décimales) pour
 * éliminer les artefacts de virgule flottante (ex. 32.900000000000006 → 32,9)
 * et enlève les zéros inutiles.
 */
export const formatQuantite = (n?: number | null): string => {
  const v = Number(n) || 0;
  return Number(v.toFixed(2)).toLocaleString('fr-FR');
};
