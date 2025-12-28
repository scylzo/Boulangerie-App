import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { useBoutiqueStore } from '../../store';

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
    terminerEquipeSoir,
    sauvegarderEquipe,
    calculerVentesBoutique,
    sauvegarderVentes,
    chargerEquipe,
    chargerVentes
  } = useBoutiqueStore();

  const [vendeuseMatin, setVendeuseMatin] = useState('');
  const [vendeuseSoir, setVendeuseSoir] = useState('');
  const [dateSelectionnee, setDateSelectionnee] = useState(
    new Date().toISOString().split('T')[0]
  );

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

        console.log('✅ Toutes les données chargées');
      } catch (error) {
        console.error('❌ Erreur lors du chargement automatique:', error);
      }
    };

    chargerDonneesAutomatiquement();
  }, [dateSelectionnee]);

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header moderne type Odoo */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-r from-amber-600 to-orange-600 rounded-lg flex items-center justify-center">
              <Icon icon="mdi:store" className="text-2xl text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Gestion Boutique
              </h1>
              <p className="text-sm text-gray-500">
                Suivi des ventes matin et soir
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Widget de sélection de date moderne */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
              <Icon icon="mdi:calendar" className="text-lg text-amber-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Date de service</h2>
          </div>
          <div className="flex items-center gap-4">
            <input
              type="date"
              value={dateSelectionnee}
              onChange={(e) => setDateSelectionnee(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-gray-900 font-medium"
            />
            <div className="text-sm text-gray-500">
              Service boutique pour {new Date(dateSelectionnee).toLocaleDateString('fr-FR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
          </div>
        </div>

        {/* État du chargement ou absence de stock */}
        {!stockJour && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Icon icon="mdi:package-variant" className="text-lg text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Stock de départ</h2>
                  <p className="text-sm text-gray-500">Chargement automatique des produits destinés à la boutique</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="text-center py-12">
                {isLoading ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-gray-600 font-medium">Chargement du stock de production...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Icon icon="mdi:calendar-clock" className="text-4xl text-gray-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        Stock non disponible
                      </h3>
                      <p className="text-gray-500 mb-6">
                        Aucune quantité boutique définie pour le {new Date(dateSelectionnee).toLocaleDateString('fr-FR')}
                      </p>
                      <div className="bg-blue-50 rounded-lg p-4 text-sm text-gray-700 space-y-1">
                        <p className="font-semibold text-blue-800 mb-2">Pour activer la boutique :</p>
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
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <Icon icon="mdi:package-check" className="text-lg text-green-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Stock de départ - {new Date(stockJour.date).toLocaleDateString('fr-FR')}
                  </h2>
                  <p className="text-sm text-gray-500">{stockJour.produits.length} produit(s) reçu(s) de la production</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-600">
                    Stock créé le {stockJour.createdAt.toLocaleString('fr-FR')}
                    {stockJour.updatedAt.getTime() !== stockJour.createdAt.getTime() && (
                      <span className="text-blue-600">
                        {' • Mis à jour le '} {stockJour.updatedAt.toLocaleString('fr-FR')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Tableau simple et clair */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Produit</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-700">Quantité</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-700">Car 1M</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-700">Car 2M</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-700">Car S</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stockJour.produits.map((produit) => (
                        <tr key={produit.produitId} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <Icon
                                icon={getProductIcon(produit.produit?.nom || '')}
                                className="text-gray-600"
                              />
                              <span className="font-medium text-gray-900">
                                {produit.produit?.nom || produit.produitId}
                              </span>
                            </div>
                          </td>
                          <td className="text-center py-3 px-4">
                            <span className="font-bold text-gray-900">{produit.stockDebut}</span>
                          </td>
                          <td className="text-center py-3 px-4 text-gray-600">
                            {produit.repartitionCars?.car1_matin || '—'}
                          </td>
                          <td className="text-center py-3 px-4 text-gray-600">
                            {produit.repartitionCars?.car2_matin || '—'}
                          </td>
                          <td className="text-center py-3 px-4 text-gray-600">
                            {produit.repartitionCars?.car_soir || '—'}
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
          <div className="space-y-6">
            {/* Indicateur de progression */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Icon icon="mdi:timeline" className="text-lg text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Flux Journalier Boutique</h2>
                    <p className="text-sm text-gray-500">Suivi des équipes matin et soir avec passage de relais</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Icon icon="wi:sunrise" className="text-gray-600" />
                      <span>Équipe Matin:</span>
                      <span className={
                        !equipeMatin ? 'text-gray-500' :
                        equipeMatin.statut === 'en_cours' ? 'text-blue-600' :
                        'text-green-600'
                      }>
                        {!equipeMatin ? 'Non commencée' :
                         equipeMatin.statut === 'en_cours' ? 'En cours' :
                         'Terminée'}
                      </span>
                    </div>

                    <div className="w-px h-6 bg-gray-300"></div>

                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Icon icon="wi:sunset" className="text-gray-600" />
                      <span>Équipe Soir:</span>
                      <span className={
                        !equipeSoir ? 'text-gray-500' :
                        equipeSoir.statut === 'en_cours' ? 'text-blue-600' :
                        'text-green-600'
                      }>
                        {!equipeSoir ? 'Non commencée' :
                         equipeSoir.statut === 'en_cours' ? 'En cours' :
                         'Terminée'}
                      </span>
                    </div>
                  </div>

                  {ventesJour && (
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Total vendu</p>
                      <p className="text-lg font-bold text-gray-900">
                        {ventesJour.produits.reduce((total, p) => total + p.venduTotal, 0)} pièces
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Équipe Matin */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Icon icon="wi:sunrise" className="text-lg text-orange-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      Équipe Matin - Vendeuse #{!equipeMatin ? 'À définir' : equipeMatin.vendeuse}
                    </h2>
                    <p className="text-sm text-gray-500">Service du matin (jusqu'à 14h) - Stock initial de la production</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                {!equipeMatin ? (
                  <div className="space-y-4">
                    <input
                      type="text"
                      placeholder="Entrez le nom de la vendeuse du matin"
                      value={vendeuseMatin}
                      onChange={(e) => setVendeuseMatin(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                    <button
                      onClick={() => {
                        if (vendeuseMatin.trim()) {
                          commencerEquipeMatin(vendeuseMatin, dateActuelle);
                        }
                      }}
                      disabled={!vendeuseMatin.trim()}
                      className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-lg hover:from-orange-700 hover:to-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                    >
                      <Icon icon="mdi:play-circle" className="text-lg" />
                      <span className="font-medium">Commencer l'équipe matin</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Vendeuse: {equipeMatin.vendeuse}</p>
                        <p className="text-sm text-gray-600">
                          Statut: {equipeMatin.statut === 'termine' ? (
                            <span className="flex items-center gap-1 text-green-600">
                              <Icon icon="mdi:check-circle" className="text-sm" />
                              Terminé
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-orange-600">
                              <Icon icon="mdi:clock-outline" className="text-sm" />
                              En cours
                            </span>
                          )}
                        </p>
                      </div>
                      {equipeMatin.statut === 'en_cours' && (
                        <button
                          onClick={async () => {
                            try {
                              terminerEquipeMatin();
                              await sauvegarderEquipe('matin');
                            } catch (error) {
                              console.error('Erreur lors de la sauvegarde matin:', error);
                            }
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all shadow-md"
                        >
                          <Icon icon="mdi:check-circle" className="text-lg" />
                          <span className="font-medium">Terminer l'équipe matin</span>
                        </button>
                      )}
                    </div>

                    {/* Grille des ventes matin */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                        <Icon icon="mdi:view-grid" className="text-gray-500" />
                        <h3 className="text-lg font-semibold text-gray-800">Saisie des ventes matinales</h3>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {equipeMatin.produits.map((produit) => (
                          <div
                            key={produit.produitId}
                            className="bg-gradient-to-br from-orange-50 to-red-50 border border-orange-200 rounded-xl p-4 hover:border-orange-300 hover:shadow-md transition-all"
                          >
                            <div className="flex items-center gap-3 mb-4">
                              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center shadow-md">
                                <Icon
                                  icon={getProductIcon(produit.produit?.nom || '')}
                                  className="text-xl text-white"
                                />
                              </div>
                              <div className="flex-1">
                                <h4 className="font-semibold text-gray-900 mb-1">
                                  {produit.produit?.nom || produit.produitId}
                                </h4>
                                <div className="text-sm text-gray-600">Stock: {produit.stockDebut} pièces</div>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-gray-700">Vendu matin:</label>
                                <input
                                  type="number"
                                  min="0"
                                  max={produit.stockDebut}
                                  value={produit.vendu}
                                  onChange={(e) =>
                                    saisirVenteMatin(produit.produitId, parseInt(e.target.value) || 0)
                                  }
                                  className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                  disabled={equipeMatin.statut === 'termine'}
                                />
                              </div>
                              <div className="text-sm">
                                <span className="text-gray-600">Reste midi: </span>
                                <span className="font-bold text-blue-600">{produit.reste} pièces</span>
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

            {/* Passage de relais */}
            {equipeMatin?.statut === 'termine' && !equipeSoir && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Icon icon="mdi:handshake" className="text-lg text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">Passage de Relais Matin → Soir</h2>
                      <p className="text-sm text-gray-500">Transmission du stock restant du matin à l'équipe soir</p>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                        <Icon icon="mdi:account-switch" className="text-white" />
                      </div>
                      <h3 className="font-semibold text-blue-800 text-lg">Stock transmis par {equipeMatin.vendeuse}</h3>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {equipeMatin.produits.map((produit) => (
                        <div key={produit.produitId} className="bg-white rounded-xl p-4 border border-blue-200 shadow-sm">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                              <Icon
                                icon={getProductIcon(produit.produit?.nom || '')}
                                className="text-white text-sm"
                              />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-sm text-gray-900">{produit.produit?.nom || produit.produitId}</p>
                              <p className="text-xs text-gray-500">Stock pour le soir</p>
                            </div>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-bold text-blue-600">{produit.reste}</p>
                            <p className="text-xs text-gray-500">pièces</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Équipe Soir */}
            {equipeMatin?.statut === 'termine' && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                      <Icon icon="wi:sunset" className="text-lg text-indigo-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">
                        Équipe Soir - Vendeuse #{!equipeSoir ? 'À définir' : equipeSoir.vendeuse}
                      </h2>
                      <p className="text-sm text-gray-500">Service du soir (après 14h) - Stock = Reste du matin</p>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  {!equipeSoir ? (
                    <div className="space-y-4">
                      <input
                        type="text"
                        placeholder="Entrez le nom de la vendeuse du soir"
                        value={vendeuseSoir}
                        onChange={(e) => setVendeuseSoir(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                      <button
                        onClick={() => {
                          if (vendeuseSoir.trim()) {
                            commencerEquipeSoir(vendeuseSoir, dateActuelle);
                          }
                        }}
                        disabled={!vendeuseSoir.trim()}
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                      >
                        <Icon icon="mdi:play-circle" className="text-lg" />
                        <span className="font-medium">Commencer l'équipe soir</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Vendeuse: {equipeSoir.vendeuse}</p>
                          <p className="text-sm text-gray-600">
                            Statut: {equipeSoir.statut === 'termine' ? (
                              <span className="flex items-center gap-1 text-green-600">
                                <Icon icon="mdi:check-circle" className="text-sm" />
                                Terminé
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-orange-600">
                                <Icon icon="mdi:clock-outline" className="text-sm" />
                                En cours
                              </span>
                            )}
                          </p>
                        </div>
                        {equipeSoir.statut === 'en_cours' && (
                          <button
                            onClick={async () => {
                              try {
                                terminerEquipeSoir();
                                calculerVentesBoutique();
                                await sauvegarderEquipe('soir');

                                // Attendre un peu pour que les ventes soient calculées
                                await new Promise(resolve => setTimeout(resolve, 100));
                                await sauvegarderVentes();
                              } catch (error) {
                                console.error('Erreur lors de la finalisation:', error);
                              }
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all shadow-md"
                          >
                            <Icon icon="mdi:check-circle" className="text-lg" />
                            <span className="font-medium">Terminer l'équipe soir</span>
                          </button>
                        )}
                      </div>

                      {/* Grille des ventes soir */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                          <Icon icon="mdi:view-grid" className="text-gray-500" />
                          <h3 className="text-lg font-semibold text-gray-800">Saisie des ventes du soir</h3>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                          {equipeSoir.produits.map((produit) => (
                            <div
                              key={produit.produitId}
                              className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-md transition-all"
                            >
                              <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center shadow-md">
                                  <Icon
                                    icon={getProductIcon(produit.produit?.nom || '')}
                                    className="text-xl text-white"
                                  />
                                </div>
                                <div className="flex-1">
                                  <h4 className="font-semibold text-gray-900 mb-1">
                                    {produit.produit?.nom || produit.produitId}
                                  </h4>
                                  <div className="text-sm text-gray-600">Stock début: {produit.stockDebut} pièces</div>
                                </div>
                              </div>

                              <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                  <label className="text-sm font-medium text-gray-700">Vendu soir:</label>
                                  <input
                                    type="number"
                                    min="0"
                                    max={produit.stockDebut}
                                    value={produit.vendu}
                                    onChange={(e) =>
                                      saisirVenteSoir(produit.produitId, parseInt(e.target.value) || 0)
                                    }
                                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    disabled={equipeSoir.statut === 'termine'}
                                  />
                                </div>
                                <div className="text-sm">
                                  <span className="text-gray-600">Invendu: </span>
                                  <span className="font-bold text-red-600">{produit.reste} pièces</span>
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
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                      <Icon icon="mdi:chart-timeline" className="text-lg text-green-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">Bilan Journalier - Performance des 2 Vendeuses</h2>
                      <p className="text-sm text-gray-500">Récapitulatif complet des ventes matin et soir</p>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <div className="space-y-6">
                    {/* KPI Cards style dashboard */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <div className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105">
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                            <Icon icon="mdi:package-variant" className="text-2xl text-white" />
                          </div>
                          <div className="text-right">
                            <div className="text-3xl font-bold">
                              {ventesJour.produits.reduce((total, p) => total + p.stockDebut, 0)}
                            </div>
                            <div className="text-gray-300 text-xs">pièces</div>
                          </div>
                        </div>
                        <div className="text-lg font-semibold">Stock Initial</div>
                      </div>

                      <div className="bg-gradient-to-br from-gray-600 to-gray-700 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105">
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                            <Icon icon="mdi:chart-line" className="text-2xl text-white" />
                          </div>
                          <div className="text-right">
                            <div className="text-3xl font-bold">
                              {ventesJour.produits.reduce((total, p) => total + p.venduTotal, 0)}
                            </div>
                            <div className="text-gray-300 text-xs">pièces</div>
                          </div>
                        </div>
                        <div className="text-lg font-semibold">Total Vendu</div>
                      </div>

                      <div className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105">
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                            <Icon icon="mdi:package-down" className="text-2xl text-white" />
                          </div>
                          <div className="text-right">
                            <div className="text-3xl font-bold">
                              {ventesJour.produits.reduce((total, p) => total + p.invenduBoutique, 0)}
                            </div>
                            <div className="text-gray-300 text-xs">pièces</div>
                          </div>
                        </div>
                        <div className="text-lg font-semibold">Invendus</div>
                      </div>

                      <div className="bg-gradient-to-br from-gray-600 to-gray-700 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105">
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                            <Icon icon="mdi:percent" className="text-2xl text-white" />
                          </div>
                          <div className="text-right">
                            <div className="text-3xl font-bold">
                              {Math.round((ventesJour.produits.reduce((total, p) => total + p.venduTotal, 0) / ventesJour.produits.reduce((total, p) => total + p.stockDebut, 0)) * 100)}%
                            </div>
                            <div className="text-gray-300 text-xs">taux</div>
                          </div>
                        </div>
                        <div className="text-lg font-semibold">Taux de Vente</div>
                      </div>
                    </div>

                    {/* Performance par vendeuse */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Vendeuse Matin */}
                      <div className="bg-gradient-to-br from-orange-50 to-red-50 border border-orange-200 rounded-xl p-6">
                        <h4 className="flex items-center gap-3 font-semibold text-orange-800 mb-4">
                          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                            <Icon icon="wi:sunrise" className="text-white" />
                          </div>
                          {equipeMatin?.vendeuse} - Équipe Matin
                        </h4>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Ventes totales :</span>
                            <span className="font-bold text-orange-700">
                              {ventesJour.produits.reduce((total, p) => total + p.venduMatin, 0)} pcs
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Transmis au soir :</span>
                            <span className="font-medium text-blue-600">
                              {ventesJour.produits.reduce((total, p) => total + p.resteMidi, 0)} pcs
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Vendeuse Soir */}
                      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-6">
                        <h4 className="flex items-center gap-3 font-semibold text-indigo-800 mb-4">
                          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
                            <Icon icon="wi:sunset" className="text-white" />
                          </div>
                          {equipeSoir?.vendeuse} - Équipe Soir
                        </h4>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Ventes totales :</span>
                            <span className="font-bold text-indigo-700">
                              {ventesJour.produits.reduce((total, p) => total + p.venduSoir, 0)} pcs
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Invendus finaux :</span>
                            <span className="font-medium text-red-600">
                              {ventesJour.produits.reduce((total, p) => total + p.invenduBoutique, 0)} pcs
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Tableau détaillé moderne */}
                    <div className="bg-gray-50 rounded-xl p-6">
                      <div className="flex items-center gap-2 pb-4 border-b border-gray-200 mb-6">
                        <Icon icon="mdi:table-large" className="text-gray-500" />
                        <h3 className="text-lg font-semibold text-gray-900">Détail par produit</h3>
                      </div>
                      <div className="grid gap-4">
                        {ventesJour.produits.map((produit) => (
                          <div
                            key={produit.produitId}
                            className="bg-white rounded-xl p-4 border border-gray-200 hover:shadow-md transition-all"
                          >
                            <div className="grid grid-cols-2 md:grid-cols-7 gap-4 items-center">
                              <div className="md:col-span-1">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-gradient-to-br from-gray-500 to-gray-700 rounded-lg flex items-center justify-center">
                                    <Icon
                                      icon={getProductIcon(produit.produit?.nom || '')}
                                      className="text-white text-sm"
                                    />
                                  </div>
                                  <span className="font-medium text-gray-900 text-sm">
                                    {produit.produit?.nom || produit.produitId}
                                  </span>
                                </div>
                              </div>
                              <div className="text-center">
                                <div className="text-lg font-bold text-gray-800">{produit.stockDebut}</div>
                                <div className="text-xs text-gray-500">Stock initial</div>
                              </div>
                              <div className="text-center">
                                <div className="text-lg font-bold text-orange-600">{produit.venduMatin}</div>
                                <div className="text-xs text-gray-500">Vendu matin</div>
                              </div>
                              <div className="text-center">
                                <div className="text-lg font-bold text-blue-600">{produit.resteMidi}</div>
                                <div className="text-xs text-gray-500">Transmis soir</div>
                              </div>
                              <div className="text-center">
                                <div className="text-lg font-bold text-indigo-600">{produit.venduSoir}</div>
                                <div className="text-xs text-gray-500">Vendu soir</div>
                              </div>
                              <div className="text-center">
                                <div className="text-lg font-bold text-red-600">{produit.invenduBoutique}</div>
                                <div className="text-xs text-gray-500">Invendu final</div>
                              </div>
                              <div className="text-center">
                                <div className="text-xl font-bold text-green-600">{produit.venduTotal}</div>
                                <div className="text-xs text-gray-500">Total vendu</div>
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
    </div>
  );
};