import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import type { Produit, Client, CommandeClient } from '../../types';

interface ModifierProduitFormProps {
  produits: Produit[];
  commande: CommandeClient;
  produitIndex: number;
  client: Client;
  onSave: (produitModifie: any) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const ModifierProduitForm: React.FC<ModifierProduitFormProps> = ({
  commande,
  produitIndex,

  onSave,
  onCancel,
  isLoading = false
}) => {
  const produitOriginal = commande.produits[produitIndex];


  // États du formulaire
  const [prixUnitaire, setPrixUnitaire] = useState(produitOriginal.prixUnitaire || 0);
  const [repartitionCars, setRepartitionCars] = useState({
    car1_matin: produitOriginal.repartitionCars?.car1_matin || '',
    car2_matin: produitOriginal.repartitionCars?.car2_matin || '',
    car_soir: produitOriginal.repartitionCars?.car_soir || ''
  });

  // Calculer le total des répartitions (Quantité Commandée)
  const quantiteCommandee = (Number(repartitionCars.car1_matin) || 0) + 
                           (Number(repartitionCars.car2_matin) || 0) + 
                           (Number(repartitionCars.car_soir) || 0);

  // Validation
  const isValid = quantiteCommandee > 0 && prixUnitaire >= 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValid) return;

    const produitModifie = {
      produitId: produitOriginal.produitId,
      quantiteCommandee,
      prixUnitaire,
      repartitionCars: {
        car1_matin: Number(repartitionCars.car1_matin) || 0,
        car2_matin: Number(repartitionCars.car2_matin) || 0,
        car_soir: Number(repartitionCars.car_soir) || 0
      }
    };

    onSave(produitModifie);
  };

  const modifierRepartition = (car: keyof typeof repartitionCars, value: string) => {
    // Permettre la saisie vide pour éviter le "0" bloquant
    setRepartitionCars(prev => ({
      ...prev,
      [car]: value
    }));
  };

  // ... (getProductIcon function remains same)

  return (
    <div className="space-y-6">
      {/* ... (Header info remains same) */}
      
      {/* ... (Product info remains same) */}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Quantité et prix */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantité totale (Calculée)
            </label>
            <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-500 font-medium select-none">
              {quantiteCommandee}
            </div>
          </div>
          <Input
            label="Prix unitaire (F CFA) *"
            type="number"
            min="0"
            value={prixUnitaire}
            onChange={(e) => setPrixUnitaire(Number(e.target.value))}
            required
          />
        </div>

        {/* Répartition par cars */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Icon icon="mdi:truck-delivery" className="text-lg text-gray-600" />
            <h4 className="text-lg font-semibold text-gray-900">Répartition par car de livraison</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Input
              label="Car 1 - Matin"
              type="number"
              min="0"
              value={repartitionCars.car1_matin}
              onChange={(e) => modifierRepartition('car1_matin', e.target.value)}
            />
            <Input
              label="Car 2 - Matin"
              type="number"
              min="0"
              value={repartitionCars.car2_matin}
              onChange={(e) => modifierRepartition('car2_matin', e.target.value)}
            />
            <Input
              label="Car - Soir"
              type="number"
              min="0"
              value={repartitionCars.car_soir}
              onChange={(e) => modifierRepartition('car_soir', e.target.value)}
            />
          </div>

          {/* Validation des répartitions */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Total distribué:</span>
              <span className="text-sm font-bold text-green-600">
                {quantiteCommandee}
              </span>
            </div>
            <div className="text-xs text-gray-500">
                La quantité totale est mise à jour automatiquement.
            </div>
          </div>
        </Card>

        {/* Total et actions */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="text-lg font-semibold text-gray-900">
            Total: {(quantiteCommandee * prixUnitaire).toLocaleString('fr-FR')} F CFA
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
            >
              <Icon icon="mdi:close" className="text-lg mr-2" />
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={!isValid || isLoading}
              isLoading={isLoading}
            >
              <Icon icon="mdi:content-save" className="text-lg mr-2" />
              Modifier le produit
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};