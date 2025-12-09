import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useRapportStore } from '../../store';

export const RapportJournalier: React.FC = () => {
  const {
    rapportJour,
    indicateurs,
    historiqueRapports,
    genererRapportJour,
    validerRapport,
    chargerRapport,
    chargerHistorique,
    isLoading
  } = useRapportStore();

  const [dateSelectionnee, setDateSelectionnee] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [modeAffichage, setModeAffichage] = useState<'jour' | 'historique'>('jour');

  const handleGenererRapport = async () => {
    try {
      console.log('🔄 Début génération rapport pour:', dateSelectionnee);
      await genererRapportJour(new Date(dateSelectionnee));
      console.log('✅ Rapport généré avec succès');
    } catch (error) {
      console.error('❌ Erreur lors de la génération du rapport:', error);
      alert('Erreur lors de la génération du rapport: ' + error);
    }
  };

  const handleChargerHistorique = () => {
    const today = new Date();
    const lastWeek = new Date();
    lastWeek.setDate(today.getDate() - 7);
    chargerHistorique(lastWeek, today);
  };

  useEffect(() => {
    // Charger le rapport existant si disponible
    chargerRapport(new Date(dateSelectionnee));
  }, [dateSelectionnee, chargerRapport]);

  // Fonction pour obtenir la couleur selon le taux de vente
  const getTauxVenteColor = (taux: number) => {
    if (taux >= 90) return 'from-green-500 to-emerald-600';
    if (taux >= 75) return 'from-yellow-500 to-orange-500';
    return 'from-red-500 to-rose-600';
  };

  const getTauxVenteBadgeColor = (taux: number) => {
    if (taux >= 90) return 'bg-green-100 text-green-800';
    if (taux >= 75) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header moderne type Odoo */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <Icon icon="mdi:chart-bar" className="text-2xl text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Rapport Journalier
              </h1>
              <p className="text-sm text-gray-500">
                Bilan complet des activités de la journée
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setModeAffichage(modeAffichage === 'jour' ? 'historique' : 'jour')}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Icon icon={modeAffichage === 'jour' ? 'mdi:history' : 'mdi:calendar-today'} className="text-lg" />
              <span className="font-medium">{modeAffichage === 'jour' ? 'Historique' : 'Rapport du jour'}</span>
            </button>

            {modeAffichage === 'jour' && (
              <>
                <button
                  onClick={handleGenererRapport}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <Icon icon="mdi:cogs" className="text-lg" />
                  <span className="font-medium">Générer le rapport</span>
                </button>
                {rapportJour && rapportJour.statut === 'genere' && (
                  <button
                    onClick={() => validerRapport()}
                    className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg"
                  >
                    <Icon icon="mdi:check-circle" className="text-lg" />
                    <span className="font-medium">Valider le rapport</span>
                  </button>
                )}
              </>
            )}

            {modeAffichage === 'historique' && (
              <button
                onClick={handleChargerHistorique}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <Icon icon="mdi:download" className="text-lg" />
                <span className="font-medium">Charger les 7 derniers jours</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Sélection de date - uniquement en mode jour */}
        {modeAffichage === 'jour' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <Icon icon="mdi:calendar" className="text-lg text-purple-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Date du rapport</h2>
            </div>
            <div className="flex items-center gap-4">
              <input
                type="date"
                value={dateSelectionnee}
                onChange={(e) => setDateSelectionnee(e.target.value)}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 font-medium"
              />
              <div className="text-sm text-gray-500">
                Rapport pour {new Date(dateSelectionnee).toLocaleDateString('fr-FR', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </div>
            </div>
          </div>
        )}

        {/* Indicateurs de performance - KPI Cards */}
        {modeAffichage === 'jour' && indicateurs && (
          <div className="space-y-6">
            {/* KPI Cards principales */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <Icon icon="mdi:chart-line" className="text-2xl text-white" />
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold">
                      {indicateurs.tauxVenteGlobal.toFixed(1)}%
                    </div>
                    <div className="text-gray-300 text-xs">global</div>
                  </div>
                </div>
                <div className="text-lg font-semibold">Taux de Vente Global</div>
              </div>

              <div className="bg-gradient-to-br from-gray-600 to-gray-700 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <Icon icon="mdi:account-group" className="text-2xl text-white" />
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold">
                      {indicateurs.tauxVenteClients.toFixed(1)}%
                    </div>
                    <div className="text-gray-300 text-xs">clients</div>
                  </div>
                </div>
                <div className="text-lg font-semibold">Taux Vente Clients</div>
              </div>

              <div className="bg-gradient-to-br from-gray-500 to-gray-600 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <Icon icon="mdi:storefront" className="text-2xl text-white" />
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold">
                      {indicateurs.tauxVenteBoutique.toFixed(1)}%
                    </div>
                    <div className="text-gray-300 text-xs">boutique</div>
                  </div>
                </div>
                <div className="text-lg font-semibold">Taux Vente Boutique</div>
              </div>
            </div>

            {/* KPI Cards pertes */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <Icon icon="mdi:package-down" className="text-2xl text-white" />
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold">
                      {indicateurs.pertesTotales}
                    </div>
                    <div className="text-gray-300 text-xs">pièces</div>
                  </div>
                </div>
                <div className="text-lg font-semibold">Pertes Totales</div>
              </div>

              <div className="bg-gradient-to-br from-gray-600 to-gray-700 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <Icon icon="mdi:account-cancel" className="text-2xl text-white" />
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold">
                      {indicateurs.pertesClients}
                    </div>
                    <div className="text-gray-300 text-xs">clients</div>
                  </div>
                </div>
                <div className="text-lg font-semibold">Invendus Clients</div>
              </div>

              <div className="bg-gradient-to-br from-gray-500 to-gray-600 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <Icon icon="mdi:storefront-outline" className="text-2xl text-white" />
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold">
                      {indicateurs.pertesBoutique}
                    </div>
                    <div className="text-gray-300 text-xs">boutique</div>
                  </div>
                </div>
                <div className="text-lg font-semibold">Invendus Boutique</div>
              </div>
            </div>
          </div>
        )}

        {/* Historique des rapports */}
        {modeAffichage === 'historique' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Icon icon="mdi:history" className="text-lg text-purple-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Historique des Rapports</h2>
                  <p className="text-sm text-gray-500">Rapports des derniers jours</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              {historiqueRapports.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Icon icon="mdi:file-document-outline" className="text-4xl text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Aucun rapport trouvé
                  </h3>
                  <p className="text-gray-500 mb-6">
                    Cliquez sur "Charger les 7 derniers jours" pour voir l'historique
                  </p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {historiqueRapports.map((rapport) => (
                    <div key={rapport.id} className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-6 hover:border-purple-300 hover:shadow-md transition-all">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                            <Icon icon="mdi:file-document" className="text-purple-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              {new Date(rapport.date).toLocaleDateString('fr-FR', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </h3>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                rapport.statut === 'valide'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {rapport.statut}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getTauxVenteBadgeColor(rapport.totaux.tauxVenteGlobal)}`}>
                            {rapport.totaux.tauxVenteGlobal.toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center">
                          <div className="text-lg font-bold text-gray-800">{rapport.totaux.quantiteProduite}</div>
                          <div className="text-xs text-gray-600">Produite</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-green-600">{rapport.totaux.quantiteVendueTotal}</div>
                          <div className="text-xs text-gray-600">Vendue</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-red-600">{rapport.totaux.pertesTotales}</div>
                          <div className="text-xs text-gray-600">Pertes</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-blue-600">{rapport.totaux.tauxVenteGlobal.toFixed(1)}%</div>
                          <div className="text-xs text-gray-600">Taux vente</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Rapport détaillé */}
        {modeAffichage === 'jour' && rapportJour ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Icon icon="mdi:clipboard-list" className="text-lg text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Rapport Détaillé par Produit</h2>
                  <p className="text-sm text-gray-500">
                    Rapport du {new Date(rapportJour.date).toLocaleDateString('fr-FR')} - Statut: {rapportJour.statut}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6">
              {/* Résumé total */}
              <div className="bg-gray-50 rounded-xl p-6 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <Icon icon="mdi:chart-box" className="text-gray-600" />
                  <h3 className="font-semibold text-gray-800">Totaux de la journée</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-800">{rapportJour.totaux.quantitePrevue}</div>
                    <div className="text-sm text-gray-600">Prévu</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{rapportJour.totaux.quantiteProduite}</div>
                    <div className="text-sm text-gray-600">Produite</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{rapportJour.totaux.quantiteVendueTotal}</div>
                    <div className="text-sm text-gray-600">Vendue</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{rapportJour.totaux.invendusTotal}</div>
                    <div className="text-sm text-gray-600">Invendus</div>
                  </div>
                </div>
              </div>

              {/* Grille des produits */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                  <Icon icon="mdi:view-grid" className="text-gray-500" />
                  <h3 className="text-lg font-semibold text-gray-800">Détail par produit</h3>
                  <span className="ml-auto text-sm font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
                    {rapportJour.produits.length} produit{rapportJour.produits.length > 1 ? 's' : ''}
                  </span>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {rapportJour.produits.map((produit) => (
                    <div
                      key={produit.produitId}
                      className="bg-gradient-to-br from-white to-gray-50 border border-gray-200 rounded-xl p-6 hover:border-blue-300 hover:shadow-md transition-all"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                            <Icon icon="mdi:food-variant" className="text-white" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900 text-sm">
                              {produit.produit?.nom || produit.produitId}
                            </h4>
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTauxVenteBadgeColor(produit.tauxVenteGlobal)}`}>
                          {produit.tauxVenteGlobal.toFixed(1)}%
                        </span>
                      </div>

                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-4 text-center">
                          <div>
                            <div className="text-lg font-bold text-gray-800">{produit.quantitePrevue}</div>
                            <div className="text-xs text-gray-600">Prévu</div>
                          </div>
                          <div>
                            <div className="text-lg font-bold text-blue-600">{produit.quantiteProduite}</div>
                            <div className="text-xs text-gray-600">Produite</div>
                          </div>
                        </div>

                        <div className="border-t border-gray-200 pt-3">
                          <div className="grid grid-cols-3 gap-3 text-center">
                            <div>
                              <div className="text-sm font-bold text-green-600">{produit.quantiteVendueTotal}</div>
                              <div className="text-xs text-gray-600">Total vendu</div>
                            </div>
                            <div>
                              <div className="text-sm font-bold text-green-500">{produit.quantiteVendueClients}</div>
                              <div className="text-xs text-gray-600">Clients</div>
                            </div>
                            <div>
                              <div className="text-sm font-bold text-green-400">{produit.quantiteVendueBoutique}</div>
                              <div className="text-xs text-gray-600">Boutique</div>
                            </div>
                          </div>
                        </div>

                        <div className="bg-red-50 rounded-lg p-3 text-center">
                          <div className="text-lg font-bold text-red-600">{produit.invendusTotal}</div>
                          <div className="text-xs text-gray-600">Invendus total</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : modeAffichage === 'jour' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-6">
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icon icon="mdi:chart-bar" className="text-4xl text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Aucun rapport généré
                </h3>
                <p className="text-gray-500 mb-6">
                  Cliquez sur "Générer le rapport" pour créer le rapport de la journée
                </p>
                <button
                  onClick={handleGenererRapport}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all shadow-md"
                >
                  <Icon icon="mdi:cogs" className="text-lg" />
                  <span className="font-medium">Générer le rapport</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};