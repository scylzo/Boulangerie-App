import React, { useEffect } from 'react';
import { Icon } from '@iconify/react';
import { Card } from '../ui/Card';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { CardLoader } from '../ui/Loader';
import { useReferentielStore } from '../../store/referentielStore';
import { useLivreurStore } from '../../store/livreurStore';
import type { Client, Livreur } from '../../types';

export const AssignationClientLivreur: React.FC = () => {
  const { clients, chargerClients, modifierClient, isLoadingClients } = useReferentielStore();
  const { livreurs, chargerLivreurs, getLivreursActifs, isLoadingLivreurs } = useLivreurStore();

  useEffect(() => {
    chargerClients().catch(console.error);
    chargerLivreurs().catch(console.error);
  }, [chargerClients, chargerLivreurs]);

  const livreursActifs = getLivreursActifs();

  const handleAssignerLivreur = async (clientId: string, livreurId: string) => {
    try {
      await modifierClient(clientId, { livreurId: livreurId || undefined });
    } catch (error) {
      console.error('Erreur lors de l\'assignation:', error);
    }
  };

  const getClientsParLivreur = (livreurId: string) => {
    return clients.filter(client => client.livreurId === livreurId && client.active);
  };

  const getClientsSansLivreur = () => {
    return clients.filter(client => !client.livreurId && client.active);
  };

  if (isLoadingClients || isLoadingLivreurs) {
    return (
      <Card title="Assignation Client-Livreur">
        <CardLoader message="Chargement des données..." />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section des clients non assignés */}
      <Card
        title="Clients sans livreur assigné"
        subtitle="Assignez un livreur à chaque client pour optimiser les livraisons"
      >
        {getClientsSansLivreur().length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>Tous les clients actifs ont un livreur assigné</p>
            <p className="text-sm text-gray-400 mt-1">👏 Excellent ! Toutes les assignations sont complètes</p>
          </div>
        ) : (
          <div className="space-y-3">
            {getClientsSansLivreur().map((client) => (
              <div
                key={client.id}
                className="flex items-center justify-between p-4 border border-orange-200 rounded-lg bg-orange-50"
              >
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{client.nom}</h4>
                  <p className="text-sm text-gray-600">{client.adresse}</p>
                  {client.telephone && (
                    <p className="text-xs text-gray-500">📞 {client.telephone}</p>
                  )}
                </div>
                <div className="flex items-center space-x-3">
                  <Select
                    options={[
                      { value: '', label: 'Choisir un livreur' },
                      ...livreursActifs.map(livreur => ({
                        value: livreur.id,
                        label: `${livreur.nom} ${livreur.vehicule ? `(${livreur.vehicule})` : ''}`
                      }))
                    ]}
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAssignerLivreur(client.id, e.target.value);
                      }
                    }}
                    className="min-w-48"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Section par livreur */}
      {livreursActifs.map((livreur) => {
        const clientsDuLivreur = getClientsParLivreur(livreur.id);
        return (
          <Card
            key={livreur.id}
            title={
              <div className="flex items-center gap-2">
                <Icon icon="lucide:truck" className="text-xl" />
                {livreur.nom}
              </div>
            }
            subtitle={`Clients assignés (${clientsDuLivreur.length}) ${livreur.vehicule ? `• Véhicule: ${livreur.vehicule}` : ''}`}
          >
            {clientsDuLivreur.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>Aucun client assigné à ce livreur</p>
                <p className="text-sm text-gray-400 mt-1">Assignez des clients depuis la section ci-dessus</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {clientsDuLivreur.map((client) => (
                  <div
                    key={client.id}
                    className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-gray-900">{client.nom}</h4>
                      <button
                        onClick={() => handleAssignerLivreur(client.id, '')}
                        className="text-red-500 hover:text-red-700 text-sm"
                        title="Désassigner"
                      >
                        ✕
                      </button>
                    </div>
                    <p className="text-sm text-gray-600">{client.adresse}</p>
                    {client.telephone && (
                      <p className="text-xs text-gray-500 mt-1">📞 {client.telephone}</p>
                    )}
                    <div className="mt-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        client.typeClient === 'client'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {client.typeClient === 'client' ? '🏠 Client' : '🏪 Boutique'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}

      {livreursActifs.length === 0 && (
        <Card title="Aucun livreur disponible">
          <div className="text-center py-8">
            <p className="text-gray-500">Aucun livreur actif trouvé</p>
            <p className="text-sm text-gray-400 mt-1">
              Allez dans "Gestion Livreurs" pour ajouter des livreurs
            </p>
          </div>
        </Card>
      )}
    </div>
  );
};