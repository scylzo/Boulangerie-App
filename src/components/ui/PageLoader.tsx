import React from 'react';

/**
 * Loader plein écran, réutilisé pendant l'auth, le chargement d'un chunk (lazy)
 * et le chargement des données d'une page (tant que les données ne sont pas
 * prêtes, on garde le spinner : sinon l'utilisateur voit une page vide et croit
 * à un bug).
 */
export const PageLoader: React.FC<{ message?: string }> = ({ message }) => (
  <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-sand-50">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-warning-500"></div>
    {message && <p className="text-sm text-sand-500">{message}</p>}
  </div>
);
