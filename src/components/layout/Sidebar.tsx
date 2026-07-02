import React from 'react';
import { NavLink } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useAuthStore } from '../../store';
import logoImg from '../../assets/logo.png';
import { X } from 'lucide-react';
import { APP_MODULES } from '../../constants/modules';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { user } = useAuthStore();

  // Filtrage des modules basé sur les permissions
  const filteredNavigation = APP_MODULES.filter(module => {
    if (!user) return false;
    
    // Si l'utilisateur est admin, il a accès à tout
    if (user.role === 'admin') return true;

    // Si les permissions sont définies, on vérifie si l'ID du module y est
    if (user.permissions && user.permissions.length > 0) {
      return user.permissions.includes(module.id);
    }

    // FALLBACK : Si pas de permissions définies (vieux comptes), 
    // on utilise la logique de rôles par défaut
    const rolePermissions: Record<string, string[]> = {
      gestionnaire: ['dashboard', 'production', 'rotation', 'facturation', 'stocks', 'depenses', 'comptabilite', 'rapport', 'fiche_produit'],
      boulanger: ['boulanger'],
      livreur: ['livraison', 'retours'],
      vendeuse: ['boutique']
    };

    return rolePermissions[user.role]?.includes(module.id) || false;
  });

  return (
    <>
      <div
        className={`fixed inset-y-0 left-0 w-64 bg-white border-r border-sand-200 z-30 transition-transform duration-300 transform lg:translate-x-0 flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        {/* Logo et Bouton Fermer Mobile */}
        <div className="flex justify-between items-center h-20 px-4 border-b border-sand-100 py-3 relative">
          <div className="w-32 h-16 rounded-lg flex items-center justify-center text-white text-lg font-bold overflow-hidden">
            <img src={logoImg} alt="Logo Boulangerie" className="w-full h-full object-contain" />
          </div>

          <button
            onClick={onClose}
            className="lg:hidden absolute top-4 right-4 p-2 text-sand-400 hover:text-sand-600"
          >
            <X size={24} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="mt-4 px-2 flex-1 scrollbar-hide overflow-y-auto">
          <div className="space-y-1">
            {filteredNavigation.map((module) => (
              <NavLink
                key={module.id}
                to={module.href}
                onClick={onClose}
                className={({ isActive }) =>
                  `group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-150 ${isActive
                    ? 'bg-warning-50 text-warning-600 border-l-4 border-warning-500'
                    : 'text-sand-700 hover:bg-sand-50 hover:text-sand-900'
                  }`
                }
              >
                <Icon
                  icon={module.icon}
                  className="mr-3 text-lg"
                />
                {module.name}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Footer */}
        <div className="mt-auto p-4 border-t border-sand-100 bg-white">
          <div className="text-xs text-sand-500 text-center">
            <p>Version 1.0.0</p>
          </div>
        </div>
      </div>
    </>
  );
};