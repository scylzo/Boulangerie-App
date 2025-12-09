import type { Produit, Client, CommandeClient } from '../types';

// Données fictives pour simuler
export const produitsFictifs: Produit[] = [
  {
    id: 'prod_1',
    nom: 'Baguette',
    description: 'Baguette tradition française',
    unite: 'piece',
    prixClient: 700,
    prixBoutique: 800,
    prixUnitaire: 800,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'prod_2',
    nom: 'Pain au lait Choco',
    description: 'Pain au lait aux pépites de chocolat',
    unite: 'piece',
    prixClient: 400,
    prixBoutique: 450,
    prixUnitaire: 450,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'prod_3',
    nom: 'Croissant Beurre',
    description: 'Croissant au beurre',
    unite: 'piece',
    prixClient: 700,
    prixBoutique: 800,
    prixUnitaire: 800,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'prod_4',
    nom: 'Madeleine',
    description: 'Madeleines traditionnelles',
    unite: 'piece',
    prixClient: 220,
    prixBoutique: 250,
    prixUnitaire: 250,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'prod_5',
    nom: 'Cake 200',
    description: 'Cake format 200g',
    unite: 'piece',
    prixClient: 3800,
    prixBoutique: 4200,
    prixUnitaire: 4200,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

export const clientsFictifs: Client[] = [
  {
    id: 'client_1',
    nom: 'Restaurant Central',
    adresse: 'Avenue Bourguiba, Dakar',
    telephone: '+221 33 123 45 67',
    email: 'central@restaurant.sn',
    typeClient: 'client',
    active: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'client_2',
    nom: 'Hôtel Teranga',
    adresse: 'Corniche Ouest, Dakar',
    telephone: '+221 33 987 65 43',
    email: 'contact@teranga-hotel.sn',
    typeClient: 'client',
    active: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'client_3',
    nom: 'Café de la Paix',
    adresse: 'Place de l\'Indépendance, Dakar',
    telephone: '+221 33 456 78 90',
    typeClient: 'boutique',
    active: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'client_4',
    nom: 'Boutique Plateau',
    adresse: 'Rue Parchappe, Plateau',
    telephone: '+221 33 234 56 78',
    typeClient: 'boutique',
    active: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

export const commandesFictives: CommandeClient[] = [
  {
    id: 'cmd_1',
    clientId: 'client_1',
    client: clientsFictifs[0],
    dateLivraison: new Date('2025-11-21'),
    dateCommande: new Date('2025-11-20'),
    statut: 'confirmee',
    produits: [
      {
        produitId: 'prod_1',
        produit: produitsFictifs[0],
        quantiteCommandee: 50,
        prixUnitaire: 800,
        repartitionCars: { 'car1_matin': 30, 'car2_matin': 20, 'car_soir': 10, }
      },
      {
        produitId: 'prod_2',
        produit: produitsFictifs[1],
        quantiteCommandee: 20,
        prixUnitaire: 450,
        repartitionCars: { 'car1_matin': 12, 'car2_matin': 8, 'car_soir': 10, }
      },
      {
        produitId: 'prod_3',
        produit: produitsFictifs[2],
        quantiteCommandee: 30,
        prixUnitaire: 800,
        repartitionCars: { 'car1_matin': 10, 'car2_matin': 10, 'car_soir': 10, }
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'cmd_2',
    clientId: 'client_2',
    client: clientsFictifs[1],
    dateLivraison: new Date('2025-11-21'),
    dateCommande: new Date('2025-11-20'),
    statut: 'confirmee',
    produits: [
      {
        produitId: 'prod_1',
        produit: produitsFictifs[0],
        quantiteCommandee: 80,
        prixUnitaire: 800,
        repartitionCars: { 'car1_matin': 50, 'car2_matin': 30, 'car_soir': 10, }
      },
      {
        produitId: 'prod_4',
        produit: produitsFictifs[3],
        quantiteCommandee: 100,
        prixUnitaire: 250,
        repartitionCars: { 'car1_matin': 60, 'car2_matin': 40, 'car_soir': 10, }
      },
      {
        produitId: 'prod_5',
        produit: produitsFictifs[4],
        quantiteCommandee: 5,
        prixUnitaire: 4200,
        repartitionCars: { 'car1_matin': 3, 'car2_matin': 2, 'car_soir': 10, }
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'cmd_3',
    clientId: 'client_3',
    client: clientsFictifs[2],
    dateLivraison: new Date('2025-11-21'),
    dateCommande: new Date('2025-11-20'),
    statut: 'prevue',
    produits: [
      {
        produitId: 'prod_3',
        produit: produitsFictifs[2],
        quantiteCommandee: 25,
        prixUnitaire: 800,
        repartitionCars: { 'car1_matin': 15, 'car2_matin': 10, 'car_soir': 0, }
      },
      {
        produitId: 'prod_2',
        produit: produitsFictifs[1],
        quantiteCommandee: 15,
        prixUnitaire: 450,
        repartitionCars: { 'car1_matin': 8, 'car2_matin': 7, 'car_soir': 10, }
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

export const quantitesBoutiqueFictives = [
  {
    produitId: 'prod_1',
    produit: produitsFictifs[0],
    quantite: 200
  },
  {
    produitId: 'prod_2',
    produit: produitsFictifs[1],
    quantite: 50
  },
  {
    produitId: 'prod_3',
    produit: produitsFictifs[2],
    quantite: 100
  },
  {
    produitId: 'prod_4',
    produit: produitsFictifs[3],
    quantite: 80
  }
];