import type { Produit } from '../types';

export const produitsInitiaux: Omit<Produit, 'id' | 'createdAt' | 'updatedAt'>[] = [
  // Pains
  {
    nom: 'Baguette',
    description: 'Baguette tradition française',
    unite: 'piece',
    prixUnitaire: 200,
    active: true
  },
  {
    nom: 'Baguette Pistolet',
    description: 'Petite baguette individuelle',
    unite: 'piece',
    prixUnitaire: 150,
    active: true
  },
  {
    nom: 'Pain au lait Nature',
    description: 'Pain au lait nature',
    unite: 'piece',
    prixUnitaire: 100,
    active: true
  },
  {
    nom: 'Pain au lait Choco',
    description: 'Pain au lait aux pépites de chocolat',
    unite: 'piece',
    prixUnitaire: 120,
    active: true
  },
  {
    nom: 'Pain Hamburger',
    description: 'Pain spécial hamburger',
    unite: 'piece',
    prixUnitaire: 300,
    active: true
  },
  {
    nom: 'Pain Raisin',
    description: 'Pain aux raisins',
    unite: 'piece',
    prixUnitaire: 350,
    active: true
  },

  // Viennoiseries
  {
    nom: 'Croissant Choco',
    description: 'Croissant au chocolat',
    unite: 'piece',
    prixUnitaire: 250,
    active: true
  },
  {
    nom: 'Croissant Beurre',
    description: 'Croissant au beurre',
    unite: 'piece',
    prixUnitaire: 200,
    active: true
  },

  // Pâtisseries
  {
    nom: 'Cake 100',
    description: 'Cake format 100g',
    unite: 'piece',
    prixUnitaire: 1500,
    active: true
  },
  {
    nom: 'Cake 200',
    description: 'Cake format 200g',
    unite: 'piece',
    prixUnitaire: 2500,
    active: true
  },
  {
    nom: 'Cake 300',
    description: 'Cake format 300g',
    unite: 'piece',
    prixUnitaire: 3500,
    active: true
  },
  {
    nom: 'Madeleine',
    description: 'Madeleines traditionnelles',
    unite: 'piece',
    prixUnitaire: 75,
    active: true
  },
  {
    nom: 'Cookies',
    description: 'Cookies maison',
    unite: 'piece',
    prixUnitaire: 200,
    active: true
  },

  // Spécialités
  {
    nom: 'Dakaroise',
    description: 'Spécialité Dakaroise',
    unite: 'piece',
    prixUnitaire: 500,
    active: true
  },
  {
    nom: 'Swiss Choco (Drops)',
    description: 'Chocolat suisse en drops',
    unite: 'piece',
    prixUnitaire: 150,
    active: true
  }
];

export const clientsInitiaux = [
  'Client A',
  'Client B',
  'Client C',
  'Restaurant Central',
  'Hôtel Teranga',
  'Café de la Paix',
  'Boutique Plateau',
  'Marché Kermel'
];