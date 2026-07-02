import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { Modal } from '../../components/ui/Modal';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
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
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; livreurId: string; livreurNom: string }>({
    isOpen: false,
    livreurId: '',
    livreurNom: ''
  });

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

  const handleSupprimer = (livreur: Livreur) => {
    setDeleteConfirm({
      isOpen: true,
      livreurId: livreur.id,
      livreurNom: livreur.nom
    });
  };

  const confirmSupprimer = async () => {
    await supprimerLivreur(deleteConfirm.livreurId);
    setDeleteConfirm({ isOpen: false, livreurId: '', livreurNom: '' });
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
    <div className="min-h-screen bg-sand-50">
      {/* Header moderne */}
      <div className="bg-white border-b border-sand-200 px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <div className="w-10 h-10 bg-sand-900 rounded-lg flex items-center justify-center shrink-0">
              <Icon icon="mdi:truck-delivery" className="text-xl text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl font-semibold text-sand-900 truncate">
                Gestion des Livreurs
              </h1>
              <p className="text-xs sm:text-sm text-sand-500 truncate">
                Gestion des livreurs
              </p>
            </div>
          </div>

          <button
            onClick={handleNouveauLivreur}
            className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2 bg-sand-900 text-white rounded-lg hover:bg-sand-800 transition-all shadow-sm shrink-0 w-full sm:w-auto"
          >
            <Icon icon="mdi:plus" className="text-lg" />
            <span className="font-medium text-sm sm:text-base">Nouveau livreur</span>
          </button>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">

        {/* Modal d'ajout/modification */}
        {showForm && (
          <Modal
            isOpen={showForm}
            onClose={handleAnnuler}
            title={livreurEnEdition ? 'Modifier le livreur' : 'Nouveau livreur'}
            position="center"
            size="lg"
          >
            <LivreurForm
              livreur={livreurEnEdition}
              onSave={livreurEnEdition ? handleModifier : handleAjouter}
              onCancel={handleAnnuler}
              isLoading={isLoadingLivreurs}
            />
          </Modal>
        )}

        {/* Section Liste des livreurs */}
        <div className="bg-white rounded-xl border border-sand-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-sand-100 bg-sand-50/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <div className="w-8 h-8 bg-sand-100 rounded-lg flex items-center justify-center shrink-0">
                  <Icon icon="mdi:format-list-bulleted" className="text-lg text-sand-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base sm:text-lg font-semibold text-sand-900 truncate">Équipe de livraison</h2>
                  <p className="text-xs sm:text-sm text-sand-500 truncate">{livreurs.length} livreur(s) enregistré(s)</p>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm text-sand-600 shrink-0">
                <span className="font-medium">{livreurs.filter(l => l.active).length}</span> actifs
                <span className="mx-1 sm:mx-2">•</span>
                <span className="font-medium">{livreurs.filter(l => !l.active).length}</span> inactifs
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6">
            {livreurs.length === 0 ? (
              <div className="text-center py-12 sm:py-16">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-sand-100 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
                  <Icon icon="mdi:truck-delivery-outline" className="text-3xl sm:text-4xl text-sand-400" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-sand-900 mb-2 sm:mb-3">
                  Aucun livreur enregistré
                </h3>
                <p className="text-sm sm:text-base text-sand-500 mb-6 sm:mb-8 max-w-md mx-auto px-4">
                  Commencez par ajouter vos livreurs pour organiser et gérer les livraisons
                </p>
                <button
                  onClick={handleNouveauLivreur}
                  className="inline-flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-sand-900 text-white rounded-lg hover:bg-sand-800 transition-all shadow-sm"
                >
                  <Icon icon="mdi:plus" className="text-lg" />
                  <span className="font-medium text-sm sm:text-base">Ajouter le premier livreur</span>
                </button>
              </div>
            ) : (
              <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
                {livreurs.map((livreur) => (
                  <div
                    key={livreur.id}
                    className="bg-white border border-sand-200 rounded-xl p-4 sm:p-5 hover:border-sand-300 hover:shadow-md transition-all duration-200 overflow-hidden"
                  >
                    {/* Header du livreur */}
                    <div className="flex items-start justify-between mb-3 sm:mb-4">
                      <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-sand-900 rounded-lg flex items-center justify-center shrink-0">
                          <span className="text-white font-bold text-base sm:text-lg">
                            {livreur.nom.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-base sm:text-lg text-sand-900 mb-1 truncate" title={livreur.nom}>
                            {livreur.nom}
                          </h3>
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] sm:text-xs font-medium rounded-full ${livreur.active
                              ? 'bg-success-50 text-success-700'
                              : 'bg-danger-50 text-danger-700'
                              }`}>
                              <Icon icon={livreur.active ? 'mdi:check-circle' : 'mdi:pause-circle'} className="text-xs" />
                              {livreur.active ? 'Actif' : 'Inactif'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Informations de contact */}
                    <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-5">
                      {livreur.telephone && (
                        <div className="flex items-center gap-2">
                          <Icon icon="mdi:phone" className="text-sand-400 shrink-0" />
                          <span className="text-xs sm:text-sm text-sand-700 truncate">{livreur.telephone}</span>
                        </div>
                      )}

                      {livreur.vehicule && (
                        <div className="bg-sand-50 border border-sand-200 rounded-lg p-2 sm:p-3">
                          <div className="flex items-center gap-2">
                            <Icon icon="mdi:car" className="text-sand-600 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="text-[10px] sm:text-xs font-medium text-sand-500 mb-0.5">Véhicule</div>
                              <div className="text-xs sm:text-sm font-semibold text-sand-900 truncate" title={livreur.vehicule}>{livreur.vehicule}</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditer(livreur)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sand-700 hover:text-sand-900 bg-sand-50 hover:bg-sand-100 rounded-lg transition-all text-xs sm:text-sm font-medium"
                      >
                        <Icon icon="mdi:pencil" className="text-base sm:text-lg" />
                        <span className="hidden sm:inline">Modifier</span>
                      </button>
                      <button
                        onClick={() => handleSupprimer(livreur)}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 text-danger-600 hover:text-danger-700 bg-danger-50 hover:bg-danger-100 rounded-lg transition-all text-xs sm:text-sm font-medium"
                      >
                        <Icon icon="mdi:delete-outline" className="text-base sm:text-lg" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, livreurId: '', livreurNom: '' })}
        onConfirm={confirmSupprimer}
        title="Confirmer la suppression"
        message={`Êtes-vous sûr de vouloir supprimer le livreur "${deleteConfirm.livreurNom}" ?\n\nCette action est irréversible.`}
        confirmText="Supprimer"
        cancelText="Annuler"
        type="danger"
        position="center"
      />
    </div>
  );
};