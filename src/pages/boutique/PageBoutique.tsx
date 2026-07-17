import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { useBoutiqueStore } from '../../store';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { RepartitionInvendusModal } from '../../components/boutique/RepartitionInvendusModal';
import { PageLoader } from '../../components/ui/PageLoader';

export const PageBoutique: React.FC = () => {
  const {
    stockJour,
    equipeMatin,
    equipeSoir,
    ventesJour,
    isLoading,
    chargerStockJour,
    creerStockDepuisProduction,
    commencerEquipeMatin,
    commencerEquipeSoir,
    saisirVenteMatin,
    saisirVenteSoir,
    terminerEquipeMatin,
    terminerEquipeMatinAvecRepartition,
    sauvegarderEquipe,
    chargerEquipe,
    chargerVentes,
    produits,
    chargerProduits,
    ajouterProduitManuel,
    modifierQuantiteStock,
    supprimerProduitStock,
    rouvrirEquipeMatin,
    rouvrirEquipeSoir,
    toggleModeJourneeContinue,
    validerVenteDirecte,
    synchroniserVentesPOS,
    terminerEquipeSoirAvecRepartition
  } = useBoutiqueStore();

  const [syncingPos, setSyncingPos] = useState(false);

  // Mode de fonctionnement de la boutique :
  //  - 'classique' : saisie manuelle des ventes (ancien fonctionnement)
  //  - 'avance'    : ventes injectées depuis la caisse (POS), en lecture seule
  const [mode, setMode] = useState<'classique' | 'avance'>(
    () => (localStorage.getItem('cm.boutique.mode') as 'classique' | 'avance') || 'classique'
  );
  const changerMode = (m: 'classique' | 'avance') => {
    localStorage.setItem('cm.boutique.mode', m);
    setMode(m);
  };

  // Loader plein écran au premier chargement (les changements de date gardent
  // l'indicateur inline isLoading de la page).
  const [chargementInitial, setChargementInitial] = useState(true);

  const [vendeuseMatin, setVendeuseMatin] = useState(() => localStorage.getItem('cm.pos.vendeur') || '');
  const [vendeuseSoir, setVendeuseSoir] = useState(() => localStorage.getItem('cm.pos.vendeur') || '');
  const [dateSelectionnee, setDateSelectionnee] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [selectedProductToAdd, setSelectedProductToAdd] = useState('');
  const [quantityToAdd, setQuantityToAdd] = useState(0);
  const [isSold, setIsSold] = useState(false);
  const [soldQuantity, setSoldQuantity] = useState(0);
  const [soldPeriod, setSoldPeriod] = useState<'matin' | 'soir'>('matin');

  // État pour la suppression
  const [productToDelete, setProductToDelete] = useState<{ id: string, nom: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // État pour le modal de répartition
  const [showRepartitionModal, setShowRepartitionModal] = useState(false);

  // État pour la modification
  const [productToEdit, setProductToEdit] = useState<{ id: string, nom: string, quantity: number } | null>(null);
  const [newQuantity, setNewQuantity] = useState(0);

  // États pour Saisie Rapide
  const [showFastSaleModal, setShowFastSaleModal] = useState(false);
  const [showStartFastSaleConfirm, setShowStartFastSaleConfirm] = useState(false);
  const [fastSaleValues, setFastSaleValues] = useState<Record<string, number>>({});

  // Initialiser les valeurs de saisie rapide
  React.useEffect(() => {
    if (showFastSaleModal && stockJour) {
      const initial: Record<string, number> = {};
      stockJour.produits.forEach(p => {
        const existing = equipeMatin?.produits.find(ep => ep.produitId === p.produitId);
        initial[p.produitId] = existing ? existing.vendu : 0;
      });
      setFastSaleValues(initial);
    }
  }, [showFastSaleModal, stockJour, equipeMatin]);

  const dateActuelle = new Date(dateSelectionnee);

  // Charger automatiquement toutes les données
  React.useEffect(() => {
    const chargerDonneesAutomatiquement = async () => {
      try {
        console.log('🔄 Chargement des données pour', dateActuelle.toISOString().split('T')[0]);

        // 1. Charger le stock depuis programme de production
        await chargerStockJour(dateActuelle);

        await new Promise(resolve => setTimeout(resolve, 100));
        const currentStore = useBoutiqueStore.getState();

        if (!currentStore.stockJour && !currentStore.isLoading) {
          await creerStockDepuisProduction(dateActuelle);
        }

        // 2. Charger les équipes matin et soir depuis Firebase
        await chargerEquipe(dateActuelle, 'matin');
        await chargerEquipe(dateActuelle, 'soir');

        // 3. Charger les ventes depuis Firebase
        await chargerVentes(dateActuelle);

        // 4. Charger le catalogue produits (pour l'ajout manuel)
        await chargerProduits();

        // 5. Mode avancé uniquement : injecter les ventes caisse (POS) dans les équipes en cours
        if (localStorage.getItem('cm.boutique.mode') !== 'classique') {
          await useBoutiqueStore.getState().synchroniserVentesPOS(dateActuelle);
        }

        console.log('✅ Toutes les données chargées');
      } catch (error) {
        console.error('❌ Erreur lors du chargement automatique:', error);
      } finally {
        setChargementInitial(false);
      }
    };

    chargerDonneesAutomatiquement();
  }, [dateSelectionnee]);

  const handleSyncPos = async () => {
    setSyncingPos(true);
    try {
      await synchroniserVentesPOS(dateActuelle);
    } finally {
      setSyncingPos(false);
    }
  };

  // Fonction pour obtenir l'icône du produit
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

  if (chargementInitial) {
    return <PageLoader message="Chargement de la boutique…" />;
  }

  return (
    <div className="min-h-screen bg-sand-100 overflow-x-hidden">
      {/* Header */}
      <div className="bg-white border-b border-sand-200 px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-10 h-10 bg-terracotta-50 rounded-xl flex items-center justify-center shrink-0">
            <Icon icon="mdi:storefront-outline" className="text-xl text-terracotta-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-lg sm:text-2xl font-semibold text-sand-900 truncate">
              Gestion Boutique
            </h1>
            <p className="text-xs sm:text-sm text-sand-500 truncate">
              Suivi des ventes matin et soir
            </p>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
        {/* Widget de sélection de date moderne */}
        <div className="bg-white rounded-2xl border border-sand-200 shadow-card p-4 sm:p-6 overflow-hidden">
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <div className="w-8 h-8 bg-sand-100 rounded-lg flex items-center justify-center shrink-0">
              <Icon icon="mdi:calendar" className="text-lg text-sand-600" />
            </div>
            <h2 className="text-base sm:text-lg font-semibold text-sand-900 truncate">Date de service</h2>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <input
              type="date"
              value={dateSelectionnee}
              onChange={(e) => setDateSelectionnee(e.target.value)}
              className="px-3 sm:px-4 py-2 sm:py-3 border border-sand-300 rounded-lg focus:ring-2 focus:ring-terracotta-500 focus:border-transparent text-sand-900 font-medium text-sm sm:text-base w-full sm:w-auto"
            />
            <div className="text-xs sm:text-sm text-sand-500 truncate">
              Service boutique pour {new Date(dateSelectionnee).toLocaleDateString('fr-FR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>

            {/* Sélecteur de mode */}
            <div className="sm:ml-auto shrink-0">
              <div className="inline-flex items-center p-1 rounded-xl bg-sand-100 border border-sand-200">
                {([
                  { val: 'classique', label: 'Classique', icon: 'mdi:pencil-outline' },
                  { val: 'avance', label: 'Avancé (caisse)', icon: 'mdi:cash-register' },
                ] as { val: 'classique' | 'avance'; label: string; icon: string }[]).map((m) => (
                  <button
                    key={m.val}
                    onClick={() => changerMode(m.val)}
                    title={m.val === 'classique' ? 'Saisie manuelle des ventes' : 'Ventes injectées depuis la caisse (POS)'}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${mode === m.val ? 'bg-white text-sand-900 shadow-sm' : 'text-sand-500 hover:text-sand-700'}`}
                  >
                    <Icon icon={m.icon} className="text-base" />
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-sand-400 mt-2">
            {mode === 'classique'
              ? 'Mode classique : vous saisissez manuellement les ventes matin/soir.'
              : 'Mode avancé : les ventes sont injectées automatiquement depuis la caisse (POS).'}
          </p>
        </div>

        {/* État du chargement ou absence de stock */}
        {!stockJour && (
          <div className="bg-white rounded-2xl border border-sand-200 shadow-card">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-sand-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-info-100 rounded-lg flex items-center justify-center shrink-0">
                  <Icon icon="mdi:package-variant" className="text-base sm:text-lg text-info-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base sm:text-lg font-semibold text-sand-900 truncate">Stock de départ</h2>
                  <p className="text-xs sm:text-sm text-sand-500 truncate">Chargement automatique des produits destinés à la boutique</p>
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-6">
              <div className="text-center py-8 sm:py-12">
                {isLoading ? (
                  <div className="flex flex-col items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 border-4 border-info-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm sm:text-base text-sand-600 font-medium">Chargement du stock de production...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 sm:gap-4">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-sand-100 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-4">
                      <Icon icon="mdi:calendar-clock" className="text-3xl sm:text-4xl text-sand-400" />
                    </div>
                    <div className="max-w-md">
                      <h3 className="text-base sm:text-lg font-medium text-sand-900 mb-2">
                        Stock non disponible
                      </h3>
                      <p className="text-sm sm:text-base text-sand-500 mb-4 sm:mb-6">
                        Aucune quantité boutique définie pour le {new Date(dateSelectionnee).toLocaleDateString('fr-FR')}
                      </p>
                      <div className="bg-info-50 rounded-lg p-3 sm:p-4 text-xs sm:text-sm text-sand-700 space-y-1 text-left">
                        <p className="font-semibold text-info-600 mb-2">Pour activer la boutique :</p>
                        <p>1. Créez un programme de production</p>
                        <p>2. Ajoutez des quantités à envoyer en boutique</p>
                        <p>3. Le stock apparaîtra automatiquement ici</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Affichage du stock reçu */}
        {stockJour && (
          <div className="bg-white rounded-2xl border border-sand-200 shadow-card">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-sand-100">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-success-100 rounded-lg flex items-center justify-center shrink-0">
                    <Icon icon="mdi:package-check" className="text-base sm:text-lg text-success-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base sm:text-lg font-semibold text-sand-900 truncate">
                      Stock de départ - {new Date(stockJour.date).toLocaleDateString('fr-FR')}
                    </h2>
                    <p className="text-xs sm:text-sm text-sand-500 truncate">{stockJour.produits.length} produit(s) reçu(s) de la production</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                  {/* Toggle Mode Journée Continue */}
                  <div className="flex items-center gap-2 bg-sand-50 p-2 rounded-lg border border-sand-200 w-full sm:w-auto">
                    <button
                      onClick={toggleModeJourneeContinue}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-hidden focus:ring-2 focus:ring-terracotta-500 focus:ring-offset-2 shrink-0 ${stockJour.isJourneeContinue ? 'bg-terracotta-600' : 'bg-sand-200'
                        }`}
                    >
                      <span
                        className={`${stockJour.isJourneeContinue ? 'translate-x-6' : 'translate-x-1'
                          } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                      />
                    </button>
                    <span className="text-xs sm:text-sm font-medium text-sand-700 truncate">
                      {stockJour.isJourneeContinue ? 'Mode Journée Continue' : 'Mode 2 Équipes'}
                    </span>
                  </div>

                  {/* Bouton Saisie Rapide */}
                  <button
                    onClick={() => setShowFastSaleModal(true)}
                    className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-sand-900 hover:bg-sand-800 text-white rounded-lg transition-colors shadow-sm text-xs sm:text-sm font-medium w-full sm:w-auto"
                  >
                    <Icon icon="mdi:flash" className="text-base sm:text-lg" />
                    <span>Saisie Rapide</span>
                  </button>

                  <button
                    onClick={() => setShowAddProductModal(true)}
                    className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-info-50 text-info-600 rounded-lg hover:bg-info-100 transition-colors text-xs sm:text-sm font-medium w-full sm:w-auto"
                  >
                    <Icon icon="mdi:plus-circle" className="text-base sm:text-lg" />
                    <span>Ajouter Produit</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Saisie Rapide (One Shot) */}
            {showFastSaleModal && stockJour && (
              <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-elevated w-full max-w-5xl p-6 animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="font-display text-xl font-semibold text-sand-900 flex items-center gap-2">
                        <Icon icon="mdi:flash-circle" className="text-terracotta-600" />
                        Saisie Rapide des Ventes
                      </h3>
                      <p className="text-sm text-sand-500 mt-1">
                        Validez les ventes de la journée en une seule fois. Cette action passera la boutique en mode "Journée Continue" et clôturera le service.
                      </p>
                    </div>
                    <button onClick={() => setShowFastSaleModal(false)} className="text-sand-400 hover:text-sand-600">
                      <Icon icon="mdi:close" className="text-2xl" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto pr-2 pb-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {stockJour.produits.map(p => {
                        const currentValue = fastSaleValues[p.produitId] ?? 0;
                        const isFull = currentValue === p.stockDebut;

                        return (
                          <div key={p.produitId} className={`p-4 rounded-xl border transition-all ${isFull ? 'bg-terracotta-50 border-terracotta-100' : 'bg-white border-sand-200 hover:border-terracotta-100'}`}>
                            <div className="flex items-center gap-3 mb-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shadow-sm ${isFull ? 'bg-terracotta-100 text-terracotta-700' : 'bg-sand-100 text-sand-500'}`}>
                                <Icon icon={getProductIcon(p.produit?.nom || '')} className="text-xl" />
                              </div>
                              <div className="flex-1 overflow-hidden">
                                <p className="font-semibold text-sand-900 truncate uppercase" title={p.produit?.nom}>{p.produit?.nom}</p>
                                <p className="text-xs text-sand-500">Stock: {p.stockDebut}</p>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-medium text-sand-500">Vendu</span>
                                <span className="font-semibold text-lg text-sand-900">{currentValue}</span>
                              </div>

                              <input
                                type="range"
                                min="0"
                                max={p.stockDebut}
                                value={currentValue}
                                onChange={(e) => setFastSaleValues(prev => ({ ...prev, [p.produitId]: parseInt(e.target.value) }))}
                                className="w-full accent-terracotta-600 h-2 bg-sand-200 rounded-lg appearance-none cursor-pointer"
                              />

                              <div className="flex gap-2">
                                <button
                                  onClick={() => setFastSaleValues(prev => ({ ...prev, [p.produitId]: 0 }))}
                                  className="flex-1 py-1.5 text-xs font-medium bg-white border border-sand-200 rounded-lg text-sand-600 hover:bg-sand-50 transition-colors"
                                >
                                  0
                                </button>
                                <button
                                  onClick={() => setFastSaleValues(prev => ({ ...prev, [p.produitId]: p.stockDebut }))}
                                  className={`flex-1 py-1.5 text-xs font-medium border rounded-lg transition-colors ${isFull ? 'bg-terracotta-600 text-white border-terracotta-600' : 'bg-terracotta-50 text-terracotta-700 border-terracotta-100 hover:bg-terracotta-100'}`}
                                >
                                  Tout
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-4 mt-2 border-t border-sand-100 bg-white">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                      <div className="text-sm text-sand-500">
                        <strong>{Object.keys(fastSaleValues).length}</strong> produits configurés
                      </div>
                      <div className="flex gap-3 w-full md:w-auto">
                        <button
                          onClick={() => {
                            // Tout vendre
                            const allSold: Record<string, number> = {};
                            stockJour.produits.forEach(p => allSold[p.produitId] = p.stockDebut);
                            setFastSaleValues(allSold);
                          }}
                          className="px-4 py-2 text-terracotta-600 hover:bg-terracotta-50 rounded-lg transition-colors font-medium text-sm"
                        >
                          Tout Vendre (100%)
                        </button>
                        <button
                          onClick={() => setShowStartFastSaleConfirm(true)}
                          className="bg-sand-900 hover:bg-sand-800 text-white px-6 py-2 rounded-lg shadow-sm font-semibold flex items-center gap-2 transition-all w-full md:w-auto justify-center"
                        >
                          <Icon icon="mdi:check-all" className="text-xl" />
                          Valider et Clôturer
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <ConfirmModal
              isOpen={showStartFastSaleConfirm}
              onClose={() => setShowStartFastSaleConfirm(false)}
              onConfirm={async () => {
                try {
                  await validerVenteDirecte(dateActuelle, fastSaleValues);
                  setShowFastSaleModal(false);
                  setFastSaleValues({});
                } catch (e) {
                  // Erreur gérée
                  console.error(e);
                }
              }}
              title="Confirmer la validation rapide"
              message={
                <div>
                  <p>Vous êtes sur le point de valider les ventes pour toute la journée.</p>
                  <p className="text-sm text-sand-500 mt-2">Cela va :</p>
                  <ul className="text-sm text-sand-500 list-disc list-inside">
                    <li>Basculer en mode "Journée Continue"</li>
                    <li>Enregistrer les ventes saisies</li>
                    <li>Clôturer la journée boutique</li>
                  </ul>
                </div>
              }
              confirmText="Valider et Clôturer"
              type="warning"
            />

            {/* Modal d'ajout manuel */}
            {showAddProductModal && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-elevated w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
                  <h3 className="font-display text-xl font-semibold text-sand-900 mb-4 flex items-center gap-2">
                    <Icon icon="mdi:plus-box" className="text-info-600" />
                    Ajouter un produit au stock
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-sand-700 mb-1">Produit</label>
                      <select
                        value={selectedProductToAdd}
                        onChange={(e) => setSelectedProductToAdd(e.target.value)}
                        className="w-full px-4 py-2 border border-sand-300 rounded-lg focus:ring-2 focus:ring-info-500 focus:border-transparent"
                      >
                        <option value="">Sélectionner un produit...</option>
                        {produits.map(p => (
                          <option key={p.id} value={p.id}>{p.nom}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-sand-700 mb-1">Quantité à ajouter</label>
                      <input
                        type="number"
                        min="1"
                        value={quantityToAdd || ''}
                        onChange={(e) => setQuantityToAdd(parseInt(e.target.value) || 0)}
                        className="w-full px-4 py-2 border border-sand-300 rounded-lg focus:ring-2 focus:ring-info-500 focus:border-transparent"
                      />
                      <p className="text-xs text-sand-500 mt-1">
                        Cette quantité sera ajoutée au stock existant et propagée aux équipes actives.
                      </p>
                    </div>

                    <div className="pt-4 border-t border-sand-100">
                      <div className="flex items-center gap-2 mb-3">
                        <input
                          type="checkbox"
                          id="isSold"
                          checked={isSold}
                          onChange={(e) => setIsSold(e.target.checked)}
                          className="rounded text-info-600 focus:ring-info-500"
                        />
                        <label htmlFor="isSold" className="text-sm font-medium text-sand-900">
                          Enregistrer une vente immédiatement ?
                        </label>
                      </div>

                      {isSold && (
                        <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                          <div>
                            <label className="block text-sm font-medium text-sand-700 mb-1">Quantité vendue</label>
                            <input
                              type="number"
                              min="1"
                              max={quantityToAdd}
                              value={soldQuantity || ''}
                              onChange={(e) => setSoldQuantity(parseInt(e.target.value) || 0)}
                              className="w-full px-4 py-2 border border-sand-300 rounded-lg focus:ring-2 focus:ring-info-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-sand-700 mb-1">Période</label>
                            <select
                              value={soldPeriod}
                              onChange={(e) => setSoldPeriod(e.target.value as 'matin' | 'soir')}
                              className="w-full px-4 py-2 border border-sand-300 rounded-lg focus:ring-2 focus:ring-info-500 focus:border-transparent"
                            >
                              <option value="matin">Matin</option>
                              <option value="soir">Soir</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                      <button
                        onClick={() => {
                          setShowAddProductModal(false);
                          setSelectedProductToAdd('');
                          setQuantityToAdd(0);
                          setIsSold(false);
                          setSoldQuantity(0);
                        }}
                        className="px-4 py-2 text-sand-600 hover:bg-sand-100 rounded-lg transition-colors"
                      >
                        Annuler
                      </button>
                      <button
                        disabled={isLoading || !selectedProductToAdd || quantityToAdd <= 0 || (isSold && soldQuantity <= 0)}
                        onClick={async () => {
                          try {
                            await ajouterProduitManuel(
                              dateActuelle,
                              selectedProductToAdd,
                              quantityToAdd,
                              isSold ? soldQuantity : 0,
                              isSold ? soldPeriod : undefined
                            );
                            setShowAddProductModal(false);
                            setSelectedProductToAdd('');
                            setQuantityToAdd(0);
                            setIsSold(false);
                            setSoldQuantity(0);
                          } catch (error) {
                            console.error('Erreur ajout:', error);
                            alert('Erreur lors de l\'ajout du produit');
                          }
                        }}
                        className="px-4 py-2 bg-info-600 text-white rounded-lg hover:bg-info-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {isLoading ? (
                          <>
                            <Icon icon="mdi:loading" className="animate-spin" />
                            <span>Ajout...</span>
                          </>
                        ) : (
                          "Confirmer l'ajout"
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-sand-600">
                    Stock créé le {stockJour.createdAt.toLocaleString('fr-FR')}
                    {stockJour.updatedAt.getTime() !== stockJour.createdAt.getTime() && (
                      <span className="text-info-600">
                        {' • Mis à jour le '} {stockJour.updatedAt.toLocaleString('fr-FR')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Tableau simple et clair */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-sand-200">
                        <th className="text-left py-3 px-4 font-medium text-sand-700">Produit</th>
                        <th className="text-center py-3 px-4 font-medium text-sand-700">Quantité</th>
                        <th className="text-center py-3 px-4 font-medium text-sand-700">Car 1M</th>
                        <th className="text-center py-3 px-4 font-medium text-sand-700">Car 2M</th>
                        <th className="text-center py-3 px-4 font-medium text-sand-700">Car S</th>
                        <th className="text-center py-3 px-4 font-medium text-sand-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stockJour.produits.map((produit) => (
                        <tr key={produit.produitId} className="border-b border-sand-100 hover:bg-sand-50">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <Icon
                                icon={getProductIcon(produit.produit?.nom || produit.produitId)}
                                className="text-sand-600"
                              />
                              <span className="font-medium text-sand-900 uppercase">
                                {produit.produit?.nom || produit.produitId}
                              </span>
                            </div>
                          </td>
                          <td className="text-center py-3 px-4">
                            <span className="font-semibold text-sand-900">{produit.stockDebut}</span>
                          </td>
                          <td className="text-center py-3 px-4 text-sand-600">
                            {produit.repartitionCars?.car1_matin || '—'}
                          </td>
                          <td className="text-center py-3 px-4 text-sand-600">
                            {produit.repartitionCars?.car2_matin || '—'}
                          </td>
                          <td className="text-center py-3 px-4 text-sand-600">
                            {produit.repartitionCars?.car_soir || '—'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={() => {
                                  setProductToEdit({
                                    id: produit.produitId,
                                    nom: produit.produit?.nom || 'Produit inconnu',
                                    quantity: produit.stockDebut
                                  });
                                  setNewQuantity(produit.stockDebut);
                                }}
                                className="p-1 text-sand-400 hover:text-info-500 hover:bg-info-50 rounded transition-colors"
                                title="Modifier la quantité"
                              >
                                <Icon icon="mdi:pencil-outline" />
                              </button>
                              <button
                                onClick={() => {
                                  setProductToDelete({
                                    id: produit.produitId,
                                    nom: produit.produit?.nom || 'Produit inconnu'
                                  });
                                  setShowDeleteConfirm(true);
                                }}
                                className="p-1 text-sand-400 hover:text-danger-500 hover:bg-danger-50 rounded transition-colors"
                                title="Supprimer du stock"
                              >
                                <Icon icon="mdi:trash-can-outline" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}


        {/* Flux des 2 équipes */}
        {stockJour && (
          <div className="space-y-4 sm:space-y-6">
            {/* Indicateur de progression */}
            <div className="bg-white rounded-2xl border border-sand-200 shadow-card">
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-sand-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-info-100 rounded-lg flex items-center justify-center shrink-0">
                    <Icon icon="mdi:timeline" className="text-base sm:text-lg text-info-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base sm:text-lg font-semibold text-sand-900 truncate">Flux Journalier Boutique</h2>
                    <p className="text-xs sm:text-sm text-sand-500 truncate">Suivi des équipes matin et soir avec passage de relais</p>
                  </div>
                </div>
              </div>
              <div className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 p-3 sm:p-4 bg-sand-50 rounded-lg">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
                    <div className="flex items-center gap-2 text-xs sm:text-sm font-medium">
                      <Icon icon="wi:sunrise" className="text-sand-600 shrink-0" />
                      <span className="shrink-0">Équipe Matin:</span>
                      <span className={
                        !equipeMatin ? 'text-sand-500' :
                          equipeMatin.statut === 'en_cours' ? 'text-info-600' :
                            'text-success-600'
                      }>
                        {!equipeMatin ? 'Non commencée' :
                          equipeMatin.statut === 'en_cours' ? 'En cours' :
                            'Terminée'}
                      </span>
                    </div>

                    {!stockJour.isJourneeContinue && (
                      <>
                        <div className="hidden sm:block w-px h-6 bg-sand-300"></div>

                        <div className="flex items-center gap-2 text-xs sm:text-sm font-medium">
                          <Icon icon="wi:sunset" className="text-sand-600 shrink-0" />
                          <span className="shrink-0">Équipe Soir:</span>
                          <span className={
                            !equipeSoir ? 'text-sand-500' :
                              equipeSoir.statut === 'en_cours' ? 'text-info-600' :
                                'text-success-600'
                          }>
                            {!equipeSoir ? 'Non commencée' :
                              equipeSoir.statut === 'en_cours' ? 'En cours' :
                                'Terminée'}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {ventesJour && (
                    <div className="text-left sm:text-right w-full sm:w-auto">
                      <p className="text-xs sm:text-sm text-sand-600">Total vendu</p>
                      <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 sm:gap-0">
                        <p className="text-base sm:text-lg font-semibold text-sand-900">
                          {ventesJour.produits.reduce((total, p) => total + p.venduTotal, 0)} pièces
                        </p>
                        <p className="text-xs sm:text-sm font-semibold text-success-600">
                          {ventesJour.produits.reduce((total, p) => {
                            const prix = p.produit?.prixBoutique || p.produit?.prixUnitaire || 0;
                            return total + (p.venduTotal * prix);
                          }, 0).toLocaleString('fr-FR')} CFA
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Équipe Matin */}
            <div className="bg-white rounded-2xl border border-sand-200 shadow-card">
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-sand-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-warning-100 rounded-lg flex items-center justify-center shrink-0">
                    <Icon icon="wi:day-sunny" className="text-base sm:text-lg text-warning-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base sm:text-lg font-semibold text-sand-900 truncate">
                      {stockJour.isJourneeContinue
                        ? `Équipe Journée (Unique) - Vendeuse #${!equipeMatin ? 'À définir' : equipeMatin.vendeuse}`
                        : `Équipe Matin - Vendeuse #${!equipeMatin ? 'À définir' : equipeMatin.vendeuse}`
                      }
                    </h2>
                    <p className="text-xs sm:text-sm text-sand-500 truncate">
                      {stockJour.isJourneeContinue
                        ? "Service complet (Journée continue) - Stock initial complet"
                        : "Service du matin (jusqu'à 14h) - Stock initial de la production"
                      }
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-4 sm:p-6">
                {!equipeMatin ? (
                  <div className="space-y-3 sm:space-y-4">
                    <input
                      type="text"
                      placeholder="Entrez le nom de la vendeuse du matin"
                      value={vendeuseMatin}
                      onChange={(e) => setVendeuseMatin(e.target.value)}
                      className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-sand-300 rounded-lg focus:ring-2 focus:ring-terracotta-500 focus:border-transparent text-sm sm:text-base"
                    />
                    <button
                      onClick={() => {
                        if (vendeuseMatin.trim()) {
                          commencerEquipeMatin(vendeuseMatin, dateActuelle);
                        }
                      }}
                      disabled={!vendeuseMatin.trim()}
                      className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-terracotta-600 hover:bg-terracotta-600 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm w-full sm:w-auto text-sm sm:text-base font-medium"
                    >
                      <Icon icon="mdi:play-circle" className="text-base sm:text-lg" />
                      <span>Commencer l'équipe matin</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Vendeuse: {equipeMatin.vendeuse}</p>
                        <p className="text-sm text-sand-600">
                          Statut: {equipeMatin.statut === 'termine' ? (
                            <span className="flex items-center gap-1 text-success-600">
                              <Icon icon="mdi:check-circle" className="text-sm" />
                              Terminé
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-warning-600">
                              <Icon icon="mdi:clock-outline" className="text-sm" />
                              En cours
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Affichage du total vendu pour la journée continue */}
                      {stockJour.isJourneeContinue && (
                        <div className="text-right mr-4">
                          <p className="text-sm text-sand-600 font-medium">Total Journée</p>
                          <div className="flex flex-col items-end">
                            <p className="text-lg font-semibold text-sand-900">
                              {equipeMatin.produits.reduce((total, p) => total + (p.vendu || 0), 0)} pièces
                            </p>
                            <p className="text-sm font-semibold text-success-600">
                              {equipeMatin.produits.reduce((total, p) => {
                                const prix = p.produit?.prixBoutique || p.produit?.prixUnitaire || 0;
                                return total + ((p.vendu || 0) * prix);
                              }, 0).toLocaleString('fr-FR')} CFA
                            </p>
                          </div>
                        </div>
                      )}

                      {equipeMatin.statut === 'en_cours' && (
                        <button
                          onClick={async () => {
                            if (stockJour.isJourneeContinue) {
                              setShowRepartitionModal(true);
                            } else {
                              try {
                                terminerEquipeMatin();
                                await sauvegarderEquipe('matin');
                              } catch (error) {
                                console.error('Erreur lors de la sauvegarde matin:', error);
                              }
                            }
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-success-600 hover:bg-success-600 text-white rounded-lg transition-all shadow-sm"
                        >
                          <Icon icon="mdi:check-circle" className="text-lg" />
                          <span className="font-medium">
                            {stockJour.isJourneeContinue ? 'Clôturer la journée' : "Terminer l'équipe matin"}
                          </span>
                        </button>
                      )}
                      {equipeMatin.statut === 'termine' && (
                        <button
                          onClick={async () => {
                            try {
                              rouvrirEquipeMatin();
                            } catch (error) {
                              console.error('Erreur lors de la réouverture:', error);
                            }
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-white border border-warning-100 text-warning-600 rounded-lg hover:bg-warning-50 transition-all shadow-sm"
                        >
                          <Icon icon="mdi:pencil" className="text-lg" />
                          <span className="font-medium">Modifier (Réouvrir)</span>
                        </button>
                      )}
                    </div>

                    {/* Grille des ventes matin/journee */}
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-sand-200">
                        <Icon icon={mode === 'avance' ? 'mdi:cash-register' : 'mdi:pencil-outline'} className="text-gold-600" />
                        <h3 className="text-lg font-semibold text-sand-800">
                          {mode === 'avance'
                            ? (stockJour.isJourneeContinue ? 'Ventes de la journée (caisse)' : 'Ventes matinales (caisse)')
                            : (stockJour.isJourneeContinue ? 'Saisie des ventes journée' : 'Saisie des ventes matinales')}
                        </h3>
                        {mode === 'avance' && equipeMatin.statut === 'en_cours' && (
                          <button
                            onClick={handleSyncPos}
                            disabled={syncingPos}
                            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold-50 text-gold-700 hover:bg-gold-100 border border-gold-100 text-xs font-semibold transition-colors disabled:opacity-50"
                          >
                            <Icon icon={syncingPos ? 'mdi:loading' : 'mdi:sync'} className={`text-base ${syncingPos ? 'animate-spin' : ''}`} />
                            Synchroniser la caisse
                          </button>
                        )}
                      </div>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {equipeMatin.produits.map((produit) => (
                          <div
                            key={produit.produitId}
                            className="group relative bg-terracotta-50 border border-warning-100 rounded-xl p-4 hover:border-warning-100 hover:shadow-elevated transition-all"
                          >
                            {/* Bouton de suppression rapide */}
                            <button
                              onClick={() => {
                                setProductToDelete({
                                  id: produit.produitId,
                                  nom: produit.produit?.nom || 'Produit inconnu'
                                });
                                setShowDeleteConfirm(true);
                              }}
                              className="absolute top-2 right-2 p-1.5 text-warning-500 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                              title="Supprimer du stock"
                            >
                              <Icon icon="mdi:close-circle-outline" className="text-lg" />
                            </button>
                            <div className="flex items-center gap-3 mb-4">
                              <div className="w-12 h-12 bg-terracotta-500 rounded-xl flex items-center justify-center shadow-md">
                                <Icon
                                  icon={getProductIcon(produit.produit?.nom || '')}
                                  className="text-xl text-white"
                                />
                              </div>
                              <div className="flex-1">
                                <div className="flex flex-wrap items-start gap-1 mb-1 min-h-[2.5rem]">
                                  <h4 className="font-semibold text-sand-900 break-words mr-1 line-clamp-2 uppercase">
                                    {produit.produit?.nom || produit.produitId}
                                  </h4>
                                  {produit.produit?.categorie && (
                                    <span className={`text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded-full border ${produit.produit.categorie === 'boulangerie'
                                      ? 'bg-warning-50 text-warning-600 border-warning-100'
                                      : 'bg-danger-50 text-danger-700 border-danger-100'
                                      }`}>
                                      {produit.produit.categorie === 'boulangerie' ? 'Boulangerie' : 'Viennoiserie'}
                                    </span>
                                  )}
                                  {produit.produit?.reconduisible && (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded-full bg-success-50 text-success-700 border border-success-100">
                                      <Icon icon="mdi:recycle" className="text-xs" />
                                      Reconduisible
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm text-sand-600">Stock: {produit.stockDebut} pièces</div>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-sand-700">
                                  {stockJour.isJourneeContinue ? 'Vendu Total:' : 'Vendu matin:'}
                                </label>
                                {mode === 'classique' ? (
                                  <input
                                    type="number"
                                    min="0"
                                    max={produit.stockDebut}
                                    value={produit.vendu || ''}
                                    onChange={(e) => saisirVenteMatin(produit.produitId, parseInt(e.target.value) || 0)}
                                    disabled={equipeMatin.statut === 'termine'}
                                    className="w-20 px-3 py-2 border border-sand-300 rounded-lg focus:ring-2 focus:ring-terracotta-500 focus:border-transparent disabled:bg-sand-50"
                                  />
                                ) : (
                                  <span
                                    title="Quantité vendue en caisse (POS)"
                                    className="inline-flex items-center gap-1.5 min-w-[5rem] px-3 py-2 border border-sand-200 rounded-lg bg-white text-sand-900 font-semibold tabular-nums"
                                  >
                                    <Icon icon="mdi:cash-register" className="text-sm text-gold-600" />
                                    {produit.vendu || 0}
                                  </span>
                                )}
                              </div>
                              <div className="text-sm">
                                <span className="text-sand-600">
                                  {stockJour.isJourneeContinue ? 'Invendu final: ' : 'Reste: '}
                                </span>
                                <span className="font-semibold text-info-600">{produit.reste} pièces</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Passage de relais (Uniquement si mode normal et pas journée continue) */}
            {equipeMatin?.statut === 'termine' && !equipeSoir && !stockJour.isJourneeContinue && (
              <div className="bg-white rounded-2xl border border-sand-200 shadow-card">
                <div className="px-6 py-4 border-b border-sand-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-info-100 rounded-lg flex items-center justify-center">
                      <Icon icon="mdi:handshake" className="text-lg text-info-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-sand-900">Passage de Relais Matin → Soir</h2>
                      <p className="text-sm text-sand-500">Transmission du stock restant du matin à l'équipe soir</p>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <div className="bg-info-50 border border-info-100 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-info-500 rounded-lg flex items-center justify-center">
                        <Icon icon="mdi:account-switch" className="text-white" />
                      </div>
                      <h3 className="font-semibold text-info-600 text-lg">Stock transmis par {equipeMatin.vendeuse}</h3>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {equipeMatin.produits.map((produit) => (
                        <div key={produit.produitId} className="bg-white rounded-xl p-4 border border-info-100 shadow-sm">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-8 h-8 bg-terracotta-500 rounded-lg flex items-center justify-center">
                              <Icon
                                icon={getProductIcon(produit.produit?.nom || '')}
                                className="text-white text-sm"
                              />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-sm text-sand-900 uppercase">{produit.produit?.nom || produit.produitId}</p>
                              <p className="text-xs text-sand-500">Stock pour le soir</p>
                            </div>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-semibold text-info-600">{produit.reste}</p>
                            <p className="text-xs text-sand-500">pièces</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Équipe Soir (Uniquement si mode normal et pas journée continue) */}
            {equipeMatin?.statut === 'termine' && !stockJour.isJourneeContinue && (
              <div className="bg-white rounded-2xl border border-sand-200 shadow-card">
                <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-sand-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-terracotta-100 rounded-lg flex items-center justify-center shrink-0">
                      <Icon icon="wi:sunset" className="text-base sm:text-lg text-terracotta-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base sm:text-lg font-semibold text-sand-900 truncate">
                        Équipe Soir - Vendeuse #{!equipeSoir ? 'À définir' : equipeSoir.vendeuse}
                      </h2>
                      <p className="text-xs sm:text-sm text-sand-500 truncate">Service du soir (après 14h) - Stock = Reste du matin</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 sm:p-6">
                  {!equipeSoir ? (
                    <div className="space-y-3 sm:space-y-4">
                      <input
                        type="text"
                        placeholder="Entrez le nom de la vendeuse du soir"
                        value={vendeuseSoir}
                        onChange={(e) => setVendeuseSoir(e.target.value)}
                        className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-sand-300 rounded-lg focus:ring-2 focus:ring-terracotta-500 focus:border-transparent text-sm sm:text-base"
                      />
                      <button
                        onClick={() => {
                          if (vendeuseSoir.trim()) {
                            commencerEquipeSoir(vendeuseSoir, dateActuelle);
                          }
                        }}
                        disabled={!vendeuseSoir.trim()}
                        className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-terracotta-600 hover:bg-terracotta-600 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm w-full sm:w-auto text-sm sm:text-base font-medium"
                      >
                        <Icon icon="mdi:play-circle" className="text-base sm:text-lg" />
                        <span>Commencer l'équipe soir</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Vendeuse: {equipeSoir.vendeuse}</p>
                          <p className="text-sm text-sand-600">
                            Statut: {equipeSoir.statut === 'termine' ? (
                              <span className="flex items-center gap-1 text-success-600">
                                <Icon icon="mdi:check-circle" className="text-sm" />
                                Terminé
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-warning-600">
                                <Icon icon="mdi:clock-outline" className="text-sm" />
                                En cours
                              </span>
                            )}
                          </p>
                        </div>
                        {equipeSoir.statut === 'en_cours' && (
                          <button
                            onClick={() => setShowRepartitionModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-success-600 hover:bg-success-600 text-white rounded-lg transition-all shadow-sm"
                          >
                            <Icon icon="mdi:check-circle" className="text-lg" />
                            <span className="font-medium">Terminer l'équipe soir</span>
                          </button>
                        )}
                        {equipeSoir.statut === 'termine' && (
                          <button
                            onClick={async () => {
                              try {
                                rouvrirEquipeSoir();
                              } catch (error) {
                                console.error('Erreur lors de la réouverture:', error);
                              }
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-terracotta-100 text-terracotta-700 rounded-lg hover:bg-terracotta-50 transition-all shadow-sm"
                          >
                            <Icon icon="mdi:pencil" className="text-lg" />
                            <span className="font-medium">Modifier</span>
                          </button>
                        )}

                      </div>

                      {/* Grille des ventes soir */}
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-sand-200">
                          <Icon icon={mode === 'avance' ? 'mdi:cash-register' : 'mdi:pencil-outline'} className="text-gold-600" />
                          <h3 className="text-lg font-semibold text-sand-800">{mode === 'avance' ? 'Ventes du soir (caisse)' : 'Saisie des ventes du soir'}</h3>
                          {mode === 'avance' && equipeSoir.statut === 'en_cours' && (
                            <button
                              onClick={handleSyncPos}
                              disabled={syncingPos}
                              className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold-50 text-gold-700 hover:bg-gold-100 border border-gold-100 text-xs font-semibold transition-colors disabled:opacity-50"
                            >
                              <Icon icon={syncingPos ? 'mdi:loading' : 'mdi:sync'} className={`text-base ${syncingPos ? 'animate-spin' : ''}`} />
                              Synchroniser la caisse
                            </button>
                          )}
                        </div>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                          {equipeSoir.produits.map((produit) => (
                            <div
                              key={produit.produitId}
                              className="group relative bg-terracotta-50 border border-terracotta-100 rounded-xl p-4 hover:border-terracotta-100 hover:shadow-elevated transition-all"
                            >
                              {/* Bouton de suppression rapide */}
                              <button
                                onClick={() => {
                                  setProductToDelete({
                                    id: produit.produitId,
                                    nom: produit.produit?.nom || 'Produit inconnu'
                                  });
                                  setShowDeleteConfirm(true);
                                }}
                                className="absolute top-2 right-2 p-1.5 text-terracotta-300 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                title="Supprimer du stock"
                              >
                                <Icon icon="mdi:close-circle-outline" className="text-lg" />
                              </button>
                              <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 bg-terracotta-500 rounded-xl flex items-center justify-center shadow-md">
                                  <Icon
                                    icon={getProductIcon(produit.produit?.nom || '')}
                                    className="text-xl text-white"
                                  />
                                </div>
                                <div className="flex-1">
                                  <div className="flex flex-wrap items-start gap-1 mb-1 min-h-[2.5rem]">
                                    <h4 className="font-semibold text-sand-900 break-words mr-1 line-clamp-2 uppercase">
                                      {produit.produit?.nom || produit.produitId}
                                    </h4>
                                    {produit.produit?.categorie && (
                                      <span className={`text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded-full border ${produit.produit.categorie === 'boulangerie'
                                        ? 'bg-warning-50 text-warning-600 border-warning-100'
                                        : 'bg-danger-50 text-danger-700 border-danger-100'
                                        }`}>
                                        {produit.produit.categorie === 'boulangerie' ? 'Boulangerie' : 'Viennoiserie'}
                                      </span>
                                    )}
                                    {produit.produit?.reconduisible && (
                                      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded-full bg-success-50 text-success-700 border border-success-100">
                                        <Icon icon="mdi:recycle" className="text-xs" />
                                        Reconduisible
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-sm text-sand-600">Stock début: {produit.stockDebut} pièces</div>
                                </div>
                              </div>

                              <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                  <label className="text-sm font-medium text-sand-700">Vendu soir:</label>
                                  {mode === 'classique' ? (
                                    <input
                                      type="number"
                                      min="0"
                                      max={produit.stockDebut}
                                      value={produit.vendu || ''}
                                      onChange={(e) => saisirVenteSoir(produit.produitId, parseInt(e.target.value) || 0)}
                                      disabled={equipeSoir.statut === 'termine'}
                                      className="w-20 px-3 py-2 border border-sand-300 rounded-lg focus:ring-2 focus:ring-terracotta-500 focus:border-transparent disabled:bg-sand-50"
                                    />
                                  ) : (
                                    <span
                                      title="Quantité vendue en caisse (POS)"
                                      className="inline-flex items-center gap-1.5 min-w-[5rem] px-3 py-2 border border-sand-200 rounded-lg bg-white text-sand-900 font-semibold tabular-nums"
                                    >
                                      <Icon icon="mdi:cash-register" className="text-sm text-gold-600" />
                                      {produit.vendu || 0}
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm">
                                  <span className="text-sand-600">Invendu: </span>
                                  <span className="font-semibold text-danger-600">{produit.reste} pièces</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Récapitulatif des 2 équipes */}
            {ventesJour && (
              <div className="bg-white rounded-2xl border border-sand-200 shadow-card">
                <div className="px-6 py-4 border-b border-sand-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-success-100 rounded-lg flex items-center justify-center">
                      <Icon icon="mdi:chart-timeline" className="text-lg text-success-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-sand-900">
                        {stockJour?.isJourneeContinue ? 'Bilan Journalier - Service Continu' : 'Bilan Journalier - Performance des 2 Vendeuses'}
                      </h2>
                      <p className="text-sm text-sand-500">
                        {stockJour?.isJourneeContinue ? 'Récapitulatif des ventes de la journée unique' : 'Récapitulatif complet des ventes matin et soir'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <div className="space-y-6">
                    {/* KPI Cards style dashboard */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                      <div className="bg-white border border-sand-200 rounded-xl p-3 sm:p-4 shadow-sm hover:shadow-elevated transition-all">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 mb-2">
                          <div className="w-10 h-10 bg-info-100 rounded-lg flex items-center justify-center shrink-0">
                            <Icon icon="mdi:package-variant" className="text-lg sm:text-xl text-info-600" />
                          </div>
                          <div className="text-left sm:text-right w-full sm:w-auto">
                            <div className="font-display text-2xl sm:text-3xl font-semibold text-sand-900">
                              {ventesJour.produits.reduce((total, p) => total + p.stockDebut, 0)}
                            </div>
                            <div className="text-sand-500 text-xs">pièces</div>
                          </div>
                        </div>
                        <div className="text-sm sm:text-base font-semibold text-sand-700 truncate">Stock Initial</div>
                      </div>

                      <div className="bg-white border border-sand-200 rounded-xl p-3 sm:p-4 shadow-sm hover:shadow-elevated transition-all">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 mb-2">
                          <div className="w-10 h-10 bg-success-100 rounded-lg flex items-center justify-center shrink-0">
                            <Icon icon="mdi:chart-line" className="text-lg sm:text-xl text-success-600" />
                          </div>
                          <div className="text-left sm:text-right w-full sm:w-auto">
                            <div className="font-display text-2xl sm:text-3xl font-semibold text-sand-900">
                              {ventesJour.produits.reduce((total, p) => total + p.venduTotal, 0)}
                            </div>
                            <div className="text-sand-500 text-xs">pièces</div>
                          </div>
                        </div>
                        <div className="text-sm sm:text-base font-semibold text-sand-700 truncate">Total Vendu</div>
                      </div>

                      <div className="bg-white border border-sand-200 rounded-xl p-3 sm:p-4 shadow-sm hover:shadow-elevated transition-all">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 mb-2">
                          <div className="w-10 h-10 bg-danger-100 rounded-lg flex items-center justify-center shrink-0">
                            <Icon icon="mdi:package-down" className="text-lg sm:text-xl text-danger-600" />
                          </div>
                          <div className="text-left sm:text-right w-full sm:w-auto">
                            <div className="font-display text-2xl sm:text-3xl font-semibold text-sand-900">
                              {ventesJour.produits.reduce((total, p) => total + p.invenduBoutique, 0)}
                            </div>
                            <div className="text-sand-500 text-xs">pièces</div>
                          </div>
                        </div>
                        <div className="text-sm sm:text-base font-semibold text-sand-700 truncate">Invendus</div>
                      </div>

                      <div className="bg-white border border-sand-200 rounded-xl p-3 sm:p-4 shadow-sm hover:shadow-elevated transition-all">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 mb-2">
                          <div className="w-10 h-10 bg-terracotta-100 rounded-lg flex items-center justify-center shrink-0">
                            <Icon icon="mdi:percent" className="text-lg sm:text-xl text-terracotta-600" />
                          </div>
                          <div className="text-left sm:text-right w-full sm:w-auto">
                            <div className="font-display text-2xl sm:text-3xl font-semibold text-sand-900">
                              {Math.round((ventesJour.produits.reduce((total, p) => total + p.venduTotal, 0) / ventesJour.produits.reduce((total, p) => total + p.stockDebut, 0)) * 100)}%
                            </div>
                            <div className="text-sand-500 text-xs">taux</div>
                          </div>
                        </div>
                        <div className="text-sm sm:text-base font-semibold text-sand-700 truncate">Taux de Vente</div>
                      </div>
                    </div>

                    {/* Performance par vendeuse */}
                    <div className={`grid grid-cols-1 ${stockJour.isJourneeContinue ? '' : 'md:grid-cols-2'} gap-6`}>
                      {/* Vendeuse Matin / Unique */}
                      <div className={`bg-terracotta-50 border border-warning-100 rounded-xl p-6 ${stockJour.isJourneeContinue ? 'max-w-2xl mx-auto w-full' : ''}`}>
                        <h4 className="flex items-center gap-3 font-semibold text-warning-600 mb-4">
                          <div className="w-8 h-8 bg-terracotta-500 rounded-lg flex items-center justify-center">
                            <Icon icon={stockJour.isJourneeContinue ? "mdi:account-star" : "wi:sunrise"} className="text-white" />
                          </div>
                          {equipeMatin?.vendeuse} - {stockJour.isJourneeContinue ? 'Service Journée' : 'Équipe Matin'}
                        </h4>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-sm text-sand-600">Ventes totales :</span>
                            <span className="font-semibold text-warning-600">
                              {ventesJour.produits.reduce((total, p) => total + p.venduMatin, 0)} pcs
                            </span>
                          </div>
                          {stockJour.isJourneeContinue ? (
                            <>
                              <div className="flex justify-between">
                                <span className="text-sm text-sand-600">Restants (à reconduire) :</span>
                                <span className="font-medium text-success-600">
                                  {ventesJour.produits.reduce((total, p) => total + (p.restants || 0), 0)} pcs
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-sm text-sand-600">Invendus (Pertes) :</span>
                                <span className="font-medium text-danger-600">
                                  {ventesJour.produits.reduce((total, p) => total + (p.pertes || 0), 0)} pcs
                                </span>
                              </div>
                            </>
                          ) : (
                            <div className="flex justify-between">
                              <span className="text-sm text-sand-600">Transmis au soir :</span>
                              <span className="font-medium text-info-600">
                                {ventesJour.produits.reduce((total, p) => total + p.resteMidi, 0)} pcs
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Vendeuse Soir (Uniquement si mode normal) */}
                      {!stockJour.isJourneeContinue && (
                        <div className="bg-terracotta-50 border border-terracotta-100 rounded-xl p-6">
                          <h4 className="flex items-center gap-3 font-semibold text-terracotta-700 mb-4">
                            <div className="w-8 h-8 bg-terracotta-500 rounded-lg flex items-center justify-center">
                              <Icon icon="wi:sunset" className="text-white" />
                            </div>
                            {equipeSoir?.vendeuse} - Équipe Soir
                          </h4>
                          <div className="space-y-3">
                            <div className="flex justify-between">
                              <span className="text-sm text-sand-600">Ventes totales :</span>
                              <span className="font-semibold text-terracotta-700">
                                {ventesJour.produits.reduce((total, p) => total + p.venduSoir, 0)} pcs
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-sand-600">Restants (à reconduire) :</span>
                              <span className="font-medium text-success-600">
                                {ventesJour.produits.reduce((total, p) => total + (p.restants || 0), 0)} pcs
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-sand-600">Invendus (Pertes) :</span>
                              <span className="font-medium text-danger-600">
                                {ventesJour.produits.reduce((total, p) => total + (p.pertes || 0), 0)} pcs
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Tableau détaillé moderne */}
                    <div className="bg-sand-50 rounded-xl p-6">
                      <div className="flex items-center gap-2 pb-4 border-b border-sand-200 mb-6">
                        <Icon icon="mdi:table-large" className="text-sand-500" />
                        <h3 className="text-lg font-semibold text-sand-900">Détail par produit</h3>
                      </div>
                      <div className="grid gap-4">
                        {ventesJour.produits.map((produit) => (
                          <div
                            key={produit.produitId}
                            className="bg-white rounded-xl p-4 border border-sand-200 hover:shadow-elevated transition-all"
                          >
                            <div className="grid grid-cols-2 md:grid-cols-10 gap-4 items-center">
                              <div className="md:col-span-2">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-sand-800 rounded-lg flex items-center justify-center">
                                    <Icon
                                      icon={getProductIcon(produit.produit?.nom || produit.produitId)}
                                      className="text-white text-sm"
                                    />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="font-medium text-sand-900 text-sm uppercase">
                                      {produit.produit?.nom || produit.produitId}
                                    </span>
                                    {produit.produit?.categorie && (
                                      <span className={`text-[9px] uppercase font-semibold tracking-wider w-fit px-1.5 py-0.5 rounded-full mt-1 border ${produit.produit.categorie === 'boulangerie'
                                        ? 'bg-warning-50 text-warning-600 border-warning-100'
                                        : 'bg-danger-50 text-danger-700 border-danger-100'
                                        }`}>
                                        {produit.produit.categorie === 'boulangerie' ? 'Boulangerie' : 'Viennoiserie'}
                                      </span>
                                    )}
                                    {produit.produit?.reconduisible && (
                                      <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold tracking-wide px-1.5 py-0.5 rounded-full mt-1 bg-success-50 text-success-700 border border-success-100">
                                        <Icon icon="mdi:recycle" className="text-[10px]" />
                                        Reconduisible
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="text-center">
                                <div className="text-lg font-semibold text-sand-800">{produit.stockDebut}</div>
                                <div className="text-xs text-sand-500">Stock</div>
                              </div>
                              <div className="text-center">
                                <div className="text-lg font-semibold text-sand-900">{produit.venduMatin}</div>
                                <div className="text-xs text-terracotta-600 font-medium">
                                  {stockJour.isJourneeContinue ? 'Vendu' : `Matin (${equipeMatin?.vendeuse || '—'})`}
                                </div>
                              </div>
                              {!stockJour.isJourneeContinue && (
                                <>
                                  <div className="text-center">
                                    <div className="text-lg font-semibold text-info-600">{produit.resteMidi}</div>
                                    <div className="text-xs text-sand-500">Transmis soir</div>
                                  </div>
                                  <div className="text-center">
                                    <div className="text-lg font-semibold text-sand-900">{produit.venduSoir}</div>
                                    <div className="text-xs text-terracotta-600 font-medium">
                                      Soir ({equipeSoir?.vendeuse || '—'})
                                    </div>
                                  </div>
                                </>
                              )}
                              <div className="text-center">
                                <div className="text-lg font-semibold text-success-600">{produit.restants || 0}</div>
                                <div className="text-xs text-sand-500">Restants</div>
                              </div>
                              <div className="text-center">
                                <div className="text-lg font-semibold text-danger-600">{produit.pertes || 0}</div>
                                <div className="text-xs text-sand-500">Invendus</div>
                              </div>
                              <div className="text-center">
                                <div className="text-lg font-semibold text-success-600">{produit.venduTotal}</div>
                                <div className="text-xs text-sand-500">Total vendu</div>
                              </div>
                              <div className="flex justify-center gap-2">
                                <button
                                  onClick={() => {
                                    setProductToEdit({
                                      id: produit.produitId,
                                      nom: produit.produit?.nom || 'Produit inconnu',
                                      quantity: produit.stockDebut
                                    });
                                    setNewQuantity(produit.stockDebut);
                                  }}
                                  className="p-1 text-sand-400 hover:text-info-500 hover:bg-info-50 rounded transition-colors"
                                  title="Modifier la quantité"
                                >
                                  <Icon icon="mdi:pencil-outline" />
                                </button>
                                <button
                                  onClick={() => {
                                    setProductToDelete({
                                      id: produit.produitId,
                                      nom: produit.produit?.nom || 'Produit inconnu'
                                    });
                                    setShowDeleteConfirm(true);
                                  }}
                                  className="p-1 text-sand-400 hover:text-danger-500 hover:bg-danger-50 rounded transition-colors"
                                  title="Supprimer la ligne"
                                >
                                  <Icon icon="mdi:trash-can-outline" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setProductToDelete(null);
        }}
        onConfirm={async () => {
          if (productToDelete) {
            try {
              await supprimerProduitStock(dateActuelle, productToDelete.id);
              setShowDeleteConfirm(false);
              setProductToDelete(null);
            } catch (e) {
              console.error("Erreur suppression:", e);
              // Optionnel: Notification d'erreur
            }
          }
        }}
        title="Supprimer du stock"
        message={`Voulez-vous vraiment supprimer "${productToDelete?.nom}" du stock du jour ? Cette action est irréversible.`}
        confirmText="Supprimer"
        cancelText="Annuler"
        type="danger"
      />

      {/* Modal de modification de quantité */}
      {productToEdit && (
        <ConfirmModal
          isOpen={!!productToEdit}
          onClose={() => {
            setProductToEdit(null);
            setNewQuantity(0);
          }}
          onConfirm={async () => {
            if (productToEdit && newQuantity >= 0) {
              try {
                await modifierQuantiteStock(dateActuelle, productToEdit.id, newQuantity);
                setProductToEdit(null);
                setNewQuantity(0);
              } catch (e) {
                console.error("Erreur modification:", e);
                alert("Erreur lors de la modification");
              }
            }
          }}
          title="Modifier la quantité"
          message={
            <div className="space-y-4">
              <p>Modifier le stock initial pour <strong>{productToEdit.nom}</strong> :</p>
              <input
                type="number"
                min="0"
                className="w-full px-4 py-2 border border-sand-300 rounded-lg focus:ring-2 focus:ring-info-500 focus:border-transparent"
                value={newQuantity}
                onChange={(e) => setNewQuantity(parseInt(e.target.value) || 0)}
                autoFocus
              />
              <p className="text-xs text-sand-500">
                Cette modification ajustera automatiquement les stocks des équipes matin et soir.
              </p>
            </div>
          }
          confirmText="Enregistrer"
          cancelText="Annuler"
          type="info"
        />
      )}

      {/* Modal de répartition des invendus */}
      {(equipeSoir || (equipeMatin && stockJour?.isJourneeContinue)) && showRepartitionModal && (
        <RepartitionInvendusModal
          isOpen={showRepartitionModal}
          onClose={() => setShowRepartitionModal(false)}
          onConfirm={async (repartition) => {
            try {
              if (stockJour?.isJourneeContinue) {
                await terminerEquipeMatinAvecRepartition(repartition);
              } else {
                await terminerEquipeSoirAvecRepartition(repartition);
              }
              setShowRepartitionModal(false);
            } catch (error) {
              console.error('Erreur lors de la clôture:', error);
              alert('Erreur lors de la clôture. Veuillez réessayer.');
            }
          }}
          produits={stockJour?.isJourneeContinue ? equipeMatin!.produits : equipeSoir!.produits}
        />
      )}
    </div>
  );
};