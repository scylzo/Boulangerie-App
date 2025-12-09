import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { TableLoader } from '../../components/ui/Loader';
import { ClientForm } from '../../components/shared/ClientForm';
import { useReferentielStore } from '../../store/referentielStore';
import { useLivreurStore } from '../../store/livreurStore';
import type { Client } from '../../types';

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

  const {  chargerLivreurs, getLivreurById } = useLivreurStore();

  const [showForm, setShowForm] = useState(false);

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

  const handleSupprimer = async (client: Client) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer "${client.nom}" ?`)) {
      await supprimerClient(client.id);
    }
  };

  const handleAnnuler = () => {
    setClientEnEdition(null);
    setShowForm(false);
  };

  const handleEditer = (client: Client) => {
    setClientEnEdition(client);
    setShowForm(true);
  };

  const getTypeClientLabel = (type: string) => {
    return type === 'client' ? 'Client (prix réduit)' : 'Boutique (prix normal)';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header moderne type Odoo */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <Icon icon="mdi:account-group" className="text-2xl text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Gestion des Clients
              </h1>
              <p className="text-sm text-gray-500">
                Gérez votre base de clients et définissez les types de tarification
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowForm(true)}
            disabled={showForm}
            className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            <Icon icon="mdi:plus" className="text-lg" />
            <span className="font-medium">Nouveau client</span>
          </button>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto p-6 space-y-6">

      {/* Formulaire d'ajout/modification */}
      {showForm && (
        <ClientForm
          client={clientEnEdition}
          onSave={clientEnEdition ? handleModifier : handleAjouter}
          onCancel={handleAnnuler}
          isLoading={isLoadingClients}
        />
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
                  <span className="font-medium">{clients.filter(c => c.active).length}</span> actifs
                  <span className="mx-2">•</span>
                  <span className="font-medium">{clients.filter(c => !c.active).length}</span> inactifs
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
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md"
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
                      className="bg-gradient-to-br from-white to-gray-50 border border-gray-200 rounded-2xl p-6 hover:border-blue-300 hover:shadow-2xl transition-all duration-300 group"
                    >
                      {/* Header du client */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-start gap-4">
                          <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                            <Icon icon="mdi:account" className="text-2xl text-white" />
                          </div>
                          <div>
                            <h3 className="font-bold text-xl text-gray-900 mb-1">
                              {client.nom}
                            </h3>
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full ${
                                client.active
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}>
                                <Icon icon={client.active ? 'mdi:check-circle' : 'mdi:pause-circle'} className="text-xs" />
                                {client.active ? 'Actif' : 'Inactif'}
                              </span>
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
                      </div>

                      {/* Type et Paiement */}
                      <div className="grid grid-cols-1 gap-3 mb-6">
                        <div className="bg-gray-50 rounded-xl p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Icon icon="mdi:tag" className="text-gray-500 text-sm" />
                            <span className="text-xs font-medium text-gray-600">Type de client</span>
                          </div>
                          <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg ${
                            client.typeClient === 'client'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}>
                            <Icon icon={client.typeClient === 'client' ? 'mdi:account-heart' : 'mdi:storefront'} className="text-xs" />
                            {getTypeClientLabel(client.typeClient)}
                          </span>
                        </div>
                      </div>

                      {/* Livreur assigné */}
                      {livreur ? (
                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-3 mb-6">
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
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditer(client)}
                          disabled={showForm}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all font-medium shadow-sm hover:shadow-md disabled:opacity-50"
                        >
                          <Icon icon="mdi:pencil" className="text-lg" />
                          <span>Modifier</span>
                        </button>
                        <button
                          onClick={() => handleSupprimer(client)}
                          disabled={isLoadingClients}
                          className="flex items-center justify-center gap-2 px-4 py-2 text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-xl transition-all font-medium shadow-sm hover:shadow-md disabled:opacity-50"
                        >
                          <Icon icon="mdi:delete-outline" className="text-lg" />
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
    </div>
  );
};