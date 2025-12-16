import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { useLivraisonStore } from '../../store/livraisonStore';
import { useProductionStore } from '../../store/productionStore';
import { useReferentielStore } from '../../store/referentielStore';
import { useConfirmModal } from '../../hooks/useConfirmModal';

export const SaisieRetours: React.FC = () => {
  const {
    invendusClients,
    chargerInvendusDuJour,
    marquerAucunRetourClient,
    sauvegarderRetoursClient,
    marquerTousSansRetour,
    isLoading
  } = useLivraisonStore();

  const { commandesClients, chargerProgramme } = useProductionStore();
  const { clients, produits, chargerClients, chargerProduits } = useReferentielStore();
  const confirmModal = useConfirmModal();

  const [dateSelectionnee, setDateSelectionnee] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [searchTerm, setSearchTerm] = useState('');

  // État local pour les invendus en cours de saisie
  const [invendusLocaux, setInvendusLocaux] = useState<Record<string, Record<string, number>>>({});

  useEffect(() => {
    const initialiser = async () => {
      try {
        await Promise.all([
          chargerClients(),
          chargerProduits(),
          chargerProgramme(new Date(dateSelectionnee))
        ]);
        await chargerInvendusDuJour(new Date(dateSelectionnee));
      } catch (error) {
        console.error('Erreur lors de l\'initialisation:', error);
      }
    };
    initialiser();
  }, [dateSelectionnee, chargerClients, chargerProduits, chargerProgramme, chargerInvendusDuJour]);


  // Créer la structure des données pour l'affichage
  const clientsAvecCommandes = commandesClients.map(commande => {
    const client = clients.find(c => c.id === commande.clientId);
    if (!client) return null;

    const produitsLivres = commande.produits.map(produitCmd => {
      const produit = produits.find(p => p.id === produitCmd.produitId);
      const repartitionValues = Object.values(produitCmd.repartitionCars || {});
      const quantiteTotale = repartitionValues
        .reduce((sum, qte) => {
          const qty = typeof qte === 'number' ? qte : (parseInt(String(qte)) || 0);
          // Limiter à des valeurs raisonnables pour éviter les erreurs de données
          const safeQty = isNaN(qty) ? 0 : Math.min(qty, 9999);
          return sum + safeQty;
        }, 0);


      // Récupérer les invendus existants depuis Firebase ou localement
      const invendusExistants = invendusClients.find(inv => inv.clientId === commande.clientId);
      const produitInvendus = invendusExistants?.produits.find(p => p.produitId === produitCmd.produitId);
      const invendusFirebase = produitInvendus?.invendus || 0;
      const invendusLocauxQty = invendusLocaux[commande.clientId]?.[produitCmd.produitId];

      // Utiliser les invendus locaux si définis, sinon ceux de Firebase
      const invendusActuels = invendusLocauxQty !== undefined ? invendusLocauxQty : invendusFirebase;

      return {
        produitId: produitCmd.produitId,
        produit,
        quantiteLivree: quantiteTotale,
        invendus: invendusActuels,
        vendu: quantiteTotale - invendusActuels
      };
    }).filter(p => p.quantiteLivree > 0);

    return {
      ...client,
      commande,
      produits: produitsLivres
    };
  }).filter((client): client is NonNullable<typeof client> => client !== null)
    .filter(client => 
      searchTerm === '' || 
      client.nom.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const handleSaisirInvendus = (clientId: string, produitId: string, invendus: string) => {
    const invendusNum = parseInt(invendus) || 0;

    // Mettre à jour l'état local
    setInvendusLocaux(prev => ({
      ...prev,
      [clientId]: {
        ...prev[clientId],
        [produitId]: invendusNum
      }
    }));
  };



  const handleAucunRetour = async (clientId: string) => {
    const client = clients.find(c => c.id === clientId);

    try {
      const confirmation = await confirmModal.confirm({
        title: 'Confirmer aucun retour',
        message: `Confirmer qu'il n'y a aucun retour pour le client "${client?.nom || 'Inconnu'}" ?\n\nCela finalisera les retours pour la facturation.`,
        confirmText: 'Confirmer',
        cancelText: 'Annuler',
        type: 'info'
      });

      if (confirmation) {
        await marquerAucunRetourClient(clientId, new Date(dateSelectionnee));
        await chargerInvendusDuJour(new Date(dateSelectionnee));
        toast.success(`✅ Aucun retour confirmé pour ${client?.nom || 'le client'}`);
      }
    } catch (error) {
      console.error('Erreur lors du marquage "aucun retour":', error);
      toast.error('❌ Erreur lors du marquage "aucun retour"');
    }
  };

  // Vérifier si un client a déjà des retours finalisés
  const clientARetoursCompletes = (clientId: string) => {
    return invendusClients.some(inv =>
      inv.clientId === clientId &&
      inv.dateLivraison.toDateString() === new Date(dateSelectionnee).toDateString() &&
      inv.retoursCompletes
    );
  };

  const handleEnregistrerRetours = async (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    const clientData = clientsAvecCommandes.find(c => c.id === clientId);

    if (!clientData) {
      toast.error('Client non trouvé');
      return;
    }

    try {
      const confirmation = await confirmModal.confirm({
        title: 'Enregistrer les retours',
        message: `Confirmer l'enregistrement des retours pour le client "${client?.nom || 'Inconnu'}" ?\n\nCela finalisera les retours pour la facturation.`,
        confirmText: 'Enregistrer',
        cancelText: 'Annuler',
        type: 'info'
      });

      if (confirmation) {
        // Préparer les produits avec leurs retours
        const produitsAvecRetours = clientData.produits.map(p => ({
          produitId: p.produitId,
          produit: p.produit,
          quantiteLivree: p.quantiteLivree,
          invendus: p.invendus,
          vendu: p.vendu
        }));

        await sauvegarderRetoursClient(clientId, new Date(dateSelectionnee), produitsAvecRetours);
        await chargerInvendusDuJour(new Date(dateSelectionnee));
        
        // Réinitialiser l'état local pour ce client
        setInvendusLocaux(prev => {
          const newState = { ...prev };
          delete newState[clientId];
          return newState;
        });

        toast.success(`✅ Retours enregistrés pour ${client?.nom || 'le client'}`);
      }
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement des retours:', error);
      toast.error('❌ Erreur lors de l\'enregistrement des retours');
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header moderne type Odoo */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-linear-to-r from-red-600 to-rose-600 rounded-lg flex items-center justify-center">
              <Icon icon="mdi:keyboard-return" className="text-2xl text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Saisie des Retours Clients
              </h1>
              <p className="text-sm text-gray-500">
                Enregistrez les invendus de chaque client pour la facturation
              </p>
            </div>
          </div>

          <div className="flex gap-3">
             <button
              onClick={async () => {
                const clientsSansRetours = clientsAvecCommandes.filter(c => !clientARetoursCompletes(c.id!));
                
                if (clientsSansRetours.length === 0) {
                  toast.success('Tous les clients ont déjà des retours finalisés !');
                  return;
                }

                const confirmation = await confirmModal.confirm({
                  title: 'Tout marquer sans retour',
                  message: `Vous allez marquer "Aucun retour" pour ${clientsSansRetours.length} clients restants.\n\nÊtes-vous sûr de vouloir continuer ?`,
                  confirmText: 'Oui, tout valider',
                  cancelText: 'Annuler',
                  type: 'warning'
                });

                if (confirmation) {
                   const clientIds = clientsSansRetours.map(c => c.id!);
                   await marquerTousSansRetour(clientIds, new Date(dateSelectionnee));
                   toast.success(`✅ ${clientIds.length} clients marqués sans retour !`);
                }
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg transition-all shadow-md shrink-0"
              disabled={isLoading || clientsAvecCommandes.every(c => clientARetoursCompletes(c.id!))}
            >
              <Icon icon="mdi:check-all" className="text-lg" />
              <span className="hidden sm:inline">Tout marquer sans retour</span>
            </button>
          </div>
        </div>

        {/* Barre de recherche intégrée au header */}
        <div className="mt-4 max-w-md ml-auto">
             <div className="relative">
                <Icon icon="mdi:magnify" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Rechercher un client..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                />
             </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto p-6 space-y-6">

        {/* Widget de sélection de date moderne */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
              <Icon icon="mdi:calendar" className="text-lg text-red-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Date de livraison</h2>
          </div>
          <div className="flex items-center gap-4">
            <input
              type="date"
              value={dateSelectionnee}
              onChange={(e) => setDateSelectionnee(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-900 font-medium"
            />
            <div className="text-sm text-gray-500">
              Retours pour {new Date(dateSelectionnee).toLocaleDateString('fr-FR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
          </div>
        </div>

        {/* Liste des clients avec livraisons */}
        {clientsAvecCommandes.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-6">
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icon icon="mdi:package-variant-closed" className="text-4xl text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Aucune livraison prévue
                </h3>
                <p className="text-gray-500 mb-6">
                  Aucune commande client pour cette date
                </p>
                <button className="inline-flex items-center gap-2 px-6 py-3 bg-linear-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md">
                  <Icon icon="mdi:plus" className="text-lg" />
                  <span className="font-medium">Créer une commande</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="bg-linear-to-br from-gray-700 to-gray-800 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <Icon icon="mdi:account-group" className="text-2xl text-white" />
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold">
                      {clientsAvecCommandes.length}
                    </div>
                    <div className="text-gray-300 text-xs">clients</div>
                  </div>
                </div>
                <div className="text-lg font-semibold">Clients Livrés</div>
              </div>

              <div className="bg-linear-to-br from-gray-600 to-gray-700 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <Icon icon="mdi:package-variant" className="text-2xl text-white" />
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold">
                      {clientsAvecCommandes.reduce((sum, client) =>
                        sum + client.produits.reduce((prodSum, p) => prodSum + p.quantiteLivree, 0), 0
                      )}
                    </div>
                    <div className="text-gray-300 text-xs">pièces</div>
                  </div>
                </div>
                <div className="text-lg font-semibold">Total Livré</div>
              </div>

              <div className="bg-linear-to-br from-gray-700 to-gray-800 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <Icon icon="mdi:package-down" className="text-2xl text-white" />
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold">
                      {clientsAvecCommandes.reduce((sum, client) =>
                        sum + client.produits.reduce((prodSum, p) => prodSum + p.invendus, 0), 0
                      )}
                    </div>
                    <div className="text-gray-300 text-xs">pièces</div>
                  </div>
                </div>
                <div className="text-lg font-semibold">Total Invendus</div>
              </div>

              <div className="bg-linear-to-br from-gray-600 to-gray-700 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <Icon icon="mdi:chart-line" className="text-2xl text-white" />
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold">
                      {clientsAvecCommandes.reduce((sum, client) =>
                        sum + client.produits.reduce((prodSum, p) => prodSum + p.vendu, 0), 0
                      )}
                    </div>
                    <div className="text-gray-300 text-xs">pièces</div>
                  </div>
                </div>
                <div className="text-lg font-semibold">Total Vendu</div>
              </div>
            </div>

            {/* Liste des clients */}
            {clientsAvecCommandes.map((client) => (
              <div key={client.id} className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 ${clientARetoursCompletes(client.id!) ? 'bg-green-100' : 'bg-orange-100'} rounded-lg flex items-center justify-center`}>
                        <Icon
                          icon={clientARetoursCompletes(client.id!) ? "mdi:check" : "mdi:account"}
                          className={`text-lg ${clientARetoursCompletes(client.id!) ? 'text-green-600' : 'text-orange-600'}`}
                        />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">{client.nom}</h2>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <Icon icon="mdi:map-marker" className="text-sm" />
                            {client.adresse}
                          </div>
                          {client.telephone && (
                            <div className="flex items-center gap-1">
                              <Icon icon="mdi:phone" className="text-sm" />
                              {client.telephone}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {clientARetoursCompletes(client.id!) ? (
                      <div className="flex items-center gap-2 bg-green-100 text-green-700 px-3 py-1 rounded-full">
                        <Icon icon="mdi:check-circle" className="text-sm" />
                        <span className="text-sm font-medium">Retours finalisés</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEnregistrerRetours(client.id!)}
                          disabled={isLoading}
                          className="flex items-center gap-2 px-4 py-2 bg-linear-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-50 shadow-md"
                        >
                          <Icon icon="mdi:content-save-check" className="text-sm" />
                          <span className="text-sm font-medium">Enregistrer les retours</span>
                        </button>
                        <button
                          onClick={() => handleAucunRetour(client.id!)}
                          disabled={isLoading}
                          className="flex items-center gap-2 px-4 py-2 bg-linear-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 shadow-md"
                        >
                          <Icon icon="mdi:check-bold" className="text-sm" />
                          <span className="text-sm font-medium">Aucun retour</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-6">
                  {/* Grille des produits */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                      <Icon icon="mdi:view-grid" className="text-gray-500" />
                      <h3 className="text-lg font-semibold text-gray-800">Produits livrés</h3>
                      <span className="ml-auto text-sm font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
                        {client.produits.length} produit{client.produits.length > 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {client.produits.map((produitLivraison) => (
                        <div
                          key={produitLivraison.produitId}
                          className={`bg-linear-to-br ${produitLivraison.invendus > 0 ? 'from-red-50 to-rose-50 border-red-200' : 'from-green-50 to-emerald-50 border-green-200'} border rounded-xl p-4 hover:shadow-md transition-all`}
                        >
                          <div className="flex items-center gap-3 mb-4">
                            <div className={`w-12 h-12 bg-linear-to-br ${produitLivraison.invendus > 0 ? 'from-red-500 to-rose-500' : 'from-green-500 to-emerald-500'} rounded-xl flex items-center justify-center shadow-md`}>
                              <Icon
                                icon={getProductIcon(produitLivraison.produit?.nom || '')}
                                className="text-xl text-white"
                              />
                            </div>
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-900 mb-1">
                                {produitLivraison.produit?.nom || 'Produit inconnu'}
                              </h4>
                              <div className="text-sm text-gray-600">
                                Livré: <span className="font-bold">{produitLivraison.quantiteLivree} pièces</span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Invendus retour:</label>
                              <input
                                type="number"
                                min="0"
                                max={produitLivraison.quantiteLivree}
                                value={(() => {
                                  const val = invendusLocaux[client.id!]?.[produitLivraison.produitId] ?? produitLivraison.invendus;
                                  return val === 0 ? '' : val;
                                })()}
                                onChange={(e) =>
                                  handleSaisirInvendus(
                                    client.id!,
                                    produitLivraison.produitId,
                                    e.target.value
                                  )
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                placeholder="0"
                              />
                            </div>

                            <div className="bg-white/60 backdrop-blur-sm rounded-lg p-3">
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Vendu final:</span>
                                <span className={`text-lg font-bold ${produitLivraison.vendu > 0 ? 'text-green-600' : 'text-gray-600'}`}>
                                  {produitLivraison.vendu} pièces
                                </span>
                              </div>
                              {produitLivraison.invendus > 0 && (
                                <div className="mt-2 flex items-center gap-2">
                                  <Icon icon="mdi:package-variant-closed" className="text-red-500 text-sm" />
                                  <span className="text-xs text-red-600 font-medium">
                                    {produitLivraison.invendus} invendu{produitLivraison.invendus > 1 ? 's' : ''}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Résumé client */}
                    <div className="bg-gray-50 rounded-xl p-6 mt-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Icon icon="mdi:chart-box" className="text-gray-600" />
                        <h4 className="font-semibold text-gray-800">Résumé client</h4>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">
                            {client.produits.reduce((sum, p) => sum + p.quantiteLivree, 0)}
                          </div>
                          <div className="text-sm text-gray-600">Total livré</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-red-600">
                            {client.produits.reduce((sum, p) => sum + p.invendus, 0)}
                          </div>
                          <div className="text-sm text-gray-600">Invendus</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {client.produits.reduce((sum, p) => sum + p.vendu, 0)}
                          </div>
                          <div className="text-sm text-gray-600">Vendu</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={confirmModal.handleCancel}
        onConfirm={confirmModal.handleConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
        type={confirmModal.type}
      />
    </div>
  );
};