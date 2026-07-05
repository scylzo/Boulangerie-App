import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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

  const [searchParams] = useSearchParams();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState(() => searchParams.get('q') || '');
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

  // Préremplir la recherche depuis l'URL (?q=) — ex. depuis la recherche globale
  useEffect(() => {
    const q = searchParams.get('q');
    if (q !== null) setSearch(q);
  }, [searchParams]);

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

  const produitsFiltres = produits.filter(p =>
    p.nom.toLowerCase().includes(search.toLowerCase().trim())
  );
  const nbActifs = produits.filter(p => p.active).length;

  return (
    <div className="min-h-screen bg-sand-100">
      {/* Header */}
      <div className="bg-white border-b border-sand-200 px-3 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <div className="w-10 h-10 bg-terracotta-50 rounded-xl flex items-center justify-center shrink-0">
              <Icon icon="mdi:baguette" className="text-lg sm:text-2xl text-terracotta-600" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-base sm:text-2xl font-semibold text-sand-900 truncate">
                Catalogue produits
              </h1>
              <p className="text-xs sm:text-sm text-sand-500 truncate">
                {produits.length} produit(s) · {nbActifs} actif(s) · prix en FCFA
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
              onClick={() => setShowForm(true)}
              disabled={showForm}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-soft text-sm font-medium whitespace-nowrap"
            >
              <Icon icon="mdi:plus" className="text-lg" />
              <span className="hidden sm:inline">Nouveau produit</span>
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

        {isLoadingProduits ? (
          <div className="bg-white rounded-2xl border border-sand-200 shadow-card">
            <TableLoader message="Chargement des produits..." />
          </div>
        ) : produits.length === 0 ? (
          <div className="bg-white rounded-2xl border border-sand-200 shadow-card text-center py-16">
            <div className="w-20 h-20 bg-sand-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Icon icon="mdi:bread-slice-outline" className="text-4xl text-sand-400" />
            </div>
            <h3 className="font-display text-xl font-semibold text-sand-900 mb-3">Aucun produit enregistré</h3>
            <p className="text-sand-500 mb-8 max-w-md mx-auto px-4">
              Commencez par ajouter vos premiers produits de boulangerie pour constituer votre catalogue
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-lg transition-all shadow-soft text-sm font-medium"
            >
              <Icon icon="mdi:plus" className="text-lg" />
              <span>Ajouter le premier produit</span>
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-sand-200 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-sand-500 border-b border-sand-200 bg-sand-50">
                    <th className="font-semibold px-4 py-3">Produit</th>
                    <th className="font-semibold px-4 py-3">Catégorie</th>
                    <th className="font-semibold px-4 py-3 text-right">Prix client</th>
                    <th className="font-semibold px-4 py-3 text-right">Prix boutique</th>
                    <th className="font-semibold px-4 py-3">Statut</th>
                    <th className="font-semibold px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {produitsFiltres.map((produit) => (
                    <tr key={produit.id} className="border-b border-sand-100 last:border-0 hover:bg-sand-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 bg-sand-100 text-sand-700 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                            {produit.imageUrl ? (
                              <img src={produit.imageUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Icon icon={getProductIcon(produit.nom)} className="text-lg" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-sand-900 truncate uppercase">{produit.nom}</div>
                            {produit.reconduisible && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-success-600 mt-0.5">
                                <Icon icon="mdi:recycle" className="text-xs" /> Reconduisible
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {produit.categorie ? (
                          <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-sand-100 text-sand-600 ring-1 ring-inset ring-sand-200 capitalize">
                            {produit.categorie}
                          </span>
                        ) : (
                          <span className="text-sand-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sand-700">
                        {produit.prixClient ? `${produit.prixClient.toLocaleString('fr-FR')} F` : <span className="text-sand-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-sand-700">
                        {produit.prixBoutique ? `${produit.prixBoutique.toLocaleString('fr-FR')} F` : <span className="text-sand-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ring-1 ring-inset ${produit.active
                          ? 'bg-success-50 text-success-700 ring-success-100'
                          : 'bg-sand-100 text-sand-500 ring-sand-200'
                          }`}>
                          <Icon icon={produit.active ? 'mdi:check-circle' : 'mdi:pause-circle'} className="text-xs" />
                          {produit.active ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleEditer(produit)}
                            disabled={showForm}
                            className="w-8 h-8 rounded-lg text-sand-500 hover:bg-sand-100 hover:text-sand-900 flex items-center justify-center transition-colors disabled:opacity-50"
                            title="Modifier"
                          >
                            <Icon icon="mdi:pencil-outline" className="text-lg" />
                          </button>
                          <button
                            onClick={() => handleSupprimer(produit)}
                            disabled={isLoadingProduits}
                            className="w-8 h-8 rounded-lg text-sand-500 hover:bg-danger-50 hover:text-danger-600 flex items-center justify-center transition-colors disabled:opacity-50"
                            title="Supprimer"
                          >
                            <Icon icon="mdi:trash-can-outline" className="text-lg" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {produitsFiltres.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sand-500">
                        Aucun produit ne correspond à « {search} ».
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
