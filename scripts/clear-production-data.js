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

// Collections liées à la production
const productionCollections = [
  'productionPrograms',  // Programmes de production
  'shopStock',          // Stock boutique
  'shopShifts',         // Équipes boutique
  'shopSales'           // Ventes boutique
];

async function clearProductionData() {
  console.log('🔄 Suppression des programmes de production et données boutique...');
  console.log('📋 Collections à vider:', productionCollections.join(', '));

  for (const collectionName of productionCollections) {
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

  console.log('🎉 Programmes de production et données boutique supprimés!');
  console.log('');
  console.log('✨ Maintenant tu peux créer de nouveaux programmes avec répartition par cars');
  console.log('');
  console.log('📝 Étapes:');
  console.log('1. Va dans "Programme de Production"');
  console.log('2. Crée un nouveau programme');
  console.log('3. Ajoute des quantités boutique avec la nouvelle répartition par cars');
  console.log('4. Va dans "Boutique" pour voir le planning');

  process.exit(0);
}

clearProductionData().catch(console.error);