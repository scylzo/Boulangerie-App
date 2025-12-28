/**
 * Formate un montant en FCFA
 */
export const formatCurrency = (amount: number): string => {
  return `${Math.round(amount).toLocaleString('fr-FR')} FCFA`;
};

/**
 * Formate un montant en FCFA sans les espaces (pour les calculs)
 */
export const formatCurrencyCompact = (amount: number): string => {
  return `${Math.round(amount)} FCFA`;
};