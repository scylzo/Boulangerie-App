import React from 'react';
import { Icon } from '@iconify/react';
import { Menu } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store';

interface HeaderProps {
  onMenuClick: () => void;
  onToggleCollapse: () => void;
  collapsed: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick, onToggleCollapse }) => {
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
    <header className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-sand-200">
      <div className="h-14 px-4 sm:px-6 flex items-center justify-between gap-4">
        {/* Gauche : toggles + titre */}
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 -ml-2 text-sand-500 hover:bg-sand-100 rounded-lg transition-colors"
            title="Menu"
          >
            <Menu size={20} />
          </button>
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex p-2 -ml-2 text-sand-500 hover:bg-sand-100 rounded-lg transition-colors"
            title="Réduire / déployer le menu"
          >
            <Icon icon="mdi:menu" className="text-xl" />
          </button>
          <h2 className="text-sm font-semibold text-sand-900 truncate">{getPageTitle()}</h2>
        </div>

        {/* Droite : recherche + notifications + profil */}
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2 h-9 px-3 rounded-lg border border-sand-200 bg-sand-50 text-sand-400 text-sm w-56">
            <Icon icon="mdi:magnify" className="text-lg" />
            <span>Rechercher…</span>
          </div>

          <button
            className="relative w-9 h-9 rounded-lg text-sand-500 hover:bg-sand-100 flex items-center justify-center transition-colors"
            title="Notifications"
          >
            <Icon icon="mdi:bell-outline" className="text-xl" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-gold-500 ring-2 ring-white" />
          </button>

          {user && (
            <>
              <div className="flex items-center gap-2.5 pl-2 sm:border-l sm:border-sand-200">
                <div className="w-9 h-9 rounded-full bg-sand-900 text-white flex items-center justify-center text-xs font-semibold shrink-0">
                  {(user.nom || user.email || 'U').charAt(0).toUpperCase()}
                  {(user.prenom || '').charAt(0).toUpperCase()}
                </div>
                <div className="hidden md:block leading-tight min-w-0">
                  <div className="text-sm font-medium text-sand-900 truncate max-w-[150px]">
                    {user.nom ? `${user.nom} ${user.prenom}` : user.email}
                  </div>
                  <div className="text-xs text-sand-500 capitalize">{user.role}</div>
                </div>
              </div>
              <button
                onClick={logout}
                className="w-9 h-9 rounded-lg text-sand-400 hover:text-danger-600 hover:bg-danger-50 flex items-center justify-center transition-colors"
                title="Déconnexion"
              >
                <Icon icon="mdi:logout" className="text-xl" />
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
