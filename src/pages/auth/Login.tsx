import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useAuthStore } from '../../store';
import logo from '../../assets/logo.png';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
    } catch (error) {
      console.error('Erreur de connexion:', error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-warning-50 via-warning-50 to-warning-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-4">
        {/* Logo et titre - Version moderne Odoo */}
        <div className="text-center">
          <div className="mx-auto w-50 h-50 flex items-center justify-center transform hover:scale-105 transition-transform -mb-8">
            <img
              src={logo}
              alt="Logo Boulangerie"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="w-32 h-1 bg-linear-to-r from-warning-600 to-warning-600 mx-auto rounded-full"></div>
        </div>

        {/* Formulaire de connexion - Design moderne */}
        <div className="bg-white shadow-2xl rounded-3xl p-8 border border-sand-100 backdrop-blur-sm">
          <div className="mb-8">
            <div className="flex items-center gap-3 justify-center mb-4">
              <div className="w-8 h-8 bg-linear-to-r from-warning-600 to-warning-600 rounded-lg flex items-center justify-center">
                <Icon icon="mdi:account-circle" className="text-white text-lg" />
              </div>
              <h2 className="text-xl font-semibold text-sand-900">
                Connexion
              </h2>
            </div>
            <p className="text-sm text-sand-500 text-center">
              Accédez à votre espace de gestion
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-sand-700 mb-2">
                Adresse email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Icon icon="mdi:email" className="h-5 w-5 text-sand-400" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="votre@email.com"
                  className="w-full pl-10 pr-4 py-3 border border-sand-300 rounded-xl focus:ring-2 focus:ring-warning-500 focus:border-transparent transition-all bg-sand-50 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-sand-700 mb-2">
                Mot de passe
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Icon icon="mdi:lock" className="h-5 w-5 text-sand-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-3 border border-sand-300 rounded-xl focus:ring-2 focus:ring-warning-500 focus:border-transparent transition-all bg-sand-50 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-sand-400 hover:text-sand-600"
                >
                  <Icon icon={showPassword ? "mdi:eye-off" : "mdi:eye"} className="h-5 w-5" />
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-linear-to-r from-warning-600 to-warning-600 hover:from-warning-600 hover:to-warning-600 text-white font-semibold py-4 px-6 rounded-xl shadow-lg transform transition-all hover:scale-105 focus:ring-2 focus:ring-warning-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
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


        </div>

      </div>
    </div>
  );
};