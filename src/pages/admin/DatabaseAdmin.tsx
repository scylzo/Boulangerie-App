import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { resetDatabase } from '../../utils/resetDatabase';

export const DatabaseAdmin: React.FC = () => {
  const [isResetting, setIsResetting] = useState(false);
  const [resetStatus, setResetStatus] = useState<string>('');

  const handleResetDatabase = async () => {
    if (!confirm('ATTENTION: Cette action va supprimer toutes les données opérationnelles (programmes, commandes, etc.) et les remplacer par des données propres.\n\nLes données de référence (produits, clients) seront réinitialisées.\n\nÊtes-vous sûr de vouloir continuer ?')) {
      return;
    }

    setIsResetting(true);
    setResetStatus('Démarrage du nettoyage...');

    try {
      await resetDatabase();
      setResetStatus('Base de données nettoyée et réinitialisée avec succès !');

      // Recharger la page après 2 secondes pour rafraîchir tous les stores
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Erreur lors du reset:', error);
      setResetStatus(`❌ Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header moderne type Odoo */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-r from-red-600 to-rose-600 rounded-lg flex items-center justify-center">
              <Icon icon="mdi:database-cog" className="text-2xl text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Administration Base de Données
              </h1>
              <p className="text-sm text-gray-500">
                Gestion et maintenance de la base de données Firebase
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Actions dangereuses */}
        <div className="bg-white rounded-xl border border-red-200 shadow-sm">
          <div className="px-6 py-4 border-b border-red-100 bg-red-50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                <Icon icon="mdi:alert-triangle" className="text-lg text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-red-900">Actions Dangereuses</h2>
                <p className="text-sm text-red-700">Ces actions modifient ou suppriment des données de façon irréversible</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="bg-gradient-to-br from-red-50 to-rose-50 border border-red-200 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-rose-600 rounded-xl flex items-center justify-center shadow-md">
                  <Icon icon="mdi:database-refresh" className="text-2xl text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-red-800 text-lg">Reset Complet de la Base de Données</h3>
                  <p className="text-sm text-red-700">Action irréversible de nettoyage complet</p>
                </div>
              </div>

              <div className="bg-red-100 rounded-lg p-4 mb-4">
                <p className="text-sm text-red-800 font-medium mb-3">Cette action va :</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-red-700">
                  <div className="flex items-center gap-2">
                    <Icon icon="mdi:close-circle" className="text-red-500" />
                    <span>Supprimer tous les programmes de production</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon icon="mdi:close-circle" className="text-red-500" />
                    <span>Supprimer toutes les commandes clients</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon icon="mdi:close-circle" className="text-red-500" />
                    <span>Supprimer tous les stocks boutique</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon icon="mdi:close-circle" className="text-red-500" />
                    <span>Supprimer tous les rapports</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon icon="mdi:refresh" className="text-red-500" />
                    <span>Réinitialiser les produits</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon icon="mdi:refresh" className="text-red-500" />
                    <span>Réinitialiser les clients</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleResetDatabase}
                disabled={isResetting}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-lg hover:from-red-700 hover:to-rose-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                <Icon icon={isResetting ? "mdi:loading" : "mdi:broom"} className={`text-lg ${isResetting ? 'animate-spin' : ''}`} />
                <span className="font-medium">{isResetting ? 'Nettoyage en cours...' : 'Nettoyer et Réinitialiser'}</span>
              </button>

              {/* Status */}
              {resetStatus && (
                <div className={`mt-4 p-4 rounded-lg ${
                  resetStatus.includes('succès')
                    ? 'bg-green-50 border border-green-200'
                    : resetStatus.startsWith('❌')
                    ? 'bg-red-50 border border-red-200'
                    : 'bg-blue-50 border border-blue-200'
                }`}>
                  <div className="flex items-center gap-2">
                    <Icon
                      icon={
                        resetStatus.includes('succès') ? 'mdi:check-circle' :
                        resetStatus.startsWith('❌') ? 'mdi:alert-circle' :
                        'mdi:information'
                      }
                      className={`text-lg ${
                        resetStatus.includes('succès') ? 'text-green-600' :
                        resetStatus.startsWith('❌') ? 'text-red-600' :
                        'text-blue-600'
                      }`}
                    />
                    <span className={`font-medium ${
                      resetStatus.includes('succès') ? 'text-green-800' :
                      resetStatus.startsWith('❌') ? 'text-red-800' :
                      'text-blue-800'
                    }`}>
                      {resetStatus}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Informations */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <Icon icon="mdi:information" className="text-lg text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Informations sur la Base de Données</h2>
                <p className="text-sm text-gray-500">Détails sur la structure de la base de données Firebase</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Icon icon="mdi:database" className="text-blue-600" />
                  Collections Firebase
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { collection: 'clients', description: 'Informations des clients', icon: 'mdi:account-group' },
                    { collection: 'produits', description: 'Catalogue des produits', icon: 'mdi:food-variant' },
                    { collection: 'productionPrograms', description: 'Programmes de production', icon: 'mdi:factory' },
                    { collection: 'clientOrders', description: 'Commandes clients', icon: 'mdi:cart' },
                    { collection: 'shopStock', description: 'Stock boutique', icon: 'mdi:store' },
                    { collection: 'shopShifts', description: 'Équipes boutique', icon: 'mdi:account-clock' },
                    { collection: 'clientReturns', description: 'Livraisons clients', icon: 'mdi:truck-delivery' },
                    { collection: 'dailyReports', description: 'Rapports journaliers', icon: 'mdi:chart-bar' }
                  ].map((item, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Icon icon={item.icon} className="text-blue-600" />
                        </div>
                        <div>
                          <code className="text-sm font-mono font-semibold text-gray-900">{item.collection}</code>
                          <p className="text-xs text-gray-600">{item.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon icon="mdi:lightbulb" className="text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-blue-800 mb-2">Conseil d'utilisation</h4>
                    <p className="text-sm text-blue-700">
                      Utilisez le reset uniquement en développement ou pour démarrer avec des données propres.
                      Cette action ne peut pas être annulée et supprimera toutes les données opérationnelles.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};