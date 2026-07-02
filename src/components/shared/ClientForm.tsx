import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Card } from '../ui/Card';
import { Icon } from '@iconify/react';
import { useLivreurStore } from '../../store/livreurStore';

import type { Client } from '../../types';

interface ClientFormProps {
  client?: Client | null;
  onSave: (client: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export const ClientForm: React.FC<ClientFormProps> = ({
  client,
  onSave,
  onCancel,
  isLoading = false
}) => {
  const { chargerLivreurs, getLivreursActifs } = useLivreurStore();

  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    adresse: '',
    telephone: '',
    email: '',
    typeClient: 'client' as 'client' | 'boutique',
    livreurId: '',
    livreursParCar: {
      car1_matin: '',
      car2_matin: '',
      car_soir: ''
    },
    conditionsPaiement: '',
    modePaiementPreference: '' as 'espece' | 'om' | 'wave' | 'cheque' | 'virement' | '',
    eligibleRistourne: false,
    aKiosque: false,
    estRegulier: false,
    neTravaillePasDimanche: false,
    latitude: '' as string | number,
    longitude: '' as string | number,
    active: true
  });


  useEffect(() => {
    chargerLivreurs().catch(console.error);
  }, [chargerLivreurs]);

  useEffect(() => {
    if (client) {
      setFormData({
        nom: client.nom,
        prenom: client.prenom || '',
        adresse: client.adresse,
        telephone: client.telephone || '',
        email: client.email || '',
        typeClient: client.typeClient,
        livreurId: client.livreurId || '',
        livreursParCar: {
          car1_matin: client.livreursParCar?.car1_matin || '',
          car2_matin: client.livreursParCar?.car2_matin || '',
          car_soir: client.livreursParCar?.car_soir || ''
        },
        conditionsPaiement: client.conditionsPaiement || '',
        modePaiementPreference: client.modePaiementPreference || '',
        eligibleRistourne: client.eligibleRistourne || false,
        aKiosque: client.aKiosque || false,
        estRegulier: client.estRegulier || false,
        neTravaillePasDimanche: client.neTravaillePasDimanche || false,
        latitude: client.latitude ?? '',
        longitude: client.longitude ?? '',
        active: client.active
      });

    }
  }, [client]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { latitude, longitude, ...rest } = formData;

      const clientData: any = {
        ...rest,
        modePaiementPreference: (formData.modePaiementPreference || (null as any)),
        latitude: (formData.latitude !== '' && !isNaN(Number(formData.latitude))) ? Number(formData.latitude) : (null as any),
        longitude: (formData.longitude !== '' && !isNaN(Number(formData.longitude))) ? Number(formData.longitude) : (null as any),
      };

      if (clientData.livreursParCar) {
        const cleaned: any = {};
        if (clientData.livreursParCar.car1_matin) cleaned.car1_matin = clientData.livreursParCar.car1_matin;
        if (clientData.livreursParCar.car2_matin) cleaned.car2_matin = clientData.livreursParCar.car2_matin;
        if (clientData.livreursParCar.car_soir) cleaned.car_soir = clientData.livreursParCar.car_soir;
        clientData.livreursParCar = cleaned;
      }

      // Supprimer les champs nuls pour Firestore
      Object.keys(clientData).forEach(key => {
        if (clientData[key] === null) {
          delete clientData[key];
        }
      });

      await onSave(clientData);

      // Reset form si c'est un ajout
      if (!client) {
        setFormData({
          nom: '',
          prenom: '',
          adresse: '',
          telephone: '',
          email: '',
          typeClient: 'client',
          livreurId: '',
          livreursParCar: {
            car1_matin: '',
            car2_matin: '',
            car_soir: ''
          },
          conditionsPaiement: '',
          modePaiementPreference: '',
          eligibleRistourne: false,
          aKiosque: false,
          estRegulier: false,
          neTravaillePasDimanche: false,
          latitude: '',
          longitude: '',
          active: true
        });
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      alert('Une erreur est survenue lors de la sauvegarde du client.');
    }
  };

