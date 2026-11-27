export interface OptionConditionnement {
  id: string;
  label: string;
  labelCourt: string;
  factor: number; // Facteur multiplicateur pour obtenir l'unité de stockage de base (ex: 0.5 pour sachet de 500g quand base = kg)
  description?: string;
}

/**
 * Formate proprement les libellés d'unités de mesure (évite les identifiants techniques bruts comme sac_50kg).
 */
export const formaterNomUnite = (unite: string, pluriel: boolean = false): string => {
  if (!unite) return '';
  const clean = unite.trim().toLowerCase();
  switch (clean) {
    case 'sac_50kg':
      return pluriel ? 'sacs (50kg)' : 'sac (50kg)';
    case 'sac_25kg':
      return pluriel ? 'sacs (25kg)' : 'sac (25kg)';
    case 'sac':
      return pluriel ? 'sacs' : 'sac';
    case 'sachet':
      return pluriel ? 'sachets' : 'sachet';
    case 'carton':
      return pluriel ? 'cartons' : 'carton';
    case 'piece':
    case 'pièce':
      return pluriel ? 'pièces' : 'pièce';
    case 'kg':
    case 'kilo':
      return 'kg';
    case 'g':
      return 'g';
    case 'l':
    case 'litre':
      return pluriel ? 'litres' : 'litre';
    case 'ml':
      return 'ml';
    default:
      return unite.replace(/_/g, ' ');
  }
};

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

  if (unite === 'sac_50kg') {
    return [
      {
        id: 'sac_50kg',
        label: 'Sac (50kg)',
        labelCourt: 'sac (50kg)',
        factor: 1,
        description: 'Sac standard 50kg'
      }
    ];
  }

  if (unite === 'sac_25kg') {
    return [
      {
        id: 'sac_25kg',
        label: 'Sac (25kg)',
        labelCourt: 'sac (25kg)',
        factor: 1,
        description: 'Sac standard 25kg'
      }
    ];
  }

  // Unité par défaut identique à l'unité de stockage
  return [
    {
      id: unite,
      label: formaterNomUnite(unite),
      labelCourt: formaterNomUnite(unite),
      factor: 1
    }
  ];
};
