import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from '@iconify/react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useLivraisonStore } from '../../store/livraisonStore';
import { useReferentielStore } from '../../store/referentielStore';
import toast from 'react-hot-toast';

interface ModalQuotaGlobalProps {
  isOpen: boolean;
  onClose: () => void;
}

const getProductIcon = (nom: string) => {
  const n = nom.toLowerCase();
  if (n.includes('baguette')) return 'mdi:bread-slice-outline';
  if (n.includes('croissant')) return 'mdi:food-croissant';
  if (n.includes('chocolat')) return 'mdi:cookie';
  if (n.includes('pain')) return 'mdi:bread-slice';
  return 'mdi:package-variant-closed';
};

export const ModalQuotaGlobal: React.FC<ModalQuotaGlobalProps> = ({
  isOpen,
  onClose
}) => {
  const { parametresLivraison, chargerParametresLivraison, sauvegarderParametresLivraison } = useLivraisonStore();
  const { produits, chargerProduits } = useReferentielStore();

  const [pourcentage, setPourcentage] = useState<string>('10');
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      chargerParametresLivraison().catch(console.error);
      chargerProduits().catch(console.error);
    }
  }, [isOpen, chargerParametresLivraison, chargerProduits]);

  useEffect(() => {
    if (parametresLivraison?.pourcentageRetourGlobalMax !== undefined) {
      setPourcentage(String(parametresLivraison.pourcentageRetourGlobalMax));
    }
  }, [parametresLivraison]);

  // Initialiser les produits sélectionnés
  useEffect(() => {
    if (parametresLivraison?.produitsSoumisAuQuotaIds !== undefined) {
      setSelectedProductIds(new Set(parametresLivraison.produitsSoumisAuQuotaIds));
    } else if (produits.length > 0) {
      // Si jamais configuré auparavant, tous les produits sont cochés par défaut
      setSelectedProductIds(new Set(produits.map(p => p.id)));
    }
  }, [parametresLivraison, produits]);

  // Extraire les catégories uniques des produits
  const categories = useMemo(() => {
    const cats = Array.from(new Set(produits.map(p => p.categorie).filter(Boolean))) as string[];
    return ['all', ...cats];
  }, [produits]);

  // Filtrer les produits pour la sélection
  const produitsFiltres = useMemo(() => {
    return produits.filter(produit => {
      const matchSearch = produit.nom.toLowerCase().includes(searchQuery.toLowerCase().trim());
      const matchCat = selectedCategory === 'all' || produit.categorie === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [produits, searchQuery, selectedCategory]);

  const handleToggleProduct = (id: string) => {
    setSelectedProductIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllVisible = () => {
    setSelectedProductIds(prev => {
      const next = new Set(prev);
      produitsFiltres.forEach(p => next.add(p.id));
      return next;
    });
  };

  const handleDeselectAllVisible = () => {
    setSelectedProductIds(prev => {
      const next = new Set(prev);
      produitsFiltres.forEach(p => next.delete(p.id));
      return next;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(pourcentage);
    if (isNaN(num) || num < 0 || num > 100) {
      toast.error('Veuillez saisir un pourcentage valide entre 0 et 100%');
      return;
    }

    try {
      setIsSaving(true);
      await sauvegarderParametresLivraison({
        pourcentageRetourGlobalMax: num,
        produitsSoumisAuQuotaIds: Array.from(selectedProductIds)
      });
      toast.success(`Quota global de ${num}% appliqué à ${selectedProductIds.size} produit(s)`);
      onClose();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du quota global:', error);
      toast.error('Erreur lors de la sauvegarde du quota global');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Paramètres du Quota Global de Retours" size="lg">
      <form onSubmit={handleSave} className="space-y-4">
        {/* Section 1 : Définition du pourcentage global */}
        <div className="bg-sand-50 p-4 rounded-xl border border-sand-200">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Icon icon="mdi:keyboard-return" className="text-xl" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-sand-900">
                Taux de retour maximal par défaut (%)
              </h4>
              <p className="text-xs text-sand-600 mt-0.5 leading-relaxed">
                Ce pourcentage s'applique aux produits sélectionnés ci-dessous qui n'ont pas de taux spécifique propre.
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <div className="w-36">
              <Input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={pourcentage}
                onChange={(e) => setPourcentage(e.target.value)}
                placeholder="10"
                required
              />
            </div>
            <span className="text-sm font-bold text-sand-700">% de retour max autorisé</span>
          </div>
        </div>

        {/* Section 2 : Produits soumis au quota */}
        <div className="bg-white border border-sand-200 rounded-xl p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-sand-100">
            <div>
              <h4 className="text-sm font-semibold text-sand-900 flex items-center gap-1.5">
                <Icon icon="mdi:checkbox-marked-circle-outline" className="text-terracotta-600" />
                Produits soumis aux quotas de retours
              </h4>
              <p className="text-xs text-sand-500 mt-0.5">
                {selectedProductIds.size} sur {produits.length} produit(s) soumis au quota. Les produits non cochés seront sans restriction de retour.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAllVisible}
                className="text-xs font-medium text-terracotta-600 hover:text-terracotta-700 hover:underline px-1.5 py-0.5"
              >
                Tout cocher
              </button>
              <span className="text-sand-300">|</span>
              <button
                type="button"
                onClick={handleDeselectAllVisible}
                className="text-xs font-medium text-sand-500 hover:text-sand-700 hover:underline px-1.5 py-0.5"
              >
                Tout décocher
              </button>
            </div>
          </div>

          {/* Filtres de recherche et catégories */}
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Icon icon="mdi:magnify" className="absolute left-3 top-1/2 -translate-y-1/2 text-sand-400 text-sm" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un produit..."
                className="w-full pl-8 pr-3 py-1.5 border border-sand-300 rounded-lg text-xs text-sand-900 bg-sand-50/50 focus:bg-white focus:ring-1 focus:ring-terracotta-500 focus:border-transparent"
              />
            </div>

            {categories.length > 2 && (
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`text-xs px-2.5 py-1 rounded-md capitalize font-medium transition-all shrink-0 ${
                      selectedCategory === cat
                        ? 'bg-terracotta-600 text-white'
                        : 'bg-sand-100 text-sand-600 hover:bg-sand-200'
                    }`}
                  >
                    {cat === 'all' ? 'Tous' : cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Liste des produits avec checkboxes */}
          <div className="mt-3 max-h-60 overflow-y-auto space-y-1.5 pr-1 divide-y divide-sand-50">
            {produitsFiltres.length === 0 ? (
              <div className="text-center py-6 text-xs text-sand-500">
                Aucun produit ne correspond à votre recherche.
              </div>
            ) : (
              produitsFiltres.map((produit) => {
                const isSelected = selectedProductIds.has(produit.id);
                const hasSpecific = produit.pourcentageRetourMax !== undefined && produit.pourcentageRetourMax > 0;

                return (
                  <div
                    key={produit.id}
                    onClick={() => handleToggleProduct(produit.id)}
                    className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors pt-2 ${
                      isSelected ? 'bg-amber-50/50 hover:bg-amber-50' : 'hover:bg-sand-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // géré par le conteneur onClick
                        className="h-4 w-4 text-terracotta-600 rounded border-sand-300 focus:ring-terracotta-500 cursor-pointer"
                      />
                      <div className="w-7 h-7 bg-sand-100 text-sand-700 rounded-md flex items-center justify-center shrink-0">
                        {produit.imageUrl ? (
                          <img src={produit.imageUrl} alt="" className="w-full h-full object-cover rounded-md" />
                        ) : (
                          <Icon icon={getProductIcon(produit.nom)} className="text-sm" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-sand-900 uppercase truncate">
                          {produit.nom}
                        </div>
                        {produit.categorie && (
                          <span className="text-[10px] text-sand-500 capitalize">
                            {produit.categorie}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                      {isSelected ? (
                        hasSpecific ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded">
                            Taux propre : {produit.pourcentageRetourMax}%
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-terracotta-700 bg-terracotta-50 px-2 py-0.5 rounded">
                            Taux global ({pourcentage || 0}%)
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-sand-400 bg-sand-100 px-2 py-0.5 rounded">
                          Non soumis
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Rappel de la règle de priorité */}
        <div className="bg-sand-50 border border-sand-200 rounded-lg p-3 text-xs text-sand-600 space-y-1">
          <div className="font-semibold text-sand-800 flex items-center gap-1.5">
            <Icon icon="mdi:order-bool-ascending-variant" className="text-sm text-terracotta-600" />
            Ordre de priorité du calcul :
          </div>
          <ol className="list-decimal list-inside space-y-0.5 pl-1 text-sand-600">
            <li><span className="font-medium text-sand-800">Exception Client :</span> Si le client a un taux spécifique défini pour ce produit.</li>
            <li><span className="font-medium text-sand-800">Taux Produit :</span> Si le produit a un taux propre configuré dans sa fiche.</li>
            <li><span className="font-medium text-sand-800">Taux Global :</span> Appliqué uniquement aux produits cochés ci-dessus.</li>
            <li><span className="font-medium text-sand-800">Sans quota :</span> Produits non cochés ci-dessus (retours libres).</li>
          </ol>
        </div>

        <div className="flex justify-end gap-2.5 pt-2 border-t border-sand-100">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Annuler
          </Button>
          <Button type="submit" isLoading={isSaving}>
            Enregistrer les quotas
          </Button>
        </div>
      </form>
    </Modal>
  );
};