  const getGeolocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData({
            ...formData,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => {
          console.error("Erreur de géolocalisation:", error);
          alert("Impossible de récupérer votre position. Veuillez vérifier les autorisations de votre navigateur.");
        }
      );
    } else {
      alert("La géolocalisation n'est pas supportée par votre navigateur.");
    }
  };


  return (
    <Card
      title={client ? 'Modifier le client' : 'Ajouter un client'}
      subtitle="Remplissez les informations du client"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Prénom"
            value={formData.prenom}
            onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
            placeholder="ex: Moussa"
          />
          <Input
            label="Nom du client / Boutique *"
            value={formData.nom}
            onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
            placeholder="ex: Diop / Boutique Chez Moussa"
            required
          />
        </div>

        <Input
          label="Adresse *"
          value={formData.adresse}
          onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
          placeholder="ex: HLM Grand Yoff, Villa 124"
          required
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Téléphone"
            value={formData.telephone}
            onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
            placeholder="ex: 77 123 45 67"
          />

          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="ex: contact@chezmoussa.sn"
          />
        </div>

        <Input
          label="Conditions de paiement"
          value={formData.conditionsPaiement}
          onChange={(e) => setFormData({ ...formData, conditionsPaiement: e.target.value })}
          placeholder="ex: Payable à 15 jours, Comptant, Fin de mois"
        />
        <p className="text-xs text-sand-500 -mt-3">
          Conditions spécifiques à ce client. Si vide, les conditions par défaut seront utilisées.
        </p>

        <div className="md:col-span-1">
          <label className="block text-sm font-medium text-sand-700 mb-1">
            Mode de paiement préféré
          </label>
          <select
            value={formData.modePaiementPreference}
            onChange={(e) => setFormData({ ...formData, modePaiementPreference: e.target.value as any })}
            className="block w-full rounded-lg border border-sand-300 px-3 py-2 focus:border-warning-500 focus:ring-warning-500 focus:ring-1 sm:text-sm transition-colors bg-white"
          >
            <option value="">Non défini</option>
            <option value="espece">Espèces 💵</option>
            <option value="om">Orange Money 🟠</option>
            <option value="wave">Wave 🔵</option>
            <option value="cheque">Chèque 🏦</option>
            <option value="virement">Virement 💳</option>
          </select>
          <p className="text-xs text-sand-500 mt-1">
            Aide à distinguer les paiements (OM, Wave, etc.)
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-sand-700 mb-1">
              Type de client *
            </label>
            <select
              value={formData.typeClient}
              onChange={(e) => setFormData({ ...formData, typeClient: e.target.value as any })}
              className="block w-full rounded-lg border border-sand-300 px-3 py-2 focus:border-warning-500 focus:ring-warning-500 focus:ring-1 sm:text-sm transition-colors bg-white"
              required
            >
              <option value="client">Client (prix réduit)</option>
              <option value="boutique">Boutique (prix normal)</option>
            </select>
            <p className="text-xs text-sand-500 mt-1">
              Définit le type de tarification
            </p>

            {formData.typeClient === 'boutique' && (
              <div className="mt-3 flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="eligibleRistourne"
                    type="checkbox"
                    checked={formData.eligibleRistourne}
                    onChange={(e) => setFormData({ ...formData, eligibleRistourne: e.target.checked })}
                    className="h-4 w-4 text-warning-600 focus:ring-warning-500 border-sand-300 rounded"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="eligibleRistourne" className="font-medium text-sand-700">
                    Éligible à la Ristourne (Cashback)
                  </label>
                  <p className="text-sand-500 text-xs">
                    Le client paie le prix boutique, mais cumule la différence avec le prix client.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="md:col-span-2 bg-sand-50/50 p-4 rounded-xl border border-sand-200/80 space-y-4">
            <div className="flex items-center gap-2 text-sand-800 font-semibold text-sm">
              <Icon icon="mdi:truck-delivery" className="text-lg text-info-600" />
              <span>Assignation des Livreurs</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Select
                  label="Livreur par défaut"
                  value={formData.livreurId}
                  onChange={(e) => setFormData({ ...formData, livreurId: e.target.value })}
                  options={[
                    { value: '', label: 'Aucun livreur par défaut' },
                    ...getLivreursActifs().map(livreur => ({
                      value: livreur.id,
                      label: `${livreur.nom} ${livreur.vehicule ? `(${livreur.vehicule})` : ''}`
                    }))
                  ]}
                />
                <p className="text-[10px] text-sand-500 mt-1">
                  Livreur utilisé si aucun n'est spécifié pour un car
                </p>
              </div>

              <div>
                <Select
                  label="Car 1 - Matin"
                  value={formData.livreursParCar?.car1_matin || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    livreursParCar: {
                      ...formData.livreursParCar,
                      car1_matin: e.target.value
                    }
                  })}
                  options={[
                    { value: '', label: 'Utiliser le livreur par défaut' },
                    ...getLivreursActifs().map(livreur => ({
                      value: livreur.id,
                      label: `${livreur.nom} ${livreur.vehicule ? `(${livreur.vehicule})` : ''}`
                    }))
                  ]}
                />
              </div>

              <div>
                <Select
                  label="Car 2 - Matin"
                  value={formData.livreursParCar?.car2_matin || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    livreursParCar: {
                      ...formData.livreursParCar,
                      car2_matin: e.target.value
                    }
                  })}
                  options={[
                    { value: '', label: 'Utiliser le livreur par défaut' },
                    ...getLivreursActifs().map(livreur => ({
                      value: livreur.id,
                      label: `${livreur.nom} ${livreur.vehicule ? `(${livreur.vehicule})` : ''}`
                    }))
                  ]}
                />
              </div>

              <div>
                <Select
                  label="Car - Soir"
                  value={formData.livreursParCar?.car_soir || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    livreursParCar: {
                      ...formData.livreursParCar,
                      car_soir: e.target.value
                    }
                  })}
                  options={[
                    { value: '', label: 'Utiliser le livreur par défaut' },
                    ...getLivreursActifs().map(livreur => ({
                      value: livreur.id,
                      label: `${livreur.nom} ${livreur.vehicule ? `(${livreur.vehicule})` : ''}`
                    }))
                  ]}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section Géolocalisation */}
        <div className="bg-info-50 p-4 rounded-xl border border-info-100 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-info-600">
              <Icon icon="mdi:map-marker-radius" className="text-xl shrink-0" />
              <span className="text-sm font-bold uppercase tracking-wider leading-tight">Géolocalisation du Kiosque</span>
            </div>
            <button
              type="button"
              onClick={getGeolocation}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-info-600 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-info-600 transition-all shadow-md active:scale-95 w-full sm:w-auto"
            >
              <Icon icon="mdi:crosshairs-gps" className="text-lg" />
              Ma position actuelle
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-info-600 uppercase ml-1">Latitude</label>
              <Input
                type="number"
                step="any"
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                placeholder="ex: 14.7167"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-info-600 uppercase ml-1">Longitude</label>
              <Input
                type="number"
                step="any"
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                placeholder="ex: -17.4677"
              />
            </div>
          </div>
          <p className="text-[10px] text-info-500 italic">
            Note: La position actuelle est plus précise si vous êtes devant le kiosque avec votre téléphone.
          </p>
        </div>


        <div className="flex flex-wrap items-center gap-6 bg-sand-50 p-3 rounded-lg border border-sand-100">
          <div className="flex items-center">
            <input
              id="estRegulier"
              type="checkbox"
              checked={formData.estRegulier}
              onChange={(e) => setFormData({ ...formData, estRegulier: e.target.checked })}
              className="h-5 w-5 text-terracotta-600 focus:ring-terracotta-500 border-sand-300 rounded cursor-pointer"
            />
            <label htmlFor="estRegulier" className="ml-2 block text-sm font-medium text-sand-900 cursor-pointer">
              Client Régulier <span className="text-xs text-sand-500 font-normal">(Alerte si oublié)</span>
            </label>
          </div>

          <div className="flex items-center">
            <input
              id="aKiosque"
              type="checkbox"
              checked={formData.aKiosque}
              onChange={(e) => setFormData({ ...formData, aKiosque: e.target.checked })}
              className="h-5 w-5 text-warning-600 focus:ring-warning-500 border-sand-300 rounded cursor-pointer"
            />
            <label htmlFor="aKiosque" className="ml-2 block text-sm font-medium text-sand-900 cursor-pointer">
              A un kiosque
            </label>
          </div>

          <div className="flex items-center">
            <input
              id="neTravaillePasDimanche"
              type="checkbox"
              checked={formData.neTravaillePasDimanche}
              onChange={(e) => setFormData({ ...formData, neTravaillePasDimanche: e.target.checked })}
              className="h-5 w-5 text-danger-600 focus:ring-danger-500 border-sand-300 rounded cursor-pointer"
            />
            <label htmlFor="neTravaillePasDimanche" className="ml-2 block text-sm font-medium text-sand-900 cursor-pointer">
              Repos le Dimanche
            </label>
          </div>

          <div className="flex items-center">
            <input
              id="active"
              type="checkbox"
              checked={formData.active}
              onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
              className="h-5 w-5 text-info-600 focus:ring-info-500 border-sand-300 rounded cursor-pointer"
            />
            <label htmlFor="active" className="ml-2 block text-sm font-medium text-sand-900 cursor-pointer">
              Client actif
            </label>
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
          >
            Annuler
          </Button>
          <Button
            type="submit"
            isLoading={isLoading}
            disabled={!formData.nom.trim() || !formData.adresse.trim()}
          >
            {client ? 'Modifier' : 'Ajouter'}
          </Button>
        </div>
      </form>
    </Card>
  );
};