/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';

import { useProductionStore } from '../../store/productionStore';
import { useLivreurStore } from '../../store/livreurStore';
import { useReferentielStore } from '../../store/referentielStore';
import { CARS_LIVRAISON } from '../../types/production';
import { htmlPrintService } from '../../services/htmlPrintService';
import type { CarLivraison } from '../../types';
import toast from 'react-hot-toast';
import { ConfirmButton } from '../../components/ui/ConfirmButton';

export const PageLivraison: React.FC = () => {
  const { commandesClients, chargerProgramme, supprimerCommandesLivreur } = useProductionStore();
  const { livreurs, chargerLivreurs } = useLivreurStore();
  const { clients, produits: produitsRef, chargerProduits, chargerClients } = useReferentielStore();

  const [dateSelectionnee, setDateSelectionnee] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [carSelectionne, setCarSelectionne] = useState<CarLivraison | 'tous'>('tous');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const initialiser = async () => {
      try {
        await Promise.all([
          chargerProduits(),
          chargerClients(),
          chargerLivreurs()
        ]);
        await chargerProgramme(new Date(dateSelectionnee));
      } catch (error) {
        console.error('Erreur lors de l\'initialisation:', error);
      }
    };
    initialiser();
  }, [dateSelectionnee, chargerProgramme, chargerProduits, chargerClients, chargerLivreurs]);

  // Fonction pour organiser les commandes par livreur et par car
  const organiserCommandesParLivreur = () => {
    const commandesParLivreur = new Map();

    commandesClients.forEach(commande => {
      const client = clients.find(c => c.id === commande.clientId);

      if (!client) {
        console.warn(`⚠️ Client non trouvé pour commande:`, {
          commandeClientId: commande.clientId,
          clientsDisponibles: clients.map(c => ({ id: c.id, nom: c.nom }))
        });
      }
      const livreurId = client?.livreurId || 'non-assigne';

      if (!commandesParLivreur.has(livreurId)) {
        let livreurTrouve = livreurs.find(l => l.id === livreurId);

        // Si on a un ID mais pas de livreur trouvé, créer un objet temporaire
        if (!livreurTrouve && livreurId !== 'non-assigne') {
          console.warn(`⚠️ Livreur ID ${livreurId} non trouvé dans la liste pour client ${client?.nom}`);
          livreurTrouve = {
            id: livreurId,
            nom: `Livreur (ID: ${livreurId.substring(0, 6)}...)`,
            active: true,
            createdAt: new Date(),
            updatedAt: new Date()
          } as any;
        }

        commandesParLivreur.set(livreurId, {
          livreur: livreurTrouve,
          commandesParCar: new Map()
        });
      }

      const livreurData = commandesParLivreur.get(livreurId);

      commande.produits.forEach(produit => {
        if (produit.repartitionCars) {
          Object.entries(produit.repartitionCars).forEach(([car, quantite]) => {
            if (quantite && quantite > 0) {
              const carKey = car as CarLivraison;

              if (!livreurData.commandesParCar.has(carKey)) {
                livreurData.commandesParCar.set(carKey, []);
              }

              livreurData.commandesParCar.get(carKey).push({
                commande,
                client,
                produit: produitsRef.find(p => p.id === produit.produitId),
                quantite: quantite
              });
            }
          });
        }
      });
    });

    return Array.from(commandesParLivreur.entries());
  };

  const commandesOrganisees = organiserCommandesParLivreur();


  // Fonctions pour générer les rapports imprimables
  const genererRapportLivreur = (dataLivreur: any) => {
    try {
      htmlPrintService.generateDeliveryReportHTML(dataLivreur, dateSelectionnee);
      toast.success('Rapport ouvert dans une nouvelle fenêtre !');
    } catch (error) {
      console.error('Erreur lors de la génération du rapport:', error);
      toast.error('Erreur lors de la génération du rapport');
    }
  };

  const genererRapportGlobal = () => {
    try {
      htmlPrintService.generateGlobalReportHTML(commandesOrganisees, dateSelectionnee);
      toast.success('Rapport global ouvert dans une nouvelle fenêtre !');
    } catch (error) {
      console.error('Erreur lors de la génération du rapport:', error);
      toast.error('Erreur lors de la génération du rapport');
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

  // Fonction pour obtenir les couleurs selon le car - Palette unifiée
  const getCarColors = () => {
    return {
      headerBg: 'bg-slate-600',
      bg: 'bg-gray-50',
      summaryBg: 'bg-slate-600',
      border: 'border-gray-200',
      text: 'text-gray-700',
      badgeBg: 'bg-gray-100',
      badgeText: 'text-gray-600',
      accent: 'bg-slate-600'

    };
  };

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      {/* Header moderne */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center shrink-0">
              <Icon icon="mdi:truck-delivery" className="text-xl text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
                Programme de Livraison
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 truncate">
                <span className="hidden sm:inline">Vue détaillée par livreur et par car de livraison</span>
                <span className="sm:hidden">Vue par livreur et car</span>
              </p>
            </div>
          </div>

          {/* Boutons d'actions globales */}
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <button
              onClick={genererRapportGlobal}
              className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg shadow-sm transition-all text-xs sm:text-sm font-medium w-full sm:w-auto"
              disabled={commandesOrganisees.length === 0}
            >
              <Icon icon="mdi:printer" className="text-base sm:text-lg" />
              <span>Rapport Global</span>
            </button>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
        {/* Filtres modernes */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 sm:p-4">
          <div className="flex items-center gap-3 mb-3 sm:mb-4">
            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
              <Icon icon="mdi:filter" className="text-base sm:text-lg text-gray-600" />
            </div>
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Filtres</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Rechercher</label>
              <div className="relative">
                <Icon icon="mdi:magnify" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-base sm:text-lg" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Client..."
                  className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-gray-900 font-medium text-xs sm:text-sm"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-1 min-w-0">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Date</label>
                <input
                  type="date"
                  value={dateSelectionnee}
                  onChange={(e) => setDateSelectionnee(e.target.value)}
                  className="w-full px-2 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-gray-900 font-medium text-xs sm:text-sm min-w-0"
                />
              </div>

              <div className="flex-1 min-w-0">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Car</label>
                <select
                  value={carSelectionne}
                  onChange={(e) => setCarSelectionne(e.target.value as CarLivraison | 'tous')}
                  className="w-full px-2 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-gray-900 font-medium text-xs sm:text-sm min-w-0 appearance-none bg-white truncate"
                >
                  <option value="tous">Tous</option>
                  <option value="car1_matin">Car 1 Matin</option>
                  <option value="car2_matin">Car 2 Matin</option>
                  <option value="car_soir">Car Soir</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Vue par livreur */}
        {commandesOrganisees.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-6">
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icon icon="mdi:package-variant-closed" className="text-4xl text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Aucune livraison prévue
                </h3>
                <p className="text-gray-500">
                  Aucune commande client pour cette date
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4 shadow-sm hover:shadow-md transition-all">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 mb-2">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                    <Icon icon="mdi:account-group" className="text-lg sm:text-xl text-gray-600" />
                  </div>
                  <div className="text-left sm:text-right w-full sm:w-auto">
                    <div className="text-2xl sm:text-3xl font-bold text-gray-900">
                      {commandesOrganisees.length}
                    </div>
                    <div className="text-gray-500 text-xs">livreurs</div>
                  </div>
                </div>
                <div className="text-sm sm:text-base font-semibold text-gray-700 truncate">Livreurs Actifs</div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4 shadow-sm hover:shadow-md transition-all">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 mb-2">
                  <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0">
                    <Icon icon="mdi:package-variant" className="text-lg sm:text-xl text-emerald-600" />
                  </div>
                  <div className="text-left sm:text-right w-full sm:w-auto">
                    <div className="text-2xl sm:text-3xl font-bold text-gray-900">
                      {commandesClients.length}
                    </div>
                    <div className="text-gray-500 text-xs">commandes</div>
                  </div>
                </div>
                <div className="text-sm sm:text-base font-semibold text-gray-700 truncate">Total Commandes</div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4 shadow-sm hover:shadow-md transition-all">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 mb-2">
                  <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center shrink-0">
                    <Icon icon="mdi:truck-delivery" className="text-lg sm:text-xl text-orange-600" />
                  </div>
                  <div className="text-left sm:text-right w-full sm:w-auto">
                    <div className="text-2xl sm:text-3xl font-bold text-gray-900">
                      {commandesOrganisees.reduce((total, [, data]) => total + data.commandesParCar.size, 0)}
                    </div>
                    <div className="text-gray-500 text-xs">tournées</div>
                  </div>
                </div>
                <div className="text-sm sm:text-base font-semibold text-gray-700 truncate">Tournées Prévues</div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4 shadow-sm hover:shadow-md transition-all">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 mb-2">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                    <Icon icon="mdi:map-marker" className="text-lg sm:text-xl text-blue-600" />
                  </div>
                  <div className="text-left sm:text-right w-full sm:w-auto">
                    <div className="text-2xl sm:text-3xl font-bold text-gray-900">
                      {Array.from(new Set(
                        commandesOrganisees.flatMap(([, data]) =>
                          Array.from(data.commandesParCar.values()).flat().map((liv: any) => liv.client?.id)
                        )
                      )).length}
                    </div>
                    <div className="text-gray-500 text-xs">adresses</div>
                  </div>
                </div>
                <div className="text-sm sm:text-base font-semibold text-gray-700 truncate">Points de Livraison</div>
              </div>
            </div>

            <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
              {commandesOrganisees.map(([livreurId, data]: [string, any]) => (
                <div
                  key={livreurId}
                  className={`bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden ${!data.livreur ? 'border-amber-200 bg-amber-50' : ''
                    }`}
                >
                  {/* En-tête Livreur Compact */}
                  <div className="p-3 sm:p-4 border-b border-gray-100">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 shrink-0 ${data.livreur ? 'bg-gray-100 border-gray-200' : 'bg-amber-100 border-amber-200'
                          }`}>
                          <Icon
                            icon={data.livreur ? "mdi:helmet" : "mdi:account-alert"}
                            className={`text-lg sm:text-xl ${data.livreur ? 'text-gray-600' : 'text-amber-600'}`}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h2 className="text-sm sm:text-base font-bold text-gray-900 truncate">
                            {data.livreur ? (
                              `${data.livreur.nom} ${data.livreur.vehicule ? `(${data.livreur.vehicule})` : ''}`
                            ) : (
                              'Clients non assignés'
                            )}
                          </h2>
                          <p className="text-xs text-gray-500 truncate">
                            {data.livreur?.telephone ? (
                              <div className="flex items-center gap-1.5">
                                <Icon icon="mdi:phone" className="text-xs shrink-0" />
                                <span className="truncate">{data.livreur.telephone}</span>
                              </div>
                            ) : 'Clients sans livreur assigné'}
                          </p>
                        </div>
                      </div>

                      {/* Boutons d'actions pour ce livreur */}
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                          onClick={() => genererRapportLivreur(data)}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg shadow-sm transition-all text-xs sm:text-sm font-medium flex-1 sm:flex-none"
                          title="Générer le rapport imprimable pour ce livreur"
                        >
                          <Icon icon="mdi:printer" className="text-base" />
                          <span>Imprimer</span>
                        </button>

                        {/* Bouton de suppression - uniquement pour les livreurs assignés */}
                        {data.livreur && (
                          <ConfirmButton
                            onConfirm={() => {
                              supprimerCommandesLivreur(livreurId);
                              toast.success(`✅ Toutes les commandes de "${data.livreur?.nom}" ont été supprimées définitivement.`);
                            }}
                            title="Supprimer le programme de livraison"
                            message={`Supprimer définitivement toutes les commandes de "${data.livreur?.nom}" pour le ${dateSelectionnee} ?`}
                            confirmText="Supprimer définitivement"
                            cancelText="Annuler"
                            type="danger"
                            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-sm transition-all text-xs sm:text-sm font-medium flex-1 sm:flex-none"
                          >
                            <Icon icon="mdi:delete-forever" className="text-base" />
                            <span>Supprimer</span>
                          </ConfirmButton>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-3">
                    <div className="space-y-3">
                      {(Array.from(data.commandesParCar.entries()) as [CarLivraison, any][])
                        .sort(([carA], [carB]) => {
                          // Ordre fixe : car1_matin, car2_matin, car_soir
                          const ordre: CarLivraison[] = ['car1_matin', 'car2_matin', 'car_soir'];
                          return ordre.indexOf(carA) - ordre.indexOf(carB);
                        })
                        .filter(([car]) => carSelectionne === 'tous' || carSelectionne === car)
                        .map(([car, livraisons]) => {
                          const colors = getCarColors();
                          return (
                            <div key={car} className={`relative bg-white border ${colors.border} rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200`}>
                              {/* Barre de couleur sur le côté gauche */}
                              <div className={`absolute left-0 top-0 bottom-0 w-1 ${colors.accent}`}></div>

                              {/* En-tête du car avec fond sobre */}
                              <div className={`${colors.headerBg} p-2.5 mb-2`}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center">
                                      <Icon icon="mdi:truck-delivery" className="text-lg text-white" />
                                    </div>
                                    <div>
                                      <h3 className="text-sm font-semibold text-white">{CARS_LIVRAISON[car]}</h3>
                                      <p className="text-white/70 text-xs">{livraisons.length} livraison(s) programmée(s)</p>
                                    </div>
                                  </div>
                                  <div className="bg-white/10 px-2.5 py-1 rounded-md">
                                    <span className="text-white text-xs font-medium">
                                      {livraisons.length} stop{livraisons.length > 1 ? 's' : ''}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="px-3 pb-3">

                                {/* Grille des livraisons - Groupées par client */}
                                <div className="grid gap-3">
                                  {(() => {
                                    // Grouper les livraisons par client
                                    const livraisonsParClient = new Map<string, { client: any, produits: Array<{ produit: any, quantite: number }> }>();

                                    livraisons.forEach((livraison: any) => {
                                      const clientId = livraison.client?.id || 'inconnu';
                                      if (!livraisonsParClient.has(clientId)) {
                                        livraisonsParClient.set(clientId, {
                                          client: livraison.client,
                                          produits: []
                                        });
                                      }
                                      livraisonsParClient.get(clientId)!.produits.push({
                                        produit: livraison.produit,
                                        quantite: Number(livraison.quantite) || 0
                                      });
                                    });

                                    return Array.from(livraisonsParClient.values())
                                      .filter(clientData =>
                                        searchTerm === '' ||
                                        (clientData.client?.nom?.toLowerCase() || '').includes(searchTerm.toLowerCase())
                                      )
                                      .map((clientData, idx) => (
                                        <div key={idx} className="bg-gray-50 rounded-lg p-3 border border-gray-200 hover:border-blue-300 transition-colors">
                                          <div className="flex items-start justify-between mb-3">
                                            <div className="font-semibold text-gray-800 text-sm truncate pr-2" title={clientData.client?.nom}>
                                              {clientData.client?.nom || 'Client Inconnu'}
                                            </div>
                                            <div className="bg-white px-2 py-0.5 rounded text-xs font-bold text-gray-600 border border-gray-200 shadow-sm shrink-0">
                                              {clientData.produits.reduce((acc, p) => acc + p.quantite, 0)} pc
                                            </div>
                                          </div>

                                          <div className="space-y-1.5">
                                            {clientData.produits.map((item, idx) => (
                                              <div key={idx} className="flex justify-between items-center text-xs">
                                                <div className="flex items-center gap-1.5 overflow-hidden">
                                                  <Icon icon={getProductIcon(item.produit?.nom || '')} className="text-gray-400 text-xs shrink-0" />
                                                  <span className="text-gray-600 truncate">{item.produit?.nom}</span>
                                                </div>
                                                <span className="font-medium text-gray-900 bg-white px-1.5 rounded ml-2">
                                                  {item.quantite}
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      ));
                                  })()}
                                </div>

                                {/* Résumé du car */}
                                <div className={`mt-4 ${colors.summaryBg} border-l-4 ${colors.accent} rounded-lg p-4`}>
                                  <div className="flex items-center gap-2 mb-3">
                                    <Icon icon="mdi:chart-box" className="text-white" />
                                    <h4 className="font-medium text-white">Résumé {CARS_LIVRAISON[car]}</h4>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {((): React.ReactNode => {
                                      const resume = livraisons.reduce((acc: Record<string, number>, liv: any) => {
                                        const produitNom = liv.produit?.nom || 'Inconnu';
                                        const quantite = Number(liv.quantite) || 0;
                                        acc[produitNom] = (acc[produitNom] || 0) + quantite;
                                        return acc;
                                      }, {} as Record<string, number>);

                                      return (Object.entries(resume) as [string, number][]).map(([produit, total]) => (
                                        <div key={produit} className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm">
                                          <Icon
                                            icon={getProductIcon(produit)}
                                            className="text-gray-600 text-sm"
                                          />
                                          <span className="text-sm font-medium text-gray-900">{produit}</span>
                                          <span className="text-sm font-bold text-gray-900 bg-gray-100 px-2 py-1 rounded-full">
                                            {total}
                                          </span>
                                        </div>
                                      ));
                                    })()}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};