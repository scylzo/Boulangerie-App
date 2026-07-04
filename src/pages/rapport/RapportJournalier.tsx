import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import { useRapportStore } from '../../store';
import { usePosStore, type TicketPOS } from '../../store/posStore';
import { downloadRapportJournalierPDF } from '../../utils/pdfGenerator';
import { formatCurrency } from '../../utils/currency';
import { StatCard } from '../../components/ui';

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

  const { getTicketsPeriode } = usePosStore();
  const [posTickets, setPosTickets] = useState<TicketPOS[]>([]);

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

  // Charger les ventes caisse (POS) du jour sélectionné
  useEffect(() => {
    const d = new Date(dateSelectionnee + 'T12:00:00');
    getTicketsPeriode(d, d).then(setPosTickets).catch(() => setPosTickets([]));
  }, [dateSelectionnee, getTicketsPeriode]);

  const caPos = posTickets.reduce((s, t) => s + (t.total || 0), 0);
  const nbArticlesPos = posTickets.reduce((s, t) => s + (t.nbArticles || 0), 0);
  const posParMode = (m: TicketPOS['modePaiement']) => posTickets.filter(t => t.modePaiement === m).reduce((s, t) => s + (t.total || 0), 0);

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
                  className="bg-transparent border-none text-sand-900 font-semibold focus:ring-0 p-0"
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

        {/* Bloc Caisse (POS) du jour */}
        {modeAffichage === 'jour' && posTickets.length > 0 && (
          <div className="bg-white border border-sand-200 rounded-2xl shadow-card overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-sand-200 bg-sand-50">
              <Icon icon="mdi:cash-register" className="text-lg text-gold-600" />
              <h2 className="font-display text-base font-semibold text-sand-900">Ventes en caisse (POS)</h2>
              <span className="ml-auto font-display font-semibold text-sand-900 tabular-nums">{formatCurrency(caPos)}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 divide-x divide-y sm:divide-y-0 divide-sand-200 tabular-nums">
              <div className="px-4 py-3"><div className="text-[11px] text-sand-500">Tickets</div><div className="font-display text-lg font-semibold text-sand-900">{posTickets.length}</div></div>
              <div className="px-4 py-3"><div className="text-[11px] text-sand-500">Articles</div><div className="font-display text-lg font-semibold text-sand-900">{nbArticlesPos}</div></div>
              <div className="px-4 py-3"><div className="text-[11px] text-sand-500">Espèces</div><div className="font-display text-lg font-semibold text-success-600">{formatCurrency(posParMode('espece'))}</div></div>
              <div className="px-4 py-3"><div className="text-[11px] text-sand-500">Orange Money</div><div className="font-display text-lg font-semibold text-gold-600">{formatCurrency(posParMode('om'))}</div></div>
              <div className="px-4 py-3"><div className="text-[11px] text-sand-500">Wave</div><div className="font-display text-lg font-semibold text-info-600">{formatCurrency(posParMode('wave'))}</div></div>
            </div>
            <div className="px-5 py-3 border-t border-sand-200 flex items-center justify-between gap-3">
              <span className="text-xs text-sand-500">Encaissements enregistrés à la caisse ce jour.</span>
              <Link to="/caisse/historique" className="text-xs font-semibold text-gold-700 hover:text-gold-600 inline-flex items-center gap-1">
                Détail des tickets <Icon icon="mdi:arrow-right" className="text-sm" />
              </Link>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-sand-100 shadow-sm">
            <div className="w-16 h-16 border-4 border-terracotta-100 border-t-terracotta-600 rounded-full animate-spin mb-4" />
            <p className="text-sand-500 font-medium">Analyse des données en cours...</p>
          </div>
        ) : modeAffichage === 'jour' && rapportJour ? (
          <div className="space-y-6">
            {(() => {
              const bProds = rapportJour.produits.filter(p => p.destineBoutique);
              const cProds = rapportJour.produits.filter(p => p.destineClients);
              const bVendu = bProds.reduce((a, p) => a + p.quantiteVendueBoutique, 0);
              const bRest = bProds.reduce((a, p) => a + (p.restantsBoutique || 0), 0);
              const bInv = bProds.reduce((a, p) => a + (p.pertesBoutique || 0), 0);
              const bCA = bProds.reduce((a, p) => a + p.valeurVenteBoutique, 0);
              const cLivre = cProds.reduce((a, p) => a + (p.quantiteVendueClients + p.invendusClients), 0);
              const cVendu = cProds.reduce((a, p) => a + p.quantiteVendueClients, 0);
              const cRet = cProds.reduce((a, p) => a + p.invendusClients, 0);
              const cCA = cProds.reduce((a, p) => a + p.valeurVenteClients, 0);
              const retClients = (rapportJour.detailsRetours || []).filter(r => r.produits.some(p => p.invendus > 0));
              return (
                <>
                  {/* KPI */}
                  {indicateurs && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                      <StatCard label="CA du jour" value={formatCurrency(indicateurs.valeurVenteTotal)} icon="mdi:cash-multiple" tone="brand" />
                      <StatCard label="Écoulement global" value={`${indicateurs.tauxVenteGlobal.toFixed(1)} %`} icon="mdi:progress-check" tone="gold" />
                      <StatCard label="Vendu (total)" value={`${rapportJour.totaux.quantiteVendueTotal} u.`} icon="mdi:package-variant" tone="success" />
                      <StatCard label="Invendus + retours" value={`${indicateurs.pertesBoutique + indicateurs.pertesClients} u.`} icon="mdi:basket-off-outline" tone="info" />
                    </div>
                  )}

                  {/* Totaux quantités (bandeau) */}
                  <div className="bg-white border border-sand-200 rounded-2xl shadow-card p-4 grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3 tabular-nums">
                    {[
                      { l: 'Prévu', v: rapportJour.totaux.quantitePrevue, c: 'text-sand-900' },
                      { l: 'Produit', v: rapportJour.totaux.quantiteProduite, c: 'text-info-600' },
                      { l: 'Vendu', v: rapportJour.totaux.quantiteVendueTotal, c: 'text-success-600' },
                      { l: 'Valeur', v: formatCurrency(rapportJour.totaux.valeurVenteTotal), c: 'text-terracotta-600' },
                      { l: 'Retours clients', v: rapportJour.totaux.retoursClients || 0, c: 'text-warning-600' },
                      { l: 'Invendus boutique', v: rapportJour.totaux.pertesBoutique || 0, c: 'text-danger-600' },
                      { l: 'Restants boutique', v: rapportJour.totaux.restantsBoutique || 0, c: 'text-success-600' },
                    ].map((s, i) => (
                      <div key={i} className="text-center">
                        <div className={`font-display text-lg font-semibold ${s.c}`}>{s.v}</div>
                        <div className="text-[10px] text-sand-500 uppercase tracking-wide font-semibold">{s.l}</div>
                      </div>
                    ))}
                  </div>

                  {/* Boutique + Clients */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {bProds.length > 0 && (
                      <div className="bg-white border border-sand-200 rounded-2xl shadow-card overflow-hidden">
                        <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-sand-200 bg-sand-50">
                          <Icon icon="mdi:storefront-outline" className="text-lg text-terracotta-600" />
                          <h2 className="font-display text-base font-semibold text-sand-900">Performance boutique</h2>
                          <span className="ml-auto font-display font-semibold text-sand-900 tabular-nums">{formatCurrency(bCA)}</span>
                        </div>
                        <div className="grid grid-cols-3 divide-x divide-sand-200 border-b border-sand-200 tabular-nums">
                          <div className="px-4 py-3"><div className="text-[11px] text-sand-500">Vendu</div><div className="font-display text-lg font-semibold text-success-600">{bVendu}</div></div>
                          <div className="px-4 py-3"><div className="text-[11px] text-sand-500">Restants</div><div className="font-display text-lg font-semibold text-sand-900">{bRest}</div></div>
                          <div className="px-4 py-3"><div className="text-[11px] text-sand-500">Invendus</div><div className="font-display text-lg font-semibold text-warning-600">{bInv}</div></div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm min-w-[560px] tabular-nums">
                            <thead>
                              <tr className="text-left text-[11px] uppercase tracking-wide text-sand-500 border-b border-sand-200">
                                <th className="font-semibold px-4 py-2.5">Produit</th>
                                <th className="font-semibold px-3 py-2.5 text-right">Stock</th>
                                <th className="font-semibold px-3 py-2.5 text-right">Vendu</th>
                                <th className="font-semibold px-3 py-2.5 text-right">Rest.</th>
                                <th className="font-semibold px-3 py-2.5 text-right">Inv.</th>
                                <th className="font-semibold px-3 py-2.5 text-center">Taux</th>
                                <th className="font-semibold px-4 py-2.5 text-right">CA</th>
                              </tr>
                            </thead>
                            <tbody>
                              {bProds.map((p) => (
                                <tr key={`b-${p.produitId}`} className="border-b border-sand-100 last:border-0 hover:bg-sand-50">
                                  <td className="px-4 py-2.5 text-sand-800 truncate max-w-[150px]">{p.produit?.nom || p.produitId}</td>
                                  <td className="px-3 py-2.5 text-right text-sand-500">{p.quantiteVendueBoutique + p.invendusBoutique}</td>
                                  <td className="px-3 py-2.5 text-right text-sand-700">{p.quantiteVendueBoutique}</td>
                                  <td className="px-3 py-2.5 text-right text-success-600">{p.restantsBoutique || 0}</td>
                                  <td className="px-3 py-2.5 text-right text-warning-600 font-medium">{p.pertesBoutique || 0}</td>
                                  <td className="px-3 py-2.5 text-center"><span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${getTauxVenteBadgeColor(p.tauxVenteBoutique)}`}>{p.tauxVenteBoutique.toFixed(0)}%</span></td>
                                  <td className="px-4 py-2.5 text-right font-display font-semibold text-sand-900">{formatCurrency(p.valeurVenteBoutique)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {cProds.length > 0 && (
                      <div className="bg-white border border-sand-200 rounded-2xl shadow-card overflow-hidden">
                        <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-sand-200 bg-sand-50">
                          <Icon icon="mdi:truck-delivery-outline" className="text-lg text-terracotta-600" />
                          <h2 className="font-display text-base font-semibold text-sand-900">Performance clients</h2>
                          <span className="ml-auto font-display font-semibold text-sand-900 tabular-nums">{formatCurrency(cCA)}</span>
                        </div>
                        <div className="grid grid-cols-3 divide-x divide-sand-200 border-b border-sand-200 tabular-nums">
                          <div className="px-4 py-3"><div className="text-[11px] text-sand-500">Livré</div><div className="font-display text-lg font-semibold text-sand-900">{cLivre}</div></div>
                          <div className="px-4 py-3"><div className="text-[11px] text-sand-500">Vendu</div><div className="font-display text-lg font-semibold text-success-600">{cVendu}</div></div>
                          <div className="px-4 py-3"><div className="text-[11px] text-sand-500">Retours</div><div className="font-display text-lg font-semibold text-danger-600">{cRet}</div></div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm min-w-[500px] tabular-nums">
                            <thead>
                              <tr className="text-left text-[11px] uppercase tracking-wide text-sand-500 border-b border-sand-200">
                                <th className="font-semibold px-4 py-2.5">Produit</th>
                                <th className="font-semibold px-3 py-2.5 text-right">Livré</th>
                                <th className="font-semibold px-3 py-2.5 text-right">Vendu</th>
                                <th className="font-semibold px-3 py-2.5 text-right">Retours</th>
                                <th className="font-semibold px-3 py-2.5 text-center">Taux</th>
                                <th className="font-semibold px-4 py-2.5 text-right">CA</th>
                              </tr>
                            </thead>
                            <tbody>
                              {cProds.map((p) => (
                                <tr key={`c-${p.produitId}`} className="border-b border-sand-100 last:border-0 hover:bg-sand-50">
                                  <td className="px-4 py-2.5 text-sand-800 truncate max-w-[150px]">{p.produit?.nom || p.produitId}</td>
                                  <td className="px-3 py-2.5 text-right text-sand-500">{p.quantiteVendueClients + p.invendusClients}</td>
                                  <td className="px-3 py-2.5 text-right text-sand-700">{p.quantiteVendueClients}</td>
                                  <td className="px-3 py-2.5 text-right text-danger-600 font-medium">{p.invendusClients}</td>
                                  <td className="px-3 py-2.5 text-center"><span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${getTauxVenteBadgeColor(p.tauxVenteClients)}`}>{p.tauxVenteClients.toFixed(0)}%</span></td>
                                  <td className="px-4 py-2.5 text-right font-display font-semibold text-sand-900">{formatCurrency(p.valeurVenteClients)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Synthèse + Retours par client / Annulations */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {indicateurs && (
                      <div className="bg-white border border-sand-200 rounded-2xl shadow-card overflow-hidden">
                        <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-sand-200 bg-sand-50">
                          <Icon icon="mdi:scale-balance" className="text-lg text-terracotta-600" />
                          <h2 className="font-display text-base font-semibold text-sand-900">Synthèse globale</h2>
                        </div>
                        <div className="p-4">
                          {[
                            { l: 'CA Boutique', v: formatCurrency(indicateurs.valeurVenteBoutique), c: 'text-sand-900' },
                            { l: 'CA Clients', v: formatCurrency(indicateurs.valeurVenteClients), c: 'text-sand-900' },
                            { l: 'Écoulement global', v: `${indicateurs.tauxVenteGlobal.toFixed(1)} %`, c: 'text-sand-900' },
                            { l: 'Report total (restants)', v: `${indicateurs.restantsTotaux} u.`, c: 'text-warning-600' },
                          ].map((s, i) => (
                            <div key={i} className="flex items-center justify-between px-3 py-2.5 border-b border-sand-100">
                              <span className="text-sm text-sand-600">{s.l}</span>
                              <span className={`font-display font-semibold tabular-nums ${s.c}`}>{s.v}</span>
                            </div>
                          ))}
                          <div className="flex items-center justify-between gap-3 mt-3 px-4 py-3 bg-sand-900 rounded-xl">
                            <div className="flex items-center gap-2 text-white"><Icon icon="mdi:cash-multiple" className="text-lg" /><span className="text-sm font-medium">CA total du jour</span></div>
                            <span className="font-display text-xl font-semibold text-white tabular-nums">{formatCurrency(indicateurs.valeurVenteTotal)}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-6">
                      {retClients.length > 0 && (
                        <div className="bg-white border border-sand-200 rounded-2xl shadow-card overflow-hidden">
                          <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-sand-200 bg-sand-50">
                            <Icon icon="mdi:account-arrow-left" className="text-lg text-terracotta-600" />
                            <h2 className="font-display text-base font-semibold text-sand-900">Retours par client</h2>
                          </div>
                          <div className="divide-y divide-sand-100">
                            {retClients.map((retour, idx) => (
                              <div key={idx} className="px-4 py-3 flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-sand-900 truncate">{retour.client?.prenom ? `${retour.client.prenom} ${retour.client.nom}` : (retour.client?.nom || `Client #${retour.clientId}`)}</div>
                                  <div className="text-xs text-sand-500 mt-0.5 flex flex-wrap gap-x-2">
                                    {retour.produits.filter(p => p.invendus > 0).map((p, i) => (
                                      <span key={i} className="whitespace-nowrap" title={`Livré : ${p.quantiteLivree}`}>{p.produit?.nom || p.produitId} <span className="text-danger-600 font-medium">−{p.invendus}</span></span>
                                    ))}
                                  </div>
                                </div>
                                <span className="shrink-0 bg-warning-50 text-warning-600 text-xs font-semibold px-2 py-0.5 rounded-full ring-1 ring-inset ring-warning-100">{retour.produits.reduce((a, p) => a + p.invendus, 0)} u.</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {rapportJour.annulations && rapportJour.annulations.length > 0 && (
                        <div className="bg-white border border-sand-200 rounded-2xl shadow-card overflow-hidden">
                          <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-sand-200 bg-sand-50">
                            <Icon icon="mdi:swap-horizontal" className="text-lg text-terracotta-600" />
                            <h2 className="font-display text-base font-semibold text-sand-900">Annulations & redistribution</h2>
                          </div>
                          <div className="p-3 space-y-2">
                            {rapportJour.annulations.map((ann, idx) => (
                              <div key={idx} className="flex items-start gap-3 p-3 border border-sand-200 rounded-xl bg-sand-50">
                                <Icon icon="mdi:cancel" className="text-lg text-danger-600 shrink-0 mt-0.5" />
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-semibold text-sand-900">{ann.clientNom} <span className="text-danger-600 font-normal">· annulée</span></div>
                                  <div className="text-xs text-sand-500 mt-0.5">Motif : {ann.motif}</div>
                                  <div className="text-xs text-sand-600 mt-1 flex flex-wrap gap-x-2">{ann.produits.map((p, i) => (<span key={i}>{p.nom} <span className="font-medium">×{p.quantite}</span></span>))}</div>
                                  <div className="text-xs text-info-600 mt-1"><span className="font-semibold uppercase">{ann.redistribution.type}</span> → {ann.redistribution.destinationNom}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              );
            })()}
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
              className="inline-flex items-center gap-2 px-8 py-3 bg-terracotta-600 text-white rounded-xl font-semibold hover:bg-terracotta-700 transition-all shadow-card hover:shadow-terracotta-200"
            >
              <Icon icon="mdi:refresh" className="text-xl" />
              Générer le rapport maintenant
            </button>
          </div>
        ) : modeAffichage === 'historique' && (
          <div className="bg-white rounded-xl border border-sand-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-sand-100 bg-sand-50/50 flex items-center justify-between">
              <h2 className="font-semibold text-sand-900 flex items-center gap-2">
                <Icon icon="mdi:history" className="text-terracotta-600" /> Historique des 7 derniers jours
              </h2>
              <button
                onClick={handleChargerHistorique}
                className="text-xs font-semibold text-terracotta-600 hover:text-terracotta-700"
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
                      <span className="text-[10px] font-semibold text-sand-400 uppercase">{new Date(rapport.date).toLocaleDateString('fr-FR', { month: 'short' })}</span>
                      <span className="text-xl font-semibold text-sand-900 leading-none">{new Date(rapport.date).getDate()}</span>
                    </div>
                    <div>
                      <div className="font-semibold text-sand-900">Rapport du {new Date(rapport.date).toLocaleDateString('fr-FR', { weekday: 'long' })}</div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs font-semibold text-success-600 bg-success-50 px-2 py-0.5 rounded">CA: {formatCurrency(rapport.totaux.valeurVenteTotal)}</span>
                        <span className="text-xs font-semibold text-terracotta-600 bg-terracotta-50 px-2 py-0.5 rounded">Taux: {rapport.totaux.tauxVenteGlobal}%</span>
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