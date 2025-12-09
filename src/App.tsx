import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase/config';
import { Layout } from './components/layout/Layout';
import { Login } from './pages/auth/Login';
import { ProgrammeProduction } from './pages/production/ProgrammeProduction';
import { VueBoulanger } from './pages/production/VueBoulanger';
import { PageLivraison } from './pages/livraison/PageLivraison';
import { SaisieRetours } from './pages/livraison/SaisieRetours';
import { PageBoutique } from './pages/boutique/PageBoutique';
import { RapportJournalier } from './pages/rapport/RapportJournalier';
import { GestionProduits } from './pages/admin/GestionProduits';
import { GestionClients } from './pages/admin/GestionClients';
import { GestionLivreurs } from './pages/admin/GestionLivreurs';
import { GestionUtilisateurs } from './pages/admin/GestionUtilisateurs';
import { GestionFactures } from './pages/facturation/GestionFactures';
import { useAuthStore } from './store';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return <Layout>{children}</Layout>;
};

function App() {
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      if (user) {
        try {
          // Récupérer le profil utilisateur depuis Firestore
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUser({
              id: user.uid,
              email: user.email || '',
              nom: userData.nom || '',
              prenom: userData.prenom || '',
              role: (userData.role as any) || 'admin',
              active: userData.active ?? true,
              createdAt: userData.createdAt?.toDate() || new Date(),
              updatedAt: userData.updatedAt?.toDate() || new Date()
            });
          } else {
            // Cas spécial: Premier admin ou utilisateur sans profil
            // On donne un accès minimal ou admin temporaire si c'est l'email connu
            console.warn('Profil utilisateur introuvable dans Firestore');
            setUser({
              id: user.uid,
              email: user.email || '',
              nom: '', 
              prenom: '',
              role: 'admin', // Fallback en admin pour le premier setup
              active: true,
              createdAt: new Date(),
              updatedAt: new Date()
            });
          }
        } catch (error) {
          console.error('Erreur lors de la récupération du profil:', error);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [setUser, setLoading]);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/production" element={
          <ProtectedRoute>
            <ProgrammeProduction />
          </ProtectedRoute>
        } />

        <Route path="/boulanger" element={
          <ProtectedRoute>
            <VueBoulanger />
          </ProtectedRoute>
        } />

        <Route path="/livraison" element={
          <ProtectedRoute>
            <PageLivraison />
          </ProtectedRoute>
        } />

        <Route path="/retours" element={
          <ProtectedRoute>
            <SaisieRetours />
          </ProtectedRoute>
        } />

        <Route path="/boutique" element={
          <ProtectedRoute>
            <PageBoutique />
          </ProtectedRoute>
        } />

        <Route path="/rapport" element={
          <ProtectedRoute>
            <RapportJournalier />
          </ProtectedRoute>
        } />

        <Route path="/admin/produits" element={
          <ProtectedRoute>
            <GestionProduits />
          </ProtectedRoute>
        } />

        <Route path="/admin/clients" element={
          <ProtectedRoute>
            <GestionClients />
          </ProtectedRoute>
        } />

        <Route path="/admin/livreurs" element={
          <ProtectedRoute>
            <GestionLivreurs />
          </ProtectedRoute>
        } />

        <Route path="/admin/users" element={
          <ProtectedRoute>
            <GestionUtilisateurs />
          </ProtectedRoute>
        } />

        <Route path="/facturation" element={
          <ProtectedRoute>
            <GestionFactures />
          </ProtectedRoute>
        } />

        <Route path="/" element={<Navigate to="/production" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
