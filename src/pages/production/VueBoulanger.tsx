/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { useProductionStore } from '../../store';
import { htmlPrintService } from '../../services/htmlPrintService';

const printStyles = `
  @media print {
    @page {
      margin: 0.5in;
      size: A4;
    }

    body {
      font-size: 12pt;
      line-height: 1.4;
    }

    .print\\:break-inside-avoid {
      break-inside: avoid;
    }

    .print\\:break-before-page {
      break-before: page;
    }

    .print\\:bg-white {
      background-color: white !important;
    }

    .print\\:text-black {
      color: black !important;
    }

    .print\\:border-black {
      border-color: black !important;
    }

    .print\\:shadow-none {
      box-shadow: none !important;
    }

    .print\\:rounded-none {
      border-radius: 0 !important;
    }

    .print\\:hidden {
      display: none !important;
    }

    .print\\:block {
      display: block !important;
    }

    .print\\:grid-cols-3 {
      grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    }

    .print\\:gap-4 {
      gap: 1rem !important;
    }

    .print\\:p-4 {
      padding: 1rem !important;
    }

    .print\\:max-w-none {
      max-width: none !important;
    }

    .print\\:space-y-6 > * + * {
      margin-top: 1.5rem !important;
    }

    .print\\:mb-4 {
      margin-bottom: 1rem !important;
    }

    .print\\:mt-8 {
      margin-top: 2rem !important;
    }

    .print\\:text-lg {
      font-size: 1.125rem !important;
    }

    .print\\:text-2xl {
      font-size: 1.5rem !important;
    }

    .print\\:text-sm {
      font-size: 0.875rem !important;
    }

    .print\\:border-2 {
      border-width: 2px !important;
    }

    .print\\:bg-gray-200 {
      background-color: #e5e7eb !important;
    }
  }
`;


