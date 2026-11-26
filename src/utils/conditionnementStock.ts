export interface OptionConditionnement {
  id: string;
  label: string;
  labelCourt: string;
  factor: number; // Facteur multiplicateur pour obtenir l'unité de stockage de base (ex: 0.5 pour sachet de 500g quand base = kg)
  description?: string;
}

/**
 * Détecte si une matière première utilise généralement des conditionnements intermédiaires
 * (ex: Levure ou Magimix achetés par cartons de 20 sachets de 500g, ou Farine en sacs).
 */
export const estMatiereAvecConditionnement = (
  matiere: { nom: string; unite: string }
): boolean => {
  const nom = (matiere.nom || '').toLowerCase();
  const unite = (matiere.unite || '').toLowerCase();

  // Levure, améliorants, Magimix, etc.
  if (
    nom.includes('levure') ||
    nom.includes('magimix') ||
    nom.includes('ameliorant') ||
    nom.includes('améliorant')
  ) {
    return true;
  }

  // Autres poudres ou matières en kg pouvant être conditionnées en sachets
  if (unite === 'kg' && (nom.includes('sel') || nom.includes('sucre') || nom.includes('chocolat'))) {
    return true;
  }

  return false;
};

/**
 * Retourne les options de conditionnement adaptées à la matière.
 */
export const getOptionsConditionnement = (
  matiere: { nom: string; unite: string }
): OptionConditionnement[] => {
  const nom = (matiere.nom || '').toLowerCase();
  const unite = (matiere.unite || '').toLowerCase();

  if (
    nom.includes('levure') ||
    nom.includes('magimix') ||
    nom.includes('ameliorant') ||
    nom.includes('améliorant')
  ) {
    if (unite === 'kg') {
      return [
        {
          id: 'sachet',
          label: 'Sachet (500g)',
          labelCourt: 'sachet',
          factor: 0.5,
          description: '1 sachet = 0.5 kg (500g)'
        },
        {
          id: 'carton',
          label: 'Carton (20 sachets)',
          labelCourt: 'carton',
          factor: 10,
          description: '1 carton = 20 sachets de 500g (10 kg)'
        },
        {
          id: 'kg',
          label: 'Kilogramme (kg)',
          labelCourt: 'kg',
          factor: 1,
          description: 'Poids direct'
        }
      ];
    }
  }

  // Si l'unité de base est déjà le kg, proposer sachet 500g par défaut
  if (unite === 'kg') {
    return [
      {
        id: 'kg',
        label: 'Kilogramme (kg)',
        labelCourt: 'kg',
        factor: 1
      },
      {
        id: 'sachet',
        label: 'Sachet (500g)',
        labelCourt: 'sachet (500g)',
        factor: 0.5
      }
    ];
  }

  // Unité par défaut identique à l'unité de stockage
  return [
    {
      id: unite,
      label: unite,
      labelCourt: unite,
      factor: 1
    }
  ];
};
