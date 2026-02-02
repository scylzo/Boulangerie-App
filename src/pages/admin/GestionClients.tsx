import React, { useEffect, useState } from 'react';
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
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; clientId: string; clientNom: string }>({
    isOpen: false,
    clientId: '',
    clientNom: ''
  });

  useEffect(() => {
    chargerClients();
    chargerLivreurs();
  }, [chargerClients, chargerLivreurs]);

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
      case 'espece': return { label: 'Espèces', color: 'bg-green-100 text-green-800', icon: 'mdi:cash', isImage: false };
      case 'om': return { label: 'Orange Money', color: 'bg-orange-100 text-orange-800', image: omLogo, isImage: true };
      case 'wave': return { label: 'Wave', color: 'bg-blue-100 text-blue-800', image: waveLogo, isImage: true };
      case 'cheque': return { label: 'Chèque', color: 'bg-gray-100 text-gray-800', icon: 'mdi:checkbook', isImage: false };
      case 'virement': return { label: 'Virement', color: 'bg-purple-100 text-purple-800', icon: 'mdi:bank-transfer', isImage: false };
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-3 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
              <Icon icon="mdi:account-group" className="text-lg sm:text-2xl text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-base sm:text-xl font-semibold text-gray-900 truncate">
                Gestion des Clients
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 truncate">
                Base clients et tarifs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <a
              href="/admin/carte"
              className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-all shadow-sm text-xs sm:text-sm font-bold flex-1 sm:flex-none"
            >
              <Icon icon="mdi:map-marker-radius" className="text-base sm:text-lg" />
              <span>Carte des Kiosques</span>
            </a>

            <button
              onClick={() => setShowForm(true)}
              disabled={showForm}
              className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm text-xs sm:text-sm font-medium flex-1 sm:flex-none"
            >
              <Icon icon="mdi:plus" className="text-base sm:text-lg" />
              <span>Nouveau client</span>
            </button>
          </div>

        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto p-6 space-y-6">

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

        {/* Section Liste des clients */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Icon icon="mdi:format-list-bulleted" className="text-lg text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Liste des clients</h2>
                  <p className="text-sm text-gray-500">{clients.length} client(s) enregistré(s)</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-600">
                  <span className="font-medium text-green-600">{clients.filter(c => c.active).length}</span> actifs
                  <span className="mx-2">•</span>
                  <span className="font-medium text-red-600">{clients.filter(c => !c.active).length}</span> inactifs
                  <span className="mx-2">•</span>
                  <span className="font-medium text-orange-600">{clients.filter(c => c.aKiosque).length}</span> avec kiosque
                </div>
              </div>
            </div>
          </div>

          <div className="p-6">
            {isLoadingClients ? (
              <TableLoader message="Chargement des clients..." />
            ) : clients.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Icon icon="mdi:account-group-outline" className="text-4xl text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  Aucun client enregistré
                </h3>
                <p className="text-gray-500 mb-8 max-w-md mx-auto">
                  Commencez par ajouter vos premiers clients pour gérer votre base de données client
                </p>
                <button
                  onClick={() => setShowForm(true)}
                  className="inline-flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-sm text-xs sm:text-sm font-medium"
                >
                  <Icon icon="mdi:plus" className="text-lg" />
                  <span className="font-medium">Ajouter le premier client</span>
                </button>
              </div>
            ) : (
              <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
                {clients.map((client) => {
                  const livreur = client.livreurId ? getLivreurById(client.livreurId) : null;

                  return (
                    <div
                      key={client.id}
                      className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 hover:border-blue-300 hover:shadow-lg transition-all duration-300 group"
                    >
                      {/* Header du client */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                            <Icon icon="mdi:account" className="text-2xl text-white" />
                          </div>
                          <div>
                            <h3 className="font-bold text-sm sm:text-lg text-gray-900 mb-1 line-clamp-2">
                              {client.nom}
                            </h3>
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full ${client.active
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                                }`}>
                                <Icon icon={client.active ? 'mdi:check-circle' : 'mdi:pause-circle'} className="text-xs" />
                                {client.active ? 'Actif' : 'Inactif'}
                              </span>
                              {client.aKiosque && (
                                <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-700">
                                  <Icon icon="mdi:store-outline" className="text-xs" />
                                  Kiosque
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Informations principales */}
                      <div className="space-y-3 mb-6">
                        <div className="flex items-start gap-2">
                          <Icon icon="mdi:map-marker" className="text-gray-400 mt-0.5" />
                          <span className="text-sm text-gray-700">{client.adresse}</span>
                        </div>

                        {client.telephone && (
                          <div className="flex items-center gap-2">
                            <Icon icon="mdi:phone" className="text-gray-400" />
                            <span className="text-sm text-gray-700">{client.telephone}</span>
                          </div>
                        )}

                        {client.email && (
                          <div className="flex items-center gap-2">
                            <Icon icon="mdi:email" className="text-gray-400" />
                            <span className="text-sm text-gray-700">{client.email}</span>
                          </div>
                        )}

                        {(client.latitude && client.longitude) && (
                          <div className="flex items-center gap-2">
                            <Icon icon="mdi:crosshairs-gps" className="text-blue-500" />
                            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                              {client.latitude.toFixed(4)}, {client.longitude.toFixed(4)}
                            </span>
                          </div>
                        )}

                      </div>

                      {/* Type et Paiement */}
                      <div className="grid grid-cols-2 gap-3 mb-6">
                        <div className="bg-gray-50 rounded-xl p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Icon icon="mdi:tag" className="text-gray-500 text-xs" />
                            <span className="text-[10px] font-medium text-gray-600 uppercase">Type</span>
                          </div>
                          <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg ${client.typeClient === 'client'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-purple-100 text-purple-800'
                            }`}>
                            <Icon icon={client.typeClient === 'client' ? 'mdi:account-heart' : 'mdi:storefront'} className="text-xs" />
                            {client.typeClient === 'client' ? 'Client' : 'Boutique'}
                          </span>
                        </div>

                        {client.modePaiementPreference ? (
                          <div className="bg-gray-50 rounded-xl p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <Icon icon="mdi:credit-card-outline" className="text-gray-500 text-xs" />
                              <span className="text-[10px] font-medium text-gray-600 uppercase">Paiement</span>
                            </div>
                            {(() => {
                              const info = getModePaiementInfo(client.modePaiementPreference);
                              return info ? (
                                <span className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-semibold rounded-lg ${info.color}`}>
                                  {info.isImage ? (
                                    <img src={info.image} alt={info.label} className="w-5 h-5 object-contain" />
                                  ) : (
                                    <Icon icon={info.icon || ''} className="text-sm" />
                                  )}
                                  {info.label}
                                </span>
                              ) : <span className="text-xs text-gray-400">-</span>;
                            })()}
                          </div>
                        ) : (
                          <div className="bg-gray-50 rounded-xl p-3 opacity-50">
                            <div className="flex items-center gap-2 mb-1">
                              <Icon icon="mdi:credit-card-off-outline" className="text-gray-500 text-xs" />
                              <span className="text-[10px] font-medium text-gray-600 uppercase">Paiement</span>
                            </div>
                            <span className="text-xs text-gray-400 italic">Non défini</span>
                          </div>
                        )}
                      </div>

                      {/* Livreur assigné */}
                      {livreur ? (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2 sm:p-3 mb-4 sm:mb-6">
                          <div className="flex items-center gap-2 mb-1">
                            <Icon icon="mdi:truck-delivery" className="text-green-600 text-sm" />
                            <span className="text-xs font-medium text-green-700">Livreur assigné</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-green-500 rounded-lg flex items-center justify-center">
                              <Icon icon="mdi:account" className="text-white text-xs" />
                            </div>
                            <div>
                              <div className="font-semibold text-green-800">{livreur.nom}</div>
                              {livreur.vehicule && (
                                <div className="text-xs text-green-600">{livreur.vehicule}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6">
                          <div className="flex items-center gap-2">
                            <Icon icon="mdi:alert" className="text-amber-600" />
                            <span className="text-sm text-amber-700 font-medium">Aucun livreur assigné</span>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 mt-auto">
                        <button
                          onClick={() => handleEditer(client)}
                          disabled={showForm}
                          className="flex-1 flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all text-xs sm:text-sm font-medium shadow-sm hover:shadow-md disabled:opacity-50"
                        >
                          <Icon icon="mdi:pencil" className="text-base sm:text-lg" />
                          <span className="hidden sm:inline">Modifier</span>
                        </button>
                        <button
                          onClick={() => handleSupprimer(client)}
                          disabled={isLoadingClients}
                          className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-xl transition-all text-xs sm:text-sm font-medium shadow-sm hover:shadow-md disabled:opacity-50"
                        >
                          <Icon icon="mdi:delete-outline" className="text-base sm:text-lg" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
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