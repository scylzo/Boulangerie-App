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
  const [search, setSearch] = useState('');
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

  const livreursFiltres = livreurs.filter(l => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return l.nom?.toLowerCase().includes(q) || l.telephone?.includes(q);
  });

  return (
    <div className="min-h-screen bg-sand-100">
      {/* Header */}
      <div className="bg-white border-b border-sand-200 px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <div className="w-10 h-10 bg-terracotta-50 rounded-xl flex items-center justify-center shrink-0">
              <Icon icon="mdi:truck-delivery-outline" className="text-xl text-terracotta-600" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-lg sm:text-2xl font-semibold text-sand-900 truncate">
                Équipe de livraison
              </h1>
              <p className="text-xs sm:text-sm text-sand-500 truncate">
                {livreurs.length} livreur(s) · {livreurs.filter(l => l.active).length} actif(s)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Icon icon="mdi:magnify" className="absolute left-3 top-1/2 -translate-y-1/2 text-sand-400 text-lg" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher…"
                className="w-full sm:w-48 pl-10 pr-3 py-2 border border-sand-300 rounded-lg bg-white text-sm text-sand-900 focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={handleNouveauLivreur}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-terracotta-500 text-white rounded-lg hover:bg-terracotta-600 transition-all shadow-soft shrink-0 text-sm font-medium whitespace-nowrap"
            >
              <Icon icon="mdi:plus" className="text-lg" />
              <span className="hidden sm:inline">Nouveau livreur</span>
            </button>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto p-4 sm:p-6">

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

        {livreurs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-sand-200 shadow-card text-center py-16">
            <div className="w-20 h-20 bg-sand-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Icon icon="mdi:truck-delivery-outline" className="text-4xl text-sand-400" />
            </div>
            <h3 className="font-display text-xl font-semibold text-sand-900 mb-3">Aucun livreur enregistré</h3>
            <p className="text-sand-500 mb-8 max-w-md mx-auto px-4">
              Commencez par ajouter vos livreurs pour organiser et gérer les livraisons
            </p>
            <button
              onClick={handleNouveauLivreur}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-terracotta-500 text-white rounded-lg hover:bg-terracotta-600 transition-all shadow-soft text-sm font-medium"
            >
              <Icon icon="mdi:plus" className="text-lg" />
              <span>Ajouter le premier livreur</span>
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-sand-200 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-sand-500 border-b border-sand-200 bg-sand-50">
                    <th className="font-semibold px-4 py-3">Livreur</th>
                    <th className="font-semibold px-4 py-3">Téléphone</th>
                    <th className="font-semibold px-4 py-3">Véhicule</th>
                    <th className="font-semibold px-4 py-3">Statut</th>
                    <th className="font-semibold px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {livreursFiltres.map((livreur) => (
                    <tr key={livreur.id} className="border-b border-sand-100 last:border-0 hover:bg-sand-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 bg-sand-900 text-white rounded-lg flex items-center justify-center font-semibold text-sm shrink-0">
                            {livreur.nom.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-sand-900 truncate">{livreur.nom}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sand-700">
                        {livreur.telephone ? (
                          <span className="inline-flex items-center gap-1.5"><Icon icon="mdi:phone-outline" className="text-sand-400" />{livreur.telephone}</span>
                        ) : <span className="text-sand-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sand-700">
                        {livreur.vehicule ? (
                          <span className="inline-flex items-center gap-1.5"><Icon icon="mdi:car" className="text-sand-400" />{livreur.vehicule}</span>
                        ) : <span className="text-sand-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ring-1 ring-inset ${livreur.active
                          ? 'bg-success-50 text-success-700 ring-success-100'
                          : 'bg-sand-100 text-sand-500 ring-sand-200'
                          }`}>
                          <Icon icon={livreur.active ? 'mdi:check-circle' : 'mdi:pause-circle'} className="text-xs" />
                          {livreur.active ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleEditer(livreur)}
                            className="w-8 h-8 rounded-lg text-sand-500 hover:bg-sand-100 hover:text-sand-900 flex items-center justify-center transition-colors"
                            title="Modifier"
                          >
                            <Icon icon="mdi:pencil-outline" className="text-lg" />
                          </button>
                          <button
                            onClick={() => handleSupprimer(livreur)}
                            className="w-8 h-8 rounded-lg text-sand-500 hover:bg-danger-50 hover:text-danger-600 flex items-center justify-center transition-colors"
                            title="Supprimer"
                          >
                            <Icon icon="mdi:trash-can-outline" className="text-lg" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {livreursFiltres.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sand-500">
                        Aucun livreur ne correspond à « {search} ».
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
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
