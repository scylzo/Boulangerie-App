import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

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

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);

export default app;