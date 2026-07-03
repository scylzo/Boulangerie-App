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

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, collapsed, onClose, onToggleCollapse }) => {
  const { user } = useAuthStore();

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

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-30 bg-white border-r border-sand-200 flex flex-col transition-all duration-300
        ${collapsed ? 'w-64 lg:w-16' : 'w-64'}
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
    >
      {/* Brand */}
      <div className="flex items-center h-14 px-3 border-b border-sand-200 gap-2.5 shrink-0">
        <div className="w-9 h-9 rounded-lg bg-sand-900 text-white flex items-center justify-center shrink-0">
          <Icon icon="mdi:bread-slice-outline" className="text-lg" />
        </div>
        {!collapsed && <span className="font-semibold text-sand-900 tracking-tight truncate">Chez Mina</span>}
        <button
          onClick={onClose}
          className="lg:hidden ml-auto p-1.5 text-sand-400 hover:text-sand-700 rounded-md"
        >
          <X size={20} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-hide px-2 py-3">
        <div className="space-y-0.5">
          {filteredNavigation.map((module) => (
            <NavLink
              key={module.id}
              to={module.href}
              onClick={onClose}
              title={collapsed ? module.name : undefined}
              className={({ isActive }) =>
                `group flex items-center ${collapsed ? 'lg:justify-center' : ''} gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-sand-100 text-sand-900 font-medium'
                    : 'text-sand-500 hover:bg-sand-50 hover:text-sand-900'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    icon={module.icon}
                    className={`text-xl shrink-0 ${isActive ? 'text-sand-900' : 'text-sand-400 group-hover:text-sand-700'}`}
                  />
                  {!collapsed && <span className="truncate">{module.name}</span>}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Toggle rail (desktop) */}
      <div className="mt-auto border-t border-sand-200 p-2 shrink-0">
        <button
          onClick={onToggleCollapse}
          className={`hidden lg:flex w-full items-center ${collapsed ? 'justify-center' : ''} gap-2 px-3 py-2 rounded-lg text-sand-500 hover:bg-sand-50 hover:text-sand-900 text-sm transition-colors`}
          title={collapsed ? 'Déployer le menu' : 'Réduire le menu'}
        >
          <Icon icon={collapsed ? 'mdi:chevron-double-right' : 'mdi:chevron-double-left'} className="text-lg" />
          {!collapsed && <span>Réduire</span>}
        </button>
        {!collapsed && (
          <p className="text-[10px] text-sand-400 text-center mt-1">Chez Mina · v1.0</p>
        )}
      </div>
    </aside>
  );
};
