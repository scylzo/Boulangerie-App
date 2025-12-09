import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { TableLoader } from '../../components/ui/Loader';
import { ProduitForm } from '../../components/shared/ProduitForm';
import { useReferentielStore } from '../../store/referentielStore';
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

  useEffect(() => {
    chargerProduits();
  }, [chargerProduits]);

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

  const handleSupprimer = async (produit: Produit) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer "${produit.nom}" ?`)) {
      await supprimerProduit(produit.id);
    }
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
    <div className="min-h-screen bg-gray-50">
      {/* Header moderne type Odoo */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-r from-orange-600 to-red-600 rounded-lg flex items-center justify-center">
              <Icon icon="mdi:bread-slice" className="text-2xl text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Gestion des Produits
              </h1>
              <p className="text-sm text-gray-500">
                Gérez votre catalogue de produits de boulangerie
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowForm(true)}
            disabled={showForm}
            className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-lg hover:from-orange-700 hover:to-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            <Icon icon="mdi:plus" className="text-lg" />
            <span className="font-medium">Nouveau produit</span>
          </button>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto p-6 space-y-6">

      {/* Formulaire d'ajout/modification */}
      {showForm && (
        <ProduitForm
          produit={produitEnEdition}
          onSave={produitEnEdition ? handleModifier : handleAjouter}
          onCancel={handleAnnuler}
          isLoading={isLoadingProduits}
        />
      )}

        {/* Section Liste des produits */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Icon icon="mdi:format-list-bulleted" className="text-lg text-orange-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Catalogue produits</h2>
                  <p className="text-sm text-gray-500">{produits.length} produit(s) enregistré(s)</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-600">
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
                <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Icon icon="mdi:bread-slice-outline" className="text-4xl text-orange-500" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  Aucun produit enregistré
                </h3>
                <p className="text-gray-500 mb-8 max-w-md mx-auto">
                  Commencez par ajouter vos premiers produits de boulangerie pour constituer votre catalogue
                </p>
                <button
                  onClick={() => setShowForm(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-lg hover:from-orange-700 hover:to-red-700 transition-all shadow-md"
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
                    className="bg-gradient-to-br from-white to-gray-50 border border-gray-200 rounded-2xl p-6 hover:border-orange-300 hover:shadow-2xl transition-all duration-300 group"
                  >
                    {/* Header du produit */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                          <Icon icon={getProductIcon(produit.nom)} className="text-2xl text-white" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg text-gray-900 mb-1">
                            {produit.nom}
                          </h3>
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${
                              produit.active
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              <Icon icon={produit.active ? 'mdi:check-circle' : 'mdi:pause-circle'} className="text-xs" />
                              {produit.active ? 'Actif' : 'Inactif'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Prix */}
                    <div className="space-y-3 mb-6">
                      <div className="grid grid-cols-1 gap-3">
                        <div className="bg-blue-50 rounded-xl p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Icon icon="mdi:account-group" className="text-blue-500 text-sm" />
                            <span className="text-xs font-medium text-blue-700">Prix Client</span>
                          </div>
                          <div className="text-xl font-bold text-blue-800">
                            {produit.prixClient ? `${produit.prixClient.toLocaleString('fr-FR')} F` : 'Non défini'}
                          </div>
                        </div>

                        <div className="bg-purple-50 rounded-xl p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Icon icon="mdi:storefront" className="text-purple-500 text-sm" />
                            <span className="text-xs font-medium text-purple-700">Prix Boutique</span>
                          </div>
                          <div className="text-xl font-bold text-purple-800">
                            {produit.prixBoutique ? `${produit.prixBoutique.toLocaleString('fr-FR')} F` : 'Non défini'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditer(produit)}
                        disabled={showForm}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 rounded-xl transition-all font-medium shadow-sm hover:shadow-md disabled:opacity-50"
                      >
                        <Icon icon="mdi:pencil" className="text-lg" />
                        <span>Modifier</span>
                      </button>
                      <button
                        onClick={() => handleSupprimer(produit)}
                        disabled={isLoadingProduits}
                        className="flex items-center justify-center gap-2 px-4 py-2 text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-xl transition-all font-medium shadow-sm hover:shadow-md disabled:opacity-50"
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