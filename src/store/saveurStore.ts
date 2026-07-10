import { create } from 'zustand';
import { collection, addDoc, getDocs, deleteDoc, doc, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

export type Saveur = 'sale' | 'sucre';

// Un achat d'investissement (coût saisi depuis les tickets de courses)
export interface SaveurAchat {
  id?: string;
  date: string;        // yyyy-mm-dd
  montant: number;     // FCFA
  saveur: Saveur;
  note?: string;
  createdAt?: Date;
}

interface SaveurStore {
  achats: SaveurAchat[];
  isLoading: boolean;
  chargerAchats: (debut: Date, fin: Date) => Promise<void>;
  ajouterAchat: (achat: Omit<SaveurAchat, 'id' | 'createdAt'>) => Promise<void>;
  supprimerAchat: (id: string) => Promise<void>;
}

const jourKey = (d: Date) => d.toISOString().split('T')[0];

export const useSaveurStore = create<SaveurStore>((set) => ({
  achats: [],
  isLoading: false,

  chargerAchats: async (debut: Date, fin: Date) => {
    set({ isLoading: true });
    try {
      const q = query(
        collection(db, 'saveur_achats'),
        where('date', '>=', jourKey(debut)),
        where('date', '<=', jourKey(fin))
      );
      const snap = await getDocs(q);
      const achats = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as SaveurAchat[];
      achats.sort((a, b) => (a.date < b.date ? 1 : -1));
      set({ achats, isLoading: false });
    } catch (e) {
      console.error('Erreur chargement achats saveur:', e);
      set({ isLoading: false });
    }
  },

  ajouterAchat: async (achat) => {
    const ref = await addDoc(collection(db, 'saveur_achats'), { ...achat, createdAt: Timestamp.now() });
    set(state => ({ achats: [{ id: ref.id, ...achat }, ...state.achats] }));
  },

  supprimerAchat: async (id: string) => {
    await deleteDoc(doc(db, 'saveur_achats', id));
    set(state => ({ achats: state.achats.filter(a => a.id !== id) }));
  },
}));
