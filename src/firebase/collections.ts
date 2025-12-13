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
  onSnapshot,
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
      where('dateProduction', '>=', dateToTimestamp(dateStart)),
      where('dateProduction', '<=', dateToTimestamp(dateEnd))
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

// Fonctions de listener en temps réel
export const realTimeListeners = {
  // Listener pour les programmes de production par date
  subscribeToProgram(date: Date, callback: (programs: any[]) => void) {
    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(date);
    dateEnd.setHours(23, 59, 59, 999);

    const q = query(
      collectionsRef.productionPrograms,
      where('dateProduction', '>=', dateToTimestamp(dateStart)),
      where('dateProduction', '<=', dateToTimestamp(dateEnd))
    );

    return onSnapshot(q, (querySnapshot) => {
      const programs = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(programs);
    }, (error) => {
      console.error('❌ Erreur listener programme:', error);
    });
  },

  // Listener pour les factures
  subscribeToFactures(callback: (factures: any[]) => void, dateDebut?: Date, dateFin?: Date) {
    let q;

    if (dateDebut && dateFin) {
      q = query(
        collectionsRef.factures,
        where('dateLivraison', '>=', dateToTimestamp(dateDebut)),
        where('dateLivraison', '<=', dateToTimestamp(dateFin)),
        orderBy('dateLivraison', 'desc')
      );
    } else {
      q = query(
        collectionsRef.factures,
        orderBy('dateFacture', 'desc')
      );
    }

    return onSnapshot(q, (querySnapshot) => {
      const factures = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          dateLivraison: timestampToDate(data.dateLivraison as Timestamp),
          dateFacture: timestampToDate(data.dateFacture as Timestamp),
          createdAt: timestampToDate(data.createdAt as Timestamp),
          updatedAt: timestampToDate(data.updatedAt as Timestamp),
          validatedAt: data.validatedAt ? timestampToDate(data.validatedAt as Timestamp) : undefined,
          paidAt: data.paidAt ? timestampToDate(data.paidAt as Timestamp) : undefined,
        };
      });
      callback(factures);
    }, (error) => {
      console.error('❌ Erreur listener factures:', error);
    });
  },

  // Listener générique pour une collection
  subscribeToCollection<T>(
    collectionName: keyof typeof collectionsRef,
    callback: (data: T[]) => void,
    constraints: any[] = []
  ) {
    const q = constraints.length > 0
      ? query(collectionsRef[collectionName], ...constraints)
      : collectionsRef[collectionName];

    return onSnapshot(q, (querySnapshot) => {
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as T));
      callback(data);
    }, (error) => {
      console.error(`❌ Erreur listener ${collectionName}:`, error);
    });
  }
};