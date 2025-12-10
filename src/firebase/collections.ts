import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from './config';

// Collections de base
export const collectionsRef = {
  clients: collection(db, 'clients'),
  produits: collection(db, 'produits'),
  livreurs: collection(db, 'livreurs'),
  users: collection(db, 'users'),
  productionPrograms: collection(db, 'productionPrograms'),
  clientOrders: collection(db, 'clientOrders'),
  shopStock: collection(db, 'shopStock'),
  shopShifts: collection(db, 'shopShifts'),
  shopSales: collection(db, 'shopSales'),
  clientReturns: collection(db, 'clientReturns'),
  dailyReports: collection(db, 'dailyReports'),
  factures: collection(db, 'factures'),
  parametres: collection(db, 'parametres'),
  // Stock
  matieres: collection(db, 'matieres'),
  mouvements: collection(db, 'mouvements'),
  fournisseurs: collection(db, 'fournisseurs'),
};

// Utilitaires pour la conversion Date <-> Timestamp
export const dateToTimestamp = (date: Date): Timestamp => {
  return Timestamp.fromDate(date);
};

export const timestampToDate = (timestamp: Timestamp): Date => {
  return timestamp.toDate();
};

// Fonctions CRUD génériques
export const firestoreService = {
  // CREATE
  async create<T extends Record<string, any>>(collectionName: keyof typeof collectionsRef, data: T) {
    const colRef = collectionsRef[collectionName];
    return await addDoc(colRef, data);
  },

  // READ
  async getById<T>(collectionName: keyof typeof collectionsRef, id: string): Promise<T | null> {
    const docRef = doc(collectionsRef[collectionName], id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as T;
    }
    return null;
  },

  async getAll<T>(collectionName: keyof typeof collectionsRef): Promise<T[]> {
    const querySnapshot = await getDocs(collectionsRef[collectionName]);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as T));
  },

  async getByQuery<T>(
    collectionName: keyof typeof collectionsRef,
    constraints: any[]
  ): Promise<T[]> {
    const q = query(collectionsRef[collectionName], ...constraints);
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as T));
  },

  // UPDATE
  async update(collectionName: keyof typeof collectionsRef, id: string, data: Partial<any>) {
    const docRef = doc(collectionsRef[collectionName], id);
    return await updateDoc(docRef, data);
  },

  // DELETE
  async delete(collectionName: keyof typeof collectionsRef, id: string) {
    const docRef = doc(collectionsRef[collectionName], id);
    return await deleteDoc(docRef);
  }
};

// Fonctions spécifiques métier
export const businessQueries = {
  // Programmes de production
  async getProgrammeByDate(date: Date) {
    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(date);
    dateEnd.setHours(23, 59, 59, 999);

    return await firestoreService.getByQuery('productionPrograms', [
      where('date', '>=', dateToTimestamp(dateStart)),
      where('date', '<=', dateToTimestamp(dateEnd))
    ]);
  },

  // Livraisons du jour
  async getLivraisonsByDate(date: Date) {
    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(date);
    dateEnd.setHours(23, 59, 59, 999);

    return await firestoreService.getByQuery('clientReturns', [
      where('dateLivraison', '>=', dateToTimestamp(dateStart)),
      where('dateLivraison', '<=', dateToTimestamp(dateEnd))
    ]);
  },

  // Stock boutique du jour
  async getStockBoutiqueByDate(date: Date) {
    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(date);
    dateEnd.setHours(23, 59, 59, 999);

    return await firestoreService.getByQuery('shopStock', [
      where('date', '>=', dateToTimestamp(dateStart)),
      where('date', '<=', dateToTimestamp(dateEnd))
    ]);
  },

  // Rapport du jour
  async getRapportByDate(date: Date) {
    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(date);
    dateEnd.setHours(23, 59, 59, 999);

    return await firestoreService.getByQuery('dailyReports', [
      where('date', '>=', dateToTimestamp(dateStart)),
      where('date', '<=', dateToTimestamp(dateEnd))
    ]);
  },

  // Clients actifs
  async getClientsActifs() {
    return await firestoreService.getByQuery('clients', [
      where('active', '==', true),
      orderBy('nom')
    ]);
  },

  // Produits actifs
  async getProduitsActifs() {
    return await firestoreService.getByQuery('produits', [
      where('active', '==', true),
      orderBy('nom')
    ]);
  }
};