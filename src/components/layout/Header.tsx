import React from 'react';
import { useAuthStore } from '../../store';

import { Menu } from 'lucide-react';
interface HeaderProps {
  onMenuClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { user, logout } = useAuthStore();

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-4">
            <button
              onClick={onMenuClick}
              className="lg:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-md"
            >
              <Menu size={24} />
            </button>
            {/* Breadcrumb ou titre de page */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Dashboard</h2>
              <p className="text-sm text-gray-500">Gérez votre boulangerie efficacement</p>
            </div>
          </div>

          {/* User menu */}
          <div className="flex items-center space-x-4">
            {user && (
              <>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center border border-orange-200">
                    <span className="text-sm font-bold text-orange-700">
                      {(user.nom || user.email || 'U').charAt(0).toUpperCase()}
                      {(user.prenom || '').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="text-sm hidden md:block">
                    <div className="font-medium text-gray-900">
                      {user.nom ? `${user.nom} ${user.prenom}` : user.email}
                    </div>
                    <div className="text-gray-500 text-xs capitalize bg-gray-100 px-2 py-0.5 rounded-full inline-block mt-0.5">
                      {user.role}
                    </div>
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
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