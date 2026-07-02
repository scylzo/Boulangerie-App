import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import type { Livreur } from '../../types';

interface LivreurFormProps {
  livreur?: Livreur | null;
  onSave: (livreur: Omit<Livreur, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export const LivreurForm: React.FC<LivreurFormProps> = ({
  livreur,
  onSave,
  onCancel,
  isLoading = false
}) => {
  const [formData, setFormData] = useState({
    nom: '',
    telephone: '',
    vehicule: '',
    active: true
  });

  useEffect(() => {
    if (livreur) {
      setFormData({
        nom: livreur.nom,
        telephone: livreur.telephone || '',
        vehicule: livreur.vehicule || '',
        active: livreur.active
      });
    }
  }, [livreur]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onSave(formData);
      // Reset form si c'est un ajout
      if (!livreur) {
        setFormData({
          nom: '',
          telephone: '',
          vehicule: '',
          active: true
        });
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
    }
  };

  return (
    <Card
      title={livreur ? 'Modifier le livreur' : 'Ajouter un livreur'}
      subtitle="Remplissez les informations du livreur"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nom du livreur *"
          value={formData.nom}
          onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
          placeholder="ex: Modou Fall"
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
            label="Véhicule / Plaque"
            value={formData.vehicule}
            onChange={(e) => setFormData({ ...formData, vehicule: e.target.value })}
            placeholder="ex: Tricycle - DK 1234 A"
          />
        </div>

        <div className="flex items-center">
          <input
            id="active"
            type="checkbox"
            checked={formData.active}
            onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
            className="h-4 w-4 text-info-600 focus:ring-info-500 border-sand-300 rounded"
          />
          <label htmlFor="active" className="ml-2 block text-sm text-sand-900">
            Livreur actif
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
            disabled={!formData.nom.trim()}
          >
            {livreur ? 'Modifier' : 'Ajouter'}
          </Button>
        </div>
      </form>
    </Card>
  );
};