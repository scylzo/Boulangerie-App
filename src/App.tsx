import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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
import { GestionFactures } from './pages/facturation/GestionFactures';
import { useAuthStore } from './store';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Login />;
  }

  return <Layout>{children}</Layout>;
};

function App() {
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
