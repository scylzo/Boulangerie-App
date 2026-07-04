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
    <div className="min-h-screen flex items-center justify-center bg-sand-100 py-12 px-4 sm:px-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src={logo} alt="Chez Mina Noflaye" className="h-14 w-auto object-contain" />
        </div>

        {/* Carte de connexion */}
        <div className="bg-white rounded-2xl p-7 sm:p-8 border border-sand-200 shadow-elevated">
          <div className="mb-6 text-center">
            <h1 className="font-display text-2xl font-semibold text-sand-900 tracking-tight">Connexion</h1>
            <p className="text-sm text-sand-500 mt-1">Accédez à votre espace de gestion</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-sand-700 mb-1.5">Adresse email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Icon icon="mdi:email-outline" className="h-5 w-5 text-sand-400" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="votre@email.com"
                  className="w-full pl-10 pr-4 py-2.5 border border-sand-300 rounded-lg text-sand-900 placeholder:text-sand-400 focus:ring-2 focus:ring-terracotta-500 focus:border-transparent transition-all bg-sand-50 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-sand-700 mb-1.5">Mot de passe</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Icon icon="mdi:lock-outline" className="h-5 w-5 text-sand-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 border border-sand-300 rounded-lg text-sand-900 placeholder:text-sand-400 focus:ring-2 focus:ring-terracotta-500 focus:border-transparent transition-all bg-sand-50 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-sand-400 hover:text-sand-600"
                  tabIndex={-1}
                >
                  <Icon icon={showPassword ? "mdi:eye-off-outline" : "mdi:eye-outline"} className="h-5 w-5" />
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-terracotta-500 hover:bg-terracotta-600 text-white font-medium py-2.5 px-6 rounded-lg shadow-soft transition-all focus-visible:ring-2 focus-visible:ring-terracotta-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center justify-center gap-2">
                {isLoading ? (
                  <>
                    <Icon icon="mdi:loading" className="text-lg animate-spin" />
                    <span>Connexion…</span>
                  </>
                ) : (
                  <span>Se connecter</span>
                )}
              </div>
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-sand-400 mt-6">Chez Mina Noflaye · Espace de gestion</p>
      </div>
    </div>
  );
};