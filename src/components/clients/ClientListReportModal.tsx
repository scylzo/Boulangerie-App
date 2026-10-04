import React, { useState, useMemo } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import { Modal } from '../ui/Modal';
import type { Client, Livreur } from '../../types';
import {
  genererRapportClientsPDF,
  exporterClientsCSV,
  filtrerEtTrierClients,
  calculerStatsClients,
  type ClientReportFilters,
  type ClientReportStatsConfig,
  type ClientReportColumnsConfig,
} from '../../utils/clientReport';

interface ClientListReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  livreurs: Livreur[];
}

export const ClientListReportModal: React.FC<ClientListReportModalProps> = ({
  isOpen,
  onClose,
  clients,
  livreurs,
}) => {
  // Filtres
  const [filtres, setFiltres] = useState<ClientReportFilters>({
    kiosque: 'tous',
    typeClient: 'tous',
    statut: 'actif',
    livreurId: 'tous',
    tri: 'nom_asc',
  });

  // Statistiques à afficher
  const [statsConfig, setStatsConfig] = useState<ClientReportStatsConfig>({
    inclureStats: true,
    afficherTotal: true,
    afficherKiosque: true,
    afficherActifs: true,
    afficherTypes: true,
    afficherLivreurs: true,
  });

  // Colonnes du tableau
  const [colonnesConfig, setColonnesConfig] = useState<ClientReportColumnsConfig>({
    nom: true,
    typeClient: true,
    kiosque: true,
    telephone: true,
    adresse: true,
    livreur: true,
    modePaiement: true,
    statut: true,
    conditionsPaiement: false,
    coordonneesGps: false,
  });

  const [titreDoc, setTitreDoc] = useState('LISTE OFFICIELLE DES CLIENTS');
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Clients filtrés en direct
  const clientsFiltres = useMemo(() => {
    return filtrerEtTrierClients(clients, filtres);
  }, [clients, filtres]);

  // Statistiques en direct pour l'aperçu
  const liveStats = useMemo(() => {
    return calculerStatsClients(clientsFiltres, livreurs);
  }, [clientsFiltres, livreurs]);

  const handleToggleStat = (key: keyof Omit<ClientReportStatsConfig, 'inclureStats'>) => {
    setStatsConfig((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleToggleCol = (key: keyof ClientReportColumnsConfig) => {
    if (key === 'nom') return; // Toujours requis
    setColonnesConfig((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSelectAllCols = (val: boolean) => {
    setColonnesConfig({
      nom: true,
      typeClient: val,
      kiosque: val,
      telephone: val,
      adresse: val,
      livreur: val,
      modePaiement: val,
      statut: val,
      conditionsPaiement: val,
      coordonneesGps: val,
    });
  };

  const handleGenererPDF = async () => {
    if (clientsFiltres.length === 0) {
      toast.error('Aucun client ne correspond aux critères sélectionnés');
      return;
    }

    try {
      setGeneratingPdf(true);
      await genererRapportClientsPDF({
        titre: titreDoc,
        clients,
        livreurs,
        filtres,
        statsConfig,
        colonnesConfig,
      });
      toast.success('Fiche PDF des clients générée avec succès');
      onClose();
    } catch (err) {
      console.error('Erreur génération PDF clients:', err);
      toast.error('Impossible de générer le document PDF');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleExportCSV = () => {
    if (clientsFiltres.length === 0) {
      toast.error('Aucun client ne correspond aux critères sélectionnés');
      return;
    }

    try {
      exporterClientsCSV({
        titre: titreDoc,
        clients,
        livreurs,
        filtres,
        statsConfig,
        colonnesConfig,
      });
      toast.success('Export CSV généré avec succès');
      onClose();
    } catch (err) {
      console.error('Erreur export CSV clients:', err);
      toast.error("Impossible d'exporter le fichier CSV");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Générer la liste personnalisée des clients"
      position="center"
      size="xl"
    >
      <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-1">
        {/* Bandeau d'aperçu dynamique du résultat */}
        <div className="bg-sand-50 border border-sand-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-terracotta-500 text-white flex items-center justify-center text-xl shrink-0 shadow-sm">
              <Icon icon="mdi:account-group" />
            </div>
            <div>
              <div className="text-sm font-semibold text-sand-900">
                {clientsFiltres.length} client(s) sélectionné(s){' '}
                <span className="text-sand-500 font-normal text-xs">sur un total de {clients.length}</span>
              </div>
              <div className="text-xs text-sand-500 flex flex-wrap items-center gap-2 mt-0.5">
                <span className="inline-flex items-center gap-1 font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                  <Icon icon="mdi:store" className="text-xs" /> {liveStats.avecKiosque} avec kiosque ({liveStats.pctKiosque.toFixed(0)}%)
                </span>
                <span className="inline-flex items-center gap-1 font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  <Icon icon="mdi:check-circle" className="text-xs" /> {liveStats.actifs} actif(s)
                </span>
                <span className="text-sand-400">·</span>
                <span>{liveStats.typeClients} particulier(s) / {liveStats.typeBoutiques} boutique(s)</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-sand-500 hidden sm:inline">Format paysage (A4)</span>
          </div>
        </div>

        {/* Section 1 : Titre personnalisé */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-sand-700 mb-1.5">
            Titre de la fiche / du document
          </label>
          <input
            type="text"
            value={titreDoc}
            onChange={(e) => setTitreDoc(e.target.value)}
            placeholder="Ex : LISTE OFFICIELLE DES CLIENTS"
            className="w-full h-9 px-3 border border-sand-300 rounded-lg text-sm text-sand-900 focus:ring-2 focus:ring-terracotta-500 focus:border-transparent bg-white shadow-sm"
          />
        </div>

        {/* Section 2 : Critères de filtrage cliquables */}
        <div className="bg-white border border-sand-200 rounded-xl p-4 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-sand-100 pb-2.5">
            <Icon icon="mdi:filter-variant" className="text-terracotta-600 text-lg" />
            <h3 className="text-sm font-semibold text-sand-900">1. Quels clients inclure dans la liste ?</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Filtre Kiosque */}
            <div>
              <label className="block text-xs font-medium text-sand-600 mb-1.5">
                Kiosque <span className="text-terracotta-600 font-semibold">*</span>
              </label>
              <div className="grid grid-cols-3 gap-1 bg-sand-100 p-1 rounded-lg">
                {(
                  [
                    { key: 'tous', label: 'Tous' },
                    { key: 'avec_kiosque', label: 'Avec' },
                    { key: 'sans_kiosque', label: 'Sans' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setFiltres((f) => ({ ...f, kiosque: opt.key }))}
                    className={`py-1 text-xs font-medium rounded-md transition-all text-center ${
                      filtres.kiosque === opt.key
                        ? 'bg-white text-terracotta-600 shadow-sm font-semibold'
                        : 'text-sand-600 hover:text-sand-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Filtre Type de client */}
            <div>
              <label className="block text-xs font-medium text-sand-600 mb-1.5">Type de client</label>
              <div className="grid grid-cols-3 gap-1 bg-sand-100 p-1 rounded-lg">
                {(
                  [
                    { key: 'tous', label: 'Tous' },
                    { key: 'client', label: 'Clients' },
                    { key: 'boutique', label: 'Boutiques' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setFiltres((f) => ({ ...f, typeClient: opt.key }))}
                    className={`py-1 text-xs font-medium rounded-md transition-all text-center ${
                      filtres.typeClient === opt.key
                        ? 'bg-white text-terracotta-600 shadow-sm font-semibold'
                        : 'text-sand-600 hover:text-sand-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Filtre Statut */}
            <div>
              <label className="block text-xs font-medium text-sand-600 mb-1.5">Statut d'activité</label>
              <div className="grid grid-cols-3 gap-1 bg-sand-100 p-1 rounded-lg">
                {(
                  [
                    { key: 'tous', label: 'Tous' },
                    { key: 'actif', label: 'Actifs' },
                    { key: 'inactif', label: 'Inactifs' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setFiltres((f) => ({ ...f, statut: opt.key }))}
                    className={`py-1 text-xs font-medium rounded-md transition-all text-center ${
                      filtres.statut === opt.key
                        ? 'bg-white text-terracotta-600 shadow-sm font-semibold'
                        : 'text-sand-600 hover:text-sand-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Filtre Livreur */}
            <div>
              <label className="block text-xs font-medium text-sand-600 mb-1.5">Livreur assigné</label>
              <select
                value={filtres.livreurId}
                onChange={(e) => setFiltres((f) => ({ ...f, livreurId: e.target.value }))}
                className="w-full h-8 px-2.5 text-xs bg-white border border-sand-300 rounded-lg text-sand-900 focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
              >
                <option value="tous">Tous les livreurs</option>
                {livreurs.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nom}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tri */}
          <div className="pt-2 flex items-center justify-between border-t border-sand-100 text-xs">
            <span className="text-sand-500 font-medium">Ordre de tri dans le document :</span>
            <div className="flex items-center gap-1.5">
              {(
                [
                  { key: 'nom_asc', label: 'A → Z (Nom)' },
                  { key: 'kiosque_premier', label: 'Kiosques en tête' },
                  { key: 'type', label: 'Par type (Boutiques d\'abord)' },
                ] as const
              ).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setFiltres((f) => ({ ...f, tri: t.key }))}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                    filtres.tri === t.key
                      ? 'bg-terracotta-50 text-terracotta-700 border-terracotta-200'
                      : 'bg-white text-sand-600 border-sand-200 hover:bg-sand-50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Section 3 : Options cliquables de Statistiques */}
        <div className="bg-white border border-sand-200 rounded-xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-sand-100 pb-2.5">
            <div className="flex items-center gap-2">
              <Icon icon="mdi:chart-box-outline" className="text-terracotta-600 text-lg" />
              <h3 className="text-sm font-semibold text-sand-900">
                2. Bloc de statistiques en haut de la fiche
              </h3>
            </div>
            <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-sand-700">
              <input
                type="checkbox"
                checked={statsConfig.inclureStats}
                onChange={(e) => setStatsConfig((s) => ({ ...s, inclureStats: e.target.checked }))}
                className="w-4 h-4 text-terracotta-600 border-sand-300 rounded focus:ring-terracotta-500"
              />
              <span>Afficher les statistiques</span>
            </label>
          </div>

          <p className="text-xs text-sand-500">
            Cochez les indicateurs que vous souhaitez faire apparaître dans le bandeau de synthèse de la fiche :
          </p>

          <div
            className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 transition-opacity ${
              statsConfig.inclureStats ? 'opacity-100' : 'opacity-40 pointer-events-none'
            }`}
          >
            {/* Total clients */}
            <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-sand-200 hover:bg-sand-50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={statsConfig.afficherTotal}
                onChange={() => handleToggleStat('afficherTotal')}
                className="mt-0.5 w-4 h-4 text-terracotta-600 border-sand-300 rounded focus:ring-terracotta-500"
              />
              <div>
                <span className="text-xs font-medium text-sand-900 block">Nombre total de clients</span>
                <span className="text-[11px] text-sand-500">Affiche le total sélectionné ({liveStats.total})</span>
              </div>
            </label>

            {/* Avec Kiosque ou pas */}
            <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-sand-200 hover:bg-sand-50 cursor-pointer transition-colors bg-amber-50/40 border-amber-200/60">
              <input
                type="checkbox"
                checked={statsConfig.afficherKiosque}
                onChange={() => handleToggleStat('afficherKiosque')}
                className="mt-0.5 w-4 h-4 text-terracotta-600 border-sand-300 rounded focus:ring-terracotta-500"
              />
              <div>
                <span className="text-xs font-semibold text-amber-900 block flex items-center gap-1">
                  <Icon icon="mdi:store" className="text-amber-600" />
                  Nombre avec kiosque ou pas
                </span>
                <span className="text-[11px] text-amber-700">
                  {liveStats.avecKiosque} avec kiosque ({liveStats.pctKiosque.toFixed(0)}%) · {liveStats.sansKiosque} sans kiosque
                </span>
              </div>
            </label>

            {/* Actifs / Inactifs */}
            <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-sand-200 hover:bg-sand-50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={statsConfig.afficherActifs}
                onChange={() => handleToggleStat('afficherActifs')}
                className="mt-0.5 w-4 h-4 text-terracotta-600 border-sand-300 rounded focus:ring-terracotta-500"
              />
              <div>
                <span className="text-xs font-medium text-sand-900 block">Clients actifs vs inactifs</span>
                <span className="text-[11px] text-sand-500">
                  {liveStats.actifs} actifs ({liveStats.pctActifs.toFixed(0)}%) · {liveStats.inactifs} inactifs
                </span>
              </div>
            </label>

            {/* Répartition Types */}
            <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-sand-200 hover:bg-sand-50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={statsConfig.afficherTypes}
                onChange={() => handleToggleStat('afficherTypes')}
                className="mt-0.5 w-4 h-4 text-terracotta-600 border-sand-300 rounded focus:ring-terracotta-500"
              />
              <div>
                <span className="text-xs font-medium text-sand-900 block">Répartition Types (Clients / Boutiques)</span>
                <span className="text-[11px] text-sand-500">
                  {liveStats.typeClients} clients classiques vs {liveStats.typeBoutiques} boutiques
                </span>
              </div>
            </label>

            {/* Répartition Livreurs */}
            <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-sand-200 hover:bg-sand-50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={statsConfig.afficherLivreurs}
                onChange={() => handleToggleStat('afficherLivreurs')}
                className="mt-0.5 w-4 h-4 text-terracotta-600 border-sand-300 rounded focus:ring-terracotta-500"
              />
              <div>
                <span className="text-xs font-medium text-sand-900 block">Affectation des livreurs</span>
                <span className="text-[11px] text-sand-500">
                  Nombre de clients assignés par livreur
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Section 4 : Colonnes et informations du tableau */}
        <div className="bg-white border border-sand-200 rounded-xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-sand-100 pb-2.5">
            <div className="flex items-center gap-2">
              <Icon icon="mdi:table" className="text-terracotta-600 text-lg" />
              <h3 className="text-sm font-semibold text-sand-900">
                3. Informations à faire figurer dans les colonnes
              </h3>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleSelectAllCols(true)}
                className="text-terracotta-600 hover:underline font-medium"
              >
                Tout cocher
              </button>
              <span className="text-sand-300">|</span>
              <button
                type="button"
                onClick={() => handleSelectAllCols(false)}
                className="text-sand-500 hover:underline font-medium"
              >
                Tout décocher
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {/* Nom & Prénom */}
            <div className="flex items-center gap-2 p-2 rounded-lg bg-sand-50 border border-sand-200 opacity-80 cursor-not-allowed">
              <input
                type="checkbox"
                checked
                disabled
                className="w-4 h-4 text-sand-400 border-sand-300 rounded cursor-not-allowed"
              />
              <span className="text-xs font-semibold text-sand-800">Nom & Prénom *</span>
            </div>

            {/* Type */}
            <label className="flex items-center gap-2 p-2 rounded-lg border border-sand-200 hover:bg-sand-50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={colonnesConfig.typeClient}
                onChange={() => handleToggleCol('typeClient')}
                className="w-4 h-4 text-terracotta-600 border-sand-300 rounded focus:ring-terracotta-500"
              />
              <span className="text-xs font-medium text-sand-800">Type (Client / Boutique)</span>
            </label>

            {/* Kiosque */}
            <label className="flex items-center gap-2 p-2 rounded-lg border border-amber-200 bg-amber-50/40 hover:bg-amber-50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={colonnesConfig.kiosque}
                onChange={() => handleToggleCol('kiosque')}
                className="w-4 h-4 text-terracotta-600 border-sand-300 rounded focus:ring-terracotta-500"
              />
              <span className="text-xs font-semibold text-amber-900 flex items-center gap-1">
                <Icon icon="mdi:store" className="text-amber-600" /> Kiosque
              </span>
            </label>

            {/* Téléphone */}
            <label className="flex items-center gap-2 p-2 rounded-lg border border-sand-200 hover:bg-sand-50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={colonnesConfig.telephone}
                onChange={() => handleToggleCol('telephone')}
                className="w-4 h-4 text-terracotta-600 border-sand-300 rounded focus:ring-terracotta-500"
              />
              <span className="text-xs font-medium text-sand-800">Téléphone</span>
            </label>

            {/* Adresse */}
            <label className="flex items-center gap-2 p-2 rounded-lg border border-sand-200 hover:bg-sand-50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={colonnesConfig.adresse}
                onChange={() => handleToggleCol('adresse')}
                className="w-4 h-4 text-terracotta-600 border-sand-300 rounded focus:ring-terracotta-500"
              />
              <span className="text-xs font-medium text-sand-800">Adresse</span>
            </label>

            {/* Livreur */}
            <label className="flex items-center gap-2 p-2 rounded-lg border border-sand-200 hover:bg-sand-50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={colonnesConfig.livreur}
                onChange={() => handleToggleCol('livreur')}
                className="w-4 h-4 text-terracotta-600 border-sand-300 rounded focus:ring-terracotta-500"
              />
              <span className="text-xs font-medium text-sand-800">Livreur / Cars</span>
            </label>

            {/* Mode de paiement */}
            <label className="flex items-center gap-2 p-2 rounded-lg border border-sand-200 hover:bg-sand-50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={colonnesConfig.modePaiement}
                onChange={() => handleToggleCol('modePaiement')}
                className="w-4 h-4 text-terracotta-600 border-sand-300 rounded focus:ring-terracotta-500"
              />
              <span className="text-xs font-medium text-sand-800">Mode Paiement</span>
            </label>

            {/* Statut */}
            <label className="flex items-center gap-2 p-2 rounded-lg border border-sand-200 hover:bg-sand-50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={colonnesConfig.statut}
                onChange={() => handleToggleCol('statut')}
                className="w-4 h-4 text-terracotta-600 border-sand-300 rounded focus:ring-terracotta-500"
              />
              <span className="text-xs font-medium text-sand-800">Statut (Actif/Inactif)</span>
            </label>

            {/* Conditions de paiement */}
            <label className="flex items-center gap-2 p-2 rounded-lg border border-sand-200 hover:bg-sand-50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={colonnesConfig.conditionsPaiement}
                onChange={() => handleToggleCol('conditionsPaiement')}
                className="w-4 h-4 text-terracotta-600 border-sand-300 rounded focus:ring-terracotta-500"
              />
              <span className="text-xs font-medium text-sand-800">Conditions / Ristourne</span>
            </label>

            {/* GPS */}
            <label className="flex items-center gap-2 p-2 rounded-lg border border-sand-200 hover:bg-sand-50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={colonnesConfig.coordonneesGps}
                onChange={() => handleToggleCol('coordonneesGps')}
                className="w-4 h-4 text-terracotta-600 border-sand-300 rounded focus:ring-terracotta-500"
              />
              <span className="text-xs font-medium text-sand-800">Coordonnées GPS</span>
            </label>
          </div>
        </div>

        {/* Boutons d'action */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-3 border-t border-sand-200">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 border border-sand-300 rounded-lg text-sm text-sand-700 hover:bg-sand-50 font-medium transition-colors"
          >
            Fermer
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={clientsFiltres.length === 0}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-white border border-sand-300 hover:bg-sand-50 text-sand-700 rounded-lg text-sm font-medium transition-all shadow-sm disabled:opacity-50"
              title="Exporter les données au format CSV / Excel"
            >
              <Icon icon="mdi:file-delimited-outline" className="text-lg text-emerald-600" />
              <span>Export CSV / Excel</span>
            </button>

            <button
              type="button"
              onClick={handleGenererPDF}
              disabled={generatingPdf || clientsFiltres.length === 0}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-lg text-sm font-medium transition-all shadow-soft active:scale-[0.98] disabled:opacity-50"
            >
              <Icon
                icon={generatingPdf ? 'mdi:loading' : 'mdi:file-pdf-box'}
                className={`text-lg ${generatingPdf ? 'animate-spin' : ''}`}
              />
              <span>{generatingPdf ? 'Génération…' : 'Générer la Fiche PDF'}</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
