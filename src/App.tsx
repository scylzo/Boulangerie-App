import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase/config';
import { Layout } from './components/layout/Layout';
import { Login } from './pages/auth/Login';
import { PageLoader } from './components/ui/PageLoader';
// Pages chargées à la demande (code-splitting) — allège le bundle initial.
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const PointOfSale = lazy(() => import('./pages/pos/PointOfSale').then(m => ({ default: m.PointOfSale })));
const HistoriqueTickets = lazy(() => import('./pages/pos/HistoriqueTickets').then(m => ({ default: m.HistoriqueTickets })));
const ProgrammeProduction = lazy(() => import('./pages/production/ProgrammeProduction').then(m => ({ default: m.ProgrammeProduction })));
const RotationBoulangers = lazy(() => import('./pages/production/RotationBoulangers').then(m => ({ default: m.RotationBoulangers })));
const VueBoulanger = lazy(() => import('./pages/production/VueBoulanger').then(m => ({ default: m.VueBoulanger })));
const PageLivraison = lazy(() => import('./pages/livraison/PageLivraison').then(m => ({ default: m.PageLivraison })));
const SaisieRetours = lazy(() => import('./pages/livraison/SaisieRetours').then(m => ({ default: m.SaisieRetours })));
const PageBoutique = lazy(() => import('./pages/boutique/PageBoutique').then(m => ({ default: m.PageBoutique })));
const RapportJournalier = lazy(() => import('./pages/rapport/RapportJournalier').then(m => ({ default: m.RapportJournalier })));
const GestionProduits = lazy(() => import('./pages/admin/GestionProduits').then(m => ({ default: m.GestionProduits })));
const GestionClients = lazy(() => import('./pages/admin/GestionClients').then(m => ({ default: m.GestionClients })));
const GestionLivreurs = lazy(() => import('./pages/admin/GestionLivreurs').then(m => ({ default: m.GestionLivreurs })));
const GestionUtilisateurs = lazy(() => import('./pages/admin/GestionUtilisateurs').then(m => ({ default: m.GestionUtilisateurs })));
const FicheProduit = lazy(() => import('./pages/admin/FicheProduit').then(m => ({ default: m.FicheProduit })));
const GestionFactures = lazy(() => import('./pages/facturation/GestionFactures').then(m => ({ default: m.GestionFactures })));
const GestionStock = lazy(() => import('./pages/stock/GestionStock').then(m => ({ default: m.GestionStock })));
const GestionDepenses = lazy(() => import('./pages/finance/GestionDepenses').then(m => ({ default: m.GestionDepenses })));
const Comptabilite = lazy(() => import('./pages/finance/Comptabilite').then(m => ({ default: m.Comptabilite })));
const SuiviSaveur = lazy(() => import('./pages/finance/SuiviSaveur').then(m => ({ default: m.SuiviSaveur })));
const SaisieConsommations = lazy(() => import('./pages/stock/SaisieConsommations').then(m => ({ default: m.SaisieConsommations })));
const CarteKiosques = lazy(() => import('./pages/admin/CarteKiosques').then(m => ({ default: m.CarteKiosques })));
import { useAuthStore } from './store';
import 'leaflet/dist/leaflet.css';


const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return <Layout><Suspense fallback={<PageLoader />}>{children}</Suspense></Layout>;
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

        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />

        <Route path="/caisse" element={
          <ProtectedRoute>
            <PointOfSale />
          </ProtectedRoute>
        } />

        <Route path="/caisse/historique" element={
          <ProtectedRoute>
            <HistoriqueTickets />
          </ProtectedRoute>
        } />

        <Route path="/production" element={
          <ProtectedRoute>
            <ProgrammeProduction />
          </ProtectedRoute>
        } />

        <Route path="/rotation-boulangers" element={
          <ProtectedRoute>
            <RotationBoulangers />
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

        <Route path="/admin/carte" element={
          <ProtectedRoute>
            <CarteKiosques />
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

        <Route path="/admin/fiche-produit" element={
          <ProtectedRoute>
            <FicheProduit />
          </ProtectedRoute>
        } />

        <Route path="/facturation" element={
          <ProtectedRoute>
            <GestionFactures />
          </ProtectedRoute>
        } />


        <Route path="/stocks" element={
          <ProtectedRoute>
            <GestionStock />
          </ProtectedRoute>
        } />

        <Route path="/stocks/declaration" element={
          <ProtectedRoute>
            <SaisieConsommations />
          </ProtectedRoute>
        } />

        <Route path="/depenses" element={
          <ProtectedRoute>
            <GestionDepenses />
          </ProtectedRoute>
        } />

        <Route path="/comptabilite" element={
          <ProtectedRoute>
            <Comptabilite />
          </ProtectedRoute>
        } />

        <Route path="/suivi-saveur" element={
          <ProtectedRoute>
            <SuiviSaveur />
          </ProtectedRoute>
        } />


        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
