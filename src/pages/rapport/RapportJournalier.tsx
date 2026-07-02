import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useRapportStore } from '../../store';
import { downloadRapportJournalierPDF } from '../../utils/pdfGenerator';
import { formatCurrency } from '../../utils/currency';

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

  const handleDownloadPDF = async () => {
    if (!rapportJour) return;
    try {
      await downloadRapportJournalierPDF(rapportJour, indicateurs);
    } catch (error) {
      alert('Erreur lors du téléchargement du PDF');
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

  const getTauxVenteBadgeColor = (taux: number) => {
    if (taux >= 90) return 'bg-success-100 text-success-700';
    if (taux >= 75) return 'bg-warning-100 text-warning-600';
    return 'bg-danger-100 text-danger-700';
  };

  return (
    <div className="min-h-screen bg-sand-100">
      {/* Header */}
      <div className="bg-white border-b border-sand-200 px-3 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <div className="w-10 h-10 bg-terracotta-50 rounded-xl flex items-center justify-center shrink-0">
              <Icon icon="mdi:file-chart-outline" className="text-lg sm:text-2xl text-terracotta-600" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-base sm:text-2xl font-semibold text-sand-900 truncate">
                Rapport Journalier
              </h1>
              <p className="text-xs sm:text-sm text-sand-500 truncate">
                Bilan complet des activités de la journée
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <button
              onClick={() => setModeAffichage(modeAffichage === 'jour' ? 'historique' : 'jour')}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 text-sand-700 bg-white border border-sand-300 rounded-lg hover:bg-sand-50 transition-colors text-xs sm:text-sm font-medium"
            >
              <Icon icon={modeAffichage === 'jour' ? 'mdi:history' : 'mdi:calendar-today'} className="text-base sm:text-lg" />
              <span className="hidden sm:inline">{modeAffichage === 'jour' ? 'Historique' : 'Rapport du jour'}</span>
              <span className="sm:hidden">{modeAffichage === 'jour' ? 'Hist.' : 'Jour'}</span>
            </button>

            {modeAffichage === 'jour' && (
              <div className="flex flex-wrap items-center gap-2">
                {!rapportJour || rapportJour.statut === 'genere' ? (
                  <button
                    onClick={handleGenererRapport}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 transition-all shadow-sm disabled:opacity-50 text-xs sm:text-sm font-medium"
                  >
                    <Icon icon={isLoading ? "mdi:loading" : "mdi:refresh"} className={`text-base sm:text-lg ${isLoading ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">Générer le rapport</span>
                    <span className="sm:hidden">Générer</span>
                  </button>
                ) : (
                  <button
                    onClick={handleGenererRapport}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-4 py-2 text-terracotta-600 bg-terracotta-50 border border-terracotta-200 rounded-lg hover:bg-terracotta-100 transition-colors"
                  >
                    <Icon icon="mdi:refresh" className="text-lg" />
                    <span className="font-medium">Actualiser</span>
                  </button>
                )}

                {rapportJour && rapportJour.statut === 'genere' && (
                  <button
                    onClick={() => validerRapport()}
                    className="flex items-center gap-2 px-4 sm:px-6 py-2 bg-success-600 text-white rounded-lg hover:bg-success-700 transition-all shadow-sm text-xs sm:text-sm font-medium"
                  >
                    <Icon icon="mdi:check-circle" className="text-lg" />
                    <span className="font-medium">Valider</span>
                  </button>
                )}

                {rapportJour && (
                  <button
                    onClick={handleDownloadPDF}
                    className="flex items-center gap-2 px-4 py-2 text-sand-700 bg-white border border-sand-300 rounded-lg hover:bg-sand-50 transition-colors"
                  >
                    <Icon icon="mdi:file-pdf-box" className="text-lg text-danger-500" />
                    <span className="font-medium">PDF</span>
                  </button>
                )}
              </div>
            )}

            {modeAffichage === 'historique' && (
              <button
                onClick={handleChargerHistorique}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 text-sand-700 bg-white border border-sand-300 rounded-lg hover:bg-sand-50 transition-colors disabled:opacity-50"
              >
                <Icon icon="mdi:download" className="text-lg" />
                <span className="font-medium">Charger les 7 derniers jours</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Barre de contrôle par jour */}
        {modeAffichage === 'jour' && (
          <div className="bg-white rounded-xl border border-sand-200 p-3 sm:p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-terracotta-100 rounded-lg flex items-center justify-center text-terracotta-600">
                <Icon icon="mdi:calendar" className="text-xl" />
              </div>
              <div>
                <label className="text-xs font-semibold text-sand-500 uppercase tracking-wider block mb-1">
                  Date du rapport
                </label>
                <input
                  type="date"
                  value={dateSelectionnee}
                  onChange={(e) => setDateSelectionnee(e.target.value)}
                  className="bg-transparent border-none text-sand-900 font-bold focus:ring-0 p-0"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-sand-400 italic">
                {rapportJour ? `Dernière mise à jour : ${new Date().toLocaleTimeString('fr-FR')}` : "Aucune donnée chargée"}
              </span>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-sand-100 shadow-sm">
            <div className="w-16 h-16 border-4 border-terracotta-100 border-t-terracotta-600 rounded-full animate-spin mb-4" />
            <p className="text-sand-500 font-medium">Analyse des données en cours...</p>
          </div>
        ) : modeAffichage === 'jour' && rapportJour ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* KPI Cards */}
            {indicateurs && (
              <div className="space-y-8">
                <div className="space-y-12">
                  {/* SECTION BOUTIQUE */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 px-1">
                      <div className="w-10 h-10 bg-success-100 rounded-xl flex items-center justify-center text-success-600">
                        <Icon icon="mdi:storefront" className="text-2xl" />
                      </div>
                      <div>
                        <h2 className="font-display text-xl font-semibold text-sand-900">Performance Boutique</h2>
                        <p className="text-xs text-sand-500 uppercase tracking-widest font-semibold">Ventes directes & Rayon</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-white rounded-2xl p-6 shadow-sm border border-sand-100 hover:shadow-md transition-all group">
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 bg-success-50 rounded-2xl flex items-center justify-center text-success-600 group-hover:bg-success-600 group-hover:text-white transition-colors duration-300">
                            <Icon icon="mdi:chart-arc" className="text-2xl" />
                          </div>
                          <span className="px-3 py-1 bg-success-50 text-success-700 rounded-full text-xs font-bold font-mono">
                            {indicateurs.tauxVenteBoutique.toFixed(1)}%
                          </span>
                        </div>
                        <div className="text-2xl font-black text-sand-900 mb-1">{indicateurs.tauxVenteBoutique.toFixed(1)}%</div>
                        <div className="text-xs font-bold text-sand-400 uppercase tracking-wider">Taux de Vente</div>
                      </div>

                      <div className="bg-white rounded-2xl p-6 shadow-sm border border-sand-100 hover:shadow-md transition-all group">
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 bg-success-50 rounded-2xl flex items-center justify-center text-success-600 group-hover:bg-success-600 group-hover:text-white transition-colors duration-300">
                            <Icon icon="mdi:cash-register" className="text-2xl" />
                          </div>
                        </div>
                        <div className="text-2xl font-black text-sand-900 mb-1">{formatCurrency(indicateurs.valeurVenteBoutique)}</div>
                        <div className="text-xs font-bold text-sand-400 uppercase tracking-wider">Chiffre d'Affaires</div>
                      </div>

                      <div className="bg-white rounded-2xl p-6 shadow-sm border border-sand-100 hover:shadow-md transition-all group">
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 bg-success-50 rounded-2xl flex items-center justify-center text-success-600 group-hover:bg-success-600 group-hover:text-white transition-colors duration-300">
                            <Icon icon="mdi:package-variant" className="text-2xl" />
                          </div>
                          <div className="flex gap-1">
                            <span className="px-2 py-0.5 bg-danger-50 text-danger-600 rounded-md text-[10px] font-bold">-{indicateurs.pertesBoutique} u.</span>
                            <span className="px-2 py-0.5 bg-success-50 text-success-600 rounded-md text-[10px] font-bold">+{indicateurs.restantsBoutique} u.</span>
                          </div>
                        </div>
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-2xl font-black text-sand-900">{indicateurs.pertesBoutique + indicateurs.restantsBoutique}</span>
                          <span className="text-sand-400 text-sm font-medium">unités</span>
                        </div>
                        <div className="text-xs font-bold text-sand-400 uppercase tracking-wider">Invendus & Restants</div>
                      </div>
                    </div>
                  </div>

                  {/* SECTION CLIENTS */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 px-1 border-t border-sand-100 pt-8 text-info-600">
                      <div className="w-10 h-10 bg-info-100 rounded-xl flex items-center justify-center shadow-sm">
                        <Icon icon="mdi:account-group" className="text-2xl" />
                      </div>
                      <div>
                        <h2 className="font-display text-xl font-semibold text-sand-900">Performance Clients</h2>
                        <p className="text-xs text-sand-500 uppercase tracking-widest font-semibold">Livraisons & Grossistes</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-white rounded-2xl p-6 shadow-sm border border-sand-100 hover:shadow-md transition-all group font-jakarta">
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 bg-info-50 rounded-2xl flex items-center justify-center text-info-600 group-hover:bg-info-600 group-hover:text-white transition-colors duration-300">
                            <Icon icon="mdi:truck-delivery" className="text-2xl" />
                          </div>
                          <span className="px-3 py-1 bg-info-50 text-info-600 rounded-full text-xs font-bold font-mono">
                            {indicateurs.tauxVenteClients.toFixed(1)}%
                          </span>
                        </div>
                        <div className="text-2xl font-black text-sand-900 mb-1">{indicateurs.tauxVenteClients.toFixed(1)}%</div>
                        <div className="text-xs font-bold text-sand-400 uppercase tracking-wider">Taux de Vente</div>
                      </div>

                      <div className="bg-white rounded-2xl p-6 shadow-sm border border-sand-100 hover:shadow-md transition-all group font-jakarta">
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 bg-info-50 rounded-2xl flex items-center justify-center text-info-600 group-hover:bg-info-600 group-hover:text-white transition-colors duration-300">
                            <Icon icon="mdi:invoice-list" className="text-2xl" />
                          </div>
                        </div>
                        <div className="text-2xl font-black text-sand-900 mb-1">{formatCurrency(indicateurs.valeurVenteClients)}</div>
                        <div className="text-xs font-bold text-sand-400 uppercase tracking-wider">Chiffre d'Affaires</div>
                      </div>

                      <div className="bg-white rounded-2xl p-6 shadow-sm border border-sand-100 hover:shadow-md transition-all group font-jakarta">
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 bg-info-50 rounded-2xl flex items-center justify-center text-info-600 group-hover:bg-info-600 group-hover:text-white transition-colors duration-300">
                            <Icon icon="mdi:account-arrow-left" className="text-2xl" />
                          </div>
                          <span className="px-3 py-1 bg-warning-50 text-warning-600 rounded-full text-xs font-bold font-mono">
                            {indicateurs.pertesClients} u.
                          </span>
                        </div>
                        <div className="text-2xl font-black text-sand-900 mb-1">{indicateurs.pertesClients} unités</div>
                        <div className="text-xs font-bold text-sand-400 uppercase tracking-wider">Retours Clients</div>
                      </div>
                    </div>
                  </div>

                  {/* SECTION SYNTHÈSE GLOBALE */}
                  <div className="bg-sand-900 rounded-[2.5rem] p-8 sm:p-10 text-white shadow-xl relative overflow-hidden">
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-6 h-1 bg-terracotta-400 rounded-full"></span>
                          <span className="text-terracotta-300 text-xs font-black uppercase tracking-[0.2em]">Bilan Consolidé</span>
                        </div>
                        <h2 className="text-4xl sm:text-5xl font-black tracking-tight mb-2">
                          {formatCurrency(indicateurs.valeurVenteTotal)}
                        </h2>
                        <p className="text-terracotta-200 text-sm font-medium">Chiffre d'affaires total généré ce jour</p>
                      </div>

                      <div className="grid grid-cols-2 gap-8 md:border-l md:border-white/10 md:pl-12">
                        <div>
                          <div className="text-terracotta-400 text-[10px] font-black uppercase tracking-widest mb-1">Performance</div>
                          <div className="font-display text-2xl font-semibold">{indicateurs.tauxVenteGlobal.toFixed(1)}%</div>
                        </div>
                        <div>
                          <div className="text-terracotta-400 text-[10px] font-black uppercase tracking-widest mb-1">Report total</div>
                          <div className="font-display text-2xl font-semibold">{indicateurs.restantsTotaux} u.</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Détails par produit */}
            <div className="bg-white rounded-xl border border-sand-200 shadow-sm overflow-hidden">
              <div className="p-3 sm:p-6">
                <div className="bg-sand-50 rounded-xl p-3 sm:p-6 mb-6 sm:mb-8">
                  <h3 className="text-sm sm:text-base font-bold text-sand-800 mb-3 sm:mb-4 flex items-center gap-2">
                    <Icon icon="mdi:chart-box" className="text-base sm:text-lg" /> Totaux Quantités
                  </h3>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">

                    <div className="bg-white p-2 sm:p-3 rounded-lg border border-sand-100 text-center">
                      <div className="font-display text-base sm:text-xl font-semibold">{rapportJour.totaux.quantitePrevue}</div>
                      <div className="text-[10px] sm:text-xs text-sand-500 uppercase font-bold">Prévu</div>
                    </div>
                    <div className="bg-white p-2 sm:p-3 rounded-lg border border-sand-100 text-center">
                      <div className="font-display text-base sm:text-xl font-semibold text-info-600">{rapportJour.totaux.quantiteProduite}</div>
                      <div className="text-[10px] sm:text-xs text-sand-500 uppercase font-bold">Produit</div>
                    </div>
                    <div className="bg-white p-2 sm:p-3 rounded-lg border border-sand-100 text-center">
                      <div className="font-display text-base sm:text-xl font-semibold text-success-600">{rapportJour.totaux.quantiteVendueTotal}</div>
                      <div className="text-[10px] sm:text-xs text-sand-500 uppercase font-bold">Vendu</div>
                    </div>
                    <div className="bg-terracotta-50 p-2 sm:p-3 rounded-lg border border-terracotta-100 text-center col-span-2 sm:col-span-1">
                      <div className="text-sm sm:text-lg font-bold text-terracotta-700">{formatCurrency(rapportJour.totaux.valeurVenteTotal)}</div>
                      <div className="text-[10px] sm:text-xs text-terracotta-500 uppercase font-bold">Valeur</div>
                    </div>
                  </div>


                  {/* Ventilation détaillée des invendus */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-4 pt-4 border-t border-sand-100">
                    <div className="text-center group">
                      <div className="text-sm sm:text-lg font-black text-warning-600">{rapportJour.totaux.retoursClients || 0}</div>
                      <div className="text-[8px] sm:text-[9px] text-sand-400 uppercase font-bold tracking-tighter sm:tracking-normal group-hover:text-warning-500 transition-colors">Retours Clients</div>
                    </div>
                    <div className="text-center group">
                      <div className="text-sm sm:text-lg font-black text-danger-500">{rapportJour.totaux.pertesBoutique || 0}</div>
                      <div className="text-[8px] sm:text-[9px] text-sand-400 uppercase font-bold tracking-tighter sm:tracking-normal group-hover:text-danger-500 transition-colors">Invendus Boutique</div>
                    </div>
                    <div className="text-center group">
                      <div className="text-sm sm:text-lg font-black text-success-600">{rapportJour.totaux.restantsBoutique || 0}</div>
                      <div className="text-[8px] sm:text-[9px] text-sand-400 uppercase font-bold tracking-tighter sm:tracking-normal group-hover:text-success-500 transition-colors">Restants Boutique</div>
                    </div>
                  </div>
                </div>


                <div className="space-y-10">
                  {/* SECTION BOUTIQUE */}
                  {rapportJour.produits.some(p => p.destineBoutique) && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-success-100">
                        <Icon icon="mdi:storefront" className="text-success-600" />
                        <h3 className="text-lg font-semibold text-sand-800">Ventes Boutique</h3>
                      </div>

                      <div className="space-y-6">
                        {/* BOULANGERIE */}
                        {rapportJour.produits.filter(p => p.destineBoutique && (!p.produit?.categorie || p.produit.categorie === 'boulangerie')).length > 0 && (
                          <div>
                            <h4 className="text-xs font-bold text-sand-400 uppercase tracking-wider mb-3 flex items-center gap-2 border-b border-sand-100 pb-1">
                              <span className="text-lg">🥖</span> Boulangerie
                            </h4>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                              {rapportJour.produits.filter(p => p.destineBoutique && (!p.produit?.categorie || p.produit.categorie === 'boulangerie')).map((produit) => (
                                <div key={`boutique-${produit.produitId}`} className="bg-white border border-sand-200 rounded-xl p-6 hover:shadow-md transition-all">
                                  <div className="flex items-center justify-between mb-4">
                                    <div className="flex flex-col">
                                      <h4 className="font-semibold text-sand-900">{produit.produit?.nom || produit.produitId}</h4>
                                      <span className="text-xs font-bold text-success-600 bg-success-50 px-2 py-0.5 rounded w-fit mt-1">
                                        {formatCurrency(produit.valeurVenteBoutique)}
                                      </span>
                                    </div>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTauxVenteBadgeColor(produit.tauxVenteBoutique)}`}>
                                      {produit.tauxVenteBoutique.toFixed(1)}%
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-3 text-center">
                                    <div className="bg-sand-50 p-2 rounded-lg">
                                      <div className="text-lg font-bold">{produit.quantiteVendueBoutique + produit.invendusBoutique}</div>
                                      <div className="text-[10px] text-sand-500 uppercase">Stock</div>
                                    </div>
                                    <div className="bg-success-50 p-2 rounded-lg">
                                      <div className="text-lg font-bold text-success-700">{produit.quantiteVendueBoutique}</div>
                                      <div className="text-[10px] text-success-600 uppercase">Vendu</div>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 mt-3">
                                    <div className="bg-success-50 p-2 rounded-lg text-center">
                                      <div className="text-lg font-bold text-success-600">{produit.restantsBoutique || 0}</div>
                                      <div className="text-[10px] text-success-500 uppercase">Restants</div>
                                    </div>
                                    <div className="bg-danger-50 p-2 rounded-lg text-center">
                                      <div className="text-lg font-bold text-danger-600">{produit.pertesBoutique || 0}</div>
                                      <div className="text-[10px] text-danger-500 uppercase">Invendus</div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* VIENNOISERIE */}
                        {rapportJour.produits.filter(p => p.destineBoutique && p.produit?.categorie === 'viennoiserie').length > 0 && (
                          <div>
                            <h4 className="text-xs font-bold text-sand-400 uppercase tracking-wider mb-3 flex items-center gap-2 border-b border-sand-100 pb-1">
                              <span className="text-lg">🥐</span> Viennoiserie
                            </h4>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                              {rapportJour.produits.filter(p => p.destineBoutique && p.produit?.categorie === 'viennoiserie').map((produit) => (
                                <div key={`boutique-${produit.produitId}`} className="bg-white border border-sand-200 rounded-xl p-6 hover:shadow-md transition-all">
                                  <div className="flex items-center justify-between mb-4">
                                    <div className="flex flex-col">
                                      <h4 className="font-semibold text-sand-900">{produit.produit?.nom || produit.produitId}</h4>
                                      <span className="text-xs font-bold text-success-600 bg-success-50 px-2 py-0.5 rounded w-fit mt-1">
                                        {formatCurrency(produit.valeurVenteBoutique)}
                                      </span>
                                    </div>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTauxVenteBadgeColor(produit.tauxVenteBoutique)}`}>
                                      {produit.tauxVenteBoutique.toFixed(1)}%
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-3 text-center">
                                    <div className="bg-sand-50 p-2 rounded-lg">
                                      <div className="text-lg font-bold">{produit.quantiteVendueBoutique + produit.invendusBoutique}</div>
                                      <div className="text-[10px] text-sand-500 uppercase">Stock</div>
                                    </div>
                                    <div className="bg-success-50 p-2 rounded-lg">
                                      <div className="text-lg font-bold text-success-700">{produit.quantiteVendueBoutique}</div>
                                      <div className="text-[10px] text-success-600 uppercase">Vendu</div>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 mt-3">
                                    <div className="bg-success-50 p-2 rounded-lg text-center">
                                      <div className="text-lg font-bold text-success-600">{produit.restantsBoutique || 0}</div>
                                      <div className="text-[10px] text-success-500 uppercase">Restants</div>
                                    </div>
                                    <div className="bg-danger-50 p-2 rounded-lg text-center">
                                      <div className="text-lg font-bold text-danger-600">{produit.pertesBoutique || 0}</div>
                                      <div className="text-[10px] text-danger-500 uppercase">Invendus</div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Footer Boutique */}
                      <div className="bg-success-600 text-white rounded-xl p-3 sm:p-4 shadow-sm">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                          <div className="flex items-center gap-2 text-xs sm:text-sm font-bold">
                            <Icon icon="mdi:calculator" className="text-base sm:text-lg" /> TOTAL BOUTIQUE
                          </div>
                          <div className="flex flex-wrap gap-3 sm:gap-6 w-full sm:w-auto">
                            <div className="text-left sm:text-right flex-1 sm:flex-none">
                              <div className="text-[10px] text-white/90 uppercase font-bold">Vendu (PCS)</div>
                              <div className="text-base sm:text-xl font-black">{rapportJour.produits.filter(p => p.destineBoutique).reduce((acc, p) => acc + p.quantiteVendueBoutique, 0)}</div>
                            </div>
                            <div className="text-left sm:text-right flex-1 sm:flex-none sm:border-l sm:border-success-500 sm:pl-6">
                              <div className="text-[10px] text-white/90 uppercase font-bold">Valeur</div>
                              <div className="text-base sm:text-xl font-black">{formatCurrency(rapportJour.produits.filter(p => p.destineBoutique).reduce((acc, p) => acc + p.valeurVenteBoutique, 0))}</div>
                            </div>
                            <div className="text-left sm:text-right flex-1 sm:flex-none sm:border-l sm:border-success-500 sm:pl-6">
                              <div className="text-[10px] text-white/90 uppercase font-bold">Restants</div>
                              <div className="text-base sm:text-xl font-black">{rapportJour.produits.filter(p => p.destineBoutique).reduce((acc, p) => acc + (p.restantsBoutique || 0), 0)}</div>
                            </div>
                            <div className="text-left sm:text-right flex-1 sm:flex-none sm:border-l sm:border-success-500 sm:pl-6">
                              <div className="text-[10px] text-white/90 uppercase font-bold">Invendus</div>
                              <div className="text-base sm:text-xl font-black">{rapportJour.produits.filter(p => p.destineBoutique).reduce((acc, p) => acc + (p.pertesBoutique || 0), 0)}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SECTION CLIENTS */}
                  {rapportJour.produits.some(p => p.destineClients) && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-info-100">
                        <Icon icon="mdi:account-group" className="text-info-600" />
                        <h3 className="text-lg font-semibold text-sand-800">Livraisons Clients</h3>
                      </div>

                      <div className="space-y-6">
                        {/* BOULANGERIE */}
                        {rapportJour.produits.filter(p => p.destineClients && (!p.produit?.categorie || p.produit.categorie === 'boulangerie')).length > 0 && (
                          <div>
                            <h4 className="text-xs font-bold text-sand-400 uppercase tracking-wider mb-3 flex items-center gap-2 border-b border-sand-100 pb-1">
                              <span className="text-lg">🥖</span> Boulangerie
                            </h4>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                              {rapportJour.produits.filter(p => p.destineClients && (!p.produit?.categorie || p.produit.categorie === 'boulangerie')).map((produit) => (
                                <div key={`clients-${produit.produitId}`} className="bg-white border border-sand-200 rounded-xl p-6 hover:shadow-md transition-all">
                                  <div className="flex items-center justify-between mb-4">
                                    <div className="flex flex-col">
                                      <h4 className="font-semibold text-sand-900">{produit.produit?.nom || produit.produitId}</h4>
                                      <span className="text-xs font-bold text-info-600 bg-info-50 px-2 py-0.5 rounded w-fit mt-1">
                                        {formatCurrency(produit.valeurVenteClients)}
                                      </span>
                                    </div>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTauxVenteBadgeColor(produit.tauxVenteClients)}`}>
                                      {produit.tauxVenteClients.toFixed(1)}%
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-3 text-center">
                                    <div className="bg-sand-50 p-2 rounded-lg">
                                      <div className="text-lg font-bold">{produit.quantiteVendueClients + produit.invendusClients}</div>
                                      <div className="text-[10px] text-sand-500 uppercase">Livré</div>
                                    </div>
                                    <div className="bg-info-50 p-2 rounded-lg">
                                      <div className="text-lg font-bold text-info-600">{produit.quantiteVendueClients}</div>
                                      <div className="text-[10px] text-info-600 uppercase">Vendu</div>
                                    </div>
                                  </div>
                                  <div className="mt-3 bg-warning-50 p-2 rounded-lg text-center">
                                    <div className="text-lg font-bold text-warning-600">{produit.invendusClients}</div>
                                    <div className="text-[10px] text-warning-500 uppercase">Retours</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* VIENNOISERIE */}
                        {rapportJour.produits.filter(p => p.destineClients && p.produit?.categorie === 'viennoiserie').length > 0 && (
                          <div>
                            <h4 className="text-xs font-bold text-sand-400 uppercase tracking-wider mb-3 flex items-center gap-2 border-b border-sand-100 pb-1">
                              <span className="text-lg">🥐</span> Viennoiserie
                            </h4>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                              {rapportJour.produits.filter(p => p.destineClients && p.produit?.categorie === 'viennoiserie').map((produit) => (
                                <div key={`clients-${produit.produitId}`} className="bg-white border border-sand-200 rounded-xl p-6 hover:shadow-md transition-all">
                                  <div className="flex items-center justify-between mb-4">
                                    <div className="flex flex-col">
                                      <h4 className="font-semibold text-sand-900">{produit.produit?.nom || produit.produitId}</h4>
                                      <span className="text-xs font-bold text-info-600 bg-info-50 px-2 py-0.5 rounded w-fit mt-1">
                                        {formatCurrency(produit.valeurVenteClients)}
                                      </span>
                                    </div>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTauxVenteBadgeColor(produit.tauxVenteClients)}`}>
                                      {produit.tauxVenteClients.toFixed(1)}%
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-3 text-center">
                                    <div className="bg-sand-50 p-2 rounded-lg">
                                      <div className="text-lg font-bold">{produit.quantiteVendueClients + produit.invendusClients}</div>
                                      <div className="text-[10px] text-sand-500 uppercase">Livré</div>
                                    </div>
                                    <div className="bg-info-50 p-2 rounded-lg">
                                      <div className="text-lg font-bold text-info-600">{produit.quantiteVendueClients}</div>
                                      <div className="text-[10px] text-info-600 uppercase">Vendu</div>
                                    </div>
                                  </div>
                                  <div className="mt-3 bg-warning-50 p-2 rounded-lg text-center">
                                    <div className="text-lg font-bold text-warning-600">{produit.invendusClients}</div>
                                    <div className="text-[10px] text-warning-500 uppercase">Retours</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Footer Clients */}
                      <div className="bg-info-600 text-white rounded-xl p-3 sm:p-4 shadow-sm">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                          <div className="flex items-center gap-2 text-xs sm:text-sm font-bold">
                            <Icon icon="mdi:calculator" className="text-base sm:text-lg" /> TOTAL CLIENTS
                          </div>
                          <div className="flex flex-wrap gap-3 sm:gap-6 w-full sm:w-auto">
                            <div className="text-left sm:text-right flex-1 sm:flex-none">
                              <div className="text-[10px] text-info-100 uppercase font-bold">Livré (PCS)</div>
                              <div className="text-base sm:text-xl font-black">{rapportJour.produits.filter(p => p.destineClients).reduce((acc, p) => acc + (p.quantiteVendueClients + p.invendusClients), 0)}</div>
                            </div>
                            <div className="text-left sm:text-right flex-1 sm:flex-none sm:border-l sm:border-info-500 sm:pl-6">
                              <div className="text-[10px] text-info-100 uppercase font-bold">Valeur</div>
                              <div className="text-base sm:text-xl font-black">{formatCurrency(rapportJour.produits.filter(p => p.destineClients).reduce((acc, p) => acc + p.valeurVenteClients, 0))}</div>
                            </div>
                            <div className="text-left sm:text-right flex-1 sm:flex-none sm:border-l sm:border-info-500 sm:pl-6">
                              <div className="text-[10px] text-info-100 uppercase font-bold">Vendu</div>
                              <div className="text-base sm:text-xl font-black">{rapportJour.produits.filter(p => p.destineClients).reduce((acc, p) => acc + p.quantiteVendueClients, 0)}</div>
                            </div>
                            <div className="text-left sm:text-right flex-1 sm:flex-none sm:border-l sm:border-info-500 sm:pl-6">
                              <div className="text-[10px] text-info-100 uppercase font-bold">Retours</div>
                              <div className="text-base sm:text-xl font-black">{rapportJour.produits.filter(p => p.destineClients).reduce((acc, p) => acc + p.invendusClients, 0)}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SECTION DÉTAIL DES RETOURS PAR CLIENT */}
                  {rapportJour.detailsRetours && rapportJour.detailsRetours.filter(r => r.produits.some(p => p.invendus > 0)).length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-warning-100">
                        <Icon icon="mdi:account-arrow-left" className="text-warning-600" />
                        <h3 className="text-lg font-semibold text-sand-800">Détail des Retours par Client</h3>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {rapportJour.detailsRetours
                          .filter(retour => retour.produits.some(p => p.invendus > 0))
                          .map((retour, idx) => (
                            <div key={idx} className="bg-white border border-warning-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                              <div className="bg-warning-50 px-4 py-3 border-b border-warning-100 flex justify-between items-center">
                                <h4 className="font-bold text-sand-900 truncate pr-2">
                                  {retour.client?.prenom 
                                    ? `${retour.client.prenom} ${retour.client.nom}` 
                                    : (retour.client?.nom || `Client #${retour.clientId}`)}
                                </h4>
                                <span className="bg-warning-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                                  {retour.produits.reduce((acc, p) => acc + p.invendus, 0)} u.
                                </span>
                              </div>
                              <div className="p-4 space-y-2">
                                {retour.produits
                                  .filter(p => p.invendus > 0)
                                  .map((p, pIdx) => (
                                    <div key={pIdx} className="flex justify-between items-center text-sm border-b border-sand-50 pb-2 last:border-0 last:pb-0">
                                      <span className="text-sand-600 font-medium">{p.produit?.nom || p.produitId}</span>
                                      <div className="flex items-center gap-3">
                                        <span className="text-[10px] text-sand-400">Livré: {p.quantiteLivree}</span>
                                        <span className="font-bold text-warning-600">-{p.invendus}</span>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* SECTION ANNULATIONS */}
                  {rapportJour.annulations && rapportJour.annulations.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-warning-100">
                        <Icon icon="mdi:cancel" className="text-warning-600" />
                        <h3 className="text-lg font-semibold text-sand-800">Commandes Annulées & Redistribution</h3>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        {rapportJour.annulations.map((ann, idx) => (
                          <div key={idx} className="bg-warning-50 border border-warning-100 rounded-xl p-4 shadow-sm">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h4 className="font-bold text-sand-900">{ann.clientNom}</h4>
                                <p className="text-xs text-warning-600 font-medium">Motif: {ann.motif}</p>
                              </div>
                              <span className="bg-warning-100 text-warning-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                                {ann.redistribution.type}
                              </span>
                            </div>
                            <div className="space-y-1 mt-3">
                              <p className="text-[10px] font-bold text-sand-500 uppercase tracking-wider">Produits redistribués :</p>
                              {ann.produits.map((p, pidx) => (
                                <div key={pidx} className="flex justify-between text-sm">
                                  <span className="text-sand-700">{p.nom}</span>
                                  <span className="font-bold text-sand-900">x{p.quantite}</span>
                                </div>
                              ))}
                            </div>
                            <div className="mt-3 pt-2 border-t border-warning-100">
                              <p className="text-xs text-warning-600">
                                <span className="font-bold">Destination :</span> {ann.redistribution.destinationNom}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>
        ) : modeAffichage === 'jour' && !rapportJour && !isLoading ? (
          <div className="bg-white rounded-2xl border border-sand-200 p-12 text-center shadow-sm">
            <div className="w-24 h-24 bg-sand-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Icon icon="mdi:chart-bar-off" className="text-5xl text-sand-300" />
            </div>
            <h2 className="font-display text-2xl font-semibold text-sand-900 mb-2">Aucun rapport disponible</h2>
            <p className="text-sand-500 mb-8 max-w-md mx-auto">
              Il n'y a pas encore de rapport pour cette journée. Cliquez sur le bouton ci-dessous pour lancer l'analyse des ventes et des stocks.
            </p>
            <button
              onClick={handleGenererRapport}
              className="inline-flex items-center gap-2 px-8 py-3 bg-terracotta-600 text-white rounded-xl font-bold hover:bg-terracotta-700 transition-all shadow-lg hover:shadow-terracotta-200"
            >
              <Icon icon="mdi:refresh" className="text-xl" />
              Générer le rapport maintenant
            </button>
          </div>
        ) : modeAffichage === 'historique' && (
          <div className="bg-white rounded-xl border border-sand-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-sand-100 bg-sand-50/50 flex items-center justify-between">
              <h2 className="font-bold text-sand-900 flex items-center gap-2">
                <Icon icon="mdi:history" className="text-terracotta-600" /> Historique des 7 derniers jours
              </h2>
              <button
                onClick={handleChargerHistorique}
                className="text-xs font-bold text-terracotta-600 hover:text-terracotta-700"
              >
                Rafraîchir l'historique
              </button>
            </div>
            <div className="divide-y divide-sand-100">
              {historiqueRapports.length === 0 ? (
                <div className="p-12 text-center text-sand-500">
                  Chargement de l'historique...
                </div>
              ) : historiqueRapports.map((rapport) => (
                <div key={rapport.id} className="p-6 hover:bg-sand-50 transition-colors flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="w-14 h-14 bg-white border border-sand-200 rounded-2xl flex flex-col items-center justify-center shadow-sm">
                      <span className="text-[10px] font-black text-sand-400 uppercase">{new Date(rapport.date).toLocaleDateString('fr-FR', { month: 'short' })}</span>
                      <span className="text-xl font-black text-sand-900 leading-none">{new Date(rapport.date).getDate()}</span>
                    </div>
                    <div>
                      <div className="font-bold text-sand-900">Rapport du {new Date(rapport.date).toLocaleDateString('fr-FR', { weekday: 'long' })}</div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs font-bold text-success-600 bg-success-50 px-2 py-0.5 rounded">CA: {formatCurrency(rapport.totaux.valeurVenteTotal)}</span>
                        <span className="text-xs font-bold text-terracotta-600 bg-terracotta-50 px-2 py-0.5 rounded">Taux: {rapport.totaux.tauxVenteGlobal}%</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setDateSelectionnee(new Date(rapport.date).toISOString().split('T')[0]);
                      setModeAffichage('jour');
                    }}
                    className="w-10 h-10 rounded-xl bg-sand-100 hover:bg-terracotta-600 hover:text-white flex items-center justify-center transition-all"
                  >
                    <Icon icon="mdi:chevron-right" className="text-xl" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div >
  );
};