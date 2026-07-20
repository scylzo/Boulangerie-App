/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { useProductionStore } from '../../store';
import { useLivreurStore } from '../../store/livreurStore';
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

    .print\\:bg-sand-200 {
      background-color: #e5e7eb !important;
    }
  }
`;


export const VueBoulanger: React.FC = () => {
  const { programmeActuel, chargerProgramme, chargerProduits, produits, setQuantiteProduite, clients, chargerClients } = useProductionStore();
  const { livreurs, chargerLivreurs } = useLivreurStore();
  const [dateSelectionnee, setDateSelectionnee] = useState(new Date().toISOString().split('T')[0]);

  // Chargement initial des données
  useEffect(() => {
    const initialiser = async () => {
      await chargerProduits();
      await chargerClients();
      await chargerLivreurs();
    };
    initialiser();
  }, [chargerProduits, chargerClients, chargerLivreurs]);

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

  // Calculer la répartition par livreur (et boutique)
  const calculerDispatchParLivreur = () => {
    const dispatch: Record<string, {
      nom: string;
      car1_matin: Record<string, number>;
      car2_matin: Record<string, number>;
      car_soir: Record<string, number>;
    }> = {};

    // 1. Clients
    if (programmeActuel?.commandesClients) {
      programmeActuel.commandesClients
        .filter(commande => commande.statut !== 'annulee')
        .forEach(commande => {
          const clientObj = clients.find(c => c.id === commande.clientId);
          commande.produits.forEach(item => {
            const repartition = item.repartitionCars || { car1_matin: 0, car2_matin: 0, car_soir: 0 };
            const cars: ('car1_matin' | 'car2_matin' | 'car_soir')[] = ['car1_matin', 'car2_matin', 'car_soir'];
            
            cars.forEach(car => {
              const qty = Number(repartition[car]) || 0;
              if (qty > 0) {
                const livreurId = clientObj?.livreursParCar?.[car] || clientObj?.livreurId || 'non-assigne';
                let livreurNom = 'Non assigné';
                if (livreurId !== 'non-assigne') {
                  const l = livreurs.find(drv => drv.id === livreurId);
                  livreurNom = l ? l.nom : `Livreur Inconnu`;
                }
                
                if (!dispatch[livreurId]) {
                  dispatch[livreurId] = {
                    nom: livreurNom,
                    car1_matin: {},
                    car2_matin: {},
                    car_soir: {}
                  };
                }
                
                const currentQty = dispatch[livreurId][car][item.produitId] || 0;
                dispatch[livreurId][car][item.produitId] = currentQty + qty;
              }
            });
          });
        });
    }

    // 2. Boutique
    if (programmeActuel?.quantitesBoutique && programmeActuel.quantitesBoutique.length > 0) {
      const boutiqueId = 'boutique-directe';
      dispatch[boutiqueId] = {
        nom: 'Boutique (Vente Directe)',
        car1_matin: {},
        car2_matin: {},
        car_soir: {}
      };

      programmeActuel.quantitesBoutique.forEach(q => {
        const repartition = q.repartitionCars || { car1_matin: 0, car2_matin: 0, car_soir: 0 };
        const cars: ('car1_matin' | 'car2_matin' | 'car_soir')[] = ['car1_matin', 'car2_matin', 'car_soir'];
        
        cars.forEach(car => {
          const qty = Number(repartition[car]) || 0;
          if (qty > 0) {
            dispatch[boutiqueId][car][q.produitId] = qty;
          }
        });
      });

      // Si aucune quantité dans la boutique, on l'enlève
      const totalBoutiqueQty = Object.values(dispatch[boutiqueId].car1_matin).reduce((a, b) => a + b, 0) +
                               Object.values(dispatch[boutiqueId].car2_matin).reduce((a, b) => a + b, 0) +
                               Object.values(dispatch[boutiqueId].car_soir).reduce((a, b) => a + b, 0);
      if (totalBoutiqueQty === 0) {
        delete dispatch[boutiqueId];
      }
    }

    return dispatch;
  };

  const dispatchParLivreur = calculerDispatchParLivreur();

  // Fonction pour générer le document HTML d'impression
  const handleGenerateHTML = () => {
    console.log('🖨️ Bouton impression cliqué');
    console.log('📋 Programme actuel:', programmeActuel);
    console.log('🥖 Produits:', produits?.length, 'produits disponibles');

    if (programmeActuel && produits) {
      console.log('✅ Génération du rapport HTML...');
      try {
        htmlPrintService.generateProductionReportHTML(programmeActuel, produits, livreurs, clients);
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

  const handleShareWhatsApp = () => {
    if (!programmeActuel) return;

    const dateStr = programmeActuel.dateProduction.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    let message = `*PROGRAMME DE PRODUCTION - ${dateStr.toUpperCase()}*\n\n`;

    // Total Général
    const totalGeneral = totauxParProduit.reduce((acc, p) => acc + p.totalGlobal, 0);
    message += `*TOTAL GÉNÉRAL : ${totalGeneral} pièces*\n`;
    message += `--------------------------------\n`;

    // 1. Récapitulatif par Car
    ['car1_matin', 'car2_matin', 'car_soir'].forEach(carKey => {
      const carLabel = carKey === 'car1_matin' ? 'Car 1 Matin' :
        carKey === 'car2_matin' ? 'Car 2 Matin' : 'Car Soir';

      const totauxCar = new Map<string, number>();

      // Clients
      Array.from(repartitionsClients.entries()).forEach(([produitId, repartition]) => {
        const qty = carKey === 'car1_matin' ? repartition.car1Matin :
          carKey === 'car2_matin' ? repartition.car2Matin :
            repartition.carSoir;
        if (qty > 0) totauxCar.set(produitId, (totauxCar.get(produitId) || 0) + qty);
      });

      // Boutique
      if (programmeActuel.quantitesBoutique) {
        programmeActuel.quantitesBoutique.forEach(q => {
          const qty = carKey === 'car1_matin' ? (q.repartitionCars?.car1_matin || 0) :
            carKey === 'car2_matin' ? (q.repartitionCars?.car2_matin || 0) :
              (q.repartitionCars?.car_soir || 0);
          if (qty > 0) totauxCar.set(q.produitId, (totauxCar.get(q.produitId) || 0) + qty);
        });
      }

      if (totauxCar.size > 0) {
        message += `\n*${carLabel.toUpperCase()} :*\n`;
        Array.from(totauxCar.entries()).forEach(([produitId, total]) => {
          const produit = produits?.find(p => p.id === produitId);
          message += `- ${produit?.nom || 'Inconnu'} : *${total}*\n`;
        });
        message += `_Total ${carLabel} : ${Array.from(totauxCar.values()).reduce((a, b) => a + b, 0)}_\n`;
      }
    });

    message += `\n--------------------------------\n`;
    message += `_Boulangerie Chez Mina_`;

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
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
    <div className="min-h-screen bg-sand-100 print:bg-white print:text-black">
      {/* En-tête pour impression uniquement */}
      <div className="hidden print:block print:mb-4">
        <div className="text-center border-b-2 border-black pb-4 mb-6">
          <h1 className="font-display text-2xl font-semibold mb-2">🥖 PROGRAMME DE PRODUCTION</h1>
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
            <div className="text-xs text-sand-600 mt-2">
              Programme créé le {programmeActuel.dateCreation.toLocaleDateString('fr-FR')} à {programmeActuel.dateCreation.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      </div>

      {/* Header sobre */}
      <div className="bg-white border-b border-sand-200 px-4 sm:px-6 py-3 sm:py-4 print:hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <div className="w-10 h-10 bg-terracotta-500 rounded-xl flex items-center justify-center shrink-0">
              <Icon icon="mdi:chef-hat" className="text-xl text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl font-semibold text-sand-900 truncate">
                Vue Boulanger
              </h1>
              <p className="text-xs sm:text-sm text-sand-500 truncate">
                Programme de production journalier
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
            {/* Date Picker Helper */}
            <div className="flex items-center gap-2 bg-sand-50 border border-sand-300 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-sand-900 transition-all w-full sm:w-auto">
              <Icon icon="mdi:calendar" className="text-sand-500 shrink-0" />
              <input
                type="date"
                value={dateSelectionnee}
                onChange={(e) => setDateSelectionnee(e.target.value)}
                className="bg-transparent border-none text-xs sm:text-sm text-sand-700 font-medium focus:ring-0 cursor-pointer outline-none w-full"
              />
            </div>

            {/* Bouton d'impression HTML */}
            {programmeActuel && (
              <div className="flex gap-2">
                <button
                  onClick={handleGenerateHTML}
                  className="flex-1 flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-sand-900 text-white rounded-lg hover:bg-sand-800 transition-colors text-xs sm:text-sm font-medium"
                >
                  <Icon icon="mdi:printer" className="text-base sm:text-lg" />
                  <span>Imprimer</span>
                </button>
                <button
                  onClick={handleShareWhatsApp}
                  className="flex-1 flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-success-600 text-white rounded-lg hover:bg-success-700 transition-colors text-xs sm:text-sm font-medium shadow-sm"
                >
                  <Icon icon="mdi:whatsapp" className="text-base sm:text-lg" />
                  <span>Partager</span>
                </button>
              </div>
            )}

            {/* Statut simple */}
            {programmeActuel && (
              <div className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium border ${programmeActuel.statut === 'envoye'
                ? 'bg-success-50 text-success-700 border-success-100'
                : 'bg-sand-50 text-sand-700 border-sand-200'
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
      <div className="bg-sand-50 border-b border-sand-200 px-4 sm:px-6 py-3 sm:py-4 print:hidden">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 bg-info-100 rounded-lg flex items-center justify-center shrink-0">
                <Icon icon="mdi:calendar-clock" className="text-lg text-info-600" />
              </div>
              <h2 className="text-base sm:text-lg font-semibold text-sand-900 truncate">Programme de Production</h2>
            </div>

            {/* Carte d'information de production à droite */}
            {programmeActuel && (
              <div className="bg-info-50 border border-info-100 rounded-xl p-3 sm:p-4 shadow-sm w-full lg:w-auto lg:min-w-[320px]">
                <div className="flex items-center gap-3">
                  <div className="flex-1 text-left sm:text-right min-w-0">
                    <div className="flex items-center justify-start sm:justify-end gap-2 mb-1">
                      <span className="text-xs sm:text-sm font-medium text-info-600 truncate">Production programmée</span>
                      <Icon icon="mdi:calendar-check" className="text-info-600 shrink-0" />
                    </div>
                    <div className="text-base sm:text-lg font-semibold text-sand-900 truncate">
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

                    <div className="flex items-center justify-start sm:justify-end gap-1 mt-1 text-xs text-sand-600">
                      <span className="truncate">Créé le {programmeActuel.dateCreation.toLocaleDateString('fr-FR')} à {programmeActuel.dateCreation.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                      <Icon icon="mdi:clock-outline" className="text-sand-400 shrink-0" />
                    </div>
                  </div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-sand-900 rounded-xl flex items-center justify-center shadow-card shrink-0">
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
          <div className="bg-white rounded-xl border border-sand-200 shadow-sm p-12 text-center">
            <div className="w-16 h-16 bg-sand-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon icon="mdi:bread-slice" className="text-3xl text-sand-400" />
            </div>
            <h3 className="text-lg font-medium text-sand-900 mb-2">
              Pas de production
            </h3>
            <p className="text-sand-500">
              Aucun programme n'a été défini pour le moment.
            </p>
            <button
              onClick={() => {
                const dateObj = new Date(dateSelectionnee);
                chargerProgramme(dateObj);
              }}
              className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-sand-800 text-white rounded-lg hover:bg-sand-700 transition-colors"
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
              <div className="bg-sand-900 text-white rounded-xl p-4 sm:p-6 shadow-sm print:bg-white print:text-black print:border-2 print:border-black print:shadow-none print:rounded-none">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="p-2 bg-sand-800 rounded-lg print:bg-sand-200 print:text-black shrink-0">
                      <Icon icon="mdi:sigma" className="text-lg sm:text-xl" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base sm:text-lg font-semibold print:text-lg truncate">TOTAL GÉNÉRAL</h2>
                      <p className="text-sand-400 text-xs sm:text-sm print:text-black print:text-sm truncate">Production(Clients + Boutique)</p>
                    </div>
                  </div>
                  <div className="text-left sm:text-right w-full sm:w-auto">
                    <div className="font-display text-2xl sm:text-3xl font-semibold print:text-2xl">
                      {totauxParProduit.reduce((acc, p) => acc + p.totalGlobal, 0)}
                    </div>
                    <div className="text-sand-400 text-xs font-medium print:text-black">pièces au total</div>
                  </div>
                </div>
              </div>

              {/* Sous-totaux détaillés */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {/* Sous-total Clients - uniquement si > 0 */}
                {totauxParProduit.reduce((acc, p) => acc + (p.totalClient || 0), 0) > 0 && (
                  <div className="bg-white border border-sand-200 rounded-xl p-3 sm:p-4 shadow-sm print:border-black print:shadow-none print:rounded-none">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-8 h-8 bg-sand-100 rounded-lg flex items-center justify-center shrink-0">
                          <Icon icon="mdi:account-group" className="text-base sm:text-lg text-sand-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm sm:text-base font-semibold text-sand-900 truncate">Production Clients</h3>
                          <p className="text-xs text-sand-500 truncate">Commandes clients uniquement</p>
                        </div>
                      </div>
                      <div className="text-left sm:text-right w-full sm:w-auto">
                        <div className="font-display text-xl sm:text-2xl font-semibold text-sand-800">
                          {totauxParProduit.reduce((acc, p) => acc + (p.totalClient || 0), 0)}
                        </div>
                        <div className="text-xs text-sand-500">pièces</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sous-total Boutique - uniquement si > 0 */}
                {totauxParProduit.reduce((acc, p) => acc + (p.totalBoutique || 0), 0) > 0 && (
                  <div className="bg-white border border-sand-200 rounded-xl p-3 sm:p-4 shadow-sm print:border-black print:shadow-none print:rounded-none">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-8 h-8 bg-info-100 rounded-lg flex items-center justify-center shrink-0">
                          <Icon icon="mdi:storefront" className="text-base sm:text-lg text-info-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm sm:text-base font-semibold text-sand-900 truncate">Production Boutique</h3>
                          <p className="text-xs text-sand-500 truncate">Vente directe uniquement</p>
                        </div>
                      </div>
                      <div className="text-left sm:text-right w-full sm:w-auto">
                        <div className="font-display text-xl sm:text-2xl font-semibold text-info-600">
                          {totauxParProduit.reduce((acc, p) => acc + (p.totalBoutique || 0), 0)}
                        </div>
                        <div className="text-xs text-sand-500">pièces</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Saisie de la Production Réelle */}
              <div className="bg-white border-2 border-terracotta-100 rounded-xl p-4 shadow-sm print:hidden">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-terracotta-100 rounded-lg">
                    <Icon icon="mdi:checkbox-marked-circle-plus-outline" className="text-xl text-terracotta-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sand-900">Ajustement Production Réelle</h3>
                    <p className="text-xs text-sand-500">Saisissez les quantités si elles diffèrent du prévu</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {totauxParProduit.map((item) => (
                    <div key={item.produitId} className="flex items-center justify-between p-3 bg-sand-50 rounded-lg border border-sand-200">
                      <span className="font-medium text-sand-700 text-sm truncate mr-2 flex-1 uppercase" title={item.produit?.nom}>
                        {item.produit?.nom}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-sand-400">Prévu: {item.totalGlobal}</div>
                        <input
                          type="number"
                          min="0"
                          className="w-20 px-2 py-1 text-right text-sm font-semibold border border-sand-300 rounded focus:ring-2 focus:ring-terracotta-500 focus:border-terracotta-500"
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

                <div className="mt-6 flex justify-end gap-3 border-t border-sand-100 pt-4">
                  <button
                    onClick={() => {
                      if (window.confirm("Êtes-vous sûr de vouloir valider la production ? Cela déduira les stocks basés sur ces quantités.")) {
                        useProductionStore.getState().validerProduction();
                      }
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium transition-colors ${programmeActuel?.statut === 'produit'
                      ? 'bg-success-600 cursor-default'
                      : 'bg-terracotta-600 hover:bg-terracotta-700'
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
                    <div className="w-8 h-8 rounded-full bg-sand-100 flex items-center justify-center">
                      <Icon icon="wi:sunrise" className="text-xl text-sand-500" />
                    </div>
                    <h2 className="font-display text-xl font-semibold text-sand-700">Production Clients - Matin</h2>
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
                          <div key={`matin-${produitId}`} className="relative bg-white border border-sand-200 border-t-4 border-t-sand-600 rounded-xl p-4 hover:border-sand-300 hover:shadow-elevated transition-all print:border-black print:shadow-none print:rounded-none print:p-4 print:break-inside-avoid flex flex-col h-full">
                            <div className="absolute top-3 right-4 text-xs font-semibold text-sand-400 uppercase tracking-widest">Matin</div>

                            {/* En-tête Produit */}
                            <div className="flex items-center gap-3 mb-4 pt-2">
                              <div className="w-12 h-12 bg-sand-600 rounded-xl flex items-center justify-center shadow-sm shrink-0">
                                <Icon icon={getProductIcon(produit?.nom || '')} className="text-xl text-white" />
                              </div>
                              <h3 className="text-lg font-semibold text-sand-900 leading-tight uppercase">
                                {produit?.nom || 'Produit'}
                              </h3>
                            </div>

                            {/* Détail Car 1 / Car 2 - masquer si 0 */}
                            <div className="flex-1">
                              <div className="space-y-2 mb-3">
                                {car1 > 0 && (
                                  <div className="bg-sand-50 rounded-lg p-2 text-center border border-sand-100">
                                    <div className="text-xs font-semibold text-sand-500 uppercase mb-0.5">Car 1 Matin</div>
                                    <div className="font-display text-2xl font-semibold text-sand-700">{car1}</div>
                                    <div className="text-xs text-sand-500">pièces</div>
                                  </div>
                                )}
                                {car2 > 0 && (
                                  <div className="bg-sand-50 rounded-lg p-2 text-center border border-sand-100">
                                    <div className="text-xs font-semibold text-sand-500 uppercase mb-0.5">Car 2 Matin</div>
                                    <div className="font-display text-2xl font-semibold text-sand-700">{car2}</div>
                                    <div className="text-xs text-sand-500">pièces</div>
                                  </div>
                                )}
                              </div>

                              {/* Total Matin - toujours en bas */}
                              <div className="flex justify-between items-center pt-2 border-t border-sand-100 mt-auto">
                                <span className="text-xs font-medium text-sand-500">Total Matin Clients</span>
                                <div className="flex items-baseline gap-1">
                                  <span className="font-display text-xl font-semibold text-sand-800">{total}</span>
                                  <span className="text-sm text-sand-500">pc</span>
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
              <section className="pt-8 border-t border-sand-200" data-section="production-soir">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-sand-200 flex items-center justify-center">
                    <Icon icon="wi:sunset" className="text-xl text-sand-600" />
                  </div>
                  <h2 className="font-display text-2xl font-semibold text-sand-600">Production Clients - Soir</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 print:grid-cols-3 print:gap-4">
                  {Array.from(repartitionsClients.entries())
                    .filter(([_, repartition]) => repartition.carSoir > 0)
                    .map(([produitId, repartition]) => {
                      const produit = totauxParProduit.find(p => p.produitId === produitId)?.produit;
                      const total = repartition.carSoir;

                      return (
                        <div key={`soir-${produitId}`} className="relative bg-white border border-sand-200 border-t-4 border-t-sand-300 rounded-xl p-4 hover:border-sand-300 hover:shadow-elevated transition-all print:border-black print:shadow-none print:rounded-none print:p-4 print:break-inside-avoid">
                          <div className="absolute top-3 right-4 text-xs font-semibold text-sand-400 uppercase tracking-widest">Soir</div>
                          <div className="flex items-center gap-3 mb-6 pt-2">
                            <div className="w-14 h-14 bg-sand-400 rounded-xl flex items-center justify-center shadow-sm shrink-0">
                              <Icon icon={getProductIcon(produit?.nom || '')} className="text-2xl text-white" />
                            </div>
                            <h3 className="text-lg font-semibold text-sand-900 leading-tight uppercase">
                              {produit?.nom || 'Produit'}
                            </h3>
                          </div>

                          <div className="text-center mb-2">
                            <div className="text-6xl font-semibold text-sand-800 tracking-tight leading-none">{total}</div>
                            <div className="text-base text-sand-500 font-medium mt-1">pièces clients</div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </section>
            )}

            {/* Section Production pour Boutique */}
            {programmeActuel?.quantitesBoutique && programmeActuel.quantitesBoutique.length > 0 && (
              <section className="pt-8 border-t border-sand-200" data-section="production-boutique">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-info-100 flex items-center justify-center">
                    <Icon icon="mdi:storefront" className="text-xl text-info-600" />
                  </div>
                  <h2 className="font-display text-2xl font-semibold text-info-600">Production pour Boutique</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 print:grid-cols-3 print:gap-4">
                  {programmeActuel.quantitesBoutique.map(quantite => {
                    const produit = produits?.find((p: any) => p.id === quantite.produitId);
                    const repartition = quantite.repartitionCars;

                    return (
                      <div key={`boutique-${quantite.produitId}`} className="relative bg-white border-2 border-info-100 rounded-xl p-4 hover:shadow-card transition-all print:border-black print:shadow-none print:rounded-none print:p-4 print:break-inside-avoid">
                        <div className="absolute top-3 right-4 text-xs font-semibold text-info-500 uppercase tracking-widest">Boutique</div>

                        {/* En-tête Produit */}
                        <div className="flex items-center gap-3 mb-4 pt-2">
                          <div className="w-12 h-12 bg-info-600 rounded-xl flex items-center justify-center shadow-sm shrink-0">
                            <Icon icon={getProductIcon(produit?.nom || '')} className="text-xl text-white" />
                          </div>
                          <h3 className="text-lg font-semibold text-sand-900 leading-tight uppercase">
                            {produit?.nom || 'Produit'}
                          </h3>
                        </div>

                        {/* Total Boutique */}
                        <div className="bg-info-50 rounded-lg p-3 mb-3 text-center">
                          <div className="text-xs font-semibold text-info-600 uppercase mb-0.5">Total Boutique</div>
                          <div className="font-display text-3xl font-semibold text-info-600">{quantite.quantite}</div>
                          <div className="text-xs text-info-600">pièces</div>
                        </div>

                        {/* Répartition par cars si disponible */}
                        {repartition && (
                          <div className="space-y-2">
                            <div className="text-xs font-semibold text-sand-600 uppercase tracking-wide mb-3">
                              Répartition par cars:
                            </div>

                            {repartition.car1_matin > 0 && (
                              <div className="flex justify-between items-center py-2 px-3 bg-sand-50 rounded-lg">
                                <span className="text-sm font-medium text-sand-700">Car 1 Matin</span>
                                <span className="font-semibold text-sand-800">{repartition.car1_matin}</span>
                              </div>
                            )}

                            {repartition.car2_matin > 0 && (
                              <div className="flex justify-between items-center py-2 px-3 bg-sand-50 rounded-lg">
                                <span className="text-sm font-medium text-sand-700">Car 2 Matin</span>
                                <span className="font-semibold text-sand-800">{repartition.car2_matin}</span>
                              </div>
                            )}

                            {repartition.car_soir > 0 && (
                              <div className="flex justify-between items-center py-2 px-3 bg-sand-50 rounded-lg">
                                <span className="text-sm font-medium text-sand-700">Car Soir</span>
                                <span className="font-semibold text-sand-800">{repartition.car_soir}</span>
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
            <section className="pt-8 border-t border-sand-200" data-section="recap-cars">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-warning-100 flex items-center justify-center">
                  <Icon icon="mdi:truck-delivery" className="text-xl text-warning-600" />
                </div>
                <h2 className="font-display text-2xl font-semibold text-sand-800">Récapitulatif Global par Car</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:grid-cols-3 print:gap-4">
                {['car1_matin', 'car2_matin', 'car_soir'].map((carKey) => {
                  const carLabel = carKey === 'car1_matin' ? 'Car 1 Matin' :
                    carKey === 'car2_matin' ? 'Car 2 Matin' : 'Car Soir';
                  const carColor = carKey === 'car_soir' ? 'border-sand-600' : 'border-warning-500';
                  const carBg = carKey === 'car_soir' ? 'bg-sand-50' : 'bg-warning-50';

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
                      <div className={`${carBg} p-3 border-b border-sand-100 print:bg-sand-100 print:border-black`}>
                        <h3 className="text-lg font-semibold text-sand-900 text-center uppercase tracking-wide">{carLabel}</h3>
                        <div className="text-center text-xs text-sand-500 font-medium print:text-black mt-1">
                          Clients + Boutique
                        </div>
                      </div>

                      <div className="p-0">
                        <table className="w-full text-sm">
                          <thead className="bg-white border-b border-sand-100">
                            <tr>
                              <th className="px-4 py-2 text-left font-semibold text-sand-600 print:text-black">Produit</th>
                              <th className="px-4 py-2 text-right font-semibold text-sand-600 print:text-black">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-sand-50">
                            {produitsDuCar.map(([produitId, total]) => {
                              // Chercher d'abord dans totauxParProduit, sinon dans la liste globale des produits
                              let produit = totauxParProduit.find(p => p.produitId === produitId)?.produit;
                              if (!produit && produits) {
                                produit = produits.find(p => p.id === produitId);
                              }

                              return (
                                <tr key={produitId} className="hover:bg-sand-50/50">
                                  <td className="px-4 py-2.5 text-sand-800 font-medium uppercase">
                                    {produit?.nom || 'Inconnu'}
                                  </td>
                                  <td className="px-4 py-2.5 text-right font-semibold text-sand-900 text-base">
                                    {total}
                                  </td>
                                </tr>
                              );
                            })}
                            <tr className="bg-sand-50 border-t-2 border-sand-100 print:border-black print:bg-sand-100">
                              <td className="px-4 py-3 text-left font-semibold text-sand-900 uppercase text-xs">Total Général</td>
                              <td className="px-4 py-3 text-right font-semibold text-sand-900 text-lg">
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

            {/* Section Dispatching par Livreur (Clients + Boutique) */}
            {Object.keys(dispatchParLivreur).length > 0 && (
              <section className="pt-8 border-t border-sand-200" data-section="recap-livreurs">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-terracotta-100 flex items-center justify-center">
                    <Icon icon="mdi:account-badge-outline" className="text-xl text-terracotta-600" />
                  </div>
                  <h2 className="font-display text-2xl font-semibold text-sand-800">Dispatching par Livreur / Boutique</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 print:grid-cols-3 print:gap-4">
                  {Object.entries(dispatchParLivreur).map(([livreurId, dispatchL]) => {
                    const hasCar1 = Object.keys(dispatchL.car1_matin).length > 0;
                    const hasCar2 = Object.keys(dispatchL.car2_matin).length > 0;
                    const hasSoir = Object.keys(dispatchL.car_soir).length > 0;

                    // Liste de tous les produits uniques pour ce livreur
                    const tousProduitsIds = Array.from(new Set([
                      ...Object.keys(dispatchL.car1_matin),
                      ...Object.keys(dispatchL.car2_matin),
                      ...Object.keys(dispatchL.car_soir)
                    ]));

                    return (
                      <div key={livreurId} className="bg-white border border-sand-200 rounded-xl shadow-sm overflow-hidden print:border print:border-black print:shadow-none print:rounded-none flex flex-col h-full">
                        <div className="bg-sand-50 p-3 border-b border-sand-200 print:bg-sand-100 print:border-black">
                          <h3 className="text-base font-semibold text-sand-900 text-center uppercase tracking-wide">
                            {dispatchL.nom}
                          </h3>
                        </div>

                        <div className="p-0 flex-1">
                          <table className="w-full text-xs">
                            <thead className="bg-white border-b border-sand-200">
                              <tr>
                                <th className="px-3 py-2 text-left font-semibold text-sand-600 print:text-black">Produit</th>
                                {hasCar1 && <th className="px-2 py-2 text-right font-semibold text-sand-600 print:text-black">C1M</th>}
                                {hasCar2 && <th className="px-2 py-2 text-right font-semibold text-sand-600 print:text-black">C2M</th>}
                                {hasSoir && <th className="px-2 py-2 text-right font-semibold text-sand-600 print:text-black">Soir</th>}
                                <th className="px-3 py-2 text-right font-semibold text-sand-600 print:text-black">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-sand-100">
                              {tousProduitsIds.map((pId) => {
                                const produit = produits?.find(p => p.id === pId);
                                const q1 = dispatchL.car1_matin[pId] || 0;
                                const q2 = dispatchL.car2_matin[pId] || 0;
                                const qs = dispatchL.car_soir[pId] || 0;
                                const totalRow = q1 + q2 + qs;

                                return (
                                  <tr key={pId} className="hover:bg-sand-50/50">
                                    <td className="px-3 py-2 text-sand-800 font-medium uppercase truncate max-w-[120px]" title={produit?.nom}>
                                      {produit?.nom || 'Inconnu'}
                                    </td>
                                    {hasCar1 && (
                                      <td className={`px-2 py-2 text-right ${q1 > 0 ? 'text-sand-900 font-semibold' : 'text-sand-300'}`}>
                                        {q1 > 0 ? q1 : '-'}
                                      </td>
                                    )}
                                    {hasCar2 && (
                                      <td className={`px-2 py-2 text-right ${q2 > 0 ? 'text-sand-900 font-semibold' : 'text-sand-300'}`}>
                                        {q2 > 0 ? q2 : '-'}
                                      </td>
                                    )}
                                    {hasSoir && (
                                      <td className={`px-2 py-2 text-right ${qs > 0 ? 'text-sand-900 font-semibold' : 'text-sand-300'}`}>
                                        {qs > 0 ? qs : '-'}
                                      </td>
                                    )}
                                    <td className="px-3 py-2 text-right font-semibold text-sand-900 text-sm">
                                      {totalRow}
                                    </td>
                                  </tr>
                                );
                              })}
                              <tr className="bg-sand-50 border-t-2 border-sand-200 font-semibold print:border-black print:bg-sand-100">
                                <td className="px-3 py-2.5 text-left text-sand-900 uppercase text-[10px]">Total</td>
                                {hasCar1 && (
                                  <td className="px-2 py-2.5 text-right text-sand-900">
                                    {Object.values(dispatchL.car1_matin).reduce((a, b) => a + b, 0)}
                                  </td>
                                )}
                                {hasCar2 && (
                                  <td className="px-2 py-2.5 text-right text-sand-900">
                                    {Object.values(dispatchL.car2_matin).reduce((a, b) => a + b, 0)}
                                  </td>
                                )}
                                {hasSoir && (
                                  <td className="px-2 py-2.5 text-right text-sand-900">
                                    {Object.values(dispatchL.car_soir).reduce((a, b) => a + b, 0)}
                                  </td>
                                )}
                                <td className="px-3 py-2.5 text-right text-sand-900 text-sm">
                                  {tousProduitsIds.reduce((sum, pId) => {
                                    const q1 = dispatchL.car1_matin[pId] || 0;
                                    const q2 = dispatchL.car2_matin[pId] || 0;
                                    const qs = dispatchL.car_soir[pId] || 0;
                                    return sum + q1 + q2 + qs;
                                  }, 0)}
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
            )}

            {!Array.from(repartitionsClients.entries()).some(([_, repartition]) =>
              (repartition.car1Matin + repartition.car2Matin + repartition.carSoir) > 0) &&
              (!programmeActuel?.quantitesBoutique || programmeActuel.quantitesBoutique.length === 0) && (
                <div className="text-center py-12 text-sand-500">
                  <p>Aucune quantité à produire trouvée dans le programme.</p>
                </div>
              )}

            {/* Résumé pour impression uniquement */}
            <div className="hidden print:block print:mt-8">
              <div className="border-t-2 border-black pt-4">
                <h3 className="text-lg font-semibold mb-4">📋 RÉSUMÉ DE PRODUCTION</h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="border border-black p-3">
                    <div className="font-semibold mb-2">👥 PRODUCTION CLIENTS</div>
                    <div>Matin: {Array.from(repartitionsClients.entries()).reduce((acc, [_, repartition]) => acc + repartition.car1Matin + repartition.car2Matin, 0)} pièces</div>
                    <div>Soir: {Array.from(repartitionsClients.entries()).reduce((acc, [_, repartition]) => acc + repartition.carSoir, 0)} pièces</div>
                    <div className="font-semibold">Total: {totauxParProduit.reduce((acc, p) => acc + (p.totalClient || 0), 0)} pièces</div>
                  </div>
                  <div className="border border-black p-3">
                    <div className="font-semibold mb-2">🏪 PRODUCTION BOUTIQUE</div>
                    <div>Total: {totauxParProduit.reduce((acc, p) => acc + p.totalBoutique, 0)} pièces</div>
                    <div>Produits: {totauxParProduit.filter(p => p.totalBoutique > 0).length}</div>
                  </div>
                  <div className="border border-black p-3">
                    <div className="font-semibold mb-2">📊 TOTAL GÉNÉRAL</div>
                    <div className="font-display text-xl font-semibold">
                      {totauxParProduit.reduce((acc, p) => acc + p.totalGlobal, 0)} pièces
                    </div>
                  </div>
                </div>
                <div className="mt-4 text-xs text-center border-t border-sand-300 pt-2">
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
          className="fixed bottom-6 right-6 z-10 bg-sand-800 text-white rounded-full p-4 shadow-card hover:bg-sand-700 transition-all duration-300 print:hidden"
          title="Aller à la section Production"
        >
          <Icon icon="mdi:arrow-down-bold" className="text-xl" />
        </button>
      )}
    </div>
  );
};