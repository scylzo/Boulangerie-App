import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { TableLoader } from '../../components/ui/Loader';
import { Modal } from '../../components/ui/Modal';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { ProduitForm } from '../../components/shared/ProduitForm';
import { useReferentielStore } from '../../store/referentielStore';
import { useStockStore } from '../../store/stockStore'; // Import stock store
import type { Produit } from '../../types';

export const GestionProduits: React.FC = () => {
  const {
    produits,
    produitEnEdition,
    isLoadingProduits,
    chargerProduits,
    ajouterProduit,
    modifierProduit,
    supprimerProduit,
    setProduitEnEdition
  } = useReferentielStore();

  const [showForm, setShowForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; produitId: string; produitNom: string }>({
    isOpen: false,
    produitId: '',
    produitNom: ''
  });

  const { chargerDonnees: chargerStock } = useStockStore();

  useEffect(() => {
    chargerProduits();
    chargerStock();
  }, [chargerProduits, chargerStock]);

  const handleAjouter = async (produitData: Omit<Produit, 'id' | 'createdAt' | 'updatedAt'>) => {
    await ajouterProduit(produitData);
    setShowForm(false);
  };

  const handleModifier = async (produitData: Omit<Produit, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (produitEnEdition) {
      await modifierProduit(produitEnEdition.id, produitData);
      setProduitEnEdition(null);
      setShowForm(false);
    }
  };

  const handleSupprimer = (produit: Produit) => {
    setDeleteConfirm({
      isOpen: true,
      produitId: produit.id,
      produitNom: produit.nom
    });
  };

  const confirmSupprimer = async () => {
    await supprimerProduit(deleteConfirm.produitId);
    setDeleteConfirm({ isOpen: false, produitId: '', produitNom: '' });
  };

  const handleAnnuler = () => {
    setProduitEnEdition(null);
    setShowForm(false);
  };

  const handleEditer = (produit: Produit) => {
    setProduitEnEdition(produit);
    setShowForm(true);
  };

  // Fonction pour obtenir l'icône du produit basé sur son nom
  const getProductIcon = (productName: string): string => {
    const name = productName?.toLowerCase() || '';
    if (name.includes('baguette')) return 'mdi:baguette';
    if (name.includes('pain')) return 'mdi:bread-slice';
    if (name.includes('croissant')) return 'mdi:croissant';
    if (name.includes('brioche')) return 'mdi:muffin';
    if (name.includes('tarte')) return 'mdi:pie';
    if (name.includes('gateau') || name.includes('gâteau')) return 'mdi:cake';
    if (name.includes('sandwich')) return 'mdi:food';
    if (name.includes('viennoiserie')) return 'mdi:pretzel';
    return 'mdi:food-variant';
  };

  return (
    <div className="min-h-screen bg-sand-50">
      {/* Header */}
      <div className="bg-white border-b border-sand-200 px-3 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <div className="w-10 h-10 bg-warning-600 rounded-lg flex items-center justify-center shrink-0">
              <Icon icon="mdi:bread-slice" className="text-lg sm:text-2xl text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-base sm:text-xl font-semibold text-sand-900 truncate">
                Gestion des Produits
              </h1>
              <p className="text-xs sm:text-sm text-sand-500 truncate">
                Gérez votre catalogue de produits de boulangerie
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowForm(true)}
            disabled={showForm}
            className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2 bg-warning-600 hover:bg-warning-600 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm text-xs sm:text-sm font-medium w-full sm:w-auto"
          >
            <Icon icon="mdi:plus" className="text-base sm:text-lg" />
            <span>Nouveau produit</span>
          </button>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto p-6 space-y-6">

        {/* Modal d'ajout/modification */}
        {showForm && (
          <Modal
            isOpen={showForm}
            onClose={handleAnnuler}
            title={produitEnEdition ? 'Modifier le produit' : 'Nouveau produit'}
            position="center"
            size="lg"
          >
            <ProduitForm
              produit={produitEnEdition}
              onSave={produitEnEdition ? handleModifier : handleAjouter}
              onCancel={handleAnnuler}
              isLoading={isLoadingProduits}
            />
          </Modal>
        )}

        {/* Section Liste des produits */}
        <div className="bg-white rounded-xl border border-sand-200 shadow-sm">
          <div className="px-6 py-4 border-b border-sand-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-warning-100 rounded-lg flex items-center justify-center">
                  <Icon icon="mdi:format-list-bulleted" className="text-lg text-warning-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-sand-900">Catalogue produits</h2>
                  <p className="text-sm text-sand-500">{produits.length} produit(s) enregistré(s)</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-sm text-sand-600">
                  <span className="font-medium">{produits.filter(p => p.active).length}</span> actifs
                  <span className="mx-2">•</span>
                  <span className="font-medium">{produits.filter(p => !p.active).length}</span> inactifs
                </div>
              </div>
            </div>
          </div>

          <div className="p-6">
            {isLoadingProduits ? (
              <TableLoader message="Chargement des produits..." />
            ) : produits.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-warning-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Icon icon="mdi:bread-slice-outline" className="text-4xl text-warning-500" />
                </div>
                <h3 className="text-xl font-semibold text-sand-900 mb-3">
                  Aucun produit enregistré
                </h3>
                <p className="text-sand-500 mb-8 max-w-md mx-auto">
                  Commencez par ajouter vos premiers produits de boulangerie pour constituer votre catalogue
                </p>
                <button
                  onClick={() => setShowForm(true)}
                  className="inline-flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-warning-600 hover:bg-warning-600 text-white rounded-lg transition-all shadow-sm text-xs sm:text-sm font-medium"
                >
                  <Icon icon="mdi:plus" className="text-lg" />
                  <span className="font-medium">Ajouter le premier produit</span>
                </button>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {produits.map((produit) => (
                  <div
                    key={produit.id}
                    className="bg-white border border-sand-200 rounded-2xl p-4 sm:p-6 hover:border-warning-100 hover:shadow-lg transition-all duration-300 group"
                  >
                    {/* Header du produit */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 bg-warning-600 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                          <Icon icon={getProductIcon(produit.nom)} className="text-2xl text-white" />
                        </div>
                        <div>
                          <h3 className="font-bold text-sm sm:text-lg text-sand-900 mb-1 line-clamp-2 min-h-[2.5rem] sm:min-h-[3.5rem] flex items-center">
                            {produit.nom}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${produit.active
                              ? 'bg-success-100 text-success-700'
                              : 'bg-danger-100 text-danger-700'
                              }`}>
                              <Icon icon={produit.active ? 'mdi:check-circle' : 'mdi:pause-circle'} className="text-xs" />
                              {produit.active ? 'Actif' : 'Inactif'}
                            </span>
                            {produit.categorie && (
                              <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-bold uppercase tracking-wider rounded-full border ${produit.categorie === 'boulangerie'
                                ? 'bg-warning-100 text-warning-600 border-warning-100'
                                : 'bg-danger-100 text-danger-700 border-danger-100'
                                }`}>
                                {produit.categorie === 'boulangerie' ? 'Boulangerie' : 'Viennoiserie'}
                              </span>
                            )}
                            {produit.reconduisible && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-success-100 text-success-700 border border-success-100">
                                <Icon icon="mdi:recycle" className="text-xs" />
                                Reconduisible
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Prix */}
                    <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                      <div className="grid grid-cols-1 gap-2 sm:gap-3">
                        <div className="bg-info-50 rounded-xl p-2 sm:p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Icon icon="mdi:account-group" className="text-info-500 text-xs sm:text-sm" />
                            <span className="text-[10px] sm:text-xs font-medium text-info-600">Prix Client</span>
                          </div>
                          <div className="text-base sm:text-xl font-bold text-info-600">
                            {produit.prixClient ? `${produit.prixClient.toLocaleString('fr-FR')} F` : 'Non défini'}
                          </div>
                        </div>

                        <div className="bg-terracotta-50 rounded-xl p-2 sm:p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Icon icon="mdi:storefront" className="text-terracotta-500 text-xs sm:text-sm" />
                            <span className="text-[10px] sm:text-xs font-medium text-terracotta-700">Prix Boutique</span>
                          </div>
                          <div className="text-base sm:text-xl font-bold text-terracotta-800">
                            {produit.prixBoutique ? `${produit.prixBoutique.toLocaleString('fr-FR')} F` : 'Non défini'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Marge Estimée retirée car plus de gestion financière dans le stock */}

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditer(produit)}
                        disabled={showForm}
                        className="flex-1 flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-warning-600 hover:text-warning-600 bg-warning-50 hover:bg-warning-100 rounded-xl transition-all text-xs sm:text-sm font-medium shadow-sm hover:shadow-md disabled:opacity-50"
                      >
                        <Icon icon="mdi:pencil" className="text-base sm:text-lg" />
                        <span className="hidden sm:inline">Modifier</span>
                      </button>
                      <button
                        onClick={() => handleSupprimer(produit)}
                        disabled={isLoadingProduits}
                        className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-danger-600 hover:text-danger-700 bg-danger-50 hover:bg-danger-100 rounded-xl transition-all text-xs sm:text-sm font-medium shadow-sm hover:shadow-md disabled:opacity-50"
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
        onClose={() => setDeleteConfirm({ isOpen: false, produitId: '', produitNom: '' })}
        onConfirm={confirmSupprimer}
        title="Confirmer la suppression"
        message={`Êtes-vous sûr de vouloir supprimer le produit "${deleteConfirm.produitNom}" ?\n\nCette action supprimera également toutes les données liées (recettes, historique, etc.).`}
        confirmText="Supprimer"
        cancelText="Annuler"
        type="danger"
        position="center"
      />
    </div>
  );
};