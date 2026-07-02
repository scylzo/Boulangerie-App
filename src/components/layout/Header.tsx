import React from 'react';
import { useAuthStore } from '../../store';

import { Menu } from 'lucide-react';
import { useLocation } from 'react-router-dom';

interface HeaderProps {
  onMenuClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { user, logout } = useAuthStore();
  const location = useLocation();

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/dashboard') return 'Tableau de bord';
    if (path === '/production') return 'Programme Production';
    if (path === '/boulanger') return 'Vue Boulanger';
    if (path === '/livraison') return 'Livraisons';
    if (path === '/retours') return 'Retours Clients';
    if (path === '/boutique') return 'Boutique';
    if (path === '/facturation') return 'Facturation';
    if (path === '/stocks') return 'Gestion des Stocks';
    if (path === '/admin/produits') return 'Gestion Produits';
    if (path === '/admin/clients') return 'Gestion Clients';
    if (path === '/admin/livreurs') return 'Gestion Livreurs';
    if (path === '/admin/users') return 'Gestion Utilisateurs';
    if (path === '/depenses') return 'Dépenses';
    if (path === '/comptabilite') return 'Comptabilité';
    return 'Tableau de bord';
  };

  return (
    <header className="bg-white border-b border-sand-200">
      <div className="px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-4">
            <button
              onClick={onMenuClick}
              className="lg:hidden p-2 text-sand-500 hover:bg-sand-100 rounded-md"
            >
              <Menu size={24} />
            </button>
            {/* Breadcrumb ou titre de page */}
            <div className="min-w-0 flex-1">
              <h2 className="text-sm sm:text-base md:text-lg font-bold text-sand-900 tracking-tight uppercase truncate">{getPageTitle()}</h2>
            </div>
          </div>

          {/* User menu */}
          <div className="flex items-center space-x-4">
            {user && (
              <>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-sand-100 rounded-full flex items-center justify-center border border-sand-200">
                    <span className="text-sm font-bold text-sand-900">
                      {(user.nom || user.email || 'U').charAt(0).toUpperCase()}
                      {(user.prenom || '').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="text-sm hidden md:block">
                    <div className="font-medium text-sand-900">
                      {user.nom ? `${user.nom} ${user.prenom}` : user.email}
                    </div>
                    <div className="text-sand-500 text-xs capitalize bg-sand-100 px-2 py-0.5 rounded-full inline-block mt-0.5">
                      {user.role}
                    </div>
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="p-2 text-sand-400 hover:text-danger-600 hover:bg-danger-50 rounded-full transition-colors"
                  title="Déconnexion"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};