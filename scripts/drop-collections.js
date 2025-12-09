import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBwaC_ySezVpfv9y9xHNromiTW77qJQlmA",
  authDomain: "boulangerie-da431.firebaseapp.com",
  projectId: "boulangerie-da431",
  storageBucket: "boulangerie-da431.firebasestorage.app",
  messagingSenderId: "324942492234",
  appId: "1:324942492234:web:afbc851e38b557a87f2cb3",
  measurementId: "G-3E7K2Y6N31"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const collections = [
  'clients',
  'produits',
  'users',
  'productionPrograms',
  'clientOrders',
  'shopStock',
  'shopShifts',
  'clientReturns',
  'dailyReports'
];

async function dropCollections() {
  console.log('🗑️  Suppression de toutes les collections...');

  for (const collectionName of collections) {
    try {
      const querySnapshot = await getDocs(collection(db, collectionName));
      const deletePromises = [];

      querySnapshot.forEach((doc) => {
        deletePromises.push(deleteDoc(doc.ref));
      });

      if (deletePromises.length > 0) {
        await Promise.all(deletePromises);
        console.log(`✅ Collection "${collectionName}" vidée (${deletePromises.length} documents supprimés)`);
      } else {
        console.log(`📭 Collection "${collectionName}" déjà vide`);
      }
    } catch (error) {
      console.error(`❌ Erreur lors de la suppression de "${collectionName}":`, error);
    }
  }

  console.log('🎉 Toutes les collections ont été vidées!');
  console.log('Vous pouvez maintenant ajouter vos vraies données.');
  process.exit(0);
}

dropCollections().catch(console.error);