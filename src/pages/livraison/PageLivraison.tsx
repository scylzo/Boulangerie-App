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

    console.log('Debug livraisons:');
    console.log('Nombre de commandes clients:', commandesClients.length);
    console.log('Nombre de clients:', clients.length);

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
        commandesParLivreur.set(livreurId, {
          livreur: livreurs.find(l => l.id === livreurId),
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
    <div className="min-h-screen bg-gray-50">
      {/* Header moderne type Odoo */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Icon icon="mdi:truck-delivery" className="text-2xl text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Programme de Livraison
              </h1>
              <p className="text-sm text-gray-500">
                Vue détaillée par livreur et par car de livraison
              </p>
            </div>
          </div>

          {/* Boutons d'actions globales */}
          <div className="flex items-center gap-3">
            <button
              onClick={genererRapportGlobal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
              disabled={commandesOrganisees.length === 0}
            >
              <Icon icon="mdi:printer" className="text-lg" />
              <span className="font-medium">Rapport Global Imprimable</span>
            </button>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Filtres modernes */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Icon icon="mdi:filter" className="text-lg text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Filtres</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date de livraison</label>
              <input
                type="date"
                value={dateSelectionnee}
                onChange={(e) => setDateSelectionnee(e.target.value)}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 font-medium w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Car de livraison</label>
              <select
                value={carSelectionne}
                onChange={(e) => setCarSelectionne(e.target.value as CarLivraison | 'tous')}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 font-medium w-full"
              >
                <option value="tous">Tous les cars</option>
                <option value="car1_matin">{CARS_LIVRAISON.car1_matin}</option>
                <option value="car2_matin">{CARS_LIVRAISON.car2_matin}</option>
                <option value="car_soir">{CARS_LIVRAISON.car_soir}</option>
              </select>
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="bg-blue-600 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <Icon icon="mdi:account-group" className="text-2xl text-white" />
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold">
                      {commandesOrganisees.length}
                    </div>
                    <div className="text-blue-200 text-xs">livreurs</div>
                  </div>
                </div>
                <div className="text-lg font-semibold">Livreurs Actifs</div>
              </div>

              <div className="bg-green-600 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <Icon icon="mdi:package-variant" className="text-2xl text-white" />
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold">
                      {commandesClients.length}
                    </div>
                    <div className="text-green-200 text-xs">commandes</div>
                  </div>
                </div>
                <div className="text-lg font-semibold">Total Commandes</div>
              </div>

              <div className="bg-orange-600 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <Icon icon="mdi:truck-delivery" className="text-2xl text-white" />
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold">
                      {commandesOrganisees.reduce((total, [, data]) => total + data.commandesParCar.size, 0)}
                    </div>
                    <div className="text-orange-200 text-xs">tournées</div>
                  </div>
                </div>
                <div className="text-lg font-semibold">Tournées Prévues</div>
              </div>

              <div className="bg-gray-600 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <Icon icon="mdi:map-marker" className="text-2xl text-white" />
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold">
                      {Array.from(new Set(
                        commandesOrganisees.flatMap(([, data]) =>
                          Array.from(data.commandesParCar.values()).flat().map((liv: any) => liv.client?.id)
                        )
                      )).length}
                    </div>
                    <div className="text-gray-200 text-xs">adresses</div>
                  </div>
                </div>
                <div className="text-lg font-semibold">Points de Livraison</div>
              </div>
            </div>

            {/* Liste des livreurs */}
            {commandesOrganisees.map(([livreurId, data]) => (
              <div key={livreurId} className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Icon icon={data.livreur ? "mdi:truck" : "mdi:help-circle"} className="text-lg text-blue-600" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">
                          {data.livreur ? (
                            `${data.livreur.nom} ${data.livreur.vehicule ? `(${data.livreur.vehicule})` : ''}`
                          ) : (
                            'Clients non assignés'
                          )}
                        </h2>
                        <p className="text-sm text-gray-500">
                          {data.livreur?.telephone ? (
                            <div className="flex items-center gap-2">
                              <Icon icon="mdi:phone" className="text-sm" />
                              {data.livreur.telephone}
                            </div>
                          ) : 'Clients sans livreur assigné'}
                        </p>
                      </div>
                    </div>

                    {/* Boutons d'actions pour ce livreur */}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => genererRapportLivreur(data)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200"
                        title="Générer le rapport imprimable pour ce livreur"
                      >
                        <Icon icon="mdi:printer" className="text-lg" />
                        <span className="font-medium">Imprimer</span>
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
                          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200"
                        >
                          <Icon icon="mdi:delete-forever" className="text-lg" />
                          <span className="font-medium">Supprimer Programme</span>
                        </ConfirmButton>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <div className="space-y-8">
                    {(Array.from(data.commandesParCar.entries()) as [CarLivraison, any][])
                      .filter(([car]) => carSelectionne === 'tous' || carSelectionne === car)
                      .map(([car, livraisons]) => {
                        const colors = getCarColors();
                        return (
                          <div key={car} className={`relative bg-white border ${colors.border} rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200`}>
                            {/* Barre de couleur sur le côté gauche */}
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${colors.accent}`}></div>

                            {/* En-tête du car avec fond sobre */}
                            <div className={`${colors.headerBg} p-4 mb-4`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                                    <Icon icon="mdi:truck-delivery" className="text-xl text-white" />
                                  </div>
                                  <div>
                                    <h3 className="text-lg font-semibold text-white">{CARS_LIVRAISON[car]}</h3>
                                    <p className="text-white/70 text-sm">{livraisons.length} livraison(s) programmée(s)</p>
                                  </div>
                                </div>
                                <div className="bg-white/10 px-3 py-1.5 rounded-md">
                                  <span className="text-white text-sm font-medium">
                                    {livraisons.length} stop{livraisons.length > 1 ? 's' : ''}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="px-6 pb-6">

                            {/* Grille des livraisons - Groupées par client */}
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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

                                return Array.from(livraisonsParClient.values()).map((clientData, idx) => (
                                  <div key={idx} className="bg-white rounded-lg p-4 border border-gray-200 hover:shadow-sm transition-all">
                                    <div className="flex items-start gap-3 mb-3">
                                      <div className={`w-10 h-10 ${colors.accent} rounded-lg flex items-center justify-center`}>
                                        <Icon icon="mdi:account" className="text-white text-lg" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <h4 className="font-semibold text-gray-900 truncate">
                                          {clientData.client?.nom || 'Client inconnu'}
                                        </h4>
                                        <p className="text-sm text-gray-600 line-clamp-2">
                                          {clientData.client?.adresse || 'Adresse non définie'}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="border-t border-gray-100 pt-3 space-y-2">
                                      {clientData.produits.map((item, prodIdx) => (
                                        <div key={prodIdx} className="flex items-center gap-3">
                                          <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                                            <Icon
                                              icon={getProductIcon(item.produit?.nom || '')}
                                              className="text-gray-600 text-sm"
                                            />
                                          </div>
                                          <div className="flex-1">
                                            <p className="text-sm font-medium text-gray-900">
                                              {item.produit?.nom || 'Produit inconnu'}
                                            </p>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <span className="text-lg font-bold text-gray-800">{item.quantite}</span>
                                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">pcs</span>
                                          </div>
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
        )}
      </div>
    </div>
  );
};