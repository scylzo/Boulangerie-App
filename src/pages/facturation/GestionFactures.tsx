import React, { useEffect, useState, useMemo } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { FactureDetailsModal } from '../../components/factures/FactureDetailsModal';
import { PaymentModal } from '../../components/factures/PaymentModal';
import { CalculateurRistourneModal } from '../../components/factures/CalculateurRistourneModal';
import { ReleveFacturesModal } from '../../components/factures/ReleveFacturesModal';
import { useFacturationStore } from '../../store/facturationStore';

import { useLivraisonStore } from '../../store/livraisonStore';
import { useReferentielStore } from '../../store/referentielStore';
import { useConfirmModal } from '../../hooks/useConfirmModal';
import { formatCurrency } from '../../utils/currency';
import { downloadFacturePDF } from '../../utils/pdfGenerator';
import type { Facture, Client } from '../../types';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

import omLogo from '../../assets/om.svg';
import waveLogo from '../../assets/wave.svg';

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
  const [showReleveModal, setShowReleveModal] = useState(false);
  const [releveType, setReleveType] = useState<'impayes' | 'payees'>('impayes');
  const [factureAPayer, setFactureAPayer] = useState<Facture | null>(null);

  // --- Global Daily Total Logic ---
  const [globalDate, setGlobalDate] = useState(new Date());

  const globalDailyStats = useMemo(() => {
    // 1. Filter by date
    const start = new Date(globalDate); start.setHours(0, 0, 0, 0);
    const end = new Date(globalDate); end.setHours(23, 59, 59, 999);

    const invoicesOfDay = factures.filter(f => {
      if (f.statut === 'annulee') return false;
      const d = new Date(f.dateLivraison);
      return d >= start && d <= end;
    });

    // 2. Deduplication (Best invoice per client) - consistent with Accounting logic
    const uniqueInvoicesMap = new Map<string, Facture>();
    invoicesOfDay.forEach(f => {
      const key = f.clientId; // Since we filter by single day, clientID is enough uniqueness
      if (!uniqueInvoicesMap.has(key)) {
        uniqueInvoicesMap.set(key, f);
      } else {
        const existing = uniqueInvoicesMap.get(key)!;
        // Priorité : Payée > Envoyée > Validée > En attente > Brouillon
        const getScore = (statut: string) => {
          switch (statut) {
            case 'payee': return 5;
            case 'envoyee': return 4;
            case 'validee': return 3;
            case 'en_attente_retours': return 2;
            default: return 1;
          }
        };
        const scoreNew = getScore(f.statut);
        const scoreExist = getScore(existing.statut);

        if (scoreNew > scoreExist) {
          uniqueInvoicesMap.set(key, f);
        } else if (scoreNew === scoreExist) {
          if (new Date(f.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
            uniqueInvoicesMap.set(key, f);
          }
        }
      }
    });

    const finalInvoices = Array.from(uniqueInvoicesMap.values());
    const totalTTC = finalInvoices.reduce((sum, f) => sum + f.totalTTC, 0);
    const count = finalInvoices.length;

    return { totalTTC, count };
  }, [factures, globalDate]);


  // Initialisation
  useEffect(() => {
    const initialiser = async () => {
      try {
        await chargerParametres();
        const start = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
        const end = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0, 23, 59, 59, 999);
        await chargerFactures(start, end);
        await chargerClients(); // Charger les clients
      } catch (error) {
        console.error('Erreur lors de l\'initialisation:', error);
      }
    };
    initialiser();
  }, [chargerParametres, chargerFactures, chargerClients, selectedMonth]);

  // Synchronisation auto - Uniquement sur le mois sélectionné
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const start = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
        const end = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0, 23, 59, 59, 999);
        
        await actualiserStatutsFactures(); // On check globalement (on peut restreindre aussi si besoin)
        await chargerFactures(start, end, true);
      } catch (error) {
        console.error('Erreur synchro auto:', error);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [actualiserStatutsFactures, chargerFactures, selectedMonth]);

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
      case 'brouillon': return 'text-sand-600 bg-sand-100';
      case 'en_attente_retours': return 'text-warning-600 bg-warning-100';
      case 'validee': return 'text-info-600 bg-info-100';
      case 'envoyee': return 'text-terracotta-700 bg-terracotta-100';
      case 'payee': return 'text-success-700 bg-success-100';
      case 'partiellement_payee': return 'text-warning-600 bg-warning-100 border-warning-100';
      case 'annulee': return 'text-danger-700 bg-danger-100';
      default: return 'text-sand-600 bg-sand-100';
    }
  };

  const getStatutLibelle = (statut: string) => {
    switch (statut) {
      case 'brouillon': return 'Brouillon';
      case 'en_attente_retours': return 'Attente Retours';
      case 'validee': return 'Validée';
      case 'envoyee': return 'Envoyée';
      case 'payee': return 'Payée';
      case 'partiellement_payee': return 'Partiellement Payée';
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
    <div className="space-y-4 sm:space-y-6">
      {/* Global Daily Stats Card */}
      <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-sand-200">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-base sm:text-lg font-semibold text-sand-900 mb-1 truncate">Chiffre d'Affaires Facturé</h2>
            <p className="text-xs sm:text-sm text-sand-500 truncate">
              <span className="hidden sm:inline">Total global de tous les clients pour la journée sélectionnée</span>
              <span className="sm:hidden">Total journalier tous clients</span>
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 bg-sand-50 p-2 rounded-lg border border-sand-200 w-full sm:w-auto">
            <button
              onClick={() => {
                const d = new Date(globalDate); d.setDate(d.getDate() - 1); setGlobalDate(d);
              }}
              className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-sand-600"
            >
              <Icon icon="mdi:chevron-left" className="text-lg sm:text-xl" />
            </button>

            <div className="flex flex-col items-center min-w-[120px] sm:min-w-[140px] flex-1 sm:flex-none">
              <span className="font-semibold text-sand-900 text-sm sm:text-base capitalize truncate w-full text-center">{globalDate.toLocaleDateString('fr-FR', { weekday: 'long' })}</span>
              <span className="text-xs sm:text-sm text-sand-500 truncate w-full text-center">{globalDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>

            <button
              onClick={() => {
                const d = new Date(globalDate); d.setDate(d.getDate() + 1); setGlobalDate(d);
              }}
              className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-sand-600"
            >
              <Icon icon="mdi:chevron-right" className="text-lg sm:text-xl" />
            </button>
          </div>

          <div className="text-left sm:text-right pl-0 sm:pl-6 border-l-0 sm:border-l border-sand-100 w-full sm:w-auto sm:min-w-[180px]">
            <p className="text-[10px] sm:text-xs text-sand-500 font-semibold uppercase tracking-wider mb-1">Total Journalier</p>
            <p className="font-display text-xl sm:text-2xl font-semibold text-sand-900">{formatCurrency(globalDailyStats.totalTTC)}</p>
            <p className="text-xs text-sand-400">{globalDailyStats.count} facture(s)</p>
          </div>
        </div>
      </div>

      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 sm:gap-4 bg-white p-4 rounded-xl shadow-sm border border-sand-200">
        <div className="relative w-full sm:w-96">
          <Icon icon="mdi:search" className="absolute left-3 top-1/2 -translate-y-1/2 text-sand-400 text-lg sm:text-xl" />
          <input
            type="text"
            placeholder="Rechercher un client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 sm:pl-10 pr-4 py-2 border border-sand-300 rounded-lg focus:ring-2 focus:ring-terracotta-500 focus:border-transparent outline-none text-sm sm:text-base"
          />
        </div>
        <Button
          onClick={() => setShowRistourneModal(true)}
          variant="outline"
          className="flex items-center justify-center gap-2 text-sand-700 hover:bg-sand-50 border-sand-300 w-full sm:w-auto"
        >
          <Icon icon="mdi:calculator" className="text-lg sm:text-xl" />
          <span className="text-sm sm:text-base">Ristournes</span>
        </Button>
      </div>

      {/* Grid of Clients */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
        {filteredClients.map(client => {
          return (
            <div
              key={client.id}
              className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-sand-200 hover:shadow-elevated hover:border-sand-300 transition-all group relative overflow-hidden"
            >
              <div
                onClick={() => handleSelectClient(client)}
                className="cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3 sm:mb-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-sand-100 text-sand-900 rounded-full flex items-center justify-center font-semibold text-base sm:text-xl group-hover:bg-sand-900 group-hover:text-white transition-colors shrink-0">
                    {client.nom.charAt(0).toUpperCase()}
                  </div>
                  <Icon icon="mdi:chevron-right" className="text-sand-300 group-hover:text-sand-900 text-xl sm:text-2xl" />
                </div>
                <h3 className="font-semibold text-sand-900 text-base sm:text-lg mb-1 truncate" title={client.nom}>{client.nom}</h3>
                <p className="text-xs sm:text-sm text-sand-500 flex items-center gap-2 mb-3 sm:mb-4 truncate">
                  <Icon icon="mdi:phone" className="text-sand-400 shrink-0" />
                  <span className="truncate">{client.telephone || 'Non renseigné'}</span>
                </p>
                {client.modePaiementPreference && (
                  <div className={`mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${client.modePaiementPreference === 'espece' ? 'bg-success-100 text-success-700' :
                    client.modePaiementPreference === 'om' ? 'bg-warning-100 text-warning-600' :
                      client.modePaiementPreference === 'wave' ? 'bg-info-100 text-info-600' :
                        client.modePaiementPreference === 'cheque' ? 'bg-sand-100 text-sand-800' :
                          'bg-terracotta-100 text-terracotta-700'
                    }`}>
                    {(client.modePaiementPreference === 'om' || client.modePaiementPreference === 'wave') ? (
                      <img
                        src={client.modePaiementPreference === 'om' ? omLogo : waveLogo}
                        alt={client.modePaiementPreference}
                        className="w-4 h-4 object-contain"
                      />
                    ) : (
                      <Icon icon={
                        client.modePaiementPreference === 'espece' ? 'mdi:cash' :
                          client.modePaiementPreference === 'cheque' ? 'mdi:checkbook' :
                            'mdi:bank-transfer'
                      } />
                    )}
                    <span>{
                      client.modePaiementPreference === 'espece' ? 'Espèces' :
                        client.modePaiementPreference === 'om' ? 'Orange Money' :
                          client.modePaiementPreference === 'wave' ? 'Wave' :
                            client.modePaiementPreference === 'cheque' ? 'Chèque' :
                              'Virement'
                    }</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredClients.length === 0 && (
        <div className="text-center py-12 sm:py-20 text-sand-500">
          <Icon icon="mdi:account-off" className="text-5xl sm:text-6xl mx-auto mb-4 text-sand-300" />
          <p className="text-sm sm:text-base">Aucun client trouvé pour "{searchTerm}"</p>
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
    <div className="space-y-4 sm:space-y-6 animate-in slide-in-from-right duration-300">
      {/* Header Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <button
          onClick={handleBackToClients}
          className="flex items-center gap-2 text-sand-600 hover:text-sand-900 transition-colors font-medium text-sm sm:text-base"
        >
          <Icon icon="mdi:arrow-left" className="text-lg sm:text-xl" />
          <span>Retour aux clients</span>
        </button>

        <div className="flex items-center gap-2 sm:gap-4 bg-white p-2 rounded-lg shadow-sm border border-sand-200 w-full sm:w-auto">
          <button onClick={() => handleChangeMonth(-1)} className="p-2 hover:bg-sand-100 rounded-lg">
            <Icon icon="mdi:chevron-left" className="text-lg sm:text-xl" />
          </button>
          <span className="font-semibold text-sand-900 min-w-[120px] sm:min-w-32 text-center capitalize text-sm sm:text-base truncate">
            {selectedMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
          </span>
          <button onClick={() => handleChangeMonth(1)} className="p-2 hover:bg-sand-100 rounded-lg">
            <Icon icon="mdi:chevron-right" className="text-lg sm:text-xl" />
          </button>
        </div>
      </div>

      {/* Client Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-card border border-sand-200">
          <h4 className="text-sand-500 text-xs sm:text-sm font-medium mb-1 truncate">Montant Total</h4>
          <p className="font-display text-lg sm:text-2xl font-semibold text-sand-900 truncate">{formatCurrency(clientStats.montantTotal)}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-card border border-sand-200">
          <h4 className="text-sand-500 text-xs sm:text-sm font-medium mb-1 truncate">Reste à payer</h4>
          <p className={`font-display text-lg sm:text-2xl font-semibold truncate ${clientStats.montantImpaye > 0 ? 'text-danger-600' : 'text-success-600'}`}>
            {formatCurrency(clientStats.montantImpaye)}
          </p>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-card border border-sand-200">
          <h4 className="text-sand-500 text-xs sm:text-sm font-medium mb-1 truncate">Produits Livrés</h4>
          <p className="font-display text-lg sm:text-2xl font-semibold text-info-600 truncate">{clientStats.totalLivres}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-card border border-sand-200">
          <h4 className="text-sand-500 text-xs sm:text-sm font-medium mb-1 truncate">Invendus</h4>
          <p className="font-display text-lg sm:text-2xl font-semibold text-warning-600 truncate">{clientStats.totalInvendus}</p>
        </div>
      </div>

      {/* Filters & Content */}
      <div className="bg-white rounded-xl shadow-sm border border-sand-200 overflow-hidden">
        <div className="border-b border-sand-200 px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 sm:gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 min-w-0 flex-1">
              <div className="min-w-0 flex-1">
                <h2 className="text-base sm:text-lg font-semibold text-sand-900 flex items-center gap-2 mb-1 truncate">
                  <Icon icon="mdi:account-details" className="text-sand-900 shrink-0" />
                  <span className="truncate">{selectedClient?.nom}</span>
                </h2>
                <p className="text-xs sm:text-sm text-sand-500 truncate">Historique des commandes et règlements</p>
              </div>

              {/* Somme sélectionnée */}
              {selectedInvoiceIds.length > 0 && (
                <div className="bg-sand-100 border border-sand-200 px-3 sm:px-4 py-2 rounded-lg flex items-center gap-2 sm:gap-3 animate-in fade-in zoom-in duration-200 w-full sm:w-auto">
                  <span className="text-sand-700 font-medium text-xs sm:text-sm truncate">{selectedInvoiceIds.length} sélectionnée(s)</span>
                  <div className="h-4 w-px bg-sand-300"></div>
                  <span className="text-sand-900 font-semibold text-sm sm:text-base truncate">Total: {formatCurrency(totalSelectedAmount)}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full lg:w-auto">
              <Button
                onClick={() => selectedClient && handleGenererFacturesClient(selectedClient.id)}
                isLoading={selectedClient ? generatingClientId === selectedClient.id : false}
                className="bg-sand-900 text-white hover:bg-sand-800 h-9 text-xs sm:text-sm w-full sm:w-auto"
                size="sm"
              >
                <Icon icon="mdi:refresh-auto" className="text-base sm:text-lg mr-2" />
                <span className="truncate">Générer Factures</span>
              </Button>

              <Button
                onClick={() => {
                  setReleveType('impayes');
                  setShowReleveModal(true);
                }}
                variant="outline"
                className="border-sand-300 text-danger-700 hover:bg-danger-50 h-9 text-xs sm:text-sm w-full sm:w-auto"
                size="sm"
              >
                <Icon icon="mdi:printer-eye" className="text-base sm:text-lg mr-2" />
                <span className="truncate">Relevé Impayés</span>
              </Button>

              <Button
                onClick={() => {
                  setReleveType('payees');
                  setShowReleveModal(true);
                }}
                variant="outline"
                className="border-success-100 text-success-700 hover:bg-success-50 h-9 text-xs sm:text-sm w-full sm:w-auto"
                size="sm"
              >
                <Icon icon="mdi:printer-check" className="text-base sm:text-lg mr-2" />
                <span className="truncate">Relevé Payés</span>
              </Button>

              <div className="flex bg-sand-100 p-1 rounded-lg w-full sm:w-auto">
                <button
                  onClick={() => setFiltreStatut('tous')}
                  className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${filtreStatut === 'tous' ? 'bg-white text-sand-900 shadow-sm' : 'text-sand-500 hover:text-sand-900'}`}
                >
                  Tout
                </button>
                <button
                  onClick={() => setFiltreStatut('payee')}
                  className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${filtreStatut === 'payee' ? 'bg-white text-success-700 shadow-sm' : 'text-sand-500 hover:text-sand-900'}`}
                >
                  Payé
                </button>
                <button
                  onClick={() => setFiltreStatut('impayee')}
                  className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${filtreStatut === 'impayee' ? 'bg-white text-danger-700 shadow-sm' : 'text-sand-500 hover:text-sand-900'}`}
                >
                  Impayé
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-sand-50 text-sand-500 text-xs uppercase font-medium">
              <tr>
                <th className="px-6 py-3 w-4">
                  <input
                    type="checkbox"
                    className="rounded border-sand-300 text-terracotta-600 focus:ring-terracotta-500"
                    checked={clientInvoices.length > 0 && selectedInvoiceIds.length === clientInvoices.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-6 py-3 text-center w-16">Jour</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">N° Facture</th>
                <th className="px-6 py-3 text-center">Livrés</th>
                <th className="px-6 py-3 text-center">Retours</th>
                <th className="px-6 py-3 text-right">Montant</th>
                <th className="px-6 py-3 center">Statut</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {(() => {
                const daysInMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0).getDate();
                const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

                return daysArray.map((day) => {
                  const dateOfDay = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), day);
                  // Highlight week-ends differently if needed, here just weekends slightly obscure
                  const isWeekend = dateOfDay.getDay() === 0 || dateOfDay.getDay() === 6;

                  const invoice = clientInvoices.find(f => new Date(f.dateLivraison).getDate() === day);

                  if (!invoice) {
                    return (
                      <tr key={`day-${day}`} className={`border-b border-sand-100 ${isWeekend ? 'bg-sand-50/80' : 'bg-sand-50'}`}>
                        <td className="px-6 py-4"></td>
                        <td className="px-6 py-4 text-center font-semibold text-sand-300">{day}</td>
                        <td className="px-6 py-4 text-sm text-sand-400">
                          {dateOfDay.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </td>
                        <td colSpan={6} className="px-6 py-4">
                          <div className="flex items-center gap-2 text-sand-400 font-medium bg-sand-100/50 w-fit px-3 py-1 rounded-full text-xs">
                            <Icon icon="mdi:minus-circle-outline" className="text-base" />
                            <span>Aucune commande ce jour</span>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  const totalLivree = invoice.lignes.reduce((sum, l) => sum + l.quantiteLivree, 0);
                  const totalRetournee = invoice.lignes.reduce((sum, l) => sum + l.quantiteRetournee, 0);

                  return (
                    <tr key={invoice.id} className={`hover:bg-sand-50 group border-b border-sand-100 ${selectedInvoiceIds.includes(invoice.id) ? 'bg-terracotta-50 hover:bg-terracotta-50' : ''}`}>
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          className="rounded border-sand-300 text-terracotta-600 focus:ring-terracotta-500 cursor-pointer"
                          checked={selectedInvoiceIds.includes(invoice.id)}
                          onChange={() => toggleSelectInvoice(invoice.id)}
                        />
                      </td>
                      <td className="px-6 py-4 text-center font-semibold text-sand-700">{day}</td>
                      <td className="px-6 py-4 text-sm font-medium text-sand-900">
                        {new Date(invoice.dateLivraison).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-6 py-4 text-sm text-sand-500">
                        {invoice.numeroFacture}
                      </td>
                      <td className="px-6 py-4 text-center text-sm">
                        <span className="bg-info-50 text-info-600 px-2 py-1 rounded-md font-medium text-xs">
                          {totalLivree}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-sm">
                        {totalRetournee > 0 ? (
                          <span className="bg-warning-50 text-warning-600 px-2 py-1 rounded-md font-medium text-xs">
                            {totalRetournee}
                          </span>
                        ) : (
                          <span className="text-sand-300">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-semibold text-sand-900">
                        {formatCurrency(invoice.totalTTC)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold block w-fit ${getStatutColor(invoice.statut)}`}>
                          {getStatutLibelle(invoice.statut)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => handleActionFacture('voir', invoice)} className="p-2 hover:bg-sand-200 rounded text-sand-600" title="Détails">
                            <Icon icon="mdi:eye" />
                          </button>
                          <button onClick={() => handleActionFacture('pdf', invoice)} className="p-2 hover:bg-sand-200 rounded text-sand-600" title="PDF">
                            <Icon icon="mdi:file-pdf-box" />
                          </button>
                          {invoice.statut !== 'payee' && invoice.statut !== 'annulee' && (
                            <button onClick={() => handleActionFacture('payer', invoice)} className="p-2 hover:bg-success-100 rounded text-success-600" title="Payer">
                              <Icon icon="mdi:cash-check" />
                            </button>
                          )}
                          <button
                            onClick={async () => {
                              const { chargerInvendusDuJour } = useLivraisonStore.getState();
                              // Charger les retours de la date spécifiée avant d'ouvrir
                              await chargerInvendusDuJour(new Date(invoice.dateLivraison));
                              setFacturePourRetour(invoice);
                              setShowRetourModal(true);
                            }}
                            className="p-2 hover:bg-warning-100 rounded text-warning-600"
                            title="Saisir retour"
                          >
                            <Icon icon="mdi:package-variant-minus" />
                          </button>
                          <button
                            onClick={() => {
                              setFacturePourAvoir(invoice);
                              setShowAvoirModal(true);
                            }}
                            className="p-2 hover:bg-info-100 rounded text-info-600"
                            title="Ajouter un avoir/crédit"
                          >
                            <Icon icon="mdi:wallet-plus" />
                          </button>
                          <button
                            onClick={() => handleActionFacture('supprimer', invoice)}
                            className="p-2 hover:bg-danger-100 rounded text-danger-600"
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
    const { sauvegarderRetoursClient, marquerAucunRetourClient, invendusClients } = useLivraisonStore();
    const [valeursRetours, setValeursRetours] = useState<Record<string, number>>({});
    const [savingStatus, setSavingStatus] = useState<'idle' | 'saving_retours' | 'saving_aucun'>('idle');

    useEffect(() => {
      if (facturePourRetour) {
        // Chercher si on a des retours enregistrés dans le module Livraison pour ce client et cette date
        const dateLivraisonStr = new Date(facturePourRetour.dateLivraison).toDateString();
        const retourExistant = invendusClients.find(inv =>
          inv.clientId === facturePourRetour.clientId &&
          new Date(inv.dateLivraison).toDateString() === dateLivraisonStr
        );

        const initial: Record<string, number> = {};
        facturePourRetour.lignes.forEach(l => {
          // Priorité : 1. Valeur dans invendusClients, 2. Valeur dans la facture, 3. Zéro
          const invendusStockes = retourExistant?.produits.find(p => p.produitId === l.produitId)?.invendus;
          initial[l.produitId] = invendusStockes !== undefined ? invendusStockes : (l.quantiteRetournee || 0);
        });
        setValeursRetours(initial);
      }
    }, [facturePourRetour, invendusClients]);

    if (!showRetourModal || !facturePourRetour) return null;

    const handleSave = async () => {
      if (savingStatus !== 'idle') return;

      setSavingStatus('saving_retours');
      try {
        const produitsPourRetour = facturePourRetour.lignes.map(l => {
          const invendus = valeursRetours[l.produitId] ?? l.quantiteRetournee ?? 0;
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

        await actualiserStatutsFactures(facturePourRetour.clientId, new Date(facturePourRetour.dateLivraison));
        
        const start = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
        const end = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0, 23, 59, 59, 999);
        await chargerFactures(start, end, true);

        toast.success('Retours enregistrés');
        setShowRetourModal(false);
      } catch (e) {
        console.error('Erreur sauvegarde:', e);
        toast.error('Erreur lors de l\'enregistrement');
      } finally {
        setSavingStatus('idle');
      }
    };

    const handleAucunRetour = async () => {
      if (savingStatus !== 'idle') return;

      setSavingStatus('saving_aucun');
      const loadingToast = toast.loading('Validation...');
      try {
        await marquerAucunRetourClient(
          facturePourRetour.clientId,
          new Date(facturePourRetour.dateLivraison)
        );

        await actualiserStatutsFactures(facturePourRetour.clientId, new Date(facturePourRetour.dateLivraison));

        const start = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
        const end = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0, 23, 59, 59, 999);
        await chargerFactures(start, end, true);

        toast.success('Validé : Aucun retour', { id: loadingToast });
        setShowRetourModal(false);
      } catch (e) {
        console.error('Erreur validation:', e);
        toast.error('Erreur lors de la validation', { id: loadingToast });
      } finally {
        setSavingStatus('idle');
      }
    };

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-elevated w-full max-w-lg overflow-hidden">
          <div className="p-4 border-b border-sand-100 flex justify-between items-center bg-sand-50">
            <h3 className="font-semibold text-sand-800">Saisie Retours - {facturePourRetour.client?.nom}</h3>
            <button onClick={() => setShowRetourModal(false)} className="text-sand-400 hover:text-sand-600">
              <Icon icon="mdi:close" className="text-xl" />
            </button>
          </div>
          <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
            <p className="text-sm text-sand-500 mb-4">Date : {new Date(facturePourRetour.dateLivraison).toLocaleDateString('fr-FR')}</p>
            {facturePourRetour.lignes.map(ligne => (
              <div key={ligne.produitId} className="flex items-center justify-between p-3 bg-sand-50 rounded-lg">
                <div>
                  <p className="font-medium text-sand-900">{ligne.produit?.nom || 'Produit'}</p>
                  <p className="text-xs text-sand-500">Livré : {ligne.quantiteLivree}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-sand-500 uppercase font-semibold">Retour :</span>
                  <input
                    type="number"
                    min="0"
                    max={ligne.quantiteLivree}
                    value={(() => {
                      const val = valeursRetours[ligne.produitId] ?? ligne.quantiteRetournee ?? 0;
                      return val === 0 ? '' : val;
                    })()}
                    onChange={e => setValeursRetours({ ...valeursRetours, [ligne.produitId]: parseInt(e.target.value) || 0 })}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                    className="w-20 p-2 border rounded text-center font-semibold text-warning-600 focus:ring-2 focus:ring-terracotta-500 outline-none"
                    placeholder="0"
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-sand-100 flex justify-between gap-2 bg-sand-50">
            <Button
              type="button"
              variant="secondary"
              onClick={handleAucunRetour}
              className="bg-info-50 text-info-600 hover:bg-info-100 border-info-100"
              isLoading={savingStatus === 'saving_aucun'}
              disabled={savingStatus !== 'idle'}
            >
              Valider sans retours
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setShowRetourModal(false)} disabled={savingStatus !== 'idle'}>Annuler</Button>
              <Button type="button" onClick={handleSave} isLoading={savingStatus === 'saving_retours'} disabled={savingStatus !== 'idle'}>Enregistrer</Button>
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
        const start = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
        const end = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0, 23, 59, 59, 999);
        await chargerFactures(start, end, true);

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
        <div className="bg-white rounded-xl shadow-elevated w-full max-w-sm overflow-hidden">
          <div className="p-4 border-b border-sand-100 flex justify-between items-center bg-sand-50">
            <h3 className="font-semibold text-sand-800">Gestion de l'Avoir</h3>
            <button onClick={() => setShowAvoirModal(false)} className="text-sand-400 hover:text-sand-600">
              <Icon icon="mdi:close" className="text-xl" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div className="bg-sand-50 p-3 rounded-lg flex justify-between items-center">
              <span className="text-sm text-sand-600">Déjà utilisé sur cette facture :</span>
              <span className="font-semibold text-sand-900">{formatCurrency(soldeUtilise)}</span>
            </div>

            <div className="flex bg-sand-100 p-1 rounded-lg">
              <button
                onClick={() => setMode('add')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'add'
                  ? 'bg-white text-success-600 shadow-sm'
                  : 'text-sand-500 hover:text-sand-700'
                  }`}
              >
                Ajouter
              </button>
              <button
                onClick={() => setMode('remove')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'remove'
                  ? 'bg-white text-danger-600 shadow-sm'
                  : 'text-sand-500 hover:text-sand-700'
                  }`}
              >
                Retirer / Corriger
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-sand-700 mb-1">
                {mode === 'add' ? 'Montant à ajouter (FCFA)' : 'Montant à retirer (FCFA)'}
              </label>
              <Input
                type="number"
                value={montantAvoir}
                onChange={(e) => setMontantAvoir(e.target.value)}
                placeholder="Ex: 5000"
                className={mode === 'remove' ? 'text-danger-600' : 'text-success-600'}
                autoFocus
              />
              <p className="text-xs text-sand-400 mt-1">
                {mode === 'add'
                  ? "Ce montant sera ajouté au solde du client et déduit de la facture."
                  : "Ce montant sera retiré du solde du client (correction d'erreur)."}
              </p>
            </div>
          </div>

          <div className="p-4 border-t border-sand-100 flex justify-end gap-2 bg-sand-50">
            <Button variant="outline" onClick={() => setShowAvoirModal(false)}>Annuler</Button>
            <Button
              onClick={handleSaveAvoir}
              isLoading={isSaving}
              className={mode === 'remove' ? '!bg-danger-500 hover:!bg-danger-600' : ''}
            >
              {mode === 'add' ? 'Ajouter' : 'Retirer'}
            </Button>
          </div>
        </div>
      </div>
    );
  };


  return (
    <div className="min-h-screen bg-sand-100 overflow-x-hidden">
      {/* Header */}
      <div className="bg-white border-b border-sand-200 px-4 sm:px-6 py-3 sm:py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="w-10 h-10 bg-terracotta-50 rounded-xl flex items-center justify-center shrink-0">
            <Icon icon="mdi:receipt-text-outline" className="text-xl text-terracotta-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-lg sm:text-2xl font-semibold text-sand-900 truncate">Facturation</h1>
            <p className="text-xs sm:text-sm text-sand-500 truncate">Génération, encaissements, retours & avoirs clients</p>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <main className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6">
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
        onConfirm={async (reglements) => {
          if (factureAPayer) {
            await marquerPayee(factureAPayer.id, reglements);
            const modes = Array.from(new Set(reglements.map(r => r.mode.toUpperCase()))).join(' + ');
            toast.success(`💰 Réglée (${modes})`);
          }
        }}
      />
      <CalculateurRistourneModal
        isOpen={showRistourneModal}
        onClose={() => setShowRistourneModal(false)}
      />

      <SaisieRetourModal />
      <SaisieAvoirModal />

      {selectedClient && (
        <ReleveFacturesModal
          isOpen={showReleveModal}
          onClose={() => setShowReleveModal(false)}
          client={selectedClient}
          factures={factures.filter(f => f.clientId === selectedClient.id)}
          type={releveType}
        />
      )}

      {isLoading && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
          <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-sand-200 border-t-sand-900 rounded-full animate-spin mb-4" />
          <p className="font-medium text-sand-900 text-sm sm:text-base">Traitement en cours...</p>
        </div>
      )}
    </div>
  );
};

