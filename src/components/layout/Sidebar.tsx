import React from 'react';
import { NavLink } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useAuthStore } from '../../store';
import { X } from 'lucide-react';
import { APP_MODULES } from '../../constants/modules';

interface SidebarProps {
  mobileOpen: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
}

// Regroupement des modules en sections (par id)
const SECTIONS: { label: string; ids: string[] }[] = [
  { label: 'Principal', ids: ['dashboard', 'production', 'boulanger', 'rotation'] },
  { label: 'Commercial', ids: ['facturation', 'livraison', 'retours', 'boutique'] },
  { label: 'Gestion', ids: ['stocks', 'depenses', 'comptabilite', 'rapport'] },
  { label: 'Administration', ids: ['fiche_produit', 'admin_produits', 'admin_clients', 'admin_livreurs', 'admin_users'] },
];

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, collapsed, onClose, onToggleCollapse }) => {
  const { user, logout } = useAuthStore();

  // Filtrage des modules basé sur les permissions
  const filteredNavigation = APP_MODULES.filter(module => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.permissions && user.permissions.length > 0) {
      return user.permissions.includes(module.id);
    }
    const rolePermissions: Record<string, string[]> = {
      gestionnaire: ['dashboard', 'production', 'rotation', 'facturation', 'stocks', 'depenses', 'comptabilite', 'rapport', 'fiche_produit'],
      boulanger: ['boulanger'],
      livreur: ['livraison', 'retours'],
      vendeuse: ['boutique']
    };
    return rolePermissions[user.role]?.includes(module.id) || false;
  });

  // Sections avec leurs modules visibles (dans l'ordre défini), sections vides masquées
  const sections = SECTIONS
    .map(s => ({ label: s.label, items: s.ids.map(id => filteredNavigation.find(m => m.id === id)).filter(Boolean) as typeof filteredNavigation }))
    .filter(s => s.items.length > 0);

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-30 bg-sand-950 flex flex-col transition-all duration-300
        ${collapsed ? 'w-64 lg:w-16' : 'w-64'}
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
    >
      {/* Brand */}
      <div className="flex items-center h-16 px-4 border-b border-white/10 gap-2.5 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gold-500 text-white flex items-center justify-center shrink-0">
          <Icon icon="mdi:bread-slice-outline" className="text-lg" />
        </div>
        {!collapsed && <span className="text-white font-semibold text-lg tracking-tight truncate">Chez Mina</span>}
        <button onClick={onClose} className="lg:hidden ml-auto p-1.5 text-sand-400 hover:text-white rounded-md">
          <X size={20} />
        </button>
      </div>

      {/* Navigation en sections */}
      <nav className="flex-1 overflow-y-auto scrollbar-hide px-3 py-5 space-y-6">
        {sections.map((section) => (
          <div key={section.label}>
            {!collapsed && (
              <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-sand-600">{section.label}</p>
            )}
            <div className="space-y-1.5">
              {section.items.map((module) => (
                <NavLink
                  key={module.id}
                  to={module.href}
                  onClick={onClose}
                  title={collapsed ? module.name : undefined}
                  className={({ isActive }) =>
                    `group flex items-center ${collapsed ? 'lg:justify-center' : ''} gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive ? 'bg-white/10 text-white' : 'text-sand-400 hover:bg-white/5 hover:text-white'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        icon={module.icon}
                        className={`text-xl shrink-0 ${isActive ? 'text-gold-400' : 'text-sand-500 group-hover:text-sand-300'}`}
                      />
                      {!collapsed && <span className="truncate">{module.name}</span>}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Profil + réduire */}
      <div className="border-t border-white/10 p-3 shrink-0 space-y-1">
        {user && (
          <div className={`flex items-center gap-2.5 px-2 py-2 rounded-lg ${collapsed ? 'lg:justify-center' : ''}`}>
            <div className="w-9 h-9 rounded-full bg-gold-500 text-white flex items-center justify-center text-xs font-semibold shrink-0">
              {(user.nom || user.email || 'U').charAt(0).toUpperCase()}
              {(user.prenom || '').charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <div className="text-white text-sm font-medium truncate">
                    {user.nom ? `${user.nom} ${user.prenom || ''}` : user.email}
                  </div>
                  <div className="text-sand-500 text-xs capitalize">{user.role}</div>
                </div>
                <button onClick={logout} title="Déconnexion" className="text-sand-500 hover:text-danger-500 transition-colors shrink-0">
                  <Icon icon="mdi:logout" className="text-lg" />
                </button>
              </>
            )}
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className={`hidden lg:flex w-full items-center ${collapsed ? 'justify-center' : ''} gap-2 px-3 py-2 rounded-lg text-sand-500 hover:bg-white/5 hover:text-white text-sm transition-colors`}
          title={collapsed ? 'Déployer le menu' : 'Réduire le menu'}
        >
          <Icon icon={collapsed ? 'mdi:chevron-double-right' : 'mdi:chevron-double-left'} className="text-lg" />
          {!collapsed && <span>Réduire</span>}
        </button>
      </div>
    </aside>
  );
};
