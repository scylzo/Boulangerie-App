/**
 * Formate un montant en FCFA
 */
export const formatCurrency = (amount: number): string => {
  return `${Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} FCFA`;
};

/**
 * Formate un montant en FCFA sans les espaces (pour les calculs)
 */
export const formatCurrencyCompact = (amount: number): string => {
  return `${Math.round(amount)} FCFA`;
};