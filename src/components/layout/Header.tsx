import React from 'react';
import { Icon } from '@iconify/react';
import { Menu } from 'lucide-react';
import { useLocation } from 'react-router-dom';

interface HeaderProps {
  onMenuClick: () => void;
  onToggleCollapse: () => void;
  collapsed: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick, onToggleCollapse }) => {
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
      <div className="h-16 px-4 sm:px-6 flex items-center justify-between gap-4">
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

        {/* Droite : recherche + actions */}
        <div className="flex items-center gap-1">
          <div className="hidden md:flex items-center gap-2 h-10 px-3.5 rounded-xl bg-sand-100 text-sand-400 text-sm w-72">
            <Icon icon="mdi:magnify" className="text-lg" />
            <span>Recherche rapide…</span>
          </div>
          <button className="w-10 h-10 rounded-xl text-sand-500 hover:bg-sand-100 flex items-center justify-center transition-colors" title="Mode sombre">
            <Icon icon="mdi:weather-night" className="text-xl" />
          </button>
          <button className="relative w-10 h-10 rounded-xl text-sand-500 hover:bg-sand-100 flex items-center justify-center transition-colors" title="Notifications">
            <Icon icon="mdi:bell-outline" className="text-xl" />
            <span className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 rounded-full bg-danger-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white">5</span>
          </button>
          <button className="w-10 h-10 rounded-xl text-sand-500 hover:bg-sand-100 flex items-center justify-center transition-colors" title="Réglages">
            <Icon icon="mdi:cog-outline" className="text-xl" />
          </button>
        </div>
      </div>
    </header>
  );
};
