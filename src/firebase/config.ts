import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, disableNetwork, enableNetwork } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

export const firebaseConfig = {
  apiKey: "AIzaSyAHvGMXSmFRwwssxhSZTbasHU5TeAJArfc",
  authDomain: "boulangerie-fork.firebaseapp.com",
  projectId: "boulangerie-fork",
  storageBucket: "boulangerie-fork.firebasestorage.app",
  messagingSenderId: "962905478472",
  appId: "1:962905478472:web:0b5d48dd56ccc5dfa60f7d",
  measurementId: "G-8VNCV5HCHY"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services with persistent IndexedDB multi-tab cache
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});
export const analytics = getAnalytics(app);

// --- GESTION DU MODE SECOURS LOCAL (QUOTA HORS-LIGNE) ---
const MODE_SECOURS_KEY = 'boulangerie_mode_secours_quota';

export const estEnModeSecours = (): boolean => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(MODE_SECOURS_KEY) === 'true';
};

export const activerModeSecours = async () => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(MODE_SECOURS_KEY, 'true');
    await disableNetwork(db);
    window.dispatchEvent(new CustomEvent('boulangerie_mode_secours_changed', { detail: { actif: true } }));
    console.warn('🛡️ Mode Secours Local Activé : Firestore opère désormais en 100% local (IndexedDB) pour contourner le quota.');
  } catch (err) {
    console.warn('Erreur activation mode secours local:', err);
  }
};

export const desactiverModeSecours = async () => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(MODE_SECOURS_KEY);
    await enableNetwork(db);
    window.dispatchEvent(new CustomEvent('boulangerie_mode_secours_changed', { detail: { actif: false } }));
    console.log('🌐 Connexion Firebase réactivée avec succès.');
  } catch (err) {
    console.warn('Erreur réactivation Firebase:', err);
  }
};

// Démarrage initial : si le mode secours était activé, basculer immédiatement en local
if (typeof window !== 'undefined' && estEnModeSecours()) {
  disableNetwork(db).catch(() => {});
}

export default app;