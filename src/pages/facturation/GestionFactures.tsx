import React, { useEffect, useState, useMemo } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { FactureDetailsModal } from '../../components/factures/FactureDetailsModal';
import { PaymentModal } from '../../components/factures/PaymentModal';
import { CalculateurRistourneModal } from '../../components/factures/CalculateurRistourneModal';
import { useFacturationStore } from '../../store/facturationStore';

import { useLivraisonStore } from '../../store/livraisonStore';
import { useReferentielStore } from '../../store/referentielStore';
import { useConfirmModal } from '../../hooks/useConfirmModal';
import { formatCurrency } from '../../utils/currency';
import { downloadFacturePDF } from '../../utils/pdfGenerator';
import type { Facture, Client } from '../../types';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

// Types pour la vue
type ViewMode = 'clients_list' | 'client_details';

export const GestionFactures: React.FC = () => {
  const {
    factures,
    factureActive,
    isLoading,
    chargerFactures,
    chargerParametres,
    genererFacturesPourClient,
    envoyerFacture,
    marquerPayee,
    annulerFacture,
    supprimerFacture,
    setFactureActive,
    actualiserStatutsFactures
  } = useFacturationStore();

  const [generatingClientId, setGeneratingClientId] = useState<string | null>(null);

  const handleGenererFacturesClient = async (clientId: string) => {
    const moisStr = selectedMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    if (await confirmModal.confirm({
      title: 'Génération Factures',
      message: `Générer/Actualiser les factures pour ${moisStr} ?`,
      confirmText: 'Générer',
      type: 'info'
    })) {
      setGeneratingClientId(clientId);
      try {
        await genererFacturesPourClient(clientId, selectedMonth);
        toast.success("Factures mises à jour !");
      } catch (e) {
        console.error(e);
        toast.error("Erreur lors de la génération");
      } finally {
        setGeneratingClientId(null);
      }
    }
  };

  const { clients, chargerClients } = useReferentielStore();
  const confirmModal = useConfirmModal();

  // États de navigation et filtres
  const [viewMode, setViewMode] = useState<ViewMode>('clients_list');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  // États existants pour la génération et actions

  const [filtreStatut, setFiltreStatut] = useState<string>('tous');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFactureDetails, setShowFactureDetails] = useState(false);
  const [showRistourneModal, setShowRistourneModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [factureAPayer, setFactureAPayer] = useState<Facture | null>(null);

  // Initialisation
  useEffect(() => {
    const initialiser = async () => {
      try {
        await chargerParametres();
        await chargerFactures();
        await chargerClients(); // Charger les clients
      } catch (error) {
        console.error('Erreur lors de l\'initialisation:', error);
      }
    };
    initialiser();
  }, [chargerParametres, chargerFactures, chargerClients]);

  // Synchronisation auto
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        await actualiserStatutsFactures(true);
        await chargerFactures(undefined, undefined, true);
      } catch (error) {
        console.error('Erreur synchro auto:', error);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [actualiserStatutsFactures, chargerFactures]);

  // --- Logique Vue Clients ---

  const filteredClients = useMemo(() => {
    return clients
      .filter(client => client.active) // Exclure les clients inactifs
      .filter(client =>
        client.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.telephone?.includes(searchTerm)
      );
  }, [clients, searchTerm]);

  // --- Logique Vue Détails Client ---

  const clientInvoices = useMemo(() => {
    if (!selectedClient) return [];

    return factures.filter(f => {
      const invoiceDate = new Date(f.dateLivraison);
      const isSameMonth =
        invoiceDate.getMonth() === selectedMonth.getMonth() &&
        invoiceDate.getFullYear() === selectedMonth.getFullYear();

      const isClient = f.clientId === selectedClient.id;

      let isStatusMatch = true;
      if (filtreStatut === 'payee') isStatusMatch = f.statut === 'payee';
      if (filtreStatut === 'impayee') isStatusMatch = f.statut !== 'payee' && f.statut !== 'annulee';

      return isSameMonth && isClient && isStatusMatch;
    }).sort((a, b) => new Date(b.dateLivraison).getTime() - new Date(a.dateLivraison).getTime());
  }, [factures, selectedClient, selectedMonth, filtreStatut]);

  const clientStats = useMemo(() => {
    return clientInvoices.reduce((acc, f) => {
      const totalLivree = f.lignes.reduce((sum, l) => sum + l.quantiteLivree, 0);
      const totalRetournee = f.lignes.reduce((sum, l) => sum + l.quantiteRetournee, 0);

      return {
        totalFactures: acc.totalFactures + 1,
        montantTotal: acc.montantTotal + f.totalTTC,
        totalLivres: acc.totalLivres + totalLivree,
        totalInvendus: acc.totalInvendus + totalRetournee,
        montantImpaye: (f.statut !== 'payee' && f.statut !== 'annulee') ? acc.montantImpaye + f.totalTTC : acc.montantImpaye,
      };
    }, { totalFactures: 0, montantTotal: 0, totalLivres: 0, totalInvendus: 0, montantImpaye: 0 });
  }, [clientInvoices]);

  // --- Handlers ---

  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    setViewMode('client_details');
    setFiltreStatut('tous'); // Reset filter on new client selection
  };

  const handleBackToClients = () => {
    setSelectedClient(null);
    setViewMode('clients_list');
  };

  const handleChangeMonth = (delta: number) => {
    const newDate = new Date(selectedMonth);
    newDate.setMonth(newDate.getMonth() + delta);
    setSelectedMonth(newDate);
  };

  // --- Helpers UI ---

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
      case 'en_attente_retours': return 'Attente Retours';
      case 'validee': return 'Validée';
      case 'envoyee': return 'Envoyée';
      case 'payee': return 'Payée';
      case 'annulee': return 'Annulée';
      default: return statut;
    }
  };

  // --- Actions Facture Copied from original ---
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
            toast.success(`📄 PDF téléchargé`);
          } catch (error) {
            console.error(error);
            toast.error('❌ Erreur PDF');
          }
          break;

        case 'envoyer': {
          if (await confirmModal.confirm({
            title: 'Envoyer',
            message: `Envoyer facture ${facture.numeroFacture} ?`,
            confirmText: 'Envoyer',
            type: 'info'
          })) {
            await envoyerFacture(facture.id);
            toast.success(`📧 Envoyée`);
          }
          break;
        }

        case 'payer': {
          setFactureAPayer(facture);
          setShowPaymentModal(true);
          break;
        }

        case 'annuler': {
          if (await confirmModal.confirm({
            title: 'Annuler',
            message: `Annuler facture ${facture.numeroFacture} ?`,
            confirmText: 'Annuler',
            type: 'danger'
          })) {
            await annulerFacture(facture.id);
            toast.success(`❌ Annulée`);
          }
          break;
        }

        case 'supprimer': {
          if (await confirmModal.confirm({
            title: 'Supprimer',
            message: `Supprimer DEFINITIVEMENT ${facture.numeroFacture} ?`,
            confirmText: 'Supprimer',
            type: 'danger'
          })) {
            await supprimerFacture(facture.id);
            toast.success(`🗑️ Supprimée`);
          }
          break;
        }
      }
    } catch (error) {
      console.error(error);
      toast.error(`❌ Erreur: ${error}`);
    }
  };




  // --- Render Functions ---

  const renderClientsList = () => (
    <div className="space-y-6">
      {/* Search & Actions Bar */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div className="relative w-full md:w-96">
          <Icon icon="mdi:search" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl" />
          <input
            type="text"
            placeholder="Rechercher un client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
          />
        </div>
        <div className="flex gap-2">
          {/* Bouton Ristournes uniquement */}
          <Button
            onClick={() => setShowRistourneModal(true)}
            variant="outline"
            className="flex items-center gap-2 text-orange-600 hover:bg-orange-50 border-orange-200"
          >
            <Icon icon="mdi:calculator" className="text-xl" />
            Ristournes
          </Button>
        </div>
      </div>

      {/* Grid of Clients */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredClients.map(client => {
          return (
            <div
              key={client.id}
              className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-purple-300 transition-all group relative"
            >
              <div
                onClick={() => handleSelectClient(client)}
                className="cursor-pointer"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center font-bold text-xl group-hover:bg-purple-600 group-hover:text-white transition-colors">
                    {client.nom.charAt(0).toUpperCase()}
                  </div>
                  <Icon icon="mdi:chevron-right" className="text-gray-300 group-hover:text-purple-500 text-2xl" />
                </div>
                <h3 className="font-bold text-gray-900 text-lg mb-1 truncate">{client.nom}</h3>
                <p className="text-sm text-gray-500 flex items-center gap-2 mb-4">
                  <Icon icon="mdi:phone" className="text-gray-400" />
                  {client.telephone || 'Non renseigné'}
                </p>
              </div>


            </div>
          );
        })}
      </div>

      {filteredClients.length === 0 && (
        <div className="text-center py-20 text-gray-500">
          <Icon icon="mdi:account-off" className="text-6xl mx-auto mb-4 text-gray-300" />
          <p>Aucun client trouvé pour "{searchTerm}"</p>
        </div>
      )}
    </div>
  );

  // --- Sélection multiple pour calcul total ---
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);

  const toggleSelectInvoice = (id: string) => {
    setSelectedInvoiceIds(prev =>
      prev.includes(id)
        ? prev.filter(invoiceId => invoiceId !== id)
        : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedInvoiceIds.length === clientInvoices.length) {
      setSelectedInvoiceIds([]);
    } else {
      setSelectedInvoiceIds(clientInvoices.map(f => f.id));
    }
  };

  const totalSelectedAmount = clientInvoices
    .filter(f => selectedInvoiceIds.includes(f.id))
    .reduce((sum, f) => sum + (f.netAPayer ?? f.totalTTC), 0);

  const renderClientDetails = () => (
    <div className="space-y-6 animate-in slide-in-from-right duration-300">
      {/* Header Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleBackToClients}
          className="flex items-center gap-2 text-gray-600 hover:text-purple-600 transition-colors font-medium"
        >
          <Icon icon="mdi:arrow-left" className="text-xl" />
          Retour aux clients
        </button>

        <div className="flex items-center gap-4 bg-white p-2 rounded-lg shadow-sm border border-gray-200">
          <button onClick={() => handleChangeMonth(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
            <Icon icon="mdi:chevron-left" className="text-xl" />
          </button>
          <span className="font-bold text-gray-900 min-w-32 text-center capitalize">
            {selectedMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
          </span>
          <button onClick={() => handleChangeMonth(1)} className="p-2 hover:bg-gray-100 rounded-lg">
            <Icon icon="mdi:chevron-right" className="text-xl" />
          </button>
        </div>
      </div>

      {/* Client Stats Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-xs border border-gray-200">
          <h4 className="text-gray-500 text-sm font-medium mb-1">Montant Total</h4>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(clientStats.montantTotal)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-xs border border-gray-200">
          <h4 className="text-gray-500 text-sm font-medium mb-1">Reste à payer</h4>
          <p className={`text-2xl font-bold ${clientStats.montantImpaye > 0 ? 'text-red-500' : 'text-green-500'}`}>
            {formatCurrency(clientStats.montantImpaye)}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-xs border border-gray-200">
          <h4 className="text-gray-500 text-sm font-medium mb-1">Produits Livrés</h4>
          <p className="text-2xl font-bold text-blue-600">{clientStats.totalLivres}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-xs border border-gray-200">
          <h4 className="text-gray-500 text-sm font-medium mb-1">Invendus</h4>
          <p className="text-2xl font-bold text-orange-500">{clientStats.totalInvendus}</p>
        </div>
      </div>

      {/* Filters & Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Icon icon="mdi:account-details" className="text-purple-600" />
                {selectedClient?.nom}
              </h2>
              <p className="text-sm text-gray-500">Historique des commandes et règlements</p>
            </div>

            {/* Somme sélectionnée */}
            {selectedInvoiceIds.length > 0 && (
              <div className="bg-purple-100 border border-purple-200 px-4 py-2 rounded-lg flex items-center gap-3 animate-in fade-in zoom-in duration-200">
                <span className="text-purple-700 font-medium text-sm">{selectedInvoiceIds.length} sélectionnée(s)</span>
                <div className="h-4 w-px bg-purple-300"></div>
                <span className="text-purple-900 font-bold text-lg">Total: {formatCurrency(totalSelectedAmount)}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={() => selectedClient && handleGenererFacturesClient(selectedClient.id)}
              isLoading={selectedClient ? generatingClientId === selectedClient.id : false}
              className="bg-indigo-600 text-white hover:bg-indigo-700 h-9"
              size="sm"
            >
              <Icon icon="mdi:refresh-auto" className="text-lg mr-2" />
              Générer Factures
            </Button>

            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setFiltreStatut('tous')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${filtreStatut === 'tous' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
              >
                Tout
              </button>
              <button
                onClick={() => setFiltreStatut('payee')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${filtreStatut === 'payee' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
              >
                Payé
              </button>
              <button
                onClick={() => setFiltreStatut('impayee')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${filtreStatut === 'impayee' ? 'bg-white text-red-700 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
              >
                Impayé
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-medium">
              <tr>
                <th className="px-6 py-3 w-4">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    checked={clientInvoices.length > 0 && selectedInvoiceIds.length === clientInvoices.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-6 py-3 text-center w-16">Jour</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">N° Facture</th>
                <th className="px-6 py-3 text-center">Livrés</th>
                <th className="px-6 py-3 text-center">Invendus</th>
                <th className="px-6 py-3 text-right">Montant</th>
                <th className="px-6 py-3 center">Statut</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(() => {
                const daysInMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0).getDate();
                const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

                return daysArray.map((day) => {
                  const dateOfDay = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), day);
                  const invoice = clientInvoices.find(f => new Date(f.dateLivraison).getDate() === day);

                  if (!invoice) {
                    return (
                      <tr key={`day-${day}`} className="hover:bg-gray-50 border-b border-gray-100 bg-gray-50/50">
                        <td className="px-6 py-4"></td>
                        <td className="px-6 py-4 text-center font-bold text-gray-400">{day}</td>
                        <td className="px-6 py-4 text-sm text-gray-400">
                          {dateOfDay.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </td>
                        <td colSpan={6} className="px-6 py-4 text-sm text-gray-300 italic">
                          Aucune commande
                        </td>
                      </tr>
                    );
                  }

                  const totalLivree = invoice.lignes.reduce((sum, l) => sum + l.quantiteLivree, 0);
                  const totalRetournee = invoice.lignes.reduce((sum, l) => sum + l.quantiteRetournee, 0);

                  return (
                    <tr key={invoice.id} className={`hover:bg-gray-50 group border-b border-gray-100 ${selectedInvoiceIds.includes(invoice.id) ? 'bg-purple-50 hover:bg-purple-50' : ''}`}>
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                          checked={selectedInvoiceIds.includes(invoice.id)}
                          onChange={() => toggleSelectInvoice(invoice.id)}
                        />
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-gray-700">{day}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {new Date(invoice.dateLivraison).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {invoice.numeroFacture}
                      </td>
                      <td className="px-6 py-4 text-center text-sm">
                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md font-medium text-xs">
                          {totalLivree}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-sm">
                        {totalRetournee > 0 ? (
                          <span className="bg-orange-50 text-orange-700 px-2 py-1 rounded-md font-medium text-xs">
                            {totalRetournee}
                          </span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-bold text-gray-900">
                        {formatCurrency(invoice.totalTTC)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold block w-fit ${getStatutColor(invoice.statut)}`}>
                          {getStatutLibelle(invoice.statut)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => handleActionFacture('voir', invoice)} className="p-2 hover:bg-gray-200 rounded text-gray-600" title="Détails">
                            <Icon icon="mdi:eye" />
                          </button>
                          <button onClick={() => handleActionFacture('pdf', invoice)} className="p-2 hover:bg-gray-200 rounded text-gray-600" title="PDF">
                            <Icon icon="mdi:file-pdf-box" />
                          </button>
                          {invoice.statut !== 'payee' && invoice.statut !== 'annulee' && (
                            <button onClick={() => handleActionFacture('payer', invoice)} className="p-2 hover:bg-green-100 rounded text-green-600" title="Payer">
                              <Icon icon="mdi:cash-check" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setFacturePourRetour(invoice);
                              setShowRetourModal(true);
                            }}
                            className="p-2 hover:bg-orange-100 rounded text-orange-600"
                            title="Saisir retour"
                          >
                            <Icon icon="mdi:package-variant-minus" />
                          </button>
                          <button
                            onClick={() => {
                              setFacturePourAvoir(invoice);
                              setShowAvoirModal(true);
                            }}
                            className="p-2 hover:bg-blue-100 rounded text-blue-600"
                            title="Ajouter un avoir/crédit"
                          >
                            <Icon icon="mdi:wallet-plus" />
                          </button>
                          <button
                            onClick={() => handleActionFacture('supprimer', invoice)}
                            className="p-2 hover:bg-red-100 rounded text-red-600"
                            title="Supprimer"
                          >
                            <Icon icon="mdi:trash-can" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // --- Modal Saisie Retour Rapide ---
  const [showRetourModal, setShowRetourModal] = useState(false);
  const [facturePourRetour, setFacturePourRetour] = useState<Facture | null>(null);



  const SaisieRetourModal = () => {
    const { sauvegarderRetoursClient, marquerAucunRetourClient } = useLivraisonStore();
    const [valeursRetours, setValeursRetours] = useState<Record<string, number>>({});
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
      if (facturePourRetour) {
        const initial: Record<string, number> = {};
        facturePourRetour.lignes.forEach(l => {
          initial[l.produitId] = l.quantiteRetournee || 0;
        });
        setValeursRetours(initial);
      }
    }, [facturePourRetour]);

    if (!showRetourModal || !facturePourRetour) return null;

    const handleSave = async () => {
      setIsSaving(true);
      try {
        const produitsPourRetour = facturePourRetour.lignes.map(l => {
          const invendus = valeursRetours[l.produitId] || 0;
          const vendu = l.quantiteLivree - invendus;
          return {
            produitId: l.produitId,
            produit: l.produit,
            quantiteLivree: l.quantiteLivree,
            invendus,
            vendu
          };
        });

        await sauvegarderRetoursClient(
          facturePourRetour.clientId,
          new Date(facturePourRetour.dateLivraison),
          produitsPourRetour
        );

        // Actualiser la facture
        await actualiserStatutsFactures();
        await chargerFactures(undefined, undefined, true);

        toast.success('Retours enregistrés');
        setShowRetourModal(false);
      } catch (e) {
        console.error(e);
        toast.error('Erreur sauvegarde retours');
      } finally {
        setIsSaving(false);
      }
    };

    const handleAucunRetour = async () => {
      console.log("Validation sans retour cliquée...");
      setIsSaving(true);
      const loadingToast = toast.loading('Validation en cours...');
      try {
        console.log("Appel de marquerAucunRetourClient...");
        await marquerAucunRetourClient(
          facturePourRetour.clientId,
          new Date(facturePourRetour.dateLivraison)
        );
        console.log("Retour marqué. Actualisation factures...");

        await actualiserStatutsFactures();
        await chargerFactures(undefined, undefined, true);

        toast.success('Validé : Aucun retour', { id: loadingToast });
        setShowRetourModal(false);
      } catch (e) {
        console.error("Erreur handleAucunRetour:", e);
        toast.error('Erreur lors de la validation', { id: loadingToast });
      } finally {
        setIsSaving(false);
      }
    };

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <h3 className="font-bold text-gray-800">Saisie Retours - {facturePourRetour.client?.nom}</h3>
            <button onClick={() => setShowRetourModal(false)} className="text-gray-400 hover:text-gray-600">
              <Icon icon="mdi:close" className="text-xl" />
            </button>
          </div>
          <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
            <p className="text-sm text-gray-500 mb-4">Date : {new Date(facturePourRetour.dateLivraison).toLocaleDateString('fr-FR')}</p>
            {facturePourRetour.lignes.map(ligne => (
              <div key={ligne.produitId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{ligne.produit?.nom || 'Produit'}</p>
                  <p className="text-xs text-gray-500">Livré : {ligne.quantiteLivree}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 uppercase font-bold">Retour :</span>
                  <input
                    type="number"
                    min="0"
                    max={ligne.quantiteLivree}
                    value={valeursRetours[ligne.produitId] ?? 0}
                    onChange={e => setValeursRetours({ ...valeursRetours, [ligne.produitId]: parseInt(e.target.value) || 0 })}
                    className="w-20 p-2 border rounded text-center font-bold text-orange-600 focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-gray-100 flex justify-between gap-2 bg-gray-50">
            <Button
              variant="secondary"
              onClick={handleAucunRetour}
              className="bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-200"
              isLoading={isSaving}
            >
              Valider sans retours
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowRetourModal(false)}>Annuler</Button>
              <Button onClick={handleSave} isLoading={isSaving}>Enregistrer</Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- Modal Saisie Avoir ---
  const [showAvoirModal, setShowAvoirModal] = useState(false);
  const [facturePourAvoir, setFacturePourAvoir] = useState<Facture | null>(null);

  const SaisieAvoirModal = () => {
    const { ajouterAvoirClient, genererFacturesPourClient, chargerFactures } = useFacturationStore();

    const [montantAvoir, setMontantAvoir] = useState<string>('');
    const [mode, setMode] = useState<'add' | 'remove'>('add'); // 'add' ou 'remove'
    const [isSaving, setIsSaving] = useState(false);

    if (!showAvoirModal || !facturePourAvoir) return null;

    const soldeUtilise = facturePourAvoir.soldeUtilise || 0;

    const handleSaveAvoir = async () => {
      const montant = parseFloat(montantAvoir);
      if (isNaN(montant) || montant <= 0) {
        toast.error('Montant invalide');
        return;
      }

      setIsSaving(true);
      try {
        // Si mode 'remove', on soustrait (envoyer un montant négatif)
        const montantFinal = mode === 'add' ? montant : -montant;

        // 1. Mise à jour du solde client
        await ajouterAvoirClient(facturePourAvoir.clientId, montantFinal);
        const message = mode === 'add' ? 'Avoir ajouté' : 'Avoir retiré/corrigé';
        toast.success(message);

        // 2. Régénération pour mise à jour facture
        await genererFacturesPourClient(facturePourAvoir.clientId);

        // 3. Recharger les factures pour l'affichage
        await chargerFactures(undefined, undefined, true);

        toast.success('Facture mise à jour');
        setShowAvoirModal(false);
        setMontantAvoir('');
        setMode('add');
      } catch (e) {
        console.error(e);
        toast.error('Erreur lors de la mise à jour de l\'avoir');
      } finally {
        setIsSaving(false);
      }
    };

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <h3 className="font-bold text-gray-800">Gestion de l'Avoir</h3>
            <button onClick={() => setShowAvoirModal(false)} className="text-gray-400 hover:text-gray-600">
              <Icon icon="mdi:close" className="text-xl" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div className="bg-gray-50 p-3 rounded-lg flex justify-between items-center">
              <span className="text-sm text-gray-600">Déjà utilisé sur cette facture :</span>
              <span className="font-bold text-gray-900">{formatCurrency(soldeUtilise)}</span>
            </div>

            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setMode('add')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'add'
                  ? 'bg-white text-green-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                Ajouter
              </button>
              <button
                onClick={() => setMode('remove')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'remove'
                  ? 'bg-white text-red-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                Retirer / Corriger
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {mode === 'add' ? 'Montant à ajouter (FCFA)' : 'Montant à retirer (FCFA)'}
              </label>
              <Input
                type="number"
                value={montantAvoir}
                onChange={(e) => setMontantAvoir(e.target.value)}
                placeholder="Ex: 5000"
                className={mode === 'remove' ? 'text-red-600' : 'text-green-600'}
                autoFocus
              />
              <p className="text-xs text-gray-400 mt-1">
                {mode === 'add'
                  ? "Ce montant sera ajouté au solde du client et déduit de la facture."
                  : "Ce montant sera retiré du solde du client (correction d'erreur)."}
              </p>
            </div>
          </div>

          <div className="p-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50">
            <Button variant="outline" onClick={() => setShowAvoirModal(false)}>Annuler</Button>
            <Button
              onClick={handleSaveAvoir}
              isLoading={isSaving}
              className={mode === 'remove' ? '!bg-red-600 hover:!bg-red-700' : ''}
            >
              {mode === 'add' ? 'Ajouter' : 'Retirer'}
            </Button>
          </div>
        </div>
      </div>
    );
  };


  return (
    <div className="min-h-screen bg-gray-50/50 p-6">
      {/* En-tête Global */}
      <header className="bg-white shadow-sm sticky top-0 z-10 flex items-center justify-between p-4 mb-6 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="bg-orange-100 p-2 rounded-lg">
            <Icon icon="mdi:invoice-text-multiple" className="text-2xl text-orange-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Facturation</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto">
        {viewMode === 'clients_list' && renderClientsList()}
        {viewMode === 'client_details' && renderClientDetails()}

      </main>

      {/* Modals & Loaders */}
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
        onClose={() => { setShowFactureDetails(false); setFactureActive(null); }}
      />
      <PaymentModal
        facture={factureAPayer}
        isOpen={showPaymentModal}
        onClose={() => { setShowPaymentModal(false); setFactureAPayer(null); }}
        onConfirm={async (amount) => {
          if (factureAPayer) {
            await marquerPayee(factureAPayer.id, amount);
            toast.success(`💰 Réglée`);
          }
        }}
      />
      <CalculateurRistourneModal
        isOpen={showRistourneModal}
        onClose={() => setShowRistourneModal(false)}
      />

      <SaisieRetourModal />
      <SaisieAvoirModal />

      {isLoading && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
          <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-4" />
          <p className="font-medium text-purple-900">Traitement en cours...</p>
        </div>
      )}
    </div>
  );
};

