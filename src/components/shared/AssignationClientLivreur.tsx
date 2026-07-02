import React, { useEffect } from 'react';
import { Icon } from '@iconify/react';
import { Card } from '../ui/Card';
import { Select } from '../ui/Select';

import { CardLoader } from '../ui/Loader';
import { useReferentielStore } from '../../store/referentielStore';
import { useLivreurStore } from '../../store/livreurStore';


export const AssignationClientLivreur: React.FC = () => {
  const { clients, chargerClients, modifierClient, isLoadingClients } = useReferentielStore();
  const { chargerLivreurs, getLivreursActifs, isLoadingLivreurs } = useLivreurStore();

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

  const handleAssignerLivreurParCar = async (
    clientId: string,
    carKey: 'default' | 'car1_matin' | 'car2_matin' | 'car_soir',
    livreurId: string
  ) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    try {
      if (carKey === 'default') {
        await modifierClient(clientId, { livreurId: livreurId || '' });
      } else {
        const newLivreursParCar = { ...(client.livreursParCar || {}) };
        if (livreurId) {
          newLivreursParCar[carKey] = livreurId;
        } else {
          delete newLivreursParCar[carKey];
        }
        
        // Nettoyer les valeurs vides
        const cleaned: any = {};
        if (newLivreursParCar.car1_matin) cleaned.car1_matin = newLivreursParCar.car1_matin;
        if (newLivreursParCar.car2_matin) cleaned.car2_matin = newLivreursParCar.car2_matin;
        if (newLivreursParCar.car_soir) cleaned.car_soir = newLivreursParCar.car_soir;
        
        await modifierClient(clientId, {
          livreursParCar: Object.keys(cleaned).length > 0 ? cleaned : null as any
        });
      }
    } catch (error) {
      console.error('Erreur lors de l\'assignation par car:', error);
    }
  };

  const handleUnassignLivreur = async (clientId: string, livreurId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    const modifications: any = {};
    if (client.livreurId === livreurId) {
      modifications.livreurId = '';
    }

    if (client.livreursParCar) {
      const newLivreursParCar = { ...client.livreursParCar };
      let hasChanges = false;
      if (newLivreursParCar.car1_matin === livreurId) {
        delete newLivreursParCar.car1_matin;
        hasChanges = true;
      }
      if (newLivreursParCar.car2_matin === livreurId) {
        delete newLivreursParCar.car2_matin;
        hasChanges = true;
      }
      if (newLivreursParCar.car_soir === livreurId) {
        delete newLivreursParCar.car_soir;
        hasChanges = true;
      }

      if (hasChanges) {
        const cleaned: any = {};
        if (newLivreursParCar.car1_matin) cleaned.car1_matin = newLivreursParCar.car1_matin;
        if (newLivreursParCar.car2_matin) cleaned.car2_matin = newLivreursParCar.car2_matin;
        if (newLivreursParCar.car_soir) cleaned.car_soir = newLivreursParCar.car_soir;
        modifications.livreursParCar = Object.keys(cleaned).length > 0 ? cleaned : null;
      }
    }

    try {
      await modifierClient(clientId, modifications);
    } catch (error) {
      console.error('Erreur lors de la désassignation:', error);
    }
  };

  const getClientsParLivreur = (livreurId: string) => {
    return clients.filter(client => {
      if (!client.active) return false;
      const estDefaut = client.livreurId === livreurId;
      const estCar1 = client.livreursParCar?.car1_matin === livreurId;
      const estCar2 = client.livreursParCar?.car2_matin === livreurId;
      const estSoir = client.livreursParCar?.car_soir === livreurId;
      return estDefaut || estCar1 || estCar2 || estSoir;
    });
  };

  const getClientsSansLivreur = () => {
    return clients.filter(client => {
      if (!client.active) return false;
      const aLivreurDefaut = !!client.livreurId;
      const aLivreurCar1 = !!client.livreursParCar?.car1_matin;
      const aLivreurCar2 = !!client.livreursParCar?.car2_matin;
      const aLivreurCarSoir = !!client.livreursParCar?.car_soir;
      return !aLivreurDefaut && !aLivreurCar1 && !aLivreurCar2 && !aLivreurCarSoir;
    });
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
          <div className="text-center py-8 text-sand-500">
            <p>Tous les clients actifs ont un livreur assigné</p>
            <p className="text-sm text-sand-400 mt-1">👏 Excellent ! Toutes les assignations sont complètes</p>
          </div>
        ) : (
          <div className="space-y-3">
            {getClientsSansLivreur().map((client) => (
              <div
                key={client.id}
                className="flex items-center justify-between p-4 border border-warning-100 rounded-lg bg-warning-50"
              >
                <div className="flex-1">
                  <h4 className="font-medium text-sand-900">{client.nom}</h4>
                  <p className="text-sm text-sand-600">{client.adresse}</p>
                  {client.telephone && (
                    <p className="text-xs text-sand-500">📞 {client.telephone}</p>
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
              <div className="text-center py-8 text-sand-500">
                <p>Aucun client assigné à ce livreur</p>
                <p className="text-sm text-sand-400 mt-1">Assignez des clients depuis la section ci-dessus</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {clientsDuLivreur.map((client) => (
                  <div
                    key={client.id}
                    className="p-4 border border-sand-200 rounded-lg hover:border-info-100 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-sand-900">{client.nom}</h4>
                      <button
                        onClick={() => handleUnassignLivreur(client.id, livreur.id)}
                        className="text-danger-500 hover:text-danger-700 text-sm font-semibold p-1 hover:bg-danger-50 rounded"
                        title="Désassigner de ce livreur"
                      >
                        ✕
                      </button>
                    </div>
                    <p className="text-sm text-sand-600">{client.adresse}</p>
                    {client.telephone && (
                      <p className="text-xs text-sand-500 mt-1">📞 {client.telephone}</p>
                    )}
                    
                    <div className="flex flex-wrap gap-1 mt-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        client.typeClient === 'client'
                          ? 'bg-info-100 text-info-600'
                          : 'bg-success-100 text-success-700'
                      }`}>
                        {client.typeClient === 'client' ? '🏠 Client' : '🏪 Boutique'}
                      </span>
                      {client.livreurId === livreur.id && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-terracotta-100 text-terracotta-800">
                          Général
                        </span>
                      )}
                      {client.livreursParCar?.car1_matin === livreur.id && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-warning-100 text-warning-600">
                          Car 1 Matin
                        </span>
                      )}
                      {client.livreursParCar?.car2_matin === livreur.id && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-warning-100 text-warning-600">
                          Car 2 Matin
                        </span>
                      )}
                      {client.livreursParCar?.car_soir === livreur.id && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-terracotta-100 text-terracotta-800">
                          Car Soir
                        </span>
                      )}
                    </div>

                    <details className="mt-3 text-xs border-t border-sand-100 pt-2 group">
                      <summary className="cursor-pointer text-sand-500 hover:text-sand-700 font-medium flex items-center gap-1 select-none">
                        <span>Configuration par car</span>
                        <Icon icon="lucide:chevron-down" className="w-3 h-3 transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="mt-2 space-y-2 bg-sand-50 p-2 rounded border border-sand-100">
                        <div>
                          <label className="block text-[10px] text-sand-500 font-medium mb-0.5">Par défaut (Général)</label>
                          <select
                            value={client.livreurId || ''}
                            onChange={(e) => handleAssignerLivreurParCar(client.id, 'default', e.target.value)}
                            className="w-full text-xs p-1 border border-sand-200 rounded bg-white"
                          >
                            <option value="">Aucun livreur par défaut</option>
                            {livreursActifs.map(l => (
                              <option key={l.id} value={l.id}>{l.nom}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] text-sand-500 font-medium mb-0.5">Car 1 - Matin</label>
                          <select
                            value={client.livreursParCar?.car1_matin || ''}
                            onChange={(e) => handleAssignerLivreurParCar(client.id, 'car1_matin', e.target.value)}
                            className="w-full text-xs p-1 border border-sand-200 rounded bg-white"
                          >
                            <option value="">Utiliser le livreur par défaut</option>
                            {livreursActifs.map(l => (
                              <option key={l.id} value={l.id}>{l.nom}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] text-sand-500 font-medium mb-0.5">Car 2 - Matin</label>
                          <select
                            value={client.livreursParCar?.car2_matin || ''}
                            onChange={(e) => handleAssignerLivreurParCar(client.id, 'car2_matin', e.target.value)}
                            className="w-full text-xs p-1 border border-sand-200 rounded bg-white"
                          >
                            <option value="">Utiliser le livreur par défaut</option>
                            {livreursActifs.map(l => (
                              <option key={l.id} value={l.id}>{l.nom}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] text-sand-500 font-medium mb-0.5">Car - Soir</label>
                          <select
                            value={client.livreursParCar?.car_soir || ''}
                            onChange={(e) => handleAssignerLivreurParCar(client.id, 'car_soir', e.target.value)}
                            className="w-full text-xs p-1 border border-sand-200 rounded bg-white"
                          >
                            <option value="">Utiliser le livreur par défaut</option>
                            {livreursActifs.map(l => (
                              <option key={l.id} value={l.id}>{l.nom}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </details>
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
            <p className="text-sand-500">Aucun livreur actif trouvé</p>
            <p className="text-sm text-sand-400 mt-1">
              Allez dans "Gestion Livreurs" pour ajouter des livreurs
            </p>
          </div>
        </Card>
      )}
    </div>
  );
};