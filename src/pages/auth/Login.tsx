import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { useAuthStore } from '../../store';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
    } catch (error) {
      console.error('Erreur de connexion:', error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Logo et titre - Version moderne Odoo */}
        <div className="text-center">
          <div className="mx-auto w-24 h-24 bg-gradient-to-r from-amber-600 to-orange-600 rounded-2xl flex items-center justify-center text-4xl mb-6 shadow-2xl transform hover:scale-105 transition-transform">
            <Icon icon="mdi:bread-slice" className="text-white text-5xl" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Boulangerie App
          </h1>
          <p className="text-lg text-gray-600 mb-4">
            Application de gestion moderne
          </p>
          <div className="w-32 h-1 bg-gradient-to-r from-amber-600 to-orange-600 mx-auto rounded-full"></div>
        </div>

        {/* Formulaire de connexion - Design moderne */}
        <div className="bg-white shadow-2xl rounded-3xl p-8 border border-gray-100 backdrop-blur-sm">
          <div className="mb-8">
            <div className="flex items-center gap-3 justify-center mb-4">
              <div className="w-8 h-8 bg-gradient-to-r from-amber-600 to-orange-600 rounded-lg flex items-center justify-center">
                <Icon icon="mdi:account-circle" className="text-white text-lg" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">
                Connexion
              </h2>
            </div>
            <p className="text-sm text-gray-500 text-center">
              Accédez à votre espace de gestion
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Adresse email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Icon icon="mdi:email" className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="votre@email.com"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all bg-gray-50 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mot de passe
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Icon icon="mdi:lock" className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all bg-gray-50 focus:bg-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-semibold py-4 px-6 rounded-xl shadow-lg transform transition-all hover:scale-105 focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              <div className="flex items-center justify-center gap-2">
                {isLoading ? (
                  <>
                    <Icon icon="mdi:loading" className="text-lg animate-spin" />
                    <span>Connexion...</span>
                  </>
                ) : (
                  <>
                    <Icon icon="mdi:login" className="text-lg" />
                    <span>Se connecter</span>
                  </>
                )}
              </div>
            </button>
          </form>

          {/* Info développement - Style moderne */}
          <div className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <Icon icon="mdi:tools" className="text-white text-lg" />
              </div>
              <h3 className="font-semibold text-blue-800">Mode Développement</h3>
            </div>
            <p className="text-sm text-blue-700">
              Vous êtes automatiquement connecté en tant qu'Admin pour les tests et le développement.
            </p>
          </div>
        </div>

        {/* Informations supplémentaires - Version moderne */}
        <div className="text-center">
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              Solution complète de gestion
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Icon icon="mdi:factory" className="text-amber-600" />
                <span>Production</span>
              </div>
              <div className="flex items-center gap-2">
                <Icon icon="mdi:truck-delivery" className="text-blue-600" />
                <span>Livraisons</span>
              </div>
              <div className="flex items-center gap-2">
                <Icon icon="mdi:store" className="text-green-600" />
                <span>Boutique</span>
              </div>
              <div className="flex items-center gap-2">
                <Icon icon="mdi:chart-bar" className="text-purple-600" />
                <span>Rapports</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Application de gestion pour boulangeries artisanales
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};