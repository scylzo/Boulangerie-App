import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { FactureDetailsModal } from '../../components/factures/FactureDetailsModal';
import { PaymentModal } from '../../components/factures/PaymentModal';
import { CalculateurRistourneModal } from '../../components/factures/CalculateurRistourneModal';
import { useFacturationStore } from '../../store/facturationStore';
import { useProductionStore } from '../../store/productionStore';
import { useLivraisonStore } from '../../store/livraisonStore';
import { useConfirmModal } from '../../hooks/useConfirmModal';
import { formatCurrency } from '../../utils/currency';
import { downloadFacturePDF } from '../../utils/pdfGenerator';
import type { Facture } from '../../types';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

export const GestionFactures: React.FC = () => {
  const {
    factures,
    factureActive,
    isLoading,
    chargerFactures,
    chargerParametres,
    genererFacturesDepuisLivraisons,
    envoyerFacture,
    marquerPayee,
    annulerFacture,
    supprimerFacture,
    setFactureActive,
    actualiserStatutsFactures
  } = useFacturationStore();

  const { chargerProgramme } = useProductionStore();
  const { chargerInvendusDuJour } = useLivraisonStore();
  const confirmModal = useConfirmModal();

  const [dateSelectionnee, setDateSelectionnee] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [filtreStatut, setFiltreStatut] = useState<string>('tous');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFactureDetails, setShowFactureDetails] = useState(false);
  const [showRistourneModal, setShowRistourneModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [factureAPayer, setFactureAPayer] = useState<Facture | null>(null);

  useEffect(() => {
    const initialiser = async () => {
      try {
        await chargerParametres();
        await chargerFactures();
      } catch (error) {
        console.error('Erreur lors de l\'initialisation:', error);
      }
    };
    initialiser();
  }, [chargerParametres, chargerFactures]);

  // Recharger les factures quand la date change
  useEffect(() => {
    const rechargerFactures = async () => {
      try {
        await chargerFactures();
        // Actualiser automatiquement les statuts après rechargement
        await actualiserStatutsFactures();
      } catch (error) {
        console.error('Erreur lors du rechargement des factures:', error);
      }
    };
    rechargerFactures();
  }, [dateSelectionnee, chargerFactures, actualiserStatutsFactures]);

  // Synchronisation périodique des statuts (toutes les 30 secondes)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        await actualiserStatutsFactures();
        await chargerFactures();
      } catch (error) {
        console.error('Erreur lors de la synchronisation automatique:', error);
      }
    }, 30000); // 30 secondes

    return () => clearInterval(interval);
  }, [actualiserStatutsFactures, chargerFactures]);

  const handleGenererFactures = async () => {
    try {
      const date = new Date(dateSelectionnee);

      // Vérifier s'il y a déjà des factures pour cette date
      const facturesExistantes = factures.filter(f =>
        f.dateLivraison.toISOString().split('T')[0] === dateSelectionnee
      );

      // Si des factures existent, demander confirmation
      if (facturesExistantes.length > 0) {

        const confirmation = await confirmModal.confirm({
          title: 'Mise à jour des factures',
          message: `Mettre à jour les factures du ${new Date(dateSelectionnee).toLocaleDateString('fr-FR')} ?\n\nCela actualisera les statuts et validera celles dont les retours sont complétés. Aucun doublon ne sera créé.`,
          confirmText: 'Mettre à jour',
          cancelText: 'Annuler',
          type: 'warning'
        });

        if (!confirmation) {
          return; // L'utilisateur a annulé
        }
      }

      // Charger les données nécessaires
      console.log('📦 Chargement du programme pour', date.toLocaleDateString('fr-FR'));
      await chargerProgramme(date);

      console.log('📦 Chargement des retours clients pour', date.toLocaleDateString('fr-FR'));
      await chargerInvendusDuJour(date);

      // Attendre un délai plus long pour que le state soit mis à jour
      await new Promise(resolve => setTimeout(resolve, 500));

      // Récupérer les données après le chargement
      const programmeActuelApresChargement = useProductionStore.getState().programmeActuel;
      const commandesClients = programmeActuelApresChargement?.commandesClients || [];
      console.log(`✅ ${commandesClients.length} commandes clients chargées`);

      const invendusApresChargement = useLivraisonStore.getState().invendusClients;
      console.log(`✅ ${invendusApresChargement.length} retours clients chargés`);

      if (invendusApresChargement.length > 0) {
        console.log('📋 Clients avec retours:', invendusApresChargement.map(inv => ({
          clientId: inv.clientId,
          client: inv.client?.nom,
          produits: inv.produits.length,
          retoursCompletes: inv.retoursCompletes
        })));
      } else {
        console.warn('⚠️ Aucun retour client trouvé pour cette date');
      }

      await genererFacturesDepuisLivraisons(date, commandesClients, invendusApresChargement);

      // Recharger la liste des factures
      await chargerFactures();
      toast.success('✅ Factures générées avec succès');
    } catch (error) {
      console.error('Erreur lors de la génération:', error);
      toast.error(`❌ Erreur lors de la génération: ${error}`);
    }
  };

  const handleActionFacture = async (action: string, facture: Facture) => {
    try {
      switch (action) {
        case 'voir':
          setFactureActive(facture);
          setShowFactureDetails(true);
          break;

        case 'pdf':
          try {
            await downloadFacturePDF(facture);
            toast.success(`📄 PDF de la facture ${facture.numeroFacture} téléchargé`);
          } catch (error) {
            console.error('Erreur lors de la génération du PDF:', error);
            toast.error('❌ Erreur lors de la génération du PDF');
          }
          break;

        case 'envoyer': {
          const confirmationEnvoyer = await confirmModal.confirm({
            title: 'Envoyer la facture',
            message: `Envoyer la facture ${facture.numeroFacture} au client "${facture.client?.nom || 'Inconnu'}" ?\n\nLa facture passera au statut "Envoyée".`,
            confirmText: 'Envoyer',
            cancelText: 'Annuler',
            type: 'info'
          });
          if (confirmationEnvoyer) {
            await envoyerFacture(facture.id);
            toast.success(`📧 Facture ${facture.numeroFacture} envoyée au client`);
          }
          break;
        }

        case 'relancer':
          toast('📧 Relance client - Fonctionnalité à implémenter', {
            icon: '💡',
            duration: 3000,
          });
          break;

        case 'payer': {
          setFactureAPayer(facture);
          setShowPaymentModal(true);
          break;
        }

        case 'annuler': {
          const confirmationAnnulation = await confirmModal.confirm({
            title: 'Annuler la facture',
            message: `Êtes-vous sûr de vouloir annuler la facture ${facture.numeroFacture} ?\n\nCette action est irréversible et la facture ne pourra plus être modifiée.`,
            confirmText: 'Annuler la facture',
            cancelText: 'Conserver',
            type: 'danger'
          });
          if (confirmationAnnulation) {
            await annulerFacture(facture.id);
            toast.success(`❌ Facture ${facture.numeroFacture} annulée`);
          }
          break;
        }

        case 'supprimer': {
          const confirmationSuppression = await confirmModal.confirm({
            title: 'Supprimer la facture',
            message: `ATTENTION : Êtes-vous sûr de vouloir SUPPRIMER DÉFINITIVEMENT la facture ${facture.numeroFacture} ?\n\nCette action supprimera la facture de la base de données.`,
            confirmText: 'Supprimer définitivement',
            cancelText: 'Annuler',
            type: 'danger'
          });
          if (confirmationSuppression) {
            await supprimerFacture(facture.id);
            toast.success(`🗑️ Facture ${facture.numeroFacture} supprimée`);
          }
          break;
        }
      }
    } catch (error) {
      console.error('Erreur lors de l\'action:', error);
      toast.error(`❌ Erreur: ${error}`);
    }
  };



  // Filtrer les factures par date de livraison et statut
  const facturesFiltrees = factures.filter(facture => {
    // Filtrer par date de livraison sélectionnée
    const dateLivraisonStr = facture.dateLivraison.toISOString().split('T')[0];
    const dateSelectionneeStr = dateSelectionnee;

    const matchDate = dateLivraisonStr === dateSelectionneeStr;

    // Filtrer par statut
    const matchStatut = filtreStatut === 'tous' || facture.statut === filtreStatut;

    // Filtrer par recherche (Client ou N° Facture)
    const term = searchTerm.toLowerCase();
    const matchSearch =
      (facture.client?.nom?.toLowerCase() || '').includes(term) ||
      (facture.numeroFacture?.toLowerCase() || '').includes(term);

    return matchDate && matchStatut && matchSearch;
  });

  // Factures de la date sélectionnée pour les statistiques
  const facturesDateSelectionnee = factures.filter(facture => {
    const dateLivraisonStr = facture.dateLivraison.toISOString().split('T')[0];
    return dateLivraisonStr === dateSelectionnee;
  });

  // Statistiques pour la date sélectionnée
  const stats = {
    total: facturesDateSelectionnee.length,
    enAttente: facturesDateSelectionnee.filter(f => f.statut === 'en_attente_retours').length,
    validees: facturesDateSelectionnee.filter(f => f.statut === 'validee').length,
    payees: facturesDateSelectionnee.filter(f => f.statut === 'payee').length,
    montantTotal: facturesDateSelectionnee
      .filter(f => f.statut !== 'annulee')
      .reduce((sum, f) => sum + f.totalTTC, 0),
    montantEnAttente: facturesDateSelectionnee
      .filter(f => f.statut === 'validee' || f.statut === 'envoyee')
      .reduce((sum, f) => sum + f.totalTTC, 0)
  };

  const getStatutColor = (statut: string) => {
    switch (statut) {
      case 'brouillon': return 'text-gray-600 bg-gray-100';
      case 'en_attente_retours': return 'text-yellow-700 bg-yellow-100';
      case 'validee': return 'text-blue-700 bg-blue-100';
      case 'envoyee': return 'text-indigo-700 bg-indigo-100';
      case 'payee': return 'text-green-700 bg-green-100';
      case 'annulee': return 'text-red-700 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatutLibelle = (statut: string) => {
    switch (statut) {
      case 'brouillon': return 'Brouillon';
      case 'en_attente_retours': return 'En attente retours';
      case 'validee': return 'Validée';
      case 'envoyee': return 'Envoyée';
      case 'payee': return 'Payée';
      case 'annulee': return 'Annulée';
      default: return statut;
    }
  };

  const getActionsDisponibles = (facture: Facture) => {
    const actions = [
      { key: 'voir', label: 'Voir détails', icon: 'mdi:eye', color: 'text-blue-600' }
    ];

    switch (facture.statut) {
      case 'en_attente_retours':
        // Aucune action supplémentaire - attendre que les retours soient finalisés
        actions.push({ key: 'supprimer', label: 'Supprimer', icon: 'mdi:trash-can-outline', color: 'text-red-500 hover:bg-red-50' });
        break;

      case 'validee':
        actions.push({ key: 'pdf', label: 'Télécharger PDF', icon: 'mdi:download', color: 'text-gray-600' });
        actions.push({ key: 'envoyer', label: 'Envoyer au client', icon: 'mdi:send', color: 'text-indigo-600' });
        actions.push({ key: 'annuler', label: 'Annuler', icon: 'mdi:cancel', color: 'text-red-600' });
        actions.push({ key: 'supprimer', label: 'Supprimer', icon: 'mdi:trash-can-outline', color: 'text-red-500 hover:bg-red-50' });
        break;

      case 'envoyee':
        actions.push({ key: 'pdf', label: 'Télécharger PDF', icon: 'mdi:download', color: 'text-gray-600' });
        actions.push({ key: 'relancer', label: 'Relancer client', icon: 'mdi:email-send', color: 'text-orange-600' });
        actions.push({ key: 'payer', label: 'Marquer payée', icon: 'mdi:cash-check', color: 'text-green-600' });
        // Pas de suppression pour les factures envoyées par sécurité, ou alors on l'ajoute si demandé expressément.
        break;

      case 'payee':
        actions.push({ key: 'pdf', label: 'Télécharger PDF', icon: 'mdi:download', color: 'text-gray-600' });
        break;

      case 'annulee':
        // Seule consultation possible
        actions.push({ key: 'supprimer', label: 'Supprimer', icon: 'mdi:trash-can-outline', color: 'text-red-500 hover:bg-red-50' });
        break;
    }

    return actions;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header moderne type Odoo */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-linear-to-r from-purple-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <Icon icon="mdi:file-document" className="text-2xl text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Gestion des Factures
              </h1>
              <p className="text-sm text-gray-500">
                Génération et suivi des factures clients basées sur les livraisons et retours
              </p>
            </div>
          </div>

          {/* Bouton Calculateur de Ristourne */}
          <Button
            onClick={() => setShowRistourneModal(true)}
            variant="outline"
            className="flex items-center gap-2 border-orange-200 text-orange-700 hover:bg-orange-50 hover:border-orange-300"
          >
            <Icon icon="mdi:calculator" className="text-xl" />
            <span>Calculer Ristournes</span>
          </Button>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto p-6 space-y-6">

        {/* KPI Cards - Style Odoo moderne */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-linear-to-br from-gray-700 to-gray-800 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 group">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <Icon icon="mdi:file-multiple" className="text-2xl text-white" />
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">{stats.total}</div>
                <div className="text-gray-300 text-xs">factures</div>
              </div>
            </div>
            <div className="text-lg font-semibold">Total Factures</div>
            <div className="text-gray-300 text-sm">Toutes périodes confondues</div>
          </div>

          <div className="bg-linear-to-br from-gray-600 to-gray-700 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 group">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <Icon icon="mdi:clock-outline" className="text-2xl text-white" />
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">{stats.enAttente}</div>
                <div className="text-gray-300 text-xs">en attente</div>
              </div>
            </div>
            <div className="text-lg font-semibold">En Attente Retours</div>
            <div className="text-gray-300 text-sm">Nécessite saisie retours</div>
          </div>

          <div className="bg-linear-to-br from-gray-700 to-gray-800 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 group">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <Icon icon="mdi:check-circle" className="text-2xl text-white" />
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">{stats.payees}</div>
                <div className="text-gray-300 text-xs">payées</div>
              </div>
            </div>
            <div className="text-lg font-semibold">Factures Payées</div>
            <div className="text-gray-300 text-sm">Complètement réglées</div>
          </div>

          <div className="bg-linear-to-br from-gray-600 to-gray-700 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 group">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <Icon icon="mdi:cash" className="text-2xl text-white" />
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">{formatCurrency(stats.montantTotal)}</div>
                <div className="text-gray-300 text-xs">FCFA</div>
              </div>
            </div>
            <div className="text-lg font-semibold">Montant Total</div>
            <div className="text-gray-300 text-sm">Chiffre d'affaires global</div>
          </div>
        </div>

        {/* Section Génération de factures */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <Icon icon="mdi:file-plus" className="text-lg text-purple-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Génération de factures</h2>
                <p className="text-sm text-gray-500">Créer des factures basées sur les livraisons du jour</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-48">
                <Input
                  type="date"
                  label="Date de livraison"
                  value={dateSelectionnee}
                  onChange={(e) => setDateSelectionnee(e.target.value)}
                />
              </div>
              <Button
                onClick={handleGenererFactures}
                isLoading={isLoading}
                className="flex items-center gap-2"
              >
                <Icon icon="mdi:plus" className="text-sm" />
                {factures.some(f => f.dateLivraison.toISOString().split('T')[0] === dateSelectionnee)
                  ? 'Mettre à jour factures'
                  : 'Générer nouvelles factures'} du {new Date(dateSelectionnee).toLocaleDateString('fr-FR')}
              </Button>

            </div>
          </div>
        </div>

        {/* Section Liste des factures */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <Icon icon="mdi:file-document-multiple" className="text-lg text-purple-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Liste des factures</h2>
                <p className="text-sm text-gray-500">Filtrer et gérer vos factures</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            {/* Filtres et Recherche */}
            <div className="mb-4 flex flex-wrap gap-4 items-end justify-between">
              <div className="flex gap-4 items-end flex-wrap">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Filtrer par statut
                  </label>
                  <select
                    value={filtreStatut}
                    onChange={(e) => setFiltreStatut(e.target.value)}
                    className="block rounded-lg border border-gray-300 px-3 py-2 focus:border-orange-500 focus:ring-orange-500 focus:ring-1 sm:text-sm transition-colors bg-white w-48"
                  >
                    <option value="tous">Tous</option>
                    <option value="en_attente_retours">En attente retours</option>
                    <option value="validee">Validées</option>
                    <option value="envoyee">Envoyées</option>
                    <option value="payee">Payées</option>
                    <option value="annulee">Annulées</option>
                  </select>
                </div>
              </div>

              {/* Barre de recherche */}
              <div className="w-full md:w-64">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rechercher
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Icon icon="mdi:search" className="text-gray-400 text-lg" />
                  </div>
                  <input
                    type="text"
                    placeholder="Client ou N° Facture..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      <Icon icon="mdi:close" className="text-lg" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Tableau des factures */}
            {facturesFiltrees.length === 0 ? (
              <div className="text-center py-12">
                <Icon icon="mdi:file-document-outline" className="text-6xl mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Aucune facture trouvée
                </h3>
                <p className="text-gray-600">
                  {filtreStatut === 'tous'
                    ? 'Commencez par générer des factures pour une date donnée'
                    : `Aucune facture avec le statut "${getStatutLibelle(filtreStatut)}"`
                  }
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        N° Facture
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Client
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Date livraison
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Montant TTC
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Statut
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Retours
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {facturesFiltrees.map((facture) => (
                      <tr key={facture.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm font-medium text-gray-900">
                          {facture.numeroFacture}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600">
                          {facture.client?.nom || 'Client inconnu'}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600">
                          {facture.dateLivraison.toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-4 py-2 text-sm font-medium text-gray-900">
                          {formatCurrency(facture.totalTTC)}
                        </td>
                        <td className="px-4 py-2 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatutColor(facture.statut)}`}>
                            {getStatutLibelle(facture.statut)}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm text-center">
                          {facture.retoursCompletes ? (
                            <Icon icon="mdi:check-circle" className="text-green-500 text-lg" />
                          ) : (
                            <Icon icon="mdi:clock-outline" className="text-yellow-500 text-lg" />
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm">
                          <div className="flex space-x-2">
                            {getActionsDisponibles(facture).map((action) => (
                              <button
                                key={action.key}
                                onClick={() => handleActionFacture(action.key, facture)}
                                className={`p-1 rounded hover:bg-gray-100 ${action.color}`}
                                title={action.label}
                              >
                                <Icon icon={action.icon} className="text-lg" />
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
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

      <FactureDetailsModal
        facture={factureActive}
        isOpen={showFactureDetails}
        onClose={() => {
          setShowFactureDetails(false);
          setFactureActive(null);
        }}
      />

      <PaymentModal
        facture={factureAPayer}
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setFactureAPayer(null);
        }}
        onConfirm={async (amount) => {
          if (factureAPayer) {
            await marquerPayee(factureAPayer.id, amount);
            toast.success(`💰 Facture ${factureAPayer.numeroFacture} réglée`);
          }
        }}
      />

      <CalculateurRistourneModal
        isOpen={showRistourneModal}
        onClose={() => setShowRistourneModal(false)}
      />
    </div>
  );
};
