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
    adresse: '',
    telephone: '',
    email: '',
    typeClient: 'client' as 'client' | 'boutique',
    livreurId: '',
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
        adresse: client.adresse,
        telephone: client.telephone || '',
        email: client.email || '',
        typeClient: client.typeClient,
        livreurId: client.livreurId || '',
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
      await onSave({
        ...formData,
        modePaiementPreference: (formData.modePaiementPreference || undefined) as any,
        latitude: formData.latitude !== '' ? Number(formData.latitude) : undefined,
        longitude: formData.longitude !== '' ? Number(formData.longitude) : undefined,
      });

      // Reset form si c'est un ajout
      if (!client) {
        setFormData({
          nom: '',
          adresse: '',
          telephone: '',
          email: '',
          typeClient: 'client',
          livreurId: '',
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
        <Input
          label="Nom du client *"
          value={formData.nom}
          onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
          placeholder="ex: Boutique Chez Moussa"
          required
        />

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
        <p className="text-xs text-gray-500 -mt-3">
          Conditions spécifiques à ce client. Si vide, les conditions par défaut seront utilisées.
        </p>

        <div className="md:col-span-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Mode de paiement préféré
          </label>
          <select
            value={formData.modePaiementPreference}
            onChange={(e) => setFormData({ ...formData, modePaiementPreference: e.target.value as any })}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-orange-500 focus:ring-orange-500 focus:ring-1 sm:text-sm transition-colors bg-white"
          >
            <option value="">Non défini</option>
            <option value="espece">Espèces 💵</option>
            <option value="om">Orange Money 🟠</option>
            <option value="wave">Wave 🔵</option>
            <option value="cheque">Chèque 🏦</option>
            <option value="virement">Virement 💳</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Aide à distinguer les paiements (OM, Wave, etc.)
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type de client *
            </label>
            <select
              value={formData.typeClient}
              onChange={(e) => setFormData({ ...formData, typeClient: e.target.value as any })}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-orange-500 focus:ring-orange-500 focus:ring-1 sm:text-sm transition-colors bg-white"
              required
            >
              <option value="client">Client (prix réduit)</option>
              <option value="boutique">Boutique (prix normal)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
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
                    className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="eligibleRistourne" className="font-medium text-gray-700">
                    Éligible à la Ristourne (Cashback)
                  </label>
                  <p className="text-gray-500 text-xs">
                    Le client paie le prix boutique, mais cumule la différence avec le prix client.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div>
            <Select
              label="Livreur assigné"
              value={formData.livreurId}
              onChange={(e) => setFormData({ ...formData, livreurId: e.target.value })}
              options={[
                { value: '', label: 'Aucun livreur (à assigner plus tard)' },
                ...getLivreursActifs().map(livreur => ({
                  value: livreur.id,
                  label: `${livreur.nom} ${livreur.vehicule ? `(${livreur.vehicule})` : ''}`
                }))
              ]}
            />
            <p className="text-xs text-gray-500 mt-1">
              Livreur responsable des livraisons de ce client
            </p>
          </div>
        </div>

        {/* Section Géolocalisation */}
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-blue-800">
              <Icon icon="mdi:map-marker-radius" className="text-xl" />
              <span className="text-sm font-bold uppercase tracking-wider">Géolocalisation du Kiosque</span>
            </div>
            <button
              type="button"
              onClick={getGeolocation}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Icon icon="mdi:crosshairs-gps" />
              Ma position actuelle
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-blue-600 uppercase ml-1">Latitude</label>
              <Input
                type="number"
                step="any"
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                placeholder="ex: 14.7167"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-blue-600 uppercase ml-1">Longitude</label>
              <Input
                type="number"
                step="any"
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                placeholder="ex: -17.4677"
              />
            </div>
          </div>
          <p className="text-[10px] text-blue-500 italic">
            Note: La position actuelle est plus précise si vous êtes devant le kiosque avec votre téléphone.
          </p>
        </div>


        <div className="flex flex-wrap items-center gap-6 bg-gray-50 p-3 rounded-lg border border-gray-100">
          <div className="flex items-center">
            <input
              id="estRegulier"
              type="checkbox"
              checked={formData.estRegulier}
              onChange={(e) => setFormData({ ...formData, estRegulier: e.target.checked })}
              className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
            />
            <label htmlFor="estRegulier" className="ml-2 block text-sm font-medium text-gray-900 cursor-pointer">
              Client Régulier <span className="text-xs text-gray-500 font-normal">(Alerte si oublié)</span>
            </label>
          </div>

          <div className="flex items-center">
            <input
              id="aKiosque"
              type="checkbox"
              checked={formData.aKiosque}
              onChange={(e) => setFormData({ ...formData, aKiosque: e.target.checked })}
              className="h-5 w-5 text-orange-600 focus:ring-orange-500 border-gray-300 rounded cursor-pointer"
            />
            <label htmlFor="aKiosque" className="ml-2 block text-sm font-medium text-gray-900 cursor-pointer">
              A un kiosque
            </label>
          </div>

          <div className="flex items-center">
            <input
              id="neTravaillePasDimanche"
              type="checkbox"
              checked={formData.neTravaillePasDimanche}
              onChange={(e) => setFormData({ ...formData, neTravaillePasDimanche: e.target.checked })}
              className="h-5 w-5 text-red-600 focus:ring-red-500 border-gray-300 rounded cursor-pointer"
            />
            <label htmlFor="neTravaillePasDimanche" className="ml-2 block text-sm font-medium text-gray-900 cursor-pointer">
              Repos le Dimanche
            </label>
          </div>

          <div className="flex items-center">
            <input
              id="active"
              type="checkbox"
              checked={formData.active}
              onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
              className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
            />
            <label htmlFor="active" className="ml-2 block text-sm font-medium text-gray-900 cursor-pointer">
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