import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
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

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);

export default app;