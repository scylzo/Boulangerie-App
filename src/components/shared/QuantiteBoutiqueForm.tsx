import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Card } from '../ui/Card';
import type { Produit, QuantiteBoutique } from '../../types';

interface QuantiteBoutiqueFormProps {
  produits: Produit[];
  quantitesActuelles: QuantiteBoutique[];
  onSave: (quantite: QuantiteBoutique) => void;
  onCancel: () => void;
}

export const QuantiteBoutiqueForm: React.FC<QuantiteBoutiqueFormProps> = ({
  produits,
  quantitesActuelles,
  onSave,
  onCancel
}) => {
  const [selectedProduitId, setSelectedProduitId] = useState('');
  const [quantite, setQuantite] = useState<number>(0);

  // Exclure les produits déjà ajoutés
  const produitsDisponibles = produits.filter(p =>
    !quantitesActuelles.some(q => q.produitId === p.id)
  );

  const produitsOptions = [
    { value: '', label: 'Sélectionnez un produit' },
    ...produitsDisponibles.map(produit => ({
      value: produit.id,
      label: produit.nom
    }))
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProduitId || quantite <= 0) {
      alert('Veuillez sélectionner un produit et saisir une quantité valide');
      return;
    }

    const produit = produits.find(p => p.id === selectedProduitId);

    if (produit) {
      onSave({
        produitId: selectedProduitId,
        produit,
        quantite
      });

      // Reset form
      setSelectedProduitId('');
      setQuantite(0);
    }
  };

  if (produitsDisponibles.length === 0) {
    return (
      <Card title="Ajouter quantité boutique">
        <div className="text-center py-8">
          <p className="text-gray-500">Tous les produits ont déjà été ajoutés</p>
          <Button variant="outline" onClick={onCancel} className="mt-4">
            Fermer
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card
      title="Ajouter quantité boutique"
      subtitle="Définissez les quantités à envoyer en boutique"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Produit *"
            value={selectedProduitId}
            onChange={(e) => setSelectedProduitId(e.target.value)}
            options={produitsOptions}
            required
          />

          <Input
            label="Quantité *"
            type="number"
            min="1"
            value={quantite || ''}
            onChange={(e) => setQuantite(parseInt(e.target.value) || 0)}
            placeholder="Quantité pour la boutique"
            required
          />
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
          >
            Annuler
          </Button>
          <Button
            type="submit"
            disabled={!selectedProduitId || quantite <= 0}
          >
            Ajouter
          </Button>
        </div>
      </form>
    </Card>
  );
};