export const VueBoulanger: React.FC = () => {
  const { programmeActuel, chargerProgramme, chargerProduits, produits, setQuantiteProduite } = useProductionStore();
  const [dateSelectionnee, setDateSelectionnee] = useState(new Date().toISOString().split('T')[0]);

  // Chargement initial des données
  useEffect(() => {
    const initialiser = async () => {
      await chargerProduits();
    };
    initialiser();
  }, [chargerProduits]);

  // Calculer les répartitions clients uniquement (sans boutique)
  const calculerRepartitionsClients = () => {
    const repartitionsClients = new Map<string, {
      car1Matin: number;
      car2Matin: number;
      carSoir: number;
    }>();

    if (!programmeActuel?.commandesClients) return repartitionsClients;

    // Parcourir uniquement les commandes clients (exclure boutique)
    programmeActuel.commandesClients
      .filter(commande => commande.statut !== 'annulee')
      .forEach(commande => {
        commande.produits.forEach(item => {
          const current = repartitionsClients.get(item.produitId) || {
            car1Matin: 0,
            car2Matin: 0,
            carSoir: 0
          };

          const car1Matin = Number(item.repartitionCars?.car1_matin) || 0;
          const car2Matin = Number(item.repartitionCars?.car2_matin) || 0;
          const carSoir = Number(item.repartitionCars?.car_soir) || 0;

          repartitionsClients.set(item.produitId, {
            car1Matin: current.car1Matin + car1Matin,
            car2Matin: current.car2Matin + car2Matin,
            carSoir: current.carSoir + carSoir
          });
        });
      });

    return repartitionsClients;
  };

  const repartitionsClients = calculerRepartitionsClients();

  // Fonction pour générer le document HTML d'impression
  const handleGenerateHTML = () => {
    console.log('🖨️ Bouton impression cliqué');
    console.log('📋 Programme actuel:', programmeActuel);
    console.log('🥖 Produits:', produits?.length, 'produits disponibles');

    if (programmeActuel && produits) {
      console.log('✅ Génération du rapport HTML...');
      try {
        htmlPrintService.generateProductionReportHTML(programmeActuel, produits);
        console.log('✅ Rapport généré avec succès');
      } catch (error) {
        console.error('❌ Erreur lors de la génération:', error);
      }
    } else {
      console.warn('❌ Données manquantes:');
      console.warn('  - Programme actuel:', !!programmeActuel);
      console.warn('  - Produits:', !!produits, `(${produits?.length || 0} éléments)`);
    }
  };

  useEffect(() => {
    // Charger le programme pour la date sélectionnée
    const dateObj = new Date(dateSelectionnee);
    chargerProgramme(dateObj);
  }, [chargerProgramme, dateSelectionnee]);

  // Injecter les styles d'impression
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = printStyles;
    document.head.appendChild(styleElement);

    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  const totauxParProduit = programmeActuel?.totauxParProduit || [];

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
    <div className="min-h-screen bg-gray-50 print:bg-white print:text-black">
      {/* En-tête pour impression uniquement */}
      <div className="hidden print:block print:mb-4">
        <div className="text-center border-b-2 border-black pb-4 mb-6">
          <h1 className="text-2xl font-bold mb-2">🥖 PROGRAMME DE PRODUCTION</h1>
          <div className="flex justify-between items-center text-sm">
            <span>
              Production: {programmeActuel ? (() => {
                const dateProduction = programmeActuel.dateProduction;
                return dateProduction.toLocaleDateString('fr-FR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                });
              })() : new Date().toLocaleDateString('fr-FR')}
            </span>
            <span>Statut: {programmeActuel?.statut === 'envoye' ? '✅ Confirmé' : '⏳ En attente'}</span>
            <span>Imprimé le: {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          {programmeActuel && (
            <div className="text-xs text-gray-600 mt-2">
              Programme créé le {programmeActuel.dateCreation.toLocaleDateString('fr-FR')} à {programmeActuel.dateCreation.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      </div>

      {/* Header sobre */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 print:hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center shrink-0">
              <Icon icon="mdi:chef-hat" className="text-xl text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
                Vue Boulanger
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 truncate">
                Programme de production journalier
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
            {/* Date Picker Helper */}
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-gray-900 transition-all w-full sm:w-auto">
              <Icon icon="mdi:calendar" className="text-gray-500 shrink-0" />
              <input
                type="date"
                value={dateSelectionnee}
                onChange={(e) => setDateSelectionnee(e.target.value)}
                className="bg-transparent border-none text-xs sm:text-sm text-gray-700 font-medium focus:ring-0 cursor-pointer outline-none w-full"
              />
            </div>

            {/* Bouton d'impression HTML */}
            {programmeActuel && (
              <button
                onClick={handleGenerateHTML}
                className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-xs sm:text-sm font-medium"
              >
                <Icon icon="mdi:printer" className="text-base sm:text-lg" />
                <span>Imprimer</span>
              </button>
            )}

            {/* Statut simple */}
            {programmeActuel && (
              <div className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium border ${programmeActuel.statut === 'envoye'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-gray-50 text-gray-700 border-gray-200'
                }`}>
                <Icon
                  icon={programmeActuel.statut === 'envoye' ? 'mdi:check-circle' : 'mdi:clock-outline'}
                  className="text-sm"
                />
                <span className="hidden sm:inline">{programmeActuel.statut === 'envoye' ? 'Confirmé' : 'En attente'}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section Date de Production */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 print:hidden">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                <Icon icon="mdi:calendar-clock" className="text-lg text-blue-600" />
              </div>
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 truncate">Programme de Production</h2>
            </div>

            {/* Carte d'information de production à droite */}
            {programmeActuel && (
              <div className="bg-gradient-to-l from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-3 sm:p-4 shadow-sm w-full lg:w-auto lg:min-w-[320px]">
                <div className="flex items-center gap-3">
                  <div className="flex-1 text-left sm:text-right min-w-0">
                    <div className="flex items-center justify-start sm:justify-end gap-2 mb-1">
                      <span className="text-xs sm:text-sm font-medium text-blue-700 truncate">Production programmée</span>
                      <Icon icon="mdi:calendar-check" className="text-blue-600 shrink-0" />
                    </div>
                    <div className="text-base sm:text-lg font-bold text-gray-900 truncate">
                      {(() => {
                        const dateProduction = programmeActuel.dateProduction;
                        // Nouvelle logique, afficher dateProduction telle quelle
                        return dateProduction.toLocaleDateString('fr-FR', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        });
                      })()}
                    </div>

                    <div className="flex items-center justify-start sm:justify-end gap-1 mt-1 text-xs text-gray-600">
                      <span className="truncate">Créé le {programmeActuel.dateCreation.toLocaleDateString('fr-FR')} à {programmeActuel.dateCreation.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                      <Icon icon="mdi:clock-outline" className="text-gray-400 shrink-0" />
                    </div>
                  </div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-900 rounded-xl flex items-center justify-center shadow-lg shrink-0">
                    <Icon icon="mdi:factory" className="text-xl sm:text-2xl text-white" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto p-6 space-y-8 print:max-w-none print:p-4 print:space-y-6">
        {!programmeActuel || totauxParProduit.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon icon="mdi:bread-slice" className="text-3xl text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Pas de production
            </h3>
            <p className="text-gray-500">
              Aucun programme n'a été défini pour le moment.
            </p>
            <button
              onClick={() => {
                const dateObj = new Date(dateSelectionnee);
                chargerProgramme(dateObj);
              }}
              className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <Icon icon="mdi:refresh" className="text-lg" />
              <span>Actualiser</span>
            </button>
          </div>
        ) : (
          <>
            {/* Résumé Production Journée */}
            <div className="space-y-4">
              {/* Total Général */}
              <div className="bg-gray-900 text-white rounded-xl p-4 sm:p-6 shadow-sm print:bg-white print:text-black print:border-2 print:border-black print:shadow-none print:rounded-none">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="p-2 bg-gray-800 rounded-lg print:bg-gray-200 print:text-black shrink-0">
                      <Icon icon="mdi:sigma" className="text-lg sm:text-xl" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base sm:text-lg font-bold print:text-lg truncate">TOTAL GÉNÉRAL</h2>
                      <p className="text-gray-400 text-xs sm:text-sm print:text-black print:text-sm truncate">Production complète (Clients + Boutique)</p>
                    </div>
                  </div>
                  <div className="text-left sm:text-right w-full sm:w-auto">
                    <div className="text-2xl sm:text-3xl font-bold print:text-2xl">
                      {totauxParProduit.reduce((acc, p) => acc + p.totalGlobal, 0)}
                    </div>
                    <div className="text-gray-400 text-xs font-medium print:text-black">pièces au total</div>
                  </div>
                </div>
              </div>

              {/* Sous-totaux détaillés */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {/* Sous-total Clients - uniquement si > 0 */}
                {totauxParProduit.reduce((acc, p) => acc + (p.totalClient || 0), 0) > 0 && (
                  <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4 shadow-sm print:border-black print:shadow-none print:rounded-none">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                          <Icon icon="mdi:account-group" className="text-base sm:text-lg text-gray-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm sm:text-base font-semibold text-gray-900 truncate">Production Clients</h3>
                          <p className="text-xs text-gray-500 truncate">Commandes clients uniquement</p>
                        </div>
                      </div>
                      <div className="text-left sm:text-right w-full sm:w-auto">
                        <div className="text-xl sm:text-2xl font-bold text-gray-800">
                          {totauxParProduit.reduce((acc, p) => acc + (p.totalClient || 0), 0)}
                        </div>
                        <div className="text-xs text-gray-500">pièces</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sous-total Boutique - uniquement si > 0 */}
                {totauxParProduit.reduce((acc, p) => acc + (p.totalBoutique || 0), 0) > 0 && (
                  <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4 shadow-sm print:border-black print:shadow-none print:rounded-none">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                          <Icon icon="mdi:storefront" className="text-base sm:text-lg text-blue-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm sm:text-base font-semibold text-gray-900 truncate">Production Boutique</h3>
                          <p className="text-xs text-gray-500 truncate">Vente directe uniquement</p>
                        </div>
                      </div>
                      <div className="text-left sm:text-right w-full sm:w-auto">
                        <div className="text-xl sm:text-2xl font-bold text-blue-600">
                          {totauxParProduit.reduce((acc, p) => acc + (p.totalBoutique || 0), 0)}
                        </div>
                        <div className="text-xs text-gray-500">pièces</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Saisie de la Production Réelle */}
              <div className="bg-white border-2 border-indigo-100 rounded-xl p-4 shadow-sm print:hidden">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <Icon icon="mdi:checkbox-marked-circle-plus-outline" className="text-xl text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">Ajustement Production Réelle</h3>
                    <p className="text-xs text-gray-500">Saisissez les quantités si elles diffèrent du prévu</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {totauxParProduit.map((item) => (
                    <div key={item.produitId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <span className="font-medium text-gray-700 text-sm truncate mr-2 flex-1" title={item.produit?.nom}>
                        {item.produit?.nom}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-gray-400">Prévu: {item.totalGlobal}</div>
                        <input
                          type="number"
                          min="0"
                          className="w-20 px-2 py-1 text-right text-sm font-bold border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder={String(item.totalGlobal)}
                          value={item.quantiteProduiteReelle ?? ''}
                          onChange={(e) => {
                            const val = e.target.value === '' ? undefined : Number(e.target.value);
                            if (val !== undefined) {
                              setQuantiteProduite(item.produitId, val);
                            }
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-4">
                  <button
                    onClick={() => {
                      if (window.confirm("Êtes-vous sûr de vouloir valider la production ? Cela déduira les stocks basés sur ces quantités.")) {
                        useProductionStore.getState().validerProduction();
                      }
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium transition-colors ${programmeActuel?.statut === 'produit'
                      ? 'bg-green-600 cursor-default'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                      }`}
                    disabled={programmeActuel?.statut === 'produit'}
                  >
                    <Icon icon={programmeActuel?.statut === 'produit' ? "mdi:check-circle" : "mdi:check"} className="text-xl" />
                    <span>{programmeActuel?.statut === 'produit' ? 'Production Validée' : 'Valider la Production'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Section Matin - Clients uniquement */}
            {Array.from(repartitionsClients.entries()).some(([_, repartition]) =>
              (repartition.car1Matin + repartition.car2Matin) > 0
            ) && (
                <section data-section="production-matin">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                      <Icon icon="wi:sunrise" className="text-xl text-gray-500" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-700">Production Clients - Matin</h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 print:grid-cols-3 print:gap-4">
                    {Array.from(repartitionsClients.entries())
                      .filter(([_, repartition]) => (repartition.car1Matin + repartition.car2Matin) > 0)
                      .map(([produitId, repartition]) => {
                        const produit = totauxParProduit.find(p => p.produitId === produitId)?.produit;
                        const car1 = repartition.car1Matin;
                        const car2 = repartition.car2Matin;
                        const total = car1 + car2;

                        return (
                          <div key={`matin-${produitId}`} className="relative bg-white border border-gray-200 border-t-4 border-t-gray-600 rounded-xl p-4 hover:border-gray-300 hover:shadow-md transition-all print:border-black print:shadow-none print:rounded-none print:p-4 print:break-inside-avoid flex flex-col h-full">
                            <div className="absolute top-3 right-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Matin</div>

                            {/* En-tête Produit */}
                            <div className="flex items-center gap-3 mb-4 pt-2">
                              <div className="w-12 h-12 bg-gray-600 rounded-xl flex items-center justify-center shadow-sm shrink-0">
                                <Icon icon={getProductIcon(produit?.nom || '')} className="text-xl text-white" />
                              </div>
                              <h3 className="text-lg font-bold text-gray-900 leading-tight">
                                {produit?.nom || 'Produit'}
                              </h3>
                            </div>

                            {/* Détail Car 1 / Car 2 - masquer si 0 */}
                            <div className="flex-1">
                              <div className="space-y-2 mb-3">
                                {car1 > 0 && (
                                  <div className="bg-gray-50 rounded-lg p-2 text-center border border-gray-100">
                                    <div className="text-xs font-bold text-gray-500 uppercase mb-0.5">Car 1 Matin</div>
                                    <div className="text-2xl font-bold text-gray-700">{car1}</div>
                                    <div className="text-xs text-gray-500">pièces</div>
                                  </div>
                                )}
                                {car2 > 0 && (
                                  <div className="bg-gray-50 rounded-lg p-2 text-center border border-gray-100">
                                    <div className="text-xs font-bold text-gray-500 uppercase mb-0.5">Car 2 Matin</div>
                                    <div className="text-2xl font-bold text-gray-700">{car2}</div>
                                    <div className="text-xs text-gray-500">pièces</div>
                                  </div>
                                )}
                              </div>

                              {/* Total Matin - toujours en bas */}
                              <div className="flex justify-between items-center pt-2 border-t border-gray-100 mt-auto">
                                <span className="text-xs font-medium text-gray-500">Total Matin Clients</span>
                                <div className="flex items-baseline gap-1">
                                  <span className="text-xl font-bold text-gray-800">{total}</span>
                                  <span className="text-sm text-gray-500">pc</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </section>
              )}

            {/* Section Soir - Clients uniquement */}
            {Array.from(repartitionsClients.entries()).some(([_, repartition]) => repartition.carSoir > 0) && (
              <section className="pt-8 border-t border-gray-200" data-section="production-soir">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                    <Icon icon="wi:sunset" className="text-xl text-gray-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-600">Production Clients - Soir</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 print:grid-cols-3 print:gap-4">
                  {Array.from(repartitionsClients.entries())
                    .filter(([_, repartition]) => repartition.carSoir > 0)
                    .map(([produitId, repartition]) => {
                      const produit = totauxParProduit.find(p => p.produitId === produitId)?.produit;
                      const total = repartition.carSoir;

                      return (
                        <div key={`soir-${produitId}`} className="relative bg-white border border-gray-200 border-t-4 border-t-gray-300 rounded-xl p-4 hover:border-gray-300 hover:shadow-md transition-all print:border-black print:shadow-none print:rounded-none print:p-4 print:break-inside-avoid">
                          <div className="absolute top-3 right-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Soir</div>
                          <div className="flex items-center gap-3 mb-6 pt-2">
                            <div className="w-14 h-14 bg-gray-400 rounded-xl flex items-center justify-center shadow-sm shrink-0">
                              <Icon icon={getProductIcon(produit?.nom || '')} className="text-2xl text-white" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 leading-tight">
                              {produit?.nom || 'Produit'}
                            </h3>
                          </div>

                          <div className="text-center mb-2">
                            <div className="text-6xl font-bold text-gray-800 tracking-tight leading-none">{total}</div>
                            <div className="text-base text-gray-500 font-medium mt-1">pièces clients</div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </section>
            )}

            {/* Section Production pour Boutique */}
            {programmeActuel?.quantitesBoutique && programmeActuel.quantitesBoutique.length > 0 && (
              <section className="pt-8 border-t border-gray-200" data-section="production-boutique">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <Icon icon="mdi:storefront" className="text-xl text-blue-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-blue-700">Production pour Boutique</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 print:grid-cols-3 print:gap-4">
                  {programmeActuel.quantitesBoutique.map(quantite => {
                    const produit = produits?.find((p: any) => p.id === quantite.produitId);
                    const repartition = quantite.repartitionCars;

                    return (
                      <div key={`boutique-${quantite.produitId}`} className="relative bg-white border-2 border-blue-200 rounded-xl p-4 hover:shadow-lg transition-all print:border-black print:shadow-none print:rounded-none print:p-4 print:break-inside-avoid">
                        <div className="absolute top-3 right-4 text-xs font-bold text-blue-500 uppercase tracking-widest">Boutique</div>

                        {/* En-tête Produit */}
                        <div className="flex items-center gap-3 mb-4 pt-2">
                          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm shrink-0">
                            <Icon icon={getProductIcon(produit?.nom || '')} className="text-xl text-white" />
                          </div>
                          <h3 className="text-lg font-bold text-gray-900 leading-tight">
                            {produit?.nom || 'Produit'}
                          </h3>
                        </div>

                        {/* Total Boutique */}
                        <div className="bg-blue-50 rounded-lg p-3 mb-3 text-center">
                          <div className="text-xs font-bold text-blue-600 uppercase mb-0.5">Total Boutique</div>
                          <div className="text-3xl font-bold text-blue-800">{quantite.quantite}</div>
                          <div className="text-xs text-blue-600">pièces</div>
                        </div>

                        {/* Répartition par cars si disponible */}
                        {repartition && (
                          <div className="space-y-2">
                            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">
                              Répartition par cars:
                            </div>

                            {repartition.car1_matin > 0 && (
                              <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
                                <span className="text-sm font-medium text-gray-700">Car 1 Matin</span>
                                <span className="font-bold text-gray-800">{repartition.car1_matin}</span>
                              </div>
                            )}

                            {repartition.car2_matin > 0 && (
                              <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
                                <span className="text-sm font-medium text-gray-700">Car 2 Matin</span>
                                <span className="font-bold text-gray-800">{repartition.car2_matin}</span>
                              </div>
                            )}

                            {repartition.car_soir > 0 && (
                              <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
                                <span className="text-sm font-medium text-gray-700">Car Soir</span>
                                <span className="font-bold text-gray-800">{repartition.car_soir}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Section Récapitulatif par Car (Clients + Boutique) */}
            <section className="pt-8 border-t border-gray-200" data-section="recap-cars">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                  <Icon icon="mdi:truck-delivery" className="text-xl text-orange-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800">Récapitulatif Global par Car</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:grid-cols-3 print:gap-4">
                {['car1_matin', 'car2_matin', 'car_soir'].map((carKey) => {
                  const carLabel = carKey === 'car1_matin' ? 'Car 1 Matin' :
                    carKey === 'car2_matin' ? 'Car 2 Matin' : 'Car Soir';
                  const carColor = carKey === 'car_soir' ? 'border-gray-600' : 'border-orange-500';
                  const carBg = carKey === 'car_soir' ? 'bg-gray-50' : 'bg-orange-50';

                  // Calculer les totaux pour ce car (Clients + Boutique)
                  const totauxCar = new Map<string, number>();

                  // 1. Ajouter les quantités Clients
                  Array.from(repartitionsClients.entries()).forEach(([produitId, repartition]) => {
                    const qty = carKey === 'car1_matin' ? repartition.car1Matin :
                      carKey === 'car2_matin' ? repartition.car2Matin :
                        repartition.carSoir;
                    if (qty > 0) {
                      totauxCar.set(produitId, (totauxCar.get(produitId) || 0) + qty);
                    }
                  });

                  // 2. Ajouter les quantités Boutique
                  if (programmeActuel?.quantitesBoutique) {
                    programmeActuel.quantitesBoutique.forEach(q => {
                      const qty = carKey === 'car1_matin' ? (q.repartitionCars?.car1_matin || 0) :
                        carKey === 'car2_matin' ? (q.repartitionCars?.car2_matin || 0) :
                          (q.repartitionCars?.car_soir || 0);
                      if (qty > 0) {
                        totauxCar.set(q.produitId, (totauxCar.get(q.produitId) || 0) + qty);
                      }
                    });
                  }

                  const produitsDuCar = Array.from(totauxCar.entries());

                  if (produitsDuCar.length === 0) return null;

                  return (
                    <div key={carKey} className={`bg-white border-t-4 ${carColor} rounded-xl shadow-sm overflow-hidden print:border print:border-black print:shadow-none print:rounded-none h-full`}>
                      <div className={`${carBg} p-3 border-b border-gray-100 print:bg-gray-100 print:border-black`}>
                        <h3 className="text-lg font-bold text-gray-900 text-center uppercase tracking-wide">{carLabel}</h3>
                        <div className="text-center text-xs text-gray-500 font-medium print:text-black mt-1">
                          Clients + Boutique
                        </div>
                      </div>

                      <div className="p-0">
                        <table className="w-full text-sm">
                          <thead className="bg-white border-b border-gray-100">
                            <tr>
                              <th className="px-4 py-2 text-left font-semibold text-gray-600 print:text-black">Produit</th>
                              <th className="px-4 py-2 text-right font-semibold text-gray-600 print:text-black">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {produitsDuCar.map(([produitId, total]) => {
                              // Chercher d'abord dans totauxParProduit, sinon dans la liste globale des produits
                              let produit = totauxParProduit.find(p => p.produitId === produitId)?.produit;
                              if (!produit && produits) {
                                produit = produits.find(p => p.id === produitId);
                              }

                              return (
                                <tr key={produitId} className="hover:bg-gray-50/50">
                                  <td className="px-4 py-2.5 text-gray-800 font-medium">
                                    {produit?.nom || 'Inconnu'}
                                  </td>
                                  <td className="px-4 py-2.5 text-right font-bold text-gray-900 text-base">
                                    {total}
                                  </td>
                                </tr>
                              );
                            })}
                            <tr className="bg-gray-50 border-t-2 border-gray-100 print:border-black print:bg-gray-100">
                              <td className="px-4 py-3 text-left font-bold text-gray-900 uppercase text-xs">Total Général</td>
                              <td className="px-4 py-3 text-right font-black text-gray-900 text-lg">
                                {produitsDuCar.reduce((acc, [, t]) => acc + t, 0)}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {!Array.from(repartitionsClients.entries()).some(([_, repartition]) =>
              (repartition.car1Matin + repartition.car2Matin + repartition.carSoir) > 0) &&
              (!programmeActuel?.quantitesBoutique || programmeActuel.quantitesBoutique.length === 0) && (
                <div className="text-center py-12 text-gray-500">
                  <p>Aucune quantité à produire trouvée dans le programme.</p>
                </div>
              )}

            {/* Résumé pour impression uniquement */}
            <div className="hidden print:block print:mt-8">
              <div className="border-t-2 border-black pt-4">
                <h3 className="text-lg font-bold mb-4">📋 RÉSUMÉ DE PRODUCTION</h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="border border-black p-3">
                    <div className="font-bold mb-2">👥 PRODUCTION CLIENTS</div>
                    <div>Matin: {Array.from(repartitionsClients.entries()).reduce((acc, [_, repartition]) => acc + repartition.car1Matin + repartition.car2Matin, 0)} pièces</div>
                    <div>Soir: {Array.from(repartitionsClients.entries()).reduce((acc, [_, repartition]) => acc + repartition.carSoir, 0)} pièces</div>
                    <div className="font-bold">Total: {totauxParProduit.reduce((acc, p) => acc + (p.totalClient || 0), 0)} pièces</div>
                  </div>
                  <div className="border border-black p-3">
                    <div className="font-bold mb-2">🏪 PRODUCTION BOUTIQUE</div>
                    <div>Total: {totauxParProduit.reduce((acc, p) => acc + p.totalBoutique, 0)} pièces</div>
                    <div>Produits: {totauxParProduit.filter(p => p.totalBoutique > 0).length}</div>
                  </div>
                  <div className="border border-black p-3">
                    <div className="font-bold mb-2">📊 TOTAL GÉNÉRAL</div>
                    <div className="text-xl font-bold">
                      {totauxParProduit.reduce((acc, p) => acc + p.totalGlobal, 0)} pièces
                    </div>
                  </div>
                </div>
                <div className="mt-4 text-xs text-center border-t border-gray-300 pt-2">
                  Document généré automatiquement - Boulangerie App - {new Date().toLocaleDateString('fr-FR')}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bouton flottant pour aller à la section Production */}
      {programmeActuel && (
        <button
          onClick={() => {
            const productionSection = document.querySelector('[data-section="production-matin"]') ||
              document.querySelector('[data-section="production-soir"]') ||
              document.querySelector('[data-section="production-boutique"]');
            if (productionSection) {
              productionSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }}
          className="fixed bottom-6 right-6 z-10 bg-gray-800 text-white rounded-full p-4 shadow-lg hover:bg-gray-700 transition-all duration-300 hover:scale-105 print:hidden"
          title="Aller à la section Production"
        >
          <Icon icon="mdi:arrow-down-bold" className="text-xl" />
        </button>
      )}
    </div>
  );
};