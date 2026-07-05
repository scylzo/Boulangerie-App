import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { TableLoader } from '../../components/ui/Loader';
import { Modal } from '../../components/ui/Modal';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { ClientForm } from '../../components/shared/ClientForm';
import { useReferentielStore } from '../../store/referentielStore';
import { useLivreurStore } from '../../store/livreurStore';
import type { Client } from '../../types';
import omLogo from '../../assets/om.svg';
import waveLogo from '../../assets/wave.svg';

export const GestionClients: React.FC = () => {
  const {
    clients,
    clientEnEdition,
    isLoadingClients,
    chargerClients,
    ajouterClient,
    modifierClient,
    supprimerClient,
    setClientEnEdition
  } = useReferentielStore();

  const { chargerLivreurs, getLivreurById } = useLivreurStore();

  const [showForm, setShowForm] = useState(false);
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get('q') || '');
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; clientId: string; clientNom: string }>({
    isOpen: false,
    clientId: '',
    clientNom: ''
  });

  useEffect(() => {
    chargerClients();
    chargerLivreurs();
  }, [chargerClients, chargerLivreurs]);

  // Préremplir la recherche depuis l'URL (?q=) — ex. depuis la recherche globale
  useEffect(() => {
    const q = searchParams.get('q');
    if (q !== null) setSearch(q);
  }, [searchParams]);

  const handleAjouter = async (clientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => {
    await ajouterClient(clientData);
    setShowForm(false);
  };

  const handleModifier = async (clientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (clientEnEdition) {
      await modifierClient(clientEnEdition.id, clientData);
      setClientEnEdition(null);
      setShowForm(false);
    }
  };

  const handleSupprimer = (client: Client) => {
    setDeleteConfirm({
      isOpen: true,
      clientId: client.id,
      clientNom: client.nom
    });
  };

  const confirmSupprimer = async () => {
    await supprimerClient(deleteConfirm.clientId);
    setDeleteConfirm({ isOpen: false, clientId: '', clientNom: '' });
  };

  const handleAnnuler = () => {
    setClientEnEdition(null);
    setShowForm(false);
  };

  const handleEditer = (client: Client) => {
    setClientEnEdition(client);
    setShowForm(true);
  };

  const getModePaiementInfo = (mode?: string) => {
    switch (mode) {
      case 'espece': return { label: 'Espèces', color: 'bg-success-50 text-success-700 ring-success-100', icon: 'mdi:cash', isImage: false };
      case 'om': return { label: 'Orange Money', color: 'bg-warning-50 text-warning-600 ring-warning-100', image: omLogo, isImage: true };
      case 'wave': return { label: 'Wave', color: 'bg-info-50 text-info-600 ring-info-100', image: waveLogo, isImage: true };
      case 'cheque': return { label: 'Chèque', color: 'bg-sand-100 text-sand-700 ring-sand-200', icon: 'mdi:checkbook', isImage: false };
      case 'virement': return { label: 'Virement', color: 'bg-terracotta-50 text-terracotta-700 ring-terracotta-100', icon: 'mdi:bank-transfer', isImage: false };
      default: return null;
    }
  };

  const initiales = (c: Client) => {
    const base = c.prenom ? `${c.prenom} ${c.nom}` : c.nom;
    return base.split(' ').filter(Boolean).map(w => w[0]).join('').substring(0, 2).toUpperCase();
  };

  const clientsFiltres = clients.filter(c => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (c.nom?.toLowerCase().includes(q) || c.prenom?.toLowerCase().includes(q) || c.telephone?.includes(q));
  });

  return (
    <div className="min-h-screen bg-sand-100">
      {/* Header */}
      <div className="bg-white border-b border-sand-200 px-3 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <div className="w-10 h-10 bg-terracotta-50 rounded-xl flex items-center justify-center shrink-0">
              <Icon icon="mdi:account-group-outline" className="text-lg sm:text-2xl text-terracotta-600" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-base sm:text-2xl font-semibold text-sand-900 truncate">Clients</h1>
              <p className="text-xs sm:text-sm text-sand-500 truncate">
                {clients.length} client(s) · {clients.filter(c => c.active).length} actif(s) · {clients.filter(c => c.aKiosque).length} kiosque(s)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Icon icon="mdi:magnify" className="absolute left-3 top-1/2 -translate-y-1/2 text-sand-400 text-lg" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher…"
                className="w-full sm:w-44 pl-10 pr-3 py-2 border border-sand-300 rounded-lg bg-white text-sm text-sand-900 focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
              />
            </div>
            <a
              href="/admin/carte"
              className="flex items-center justify-center gap-2 px-3 py-2 bg-white text-sand-700 hover:bg-sand-50 border border-sand-300 rounded-lg transition-all text-sm font-medium whitespace-nowrap"
              title="Carte des Kiosques"
            >
              <Icon icon="mdi:map-marker-radius" className="text-lg" />
              <span className="hidden md:inline">Carte</span>
            </a>
            <button
              onClick={() => setShowForm(true)}
              disabled={showForm}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-soft text-sm font-medium whitespace-nowrap"
            >
              <Icon icon="mdi:plus" className="text-lg" />
              <span className="hidden sm:inline">Nouveau client</span>
            </button>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto p-4 sm:p-6">

        {/* Modal d'ajout/modification */}
        {showForm && (
          <Modal
            isOpen={showForm}
            onClose={handleAnnuler}
            title={clientEnEdition ? 'Modifier le client' : 'Nouveau client'}
            position="center"
            size="lg"
          >
            <ClientForm
              client={clientEnEdition}
              onSave={clientEnEdition ? handleModifier : handleAjouter}
              onCancel={handleAnnuler}
              isLoading={isLoadingClients}
            />
          </Modal>
        )}

        {isLoadingClients ? (
          <div className="bg-white rounded-2xl border border-sand-200 shadow-card">
            <TableLoader message="Chargement des clients..." />
          </div>
        ) : clients.length === 0 ? (
          <div className="bg-white rounded-2xl border border-sand-200 shadow-card text-center py-16">
            <div className="w-20 h-20 bg-sand-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Icon icon="mdi:account-group-outline" className="text-4xl text-sand-400" />
            </div>
            <h3 className="font-display text-xl font-semibold text-sand-900 mb-3">Aucun client enregistré</h3>
            <p className="text-sand-500 mb-8 max-w-md mx-auto px-4">
              Commencez par ajouter vos premiers clients pour gérer votre base de données client
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-lg transition-all shadow-soft text-sm font-medium"
            >
              <Icon icon="mdi:plus" className="text-lg" />
              <span>Ajouter le premier client</span>
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {clientsFiltres.map((client) => {
              const defaultLivreur = client.livreurId ? getLivreurById(client.livreurId) : null;
              const car1Livreur = client.livreursParCar?.car1_matin ? getLivreurById(client.livreursParCar.car1_matin) : null;
              const car2Livreur = client.livreursParCar?.car2_matin ? getLivreurById(client.livreursParCar.car2_matin) : null;
              const soirLivreur = client.livreursParCar?.car_soir ? getLivreurById(client.livreursParCar.car_soir) : null;
              const hasAnyLivreur = defaultLivreur || car1Livreur || car2Livreur || soirLivreur;
              const paiement = getModePaiementInfo(client.modePaiementPreference);

              return (
                <div key={client.id} className="bg-white border border-sand-200 rounded-2xl shadow-card hover:shadow-elevated transition-all overflow-hidden flex flex-col">
                  {/* En-tête */}
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-sand-200 bg-sand-50">
                    <div className="w-11 h-11 rounded-xl bg-sand-900 text-white flex items-center justify-center font-semibold text-sm shrink-0">
                      {initiales(client)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-display font-semibold text-sand-900 truncate">
                        {client.prenom ? `${client.prenom} ${client.nom}` : client.nom}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-md ring-1 ring-inset ${client.typeClient === 'client' ? 'bg-info-50 text-info-600 ring-info-100' : 'bg-terracotta-50 text-terracotta-700 ring-terracotta-100'}`}>
                          <Icon icon={client.typeClient === 'client' ? 'mdi:account-heart' : 'mdi:storefront'} className="text-xs" />
                          {client.typeClient === 'client' ? 'Client' : 'Boutique'}
                        </span>
                        {client.aKiosque && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-md bg-gold-50 text-gold-600 ring-1 ring-inset ring-gold-100">
                            <Icon icon="mdi:store-outline" className="text-xs" /> Kiosque
                          </span>
                        )}
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-md ring-1 ring-inset ${client.active ? 'bg-success-50 text-success-700 ring-success-100' : 'bg-sand-100 text-sand-500 ring-sand-200'}`}>
                          {client.active ? 'Actif' : 'Inactif'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Corps */}
                  <div className="p-4 flex flex-col gap-3 flex-1">
                    <div className="space-y-1.5 text-sm text-sand-600">
                      {client.adresse && (
                        <div className="flex items-start gap-2"><Icon icon="mdi:map-marker-outline" className="text-sand-400 text-base mt-0.5 shrink-0" /><span className="min-w-0">{client.adresse}</span></div>
                      )}
                      {client.telephone && (
                        <div className="flex items-center gap-2"><Icon icon="mdi:phone-outline" className="text-sand-400 text-base shrink-0" /><span className="truncate">{client.telephone}</span></div>
                      )}
                      {client.email && (
                        <div className="flex items-center gap-2"><Icon icon="mdi:email-outline" className="text-sand-400 text-base shrink-0" /><span className="truncate">{client.email}</span></div>
                      )}
                      {(client.latitude && client.longitude) && (
                        <div className="flex items-center gap-2"><Icon icon="mdi:crosshairs-gps" className="text-info-500 text-base shrink-0" /><span className="text-xs font-medium text-info-600">{client.latitude.toFixed(4)}, {client.longitude.toFixed(4)}</span></div>
                      )}
                    </div>

                    {/* Paiement + livreurs */}
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-sand-500 mb-1.5">Paiement & livreurs</div>
                      <div className="flex flex-wrap gap-1.5">
                        {paiement && (
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium rounded-md ring-1 ring-inset ${paiement.color}`}>
                            {paiement.isImage ? <img src={paiement.image} alt={paiement.label} className="w-4 h-4 object-contain" /> : <Icon icon={paiement.icon || ''} className="text-sm" />}
                            {paiement.label}
                          </span>
                        )}
                        {defaultLivreur && <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-md bg-sand-100 text-sand-600 ring-1 ring-inset ring-sand-200"><Icon icon="mdi:truck-outline" className="text-xs text-sand-400" />Défaut · {defaultLivreur.nom}</span>}
                        {car1Livreur && <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-md bg-sand-100 text-sand-600 ring-1 ring-inset ring-sand-200"><Icon icon="mdi:truck-outline" className="text-xs text-sand-400" />C1 · {car1Livreur.nom}</span>}
                        {car2Livreur && <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-md bg-sand-100 text-sand-600 ring-1 ring-inset ring-sand-200"><Icon icon="mdi:truck-outline" className="text-xs text-sand-400" />C2 · {car2Livreur.nom}</span>}
                        {soirLivreur && <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-md bg-sand-100 text-sand-600 ring-1 ring-inset ring-sand-200"><Icon icon="mdi:truck-outline" className="text-xs text-sand-400" />Soir · {soirLivreur.nom}</span>}
                        {!hasAnyLivreur && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-md bg-warning-50 text-warning-600 ring-1 ring-inset ring-warning-100">
                            <Icon icon="mdi:alert" className="text-xs" /> Aucun livreur assigné
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-1 mt-auto pt-1">
                      <button
                        onClick={() => handleEditer(client)}
                        disabled={showForm}
                        className="w-8 h-8 rounded-lg text-sand-500 hover:bg-sand-100 hover:text-sand-900 flex items-center justify-center transition-colors disabled:opacity-50"
                        title="Modifier"
                      >
                        <Icon icon="mdi:pencil-outline" className="text-lg" />
                      </button>
                      <button
                        onClick={() => handleSupprimer(client)}
                        disabled={isLoadingClients}
                        className="w-8 h-8 rounded-lg text-sand-500 hover:bg-danger-50 hover:text-danger-600 flex items-center justify-center transition-colors disabled:opacity-50"
                        title="Supprimer"
                      >
                        <Icon icon="mdi:trash-can-outline" className="text-lg" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {clientsFiltres.length === 0 && (
              <div className="col-span-full bg-white rounded-2xl border border-sand-200 shadow-card py-10 text-center text-sand-500">
                Aucun client ne correspond à « {search} ».
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, clientId: '', clientNom: '' })}
        onConfirm={confirmSupprimer}
        title="Confirmer la suppression"
        message={`Êtes-vous sûr de vouloir supprimer le client "${deleteConfirm.clientNom}" ?\n\nCette action supprimera également toutes les commandes associées à ce client.`}
        confirmText="Supprimer"
        cancelText="Annuler"
        type="danger"
        position="center"
      />
    </div>
  );
};
