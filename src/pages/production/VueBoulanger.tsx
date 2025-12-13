import React, { useEffect } from 'react';
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
  const { programmeActuel, chargerProgramme, produits } = useProductionStore();

  // Calculer les répartitions clients uniquement (sans boutique)
  const calculerRepartitionsClients = () => {
    if (!programmeActuel?.commandesClients) return [];

    const repartitionsClients = new Map<string, {
      car1Matin: number;
      car2Matin: number;
      carSoir: number;
    }>();

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
    // Charger le programme du jour
    const aujourd_hui = new Date();
    chargerProgramme(aujourd_hui);
  }, [chargerProgramme]);

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
                // Correction pour les anciens programmes
                const dateCreation = programmeActuel.dateCreation;
                const dateProduction = programmeActuel.dateProduction;
                const sameDay = dateCreation.toDateString() === dateProduction.toDateString();

                if (sameDay) {
                  const correctedDate = new Date(dateProduction);
                  correctedDate.setDate(correctedDate.getDate() + 1);
                  return correctedDate.toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  });
                } else {
                  return dateProduction.toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  });
                }
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
      <div className="bg-white border-b border-gray-200 px-6 py-4 print:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center">
              <Icon icon="mdi:chef-hat" className="text-2xl text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Vue Boulanger
              </h1>
              <p className="text-sm text-gray-500">
                Programme de production journalier
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Bouton d'impression HTML */}
            {programmeActuel && (
              <button
                onClick={handleGenerateHTML}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <Icon icon="mdi:printer" className="text-lg" />
                <span className="font-medium">Imprimer le document</span>
              </button>
            )}

            {/* Statut simple */}
            {programmeActuel && (
               <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${
                 programmeActuel.statut === 'envoye'
                   ? 'bg-green-50 text-green-700 border-green-200'
                   : 'bg-gray-50 text-gray-700 border-gray-200'
               }`}>
                 <Icon
                   icon={programmeActuel.statut === 'envoye' ? 'mdi:check-circle' : 'mdi:clock-outline'}
                   className="text-sm"
                 />
                 {programmeActuel.statut === 'envoye' ? 'Confirmé' : 'En attente'}
               </div>
            )}
          </div>
        </div>
      </div>

      {/* Section Date de Production */}
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 print:hidden">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <Icon icon="mdi:calendar-clock" className="text-lg text-blue-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Programme de Production</h2>
            </div>

            {/* Carte d'information de production à droite */}
            {programmeActuel && (
              <div className="bg-gradient-to-l from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 shadow-sm min-w-[320px]">
                <div className="flex items-center gap-3">
                  <div className="flex-1 text-right">
                    <div className="flex items-center justify-end gap-2 mb-1">
                      <span className="text-sm font-medium text-blue-700">Production programmée</span>
                      <Icon icon="mdi:calendar-check" className="text-blue-600" />
                    </div>
                    <div className="text-lg font-bold text-gray-900">
                      {(() => {
                        // Vérifier si dateProduction est la même que dateCreation (ancien système)
                        const dateCreation = programmeActuel.dateCreation;
                        const dateProduction = programmeActuel.dateProduction;

                        // Si les dates sont identiques (même jour), c'est un ancien programme
                        const sameDay = dateCreation.toDateString() === dateProduction.toDateString();

                        if (sameDay) {
                          // Corriger en ajoutant 1 jour à la date de production
                          const correctedDate = new Date(dateProduction);
                          correctedDate.setDate(correctedDate.getDate() + 1);
                          return correctedDate.toLocaleDateString('fr-FR', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          });
                        } else {
                          // Nouvelle logique, afficher dateProduction telle quelle
                          return dateProduction.toLocaleDateString('fr-FR', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          });
                        }
                      })()}
                    </div>
                    <div className="flex items-center justify-end gap-1 mt-1 text-xs text-gray-600">
                      <span>Créé le {programmeActuel.dateCreation.toLocaleDateString('fr-FR')} à {programmeActuel.dateCreation.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                      <Icon icon="mdi:clock-outline" className="text-gray-400" />
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                    <Icon icon="mdi:factory" className="text-2xl text-white" />
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
                const aujourd_hui = new Date();
                chargerProgramme(aujourd_hui);
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
              <div className="bg-gray-700 text-white rounded-xl p-6 shadow-sm print:bg-white print:text-black print:border-2 print:border-black print:shadow-none print:rounded-none">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-gray-600 rounded-lg print:bg-gray-200 print:text-black">
                      <Icon icon="mdi:sigma" className="text-2xl" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold print:text-lg">TOTAL GÉNÉRAL</h2>
                      <p className="text-gray-400 text-sm print:text-black print:text-sm">Production complète (Clients + Boutique)</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-4xl font-bold print:text-2xl">
                      {totauxParProduit.reduce((acc, p) => acc + p.totalGlobal, 0)}
                    </div>
                    <div className="text-gray-400 text-sm font-medium print:text-black">pièces au total</div>
                  </div>
                </div>
              </div>

              {/* Sous-totaux détaillés */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Sous-total Clients - uniquement si > 0 */}
                {totauxParProduit.reduce((acc, p) => acc + (p.totalClient || 0), 0) > 0 && (
                  <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm print:border-black print:shadow-none print:rounded-none">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                          <Icon icon="mdi:account-group" className="text-lg text-gray-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">Production Clients</h3>
                          <p className="text-xs text-gray-500">Commandes clients uniquement</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-800">
                          {totauxParProduit.reduce((acc, p) => acc + (p.totalClient || 0), 0)}
                        </div>
                        <div className="text-xs text-gray-500">pièces</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sous-total Boutique - uniquement si > 0 */}
                {totauxParProduit.reduce((acc, p) => acc + (p.totalBoutique || 0), 0) > 0 && (
                  <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm print:border-black print:shadow-none print:rounded-none">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Icon icon="mdi:storefront" className="text-lg text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">Production Boutique</h3>
                          <p className="text-xs text-gray-500">Vente directe uniquement</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-blue-600">
                          {totauxParProduit.reduce((acc, p) => acc + (p.totalBoutique || 0), 0)}
                        </div>
                        <div className="text-xs text-gray-500">pièces</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Section Matin - Clients uniquement */}
            {Array.from(repartitionsClients.entries()).some(([_, repartition]) =>
              (repartition.car1Matin + repartition.car2Matin) > 0
            ) && (
              <section data-section="production-matin">
                 <div className="flex items-center gap-3 mb-6">
                   <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                      <Icon icon="wi:sunrise" className="text-xl text-gray-500" />
                   </div>
                   <h2 className="text-2xl font-bold text-gray-700">Production Clients - Matin</h2>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 print:grid-cols-3 print:gap-4">
                   {Array.from(repartitionsClients.entries())
                     .filter(([_, repartition]) => (repartition.car1Matin + repartition.car2Matin) > 0)
                     .map(([produitId, repartition]) => {
                       const produit = totauxParProduit.find(p => p.produitId === produitId)?.produit;
                       const car1 = repartition.car1Matin;
                       const car2 = repartition.car2Matin;
                       const total = car1 + car2;

                       return (
                         <div key={`matin-${produitId}`} className="relative bg-white border border-gray-200 border-t-4 border-t-gray-600 rounded-xl p-6 hover:border-gray-300 hover:shadow-md transition-all print:border-black print:shadow-none print:rounded-none print:p-4 print:break-inside-avoid flex flex-col h-full">
                           <div className="absolute top-3 right-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Matin</div>

                           {/* En-tête Produit */}
                           <div className="flex items-center gap-4 mb-6 pt-2">
                             <div className="w-14 h-14 bg-gray-600 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
                               <Icon icon={getProductIcon(produit?.nom || '')} className="text-2xl text-white" />
                             </div>
                             <h3 className="text-xl font-bold text-gray-900 leading-tight">
                               {produit?.nom || 'Produit'}
                             </h3>
                           </div>

                           {/* Détail Car 1 / Car 2 - masquer si 0 */}
                           <div className="flex-1">
                             <div className="space-y-3 mb-4">
                               {car1 > 0 && (
                                 <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
                                   <div className="text-xs font-bold text-gray-500 uppercase mb-1">Car 1 Matin</div>
                                   <div className="text-3xl font-bold text-gray-700">{car1}</div>
                                   <div className="text-xs text-gray-500">pièces</div>
                                 </div>
                               )}
                               {car2 > 0 && (
                                 <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
                                   <div className="text-xs font-bold text-gray-500 uppercase mb-1">Car 2 Matin</div>
                                   <div className="text-3xl font-bold text-gray-700">{car2}</div>
                                   <div className="text-xs text-gray-500">pièces</div>
                                 </div>
                               )}
                             </div>

                             {/* Total Matin - toujours en bas */}
                             <div className="flex justify-between items-center pt-3 border-t border-gray-100 mt-auto">
                               <span className="text-sm font-medium text-gray-500">Total Matin Clients</span>
                               <div className="flex items-baseline gap-1">
                                 <span className="text-2xl font-bold text-gray-800">{total}</span>
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
                         <div key={`soir-${produitId}`} className="relative bg-white border border-gray-200 border-t-4 border-t-gray-300 rounded-xl p-6 hover:border-gray-300 hover:shadow-md transition-all print:border-black print:shadow-none print:rounded-none print:p-4 print:break-inside-avoid">
                           <div className="absolute top-3 right-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Soir</div>
                           <div className="flex items-center gap-4 mb-8 pt-2">
                             <div className="w-16 h-16 bg-gray-400 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
                               <Icon icon={getProductIcon(produit?.nom || '')} className="text-3xl text-white" />
                             </div>
                             <h3 className="text-xl font-bold text-gray-900 leading-tight">
                               {produit?.nom || 'Produit'}
                             </h3>
                           </div>

                           <div className="text-center mb-2">
                             <div className="text-7xl font-bold text-gray-800 tracking-tight leading-none">{total}</div>
                             <div className="text-lg text-gray-500 font-medium mt-1">pièces clients</div>
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
                      <div key={`boutique-${quantite.produitId}`} className="relative bg-white border-2 border-blue-200 rounded-xl p-6 hover:shadow-lg transition-all print:border-black print:shadow-none print:rounded-none print:p-4 print:break-inside-avoid">
                        <div className="absolute top-3 right-4 text-xs font-bold text-blue-500 uppercase tracking-widest">Boutique</div>

                        {/* En-tête Produit */}
                        <div className="flex items-center gap-4 mb-6 pt-2">
                          <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
                            <Icon icon={getProductIcon(produit?.nom || '')} className="text-2xl text-white" />
                          </div>
                          <h3 className="text-xl font-bold text-gray-900 leading-tight">
                            {produit?.nom || 'Produit'}
                          </h3>
                        </div>

                        {/* Total Boutique */}
                        <div className="bg-blue-50 rounded-lg p-4 mb-4 text-center">
                          <div className="text-sm font-bold text-blue-600 uppercase mb-1">Total Boutique</div>
                          <div className="text-4xl font-bold text-blue-800">{quantite.quantite}</div>
                          <div className="text-sm text-blue-600">pièces</div>
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

            {!Array.from(repartitionsClients.entries()).some(([_, repartition]) =>
               (repartition.car1Matin + repartition.car2Matin + repartition.carSoir) > 0) &&
             (!programmeActuel?.quantitesBoutique || programmeActuel.quantitesBoutique.length === 0) && (
               <div className="text-center py-12 text-gray-500">
                  <p>Aucune quantité à produire trouvée dans le programme.</p>
               </div>
            )}

            {/* Résumé pour impression uniquement */}
            <div className="hidden print:block print:break-before-page print:mt-8">
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