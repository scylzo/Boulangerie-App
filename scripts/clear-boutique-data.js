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

// Collections liées à la boutique uniquement
const boutiqueCollections = [
  'shopStock',      // Stock boutique
  'shopShifts',     // Équipes boutique (matin/soir)
  'shopSales'       // Ventes boutique (si existe)
];

async function clearBoutiqueData() {
  console.log('🧹 Suppression des données boutique pour voir les nouveaux changements...');
  console.log('📋 Collections à vider:', boutiqueCollections.join(', '));

  for (const collectionName of boutiqueCollections) {
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

  console.log('🎉 Données boutique supprimées!');
  console.log('');
  console.log('📝 Pour voir les nouveaux changements avec répartition par cars:');
  console.log('1. Allez dans "Programme de Production"');
  console.log('2. Ajoutez des quantités boutique avec répartition par cars');
  console.log('3. Allez dans "Boutique" pour voir le planning des livraisons');
  console.log('');
  console.log('⚠️  Note: Les programmes de production sont conservés');

  process.exit(0);
}

clearBoutiqueData().catch(console.error);