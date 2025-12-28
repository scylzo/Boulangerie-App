import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { firestoreService } from '../firebase/collections';

export async function resetDatabase() {
  console.log('🗑️  Début du nettoyage de la base de données...');

  const collections = [
    'productionPrograms',
    'clientOrders',
    'shopStock',
    'shopShifts',
    'clientReturns',
    'dailyReports'
  ];

  try {
    // Supprimer toutes les collections de données opérationnelles
    for (const collectionName of collections) {
      console.log(`🧹 Nettoyage de la collection: ${collectionName}`);
      const collectionRef = collection(db, collectionName);
      const snapshot = await getDocs(collectionRef);

      const deletePromises = snapshot.docs.map(document =>
        deleteDoc(doc(db, collectionName, document.id))
      );

      await Promise.all(deletePromises);
      console.log(`✅ Collection ${collectionName} nettoyée (${snapshot.docs.length} documents supprimés)`);
    }

    // Initialiser des données propres pour les référentiels
    await initializeCleanData();

    console.log('🎉 Base de données nettoyée et réinitialisée avec succès!');
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error);
    throw error;
  }
}

async function initializeCleanData() {
  console.log('📝 Initialisation des données de référence...');

  // Produits de base pour une boulangerie
  const produits = [
    {
      nom: 'Pain Complet',
      description: 'Pain complet traditionnel',
      unite: 'piece' as const,
      prixClient: 200,
      prixBoutique: 250,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      nom: 'Pain Blanc',
      description: 'Pain blanc classique',
      unite: 'piece' as const,
      prixClient: 175,
      prixBoutique: 225,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      nom: 'Croissant',
      description: 'Croissant au beurre',
      unite: 'piece' as const,
      prixClient: 150,
      prixBoutique: 200,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      nom: 'Pain au Chocolat',
      description: 'Pain au chocolat traditionnel',
      unite: 'piece' as const,
      prixClient: 175,
      prixBoutique: 225,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      nom: 'Baguette',
      description: 'Baguette française',
      unite: 'piece' as const,
      prixClient: 150,
      prixBoutique: 200,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      nom: 'Pain de Mie',
      description: 'Pain de mie pour sandwich',
      unite: 'piece' as const,
      prixClient: 300,
      prixBoutique: 400,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  // Clients de base
  const clients = [
    {
      nom: 'Restaurant Le Palmier',
      adresse: 'Zone 4, Ouagadougou',
      telephone: '+226 70 12 34 56',
      email: 'contact@lepalmier.bf',
      typeClient: 'client' as const,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      nom: 'Hôtel Splendid',
      adresse: 'Avenue Kwame Nkrumah, Ouagadougou',
      telephone: '+226 70 23 45 67',
      email: 'commandes@splendid.bf',
      typeClient: 'client' as const,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      nom: 'Café Central',
      adresse: 'Centre-ville, Ouagadougou',
      telephone: '+226 70 34 56 78',
      email: 'cafe.central@gmail.com',
      typeClient: 'client' as const,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      nom: 'Boutique Principale',
      adresse: 'Siège social',
      telephone: '+226 70 00 00 00',
      email: 'boutique@boulangerie.bf',
      typeClient: 'boutique' as const,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  try {
    // Créer les produits
    for (const produit of produits) {
      await firestoreService.create('produits', produit);
    }
    console.log(`✅ ${produits.length} produits créés`);

    // Créer les clients
    for (const client of clients) {
      await firestoreService.create('clients', client);
    }
    console.log(`✅ ${clients.length} clients créés`);

  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation:', error);
    throw error;
  }
}