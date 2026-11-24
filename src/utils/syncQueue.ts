import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db, activerModeSecours } from '../firebase/config';
import toast from 'react-hot-toast';

export interface PendingSyncItem {
  id: string;
  type: 'retour' | 'paiement_facture' | 'programme_production';
  createdAt: number;
  data: any;
}

const STORAGE_KEY = 'boulangerie_pending_sync';

export const getSyncQueue = (): PendingSyncItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Erreur lecture file d\'attente de synchronisation:', err);
    return [];
  }
};

export const addToSyncQueue = (item: Omit<PendingSyncItem, 'id' | 'createdAt'>): void => {
  try {
    const queue = getSyncQueue();
    // Éviter les doublons stricts
    const filtered = queue.filter(q => {
      if (q.type === item.type) {
        if (item.type === 'retour' && q.data?.docId === item.data?.docId) return false;
        if (item.type === 'paiement_facture' && q.data?.factureId === item.data?.factureId) return false;
        if (item.type === 'programme_production' && q.data?.id === item.data?.id) return false;
      }
      return true;
    });

    const newItem: PendingSyncItem = {
      ...item,
      id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: Date.now()
    };

    filtered.push(newItem);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    console.log(`📦 Opération mise en file d'attente de synchronisation (${item.type}):`, newItem.id);
  } catch (err) {
    console.error('Erreur ajout file d\'attente de synchronisation:', err);
  }
};

export const removeFromSyncQueue = (id: string): void => {
  try {
    const queue = getSyncQueue();
    const filtered = queue.filter(q => q.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error('Erreur suppression file d\'attente:', err);
  }
};

let isFlushing = false;
let lastQuotaErrorTime = 0;

export const flushSyncQueue = async (force: boolean = false): Promise<{ successCount: number; remainingCount: number }> => {
  if (isFlushing) return { successCount: 0, remainingCount: getSyncQueue().length };
  
  // Si le quota a été dépassé récemment, attendre au moins 5 minutes avant de retenter automatiquement
  if (!force && Date.now() - lastQuotaErrorTime < 5 * 60 * 1000) {
    return { successCount: 0, remainingCount: getSyncQueue().length };
  }

  const queue = getSyncQueue();
  if (queue.length === 0) return { successCount: 0, remainingCount: 0 };

  isFlushing = true;
  let successCount = 0;

  console.log(`🔄 Tentative de synchronisation de ${queue.length} opération(s) en attente...`);

  try {
    for (const item of queue) {
      try {
        if (item.type === 'retour') {
          const { docId, retourClient } = item.data;
          const docRef = doc(db, 'clientReturns', docId);
          await setDoc(docRef, {
            ...retourClient,
            dateLivraison: retourClient.dateLivraison ? new Date(retourClient.dateLivraison) : new Date(),
            createdAt: retourClient.createdAt ? new Date(retourClient.createdAt) : new Date(),
            updatedAt: new Date()
          }, { merge: true });

          removeFromSyncQueue(item.id);
          successCount++;
          console.log(`☁️ Retour ${docId} synchronisé sur Firestore`);
        } else if (item.type === 'paiement_facture') {
          const { factureId, updateData, nouveauxReglements, clientId } = item.data;
          const cleanUpdate = {
            ...updateData,
            updatedAt: new Date(),
            paidAt: updateData.paidAt ? new Date(updateData.paidAt) : null,
            reglements: (updateData.reglements || []).map((r: any) => ({
              ...r,
              date: r.date ? new Date(r.date) : new Date()
            }))
          };

          await updateDoc(doc(db, 'factures', factureId), cleanUpdate);

          // Règlements journal
          if (nouveauxReglements && Array.isArray(nouveauxReglements)) {
            await Promise.allSettled(nouveauxReglements.map((r: any) =>
              setDoc(doc(db, 'reglements', `${factureId}_${r.id}`), {
                factureId,
                clientId: clientId || null,
                mode: r.mode,
                montant: r.montant,
                date: r.date ? new Date(r.date) : new Date(),
                reference: r.reference || null,
              })
            ));
          }

          removeFromSyncQueue(item.id);
          successCount++;
          console.log(`☁️ Paiement facture ${factureId} synchronisé sur Firestore`);
        } else if (item.type === 'programme_production') {
          const { id: progId, data: progData } = item.data;
          if (progId && progData) {
            const docRef = doc(db, 'productionPrograms', progId);
            await setDoc(docRef, progData, { merge: true });
            removeFromSyncQueue(item.id);
            successCount++;
            console.log(`☁️ Programme de production ${progId} synchronisé sur Firestore`);
          } else {
            removeFromSyncQueue(item.id);
          }
        }
      } catch (err: any) {
        if (err?.code === 'resource-exhausted' || err?.message?.includes('Quota exceeded')) {
          lastQuotaErrorTime = Date.now();
          console.warn('⚠️ Quota Firestore toujours dépassé, mise en veille des écritures pour 5 min.');
          activerModeSecours().catch(() => {});
          break; // Ne pas insister pour ne pas surcharger
        } else {
          console.error(`Erreur synchronisation item ${item.id}:`, err);
          // Si c'est une autre erreur, on continue les suivants
        }
      }
    }
  } finally {
    isFlushing = false;
  }

  const remaining = getSyncQueue().length;
  if (successCount > 0) {
    toast.success(`☁️ ${successCount} opération(s) en attente synchronisée(s) sur le serveur !`);
  }

  return { successCount, remainingCount: remaining };
};

// Auto-démarrage d'écoute de reconnexion / focus
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flushSyncQueue();
  });

  window.addEventListener('focus', () => {
    flushSyncQueue();
  });

  // Tenter une synchronisation périodique toutes les 15 minutes
  setInterval(() => {
    flushSyncQueue();
  }, 15 * 60 * 1000);
}
