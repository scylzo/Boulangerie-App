import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Card } from '../ui/Card';
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
    eligibleRistourne: false,
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
        eligibleRistourne: client.eligibleRistourne || false,
        active: client.active
      });
    }
  }, [client]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onSave(formData);
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
          eligibleRistourne: false,
          active: true
        });
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
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
          placeholder="ex: Restaurant Central"
          required
        />

        <Input
          label="Adresse *"
          value={formData.adresse}
          onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
          placeholder="Adresse complète"
          required
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Téléphone"
            value={formData.telephone}
            onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
            placeholder="ex: +221 33 123 45 67"
          />

          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="ex: contact@restaurant.sn"
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

        <div className="flex items-center">
          <input
            id="active"
            type="checkbox"
            checked={formData.active}
            onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="active" className="ml-2 block text-sm text-gray-900">
            Client actif
          </label>
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