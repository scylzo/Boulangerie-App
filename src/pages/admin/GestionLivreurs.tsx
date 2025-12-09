import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { LivreurForm } from '../../components/shared/LivreurForm';
import { useLivreurStore } from '../../store/livreurStore';
import type { Livreur } from '../../types';

export const GestionLivreurs: React.FC = () => {
  const {
    livreurs,
    livreurEnEdition,
    isLoadingLivreurs,
    chargerLivreurs,
    ajouterLivreur,
    modifierLivreur,
    supprimerLivreur,
    setLivreurEnEdition
  } = useLivreurStore();

  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    chargerLivreurs();
  }, [chargerLivreurs]);

  const handleAjouter = async (livreurData: Omit<Livreur, 'id' | 'createdAt' | 'updatedAt'>) => {
    await ajouterLivreur(livreurData);
    setShowForm(false);
  };

  const handleModifier = async (livreurData: Omit<Livreur, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (livreurEnEdition) {
      await modifierLivreur(livreurEnEdition.id, livreurData);
      setLivreurEnEdition(null);
      setShowForm(false);
    }
  };

  const handleSupprimer = async (livreur: Livreur) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer "${livreur.nom}" ?`)) {
      await supprimerLivreur(livreur.id);
    }
  };

  const handleAnnuler = () => {
    setLivreurEnEdition(null);
    setShowForm(false);
  };

  const handleEditer = (livreur: Livreur) => {
    setLivreurEnEdition(livreur);
    setShowForm(true);
  };

  const handleNouveauLivreur = () => {
    setLivreurEnEdition(null);
    setShowForm(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header moderne type Odoo */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg flex items-center justify-center">
              <Icon icon="mdi:truck-delivery" className="text-2xl text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Gestion des Livreurs
              </h1>
              <p className="text-sm text-gray-500">
                Gérez les livreurs et leurs assignations clients
              </p>
            </div>
          </div>

          <button
            onClick={handleNouveauLivreur}
            className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg"
          >
            <Icon icon="mdi:plus" className="text-lg" />
            <span className="font-medium">Nouveau livreur</span>
          </button>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto p-6 space-y-6">

      {/* Formulaire */}
      {showForm && (
        <LivreurForm
          livreur={livreurEnEdition}
          onSave={livreurEnEdition ? handleModifier : handleAjouter}
          onCancel={handleAnnuler}
          isLoading={isLoadingLivreurs}
        />
      )}

        {/* Section Liste des livreurs */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <Icon icon="mdi:format-list-bulleted" className="text-lg text-green-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Équipe de livraison</h2>
                  <p className="text-sm text-gray-500">{livreurs.length} livreur(s) enregistré(s)</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-600">
                  <span className="font-medium">{livreurs.filter(l => l.active).length}</span> actifs
                  <span className="mx-2">•</span>
                  <span className="font-medium">{livreurs.filter(l => !l.active).length}</span> inactifs
                </div>
              </div>
            </div>
          </div>

          <div className="p-6">
            {livreurs.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Icon icon="mdi:truck-delivery-outline" className="text-4xl text-green-500" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  Aucun livreur enregistré
                </h3>
                <p className="text-gray-500 mb-8 max-w-md mx-auto">
                  Commencez par ajouter vos livreurs pour organiser et gérer les livraisons
                </p>
                <button
                  onClick={handleNouveauLivreur}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all shadow-md"
                >
                  <Icon icon="mdi:plus" className="text-lg" />
                  <span className="font-medium">Ajouter le premier livreur</span>
                </button>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {livreurs.map((livreur) => (
                  <div
                    key={livreur.id}
                    className="bg-gradient-to-br from-white to-gray-50 border border-gray-200 rounded-2xl p-6 hover:border-green-300 hover:shadow-2xl transition-all duration-300 group"
                  >
                    {/* Header du livreur */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                          <span className="text-white font-bold text-xl">
                            {livreur.nom.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-bold text-xl text-gray-900 mb-1">
                            {livreur.nom}
                          </h3>
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full ${
                              livreur.active
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              <Icon icon={livreur.active ? 'mdi:check-circle' : 'mdi:pause-circle'} className="text-xs" />
                              {livreur.active ? 'Actif' : 'Inactif'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Informations de contact */}
                    <div className="space-y-3 mb-6">
                      {livreur.telephone && (
                        <div className="flex items-center gap-2">
                          <Icon icon="mdi:phone" className="text-gray-400" />
                          <span className="text-sm text-gray-700">{livreur.telephone}</span>
                        </div>
                      )}

                      {livreur.vehicule && (
                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-3">
                          <div className="flex items-center gap-2">
                            <Icon icon="mdi:car" className="text-green-600" />
                            <div>
                              <div className="text-xs font-medium text-green-700 mb-1">Véhicule</div>
                              <div className="font-semibold text-green-800">{livreur.vehicule}</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditer(livreur)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-green-600 hover:text-green-700 bg-green-50 hover:bg-green-100 rounded-xl transition-all font-medium shadow-sm hover:shadow-md"
                      >
                        <Icon icon="mdi:pencil" className="text-lg" />
                        <span>Modifier</span>
                      </button>
                      <button
                        onClick={() => handleSupprimer(livreur)}
                        className="flex items-center justify-center gap-2 px-4 py-2 text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-xl transition-all font-medium shadow-sm hover:shadow-md"
                      >
                        <Icon icon="mdi:delete-outline" className="text-lg" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};