import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import type { Produit } from '../../types';

interface ProduitFormProps {
  produit?: Produit | null;
  onSave: (produit: Omit<Produit, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export const ProduitForm: React.FC<ProduitFormProps> = ({
  produit,
  onSave,
  onCancel,
  isLoading = false
}) => {
  const [formData, setFormData] = useState({
    nom: '',
    prixClient: 0,
    prixBoutique: 0,
    active: true
  });

  useEffect(() => {
    if (produit) {
      setFormData({
        nom: produit.nom,
        prixClient: produit.prixClient || 0,
        prixBoutique: produit.prixBoutique || 0,
        active: produit.active
      });
    }
  }, [produit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Ajouter description, unite et prixUnitaire pour respecter l'interface TypeScript
      const produitData = {
        ...formData,
        description: '',
        unite: 'piece' as const,
        prixUnitaire: formData.prixBoutique // Garder la compatibilité
      };
      await onSave(produitData);
      // Reset form si c'est un ajout
      if (!produit) {
        setFormData({
          nom: '',
          prixClient: 0,
          prixBoutique: 0,
          active: true
        });
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
    }
  };

  return (
    <Card
      title={produit ? 'Modifier le produit' : 'Ajouter un produit'}
      subtitle="Remplissez les informations du produit"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nom du produit *"
          value={formData.nom}
          onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
          placeholder="ex: Pain de campagne"
          required
        />



        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Prix client (FCFA) *"
            type="number"
            step="1"
            min="0"
            value={formData.prixClient}
            onChange={(e) => setFormData({ ...formData, prixClient: parseFloat(e.target.value) || 0 })}
            placeholder="0"
            required
          />

          <Input
            label="Prix boutique (FCFA) *"
            type="number"
            step="1"
            min="0"
            value={formData.prixBoutique}
            onChange={(e) => setFormData({ ...formData, prixBoutique: parseFloat(e.target.value) || 0 })}
            placeholder="0"
            required
          />
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
            Produit actif
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
            disabled={!formData.nom.trim() || formData.prixClient <= 0 || formData.prixBoutique <= 0}
          >
            {produit ? 'Modifier' : 'Ajouter'}
          </Button>
        </div>
      </form>
    </Card>
  );
};