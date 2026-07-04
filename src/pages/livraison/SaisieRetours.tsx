import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { useLivraisonStore } from '../../store/livraisonStore';
import { useProductionStore } from '../../store/productionStore';
import { useReferentielStore } from '../../store/referentielStore';
import { useFacturationStore } from '../../store/facturationStore';
import { useConfirmModal } from '../../hooks/useConfirmModal';
import { ScrollToTopBottom } from '../../components/ui/ScrollToTopBottom';

export const SaisieRetours: React.FC = () => {
  const {
    invendusClients,
    chargerInvendusDuJour,
    marquerAucunRetourClient,
    sauvegarderRetoursClient,
    marquerTousSansRetour,
    annulerValidationRetours,
    supprimerInvendusClient,
    isLoading
  } = useLivraisonStore();

  const { genererFacturesDepuisLivraisons } = useFacturationStore();

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


  const [filterStatus, setFilterStatus] = useState<'all' | 'with_returns' | 'without_returns'>('all');

  // Combiner les clients des commandes et des retours existants
  const clientIdsFromCommandes = new Set(commandesClients.map(c => c.clientId));
  const clientIdsFromRetours = new Set(invendusClients.map(i => i.clientId));
  const allClientIds = Array.from(new Set([...clientIdsFromCommandes, ...clientIdsFromRetours]));

  const clientsAvecDonnees = allClientIds.map(clientId => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return null;

    const commande = commandesClients.find(c => c.clientId === clientId);
    const invendusExistants = invendusClients.find(inv => inv.clientId === clientId);

    type ProduitAffichage = {
      produitId: string;
      produit: any;
      quantiteLivree: number;
      invendus: number;
      vendu: number;
    };

    let produitsAffiches: ProduitAffichage[] = [];

    if (commande) {
      // Cas 1: Le client a une commande
      produitsAffiches = commande.produits.map(produitCmd => {
        const produit = produits.find(p => p.id === produitCmd.produitId);
        const repartitionValues = Object.values(produitCmd.repartitionCars || {});
        const quantiteTotale = repartitionValues
          .reduce((sum, qte) => {
            const qty = typeof qte === 'number' ? qte : (parseInt(String(qte)) || 0);
            return sum + (isNaN(qty) ? 0 : Math.min(qty, 9999));
          }, 0);

        // Récupérer les invendus existants (Firebase ou local)
        const produitInvendus = invendusExistants?.produits.find(p => p.produitId === produitCmd.produitId);
        const invendusFirebase = produitInvendus?.invendus || 0;
        const invendusLocauxQty = invendusLocaux[clientId]?.[produitCmd.produitId];

        const invendusActuels = invendusLocauxQty !== undefined ? invendusLocauxQty : invendusFirebase;

        return {
          produitId: produitCmd.produitId,
          produit,
          quantiteLivree: quantiteTotale,
          invendus: invendusActuels,
          vendu: quantiteTotale - invendusActuels
        };
      }).filter(p => p.quantiteLivree > 0);
    } else if (invendusExistants) {
      // Cas 2: Pas de commande mais des retours (historique migré par exemple)
      produitsAffiches = invendusExistants.produits.map(produitInv => {
        const produit = produits.find(p => p.id === produitInv.produitId) || produitInv.produit; // Fallback sur le produit stocké dans l'invendu si dispo

        const invendusLocauxQty = invendusLocaux[clientId]?.[produitInv.produitId];
        const invendusActuels = invendusLocauxQty !== undefined ? invendusLocauxQty : produitInv.invendus;

        return {
          produitId: produitInv.produitId,
          produit: produit as any, // Cast necessaire si le type diffère légèrement
          quantiteLivree: produitInv.quantiteLivree,
          invendus: invendusActuels,
          vendu: produitInv.quantiteLivree - invendusActuels // Recalculer le vendu basé sur l'invendu actuel (modifiable)
        };
      });
    }

    if (produitsAffiches.length === 0) return null;

    return {
      ...client,
      produits: produitsAffiches
    };
  }).filter((client): client is NonNullable<typeof client> => client !== null)
    .filter(client =>
      searchTerm === '' ||
      client.nom.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .filter(client => {
      const totalInvendus = client.produits.reduce((sum, p) => sum + p.invendus, 0);
      if (filterStatus === 'with_returns') return totalInvendus > 0;
      if (filterStatus === 'without_returns') return totalInvendus === 0;
      return true;
    });

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

        // Mettre à jour la facture (silencieusement)
        const invendusUpdated = useLivraisonStore.getState().invendusClients;
        genererFacturesDepuisLivraisons(new Date(dateSelectionnee), commandesClients, invendusUpdated).catch(err => console.error(err));

        toast.success(`✅ Aucun retour confirmé pour ${client?.nom || 'le client'}`);
      }
    } catch (error) {
      console.error('Erreur lors du marquage "aucun retour":', error);
      toast.error('❌ Erreur lors du marquage "aucun retour"');
    }
  };

  const handleAnnulerValidation = async (clientId: string) => {
    const client = clients.find(c => c.id === clientId);

    try {
      const confirmation = await confirmModal.confirm({
        title: 'Modifier les retours',
        message: `Souhaitez-vous modifier les retours pour "${client?.nom}" ?\n\nCela annulera la validation actuelle et vous permettra de changer les quantités.`,
        confirmText: 'Modifier',
        cancelText: 'Annuler',
        type: 'warning'
      });

      if (confirmation) {
        await annulerValidationRetours(clientId, new Date(dateSelectionnee));

        // Mettre à jour la facture (pour la repasser en attente)
        const invendusUpdated = useLivraisonStore.getState().invendusClients;
        genererFacturesDepuisLivraisons(new Date(dateSelectionnee), commandesClients, invendusUpdated).catch(err => console.error(err));

        toast.success(`✏️ Retours déverrouillés pour ${client?.nom}`);
      }
    } catch (error) {
      console.error('Erreur lors de l\'annulation de la validation:', error);
      toast.error('❌ Erreur lors de l\'annulation de la validation');
    }
  };

  const handleSupprimerRetour = async (clientId: string) => {
    const client = clients.find(c => c.id === clientId);

    try {
      const confirmation = await confirmModal.confirm({
        title: 'Supprimer le retour',
        message: `Attention, vous allez supprimer définitivement le retour pour "${client?.nom}".\n\nCette action est irréversible et supprimera le retour de la base de données.`,
        confirmText: 'Supprimer définitivement',
        cancelText: 'Annuler',
        type: 'danger'
      });

      if (confirmation) {
        await supprimerInvendusClient(clientId, new Date(dateSelectionnee));

        // Mettre à jour les factures après suppression
        const invendusUpdated = useLivraisonStore.getState().invendusClients;
        genererFacturesDepuisLivraisons(new Date(dateSelectionnee), commandesClients, invendusUpdated).catch(err => console.error(err));

        toast.success(`🗑️ Retour supprimé pour ${client?.nom}`);
      }
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      toast.error('❌ Erreur lors de la suppression');
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

  // Vérifier si un client a des retours enregistrés (même non finalisés)
  const clientASauvegarde = (clientId: string) => {
    return invendusClients.some(inv =>
      inv.clientId === clientId &&
      inv.dateLivraison.toDateString() === new Date(dateSelectionnee).toDateString()
    );
  };

  const handleEnregistrerRetours = async (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    const clientData = clientsAvecDonnees.find(c => c.id === clientId);

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

        // Mettre à jour la facture IMMÉDIATEMENT
        const invendusUpdated = useLivraisonStore.getState().invendusClients;
        genererFacturesDepuisLivraisons(new Date(dateSelectionnee), commandesClients, invendusUpdated).catch(err => console.error("Erreur update facture", err));

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
    <div className="min-h-screen bg-sand-100 overflow-x-hidden">
      {/* Header moderne */}
      <div className="bg-white border-b border-sand-200 px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <div className="w-10 h-10 bg-terracotta-500 rounded-xl flex items-center justify-center shrink-0">
              <Icon icon="mdi:keyboard-return" className="text-xl text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl font-semibold text-sand-900 truncate">
                Saisie des Retours Clients
              </h1>
              <p className="text-xs sm:text-sm text-sand-500 truncate">
                <span className="hidden sm:inline">Enregistrez les invendus de chaque client pour la facturation</span>
                <span className="sm:hidden">Enregistrement des invendus</span>
              </p>
            </div>
          </div>

          <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
            <button
              onClick={async () => {
                const clientsSansRetours = clientsAvecDonnees.filter(c => !clientARetoursCompletes(c.id!));

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
              className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-sand-900 hover:bg-sand-800 text-white rounded-lg transition-all shadow-sm text-xs sm:text-sm font-medium flex-1 sm:flex-none"
              disabled={isLoading || clientsAvecDonnees.every(c => clientARetoursCompletes(c.id!))}
            >
              <Icon icon="mdi:check-all" className="text-base sm:text-lg" />
              <span className="hidden sm:inline">Tout marquer sans retour</span>
              <span className="sm:hidden">Tout valider</span>
            </button>
          </div>
        </div>

        {/* Barre de recherche et filtres */}
        <div className="flex flex-col md:flex-row gap-3 sm:gap-4 mt-3 sm:mt-4">
          {/* Filtres */}
          <div className="flex items-center bg-sand-100 rounded-lg p-1 shrink-0">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${filterStatus === 'all'
                ? 'bg-white text-sand-900 shadow-sm'
                : 'text-sand-500 hover:text-sand-700'
                }`}
            >
              Tous
            </button>
            <button
              onClick={() => setFilterStatus('with_returns')}
              className={`px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${filterStatus === 'with_returns'
                ? 'bg-white text-danger-600 shadow-sm'
                : 'text-sand-500 hover:text-sand-700'
                }`}
            >
              Avec retours
            </button>
            <button
              onClick={() => setFilterStatus('without_returns')}
              className={`px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${filterStatus === 'without_returns'
                ? 'bg-white text-success-600 shadow-sm'
                : 'text-sand-500 hover:text-sand-700'
                }`}
            >
              Sans retour
            </button>
          </div>

          {/* Barre de recherche */}
          <div className="flex-1 relative">
            <Icon icon="mdi:magnify" className="absolute left-3 top-1/2 -translate-y-1/2 text-sand-400 text-base sm:text-lg" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher un client..."
              className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 bg-sand-50 border border-sand-300 rounded-lg focus:ring-2 focus:ring-sand-900 focus:border-transparent text-xs sm:text-sm"
            />
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto p-6 space-y-6">

        {/* Widget de sélection de date moderne et visible */}
        <div className="bg-white rounded-xl border border-sand-200 shadow-sm p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Sélecteur de date à gauche */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-danger-100 rounded-lg flex items-center justify-center">
                <Icon icon="mdi:calendar" className="text-xl text-danger-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-sand-500 uppercase tracking-wider">Date de livraison</h2>
                <input
                  type="date"
                  value={dateSelectionnee}
                  onChange={(e) => setDateSelectionnee(e.target.value)}
                  className="mt-1 px-4 py-2 border border-sand-300 rounded-lg focus:ring-2 focus:ring-danger-500 focus:border-transparent text-sand-900 font-medium shadow-sm hover:border-sand-400 transition-all cursor-pointer"
                />
              </div>
            </div>

            {/* Affichage GROS de la date à droite */}
            <div className="flex-1 max-w-lg bg-danger-50 border border-danger-100 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="hidden sm:flex w-12 h-12 bg-danger-500 rounded-xl items-center justify-center text-white shadow-md transform rotate-3">
                  <Icon icon="mdi:calendar-check" className="text-2xl" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-danger-600 uppercase tracking-widest mb-1">
                    Retours du
                  </div>
                  <div className="text-xl sm:text-2xl font-semibold text-sand-800 capitalize leading-tight">
                    {new Date(dateSelectionnee).toLocaleDateString('fr-FR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Liste des clients avec livraisons */}
        {clientsAvecDonnees.length === 0 ? (
          <div className="bg-white rounded-xl border border-sand-200 shadow-sm">
            <div className="p-6">
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-sand-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icon icon="mdi:package-variant-closed" className="text-4xl text-sand-400" />
                </div>
                <h3 className="text-lg font-medium text-sand-900 mb-2">
                  Aucune livraison prévue
                </h3>
                <p className="text-sand-500 mb-6">
                  Aucune commande client pour cette date
                </p>
                <button className="inline-flex items-center gap-2 px-6 py-3 bg-info-600 text-white rounded-lg hover:from-info-600 hover:to-terracotta-700 transition-all shadow-md">
                  <Icon icon="mdi:plus" className="text-lg" />
                  <span className="font-medium">Créer une commande</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white border border-sand-200 rounded-2xl p-4 shadow-card hover:shadow-elevated transition-all">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 mb-2">
                  <div className="w-10 h-10 bg-sand-100 rounded-full flex items-center justify-center shrink-0">
                    <Icon icon="mdi:account-group" className="text-lg sm:text-xl text-sand-600" />
                  </div>
                  <div className="text-left sm:text-right w-full sm:w-auto">
                    <div className="font-display text-2xl sm:text-3xl font-semibold text-sand-900">
                      {clientsAvecDonnees.length}
                    </div>
                    <div className="text-sand-500 text-xs">clients</div>
                  </div>
                </div>
                <div className="text-sm sm:text-base font-semibold text-sand-700 truncate">Clients Livrés</div>
              </div>

              <div className="bg-white border border-sand-200 rounded-2xl p-4 shadow-card hover:shadow-elevated transition-all">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 mb-2">
                  <div className="w-10 h-10 bg-info-100 rounded-full flex items-center justify-center shrink-0">
                    <Icon icon="mdi:package-variant" className="text-lg sm:text-xl text-info-600" />
                  </div>
                  <div className="text-left sm:text-right w-full sm:w-auto">
                    <div className="font-display text-2xl sm:text-3xl font-semibold text-sand-900">
                      {clientsAvecDonnees.reduce((sum, client) =>
                        sum + client.produits.reduce((prodSum, p) => prodSum + p.quantiteLivree, 0), 0
                      )}
                    </div>
                    <div className="text-sand-500 text-xs">pièces</div>
                  </div>
                </div>
                <div className="text-sm sm:text-base font-semibold text-sand-700 truncate">Total Livré</div>
              </div>

              <div className="bg-white border border-sand-200 rounded-2xl p-4 shadow-card hover:shadow-elevated transition-all">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 mb-2">
                  <div className="w-10 h-10 bg-danger-100 rounded-full flex items-center justify-center shrink-0">
                    <Icon icon="mdi:package-down" className="text-lg sm:text-xl text-danger-600" />
                  </div>
                  <div className="text-left sm:text-right w-full sm:w-auto">
                    <div className="font-display text-2xl sm:text-3xl font-semibold text-sand-900">
                      {clientsAvecDonnees.reduce((sum, client) =>
                        sum + client.produits.reduce((prodSum, p) => prodSum + p.invendus, 0), 0
                      )}
                    </div>
                    <div className="text-sand-500 text-xs">pièces</div>
                  </div>
                </div>
                <div className="text-sm sm:text-base font-semibold text-sand-700 truncate">Total Invendus</div>
              </div>

              <div className="bg-white border border-sand-200 rounded-2xl p-4 shadow-card hover:shadow-elevated transition-all">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 mb-2">
                  <div className="w-10 h-10 bg-success-100 rounded-full flex items-center justify-center shrink-0">
                    <Icon icon="mdi:chart-line" className="text-lg sm:text-xl text-success-600" />
                  </div>
                  <div className="text-left sm:text-right w-full sm:w-auto">
                    <div className="font-display text-2xl sm:text-3xl font-semibold text-sand-900">
                      {clientsAvecDonnees.reduce((sum, client) =>
                        sum + client.produits.reduce((prodSum, p) => prodSum + p.vendu, 0), 0
                      )}
                    </div>
                    <div className="text-sand-500 text-xs">pièces</div>
                  </div>
                </div>
                <div className="text-sm sm:text-base font-semibold text-sand-700 truncate">Total Vendu</div>
              </div>
            </div>

            {/* Liste des clients */}
            {clientsAvecDonnees.map((client) => (
              <div key={client.id} className="bg-white rounded-xl border border-sand-200 shadow-sm">
                <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-sand-100">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`w-8 h-8 ${clientARetoursCompletes(client.id!) ? 'bg-success-100' : 'bg-warning-100'} rounded-full flex items-center justify-center shrink-0`}>
                        <Icon
                          icon={clientARetoursCompletes(client.id!) ? "mdi:check" : "mdi:account"}
                          className={`text-base sm:text-lg ${clientARetoursCompletes(client.id!) ? 'text-success-600' : 'text-warning-600'}`}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-base sm:text-lg font-semibold text-sand-900 truncate">{client.nom}</h2>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs sm:text-sm text-sand-500">
                          <div className="flex items-center gap-1 min-w-0">
                            <Icon icon="mdi:map-marker" className="text-xs sm:text-sm shrink-0" />
                            <span className="truncate">{client.adresse}</span>
                          </div>
                          {client.telephone && (
                            <div className="flex items-center gap-1">
                              <Icon icon="mdi:phone" className="text-xs sm:text-sm shrink-0" />
                              <span>{client.telephone}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {clientARetoursCompletes(client.id!) ? (
                      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                        <div className="flex items-center gap-2 bg-success-100 text-success-700 px-2 sm:px-3 py-1 rounded-full">
                          <Icon icon="mdi:check-circle" className="text-xs sm:text-sm" />
                          <span className="text-xs sm:text-sm font-medium">Retours finalisés</span>
                        </div>
                        <button
                          onClick={() => handleAnnulerValidation(client.id!)}
                          disabled={isLoading}
                          className="flex items-center gap-1.5 px-2 sm:px-3 py-1 bg-sand-100 hover:bg-sand-200 text-sand-600 rounded-lg transition-all text-xs sm:text-sm"
                          title="Modifier les retours"
                        >
                          <Icon icon="mdi:pencil" className="text-xs sm:text-sm" />
                          <span className="hidden sm:inline">Modifier</span>
                        </button>
                        <button
                          onClick={() => handleSupprimerRetour(client.id!)}
                          disabled={isLoading}
                          className="flex items-center gap-1.5 px-2 sm:px-3 py-1 bg-danger-100 hover:bg-danger-100 text-danger-600 rounded-lg transition-all text-xs sm:text-sm"
                          title="Supprimer le retour"
                        >
                          <Icon icon="mdi:trash-can" className="text-xs sm:text-sm" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                        <button
                          onClick={() => handleEnregistrerRetours(client.id!)}
                          disabled={isLoading}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-success-600 hover:bg-success-700 text-white rounded-lg transition-all disabled:opacity-50 shadow-sm text-xs sm:text-sm font-medium flex-1 sm:flex-none"
                        >
                          <Icon icon="mdi:content-save-check" className="text-sm" />
                          <span>Enregistrer</span>
                        </button>
                        <button
                          onClick={() => handleAucunRetour(client.id!)}
                          disabled={isLoading}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-sand-900 hover:bg-sand-800 text-white rounded-lg transition-all disabled:opacity-50 shadow-sm text-xs sm:text-sm font-medium flex-1 sm:flex-none"
                        >
                          <Icon icon="mdi:check-bold" className="text-sm" />
                          <span>Aucun retour</span>
                        </button>
                        {clientASauvegarde(client.id!) && (
                          <button
                            onClick={() => handleSupprimerRetour(client.id!)}
                            disabled={isLoading}
                            className="flex items-center gap-1.5 px-2 sm:px-3 py-2 bg-danger-100 hover:bg-danger-100 text-danger-600 rounded-lg transition-all text-xs sm:text-sm shadow-sm"
                            title="Supprimer le retour"
                          >
                            <Icon icon="mdi:trash-can" className="text-base sm:text-lg" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-6">
                  {/* Grille des produits */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-sand-200">
                      <Icon icon="mdi:view-grid" className="text-sand-500" />
                      <h3 className="text-lg font-semibold text-sand-800">Produits livrés</h3>
                      <span className="ml-auto text-sm font-medium text-sand-500 bg-sand-100 px-2 py-1 rounded-lg">
                        {client.produits.length} produit{client.produits.length > 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {client.produits.map((produitLivraison) => (
                        <div
                          key={produitLivraison.produitId}
                          className={`${produitLivraison.invendus > 0 ? 'bg-danger-50 border-danger-100' : 'bg-success-50 border-success-100'} border rounded-xl p-4 hover:shadow-elevated transition-all`}
                        >
                          <div className="flex items-center gap-3 mb-4">
                            <div className={`w-12 h-12 ${produitLivraison.invendus > 0 ? 'bg-danger-500' : 'bg-success-500'} rounded-xl flex items-center justify-center shadow-card`}>
                              <Icon
                                icon={getProductIcon(produitLivraison.produit?.nom || '')}
                                className="text-xl text-white"
                              />
                            </div>
                            <div className="flex-1">
                              <h4 className="font-semibold text-sand-900 mb-1">
                                {produitLivraison.produit?.nom || 'Produit inconnu'}
                              </h4>
                              <div className="text-sm text-sand-600">
                                Livré: <span className="font-semibold">{produitLivraison.quantiteLivree} pièces</span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-sand-700 mb-1">Invendus retour:</label>
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
                                onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                                disabled={clientARetoursCompletes(client.id!)}
                                className="w-full px-3 py-2 border border-sand-300 rounded-lg focus:ring-2 focus:ring-danger-500 focus:border-transparent disabled:bg-sand-100 disabled:text-sand-500 disabled:cursor-not-allowed"
                                placeholder="0"
                              />
                            </div>

                            <div className="bg-white/60 backdrop-blur-sm rounded-lg p-3">
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-sand-600">Vendu final:</span>
                                <span className={`text-lg font-semibold ${produitLivraison.vendu > 0 ? 'text-success-600' : 'text-sand-600'}`}>
                                  {produitLivraison.vendu} pièces
                                </span>
                              </div>
                              {produitLivraison.invendus > 0 && (
                                <div className="mt-2 flex items-center gap-2">
                                  <Icon icon="mdi:package-variant-closed" className="text-danger-500 text-sm" />
                                  <span className="text-xs text-danger-600 font-medium">
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
                    <div className="bg-sand-50 rounded-xl p-6 mt-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Icon icon="mdi:chart-box" className="text-sand-600" />
                        <h4 className="font-semibold text-sand-800">Résumé client</h4>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center">
                          <div className="font-display text-2xl font-semibold text-info-600">
                            {client.produits.reduce((sum, p) => sum + p.quantiteLivree, 0)}
                          </div>
                          <div className="text-sm text-sand-600">Total livré</div>
                        </div>
                        <div className="text-center">
                          <div className="font-display text-2xl font-semibold text-danger-600">
                            {client.produits.reduce((sum, p) => sum + p.invendus, 0)}
                          </div>
                          <div className="text-sm text-sand-600">Invendus</div>
                        </div>
                        <div className="text-center">
                          <div className="font-display text-2xl font-semibold text-success-600">
                            {client.produits.reduce((sum, p) => sum + p.vendu, 0)}
                          </div>
                          <div className="text-sm text-sand-600">Vendu</div>
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

      <ScrollToTopBottom />

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