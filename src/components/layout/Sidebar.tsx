import React from 'react';
import { NavLink } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useAuthStore } from '../../store';
import logoImg from '../../assets/logo.png';

const navigation = [
  { name: 'Programme Production', href: '/production', roles: ['admin', 'gestionnaire'] },
  { name: 'Vue Boulanger', href: '/boulanger', roles: ['admin', 'boulanger'] },
  { name: 'Livraisons', href: '/livraison', roles: ['admin', 'livreur'] },
  { name: 'Retours Clients', href: '/retours', roles: ['admin', 'livreur'] },
  { name: 'Boutique', href: '/boutique', roles: ['admin', 'vendeuse'] },
  { name: 'Facturation', href: '/facturation', roles: ['admin', 'gestionnaire'] },
  { name: 'Stocks', href: '/stocks', roles: ['admin', 'gestionnaire'] }, // Use "Stocks" or "Économat"
  { name: 'Rapport Journalier', href: '/rapport', roles: ['admin', 'gestionnaire'] },
  { name: 'Gestion Produits', href: '/admin/produits', roles: ['admin'] },
  { name: 'Gestion Clients', href: '/admin/clients', roles: ['admin'] },
  { name: 'Gestion Livreurs', href: '/admin/livreurs', roles: ['admin'] },
  { name: 'Gestion Utilisateurs', href: '/admin/users', roles: ['admin'] },
];

const navigationIcons = {
  'Programme Production': 'mdi:clipboard-text',
  'Vue Boulanger': 'ph:chef-hat-bold',
  'Livraisons': 'lucide:truck',
  'Retours Clients': 'mdi:keyboard-return',
  'Boutique': 'mdi:store',
  'Facturation': 'mdi:file-document',
  'Stocks': 'mdi:warehouse',
  'Rapport Journalier': 'mdi:chart-bar',
  'Gestion Produits': 'mdi:bread-slice',
  'Gestion Clients': 'mdi:account-group',
  'Gestion Livreurs': 'mdi:motorbike',
  'Gestion Utilisateurs': 'mdi:account-key',
};

export const Sidebar: React.FC = () => {
  const { user } = useAuthStore();

  const filteredNavigation = navigation.filter(item =>
    !user || item.roles.includes(user.role)
  );

  return (
    <div className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 z-30">
      {/* Logo */}
      <div className="flex justify-center h-28 px-6 border-b border-gray-100 py-4">
        <div className="w-40 h-24  rounded-lg flex items-center justify-center text-white text-lg font-bold overflow-hidden">
          <img src={logoImg} alt="Logo Boulangerie" className="w-full h-full object-contain" />
        </div>
      </div>

      {/* Navigation */}
      <nav className="mt-6 px-3">
        <div className="space-y-1">
          {filteredNavigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                `group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-150 ${
                  isActive
                    ? 'bg-orange-50 text-orange-700 border-l-4 border-orange-500'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <Icon
                icon={navigationIcons[item.name as keyof typeof navigationIcons]}
                className="mr-3 text-lg"
              />
              {item.name}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100">
        <div className="text-xs text-gray-500 text-center">
          <p>Version 1.0.0</p>
        </div>
      </div>
    </div>
  );
};