import React, { useState, useEffect } from 'react';
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
  produits,
  commande,
  produitIndex,
  client,
  onSave,
  onCancel,
  isLoading = false
}) => {
  const produitOriginal = commande.produits[produitIndex];
  const produitRef = produits.find(p => p.id === produitOriginal.produitId);

  // États du formulaire
  const [quantiteCommandee, setQuantiteCommandee] = useState(produitOriginal.quantiteCommandee);
  const [prixUnitaire, setPrixUnitaire] = useState(produitOriginal.prixUnitaire || 0);
  const [repartitionCars, setRepartitionCars] = useState({
    car1_matin: produitOriginal.repartitionCars?.car1_matin || 0,
    car2_matin: produitOriginal.repartitionCars?.car2_matin || 0,
    car_soir: produitOriginal.repartitionCars?.car_soir || 0
  });

  // Calculer le total des répartitions
  const totalRepartition = Number(repartitionCars.car1_matin) + Number(repartitionCars.car2_matin) + Number(repartitionCars.car_soir);

  // Validation
  const isValid = quantiteCommandee > 0 && prixUnitaire > 0 && totalRepartition === quantiteCommandee;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValid) return;

    const produitModifie = {
      produitId: produitOriginal.produitId,
      quantiteCommandee,
      prixUnitaire,
      repartitionCars: {
        car1_matin: Number(repartitionCars.car1_matin),
        car2_matin: Number(repartitionCars.car2_matin),
        car_soir: Number(repartitionCars.car_soir)
      }
    };

    onSave(produitModifie);
  };

  const modifierRepartition = (car: keyof typeof repartitionCars, value: string) => {
    setRepartitionCars(prev => ({
      ...prev,
      [car]: value === '' ? 0 : Number(value)
    }));
  };

  // Fonction pour obtenir l'icône du produit
  const getProductIcon = (productName: string): string => {
    const name = productName?.toLowerCase() || '';
    if (name.includes('baguette')) return 'mdi:baguette';
    if (name.includes('pain')) return 'mdi:bread-slice';
    if (name.includes('croissant')) return 'mdi:croissant';
    if (name.includes('brioche')) return 'mdi:muffin';
    if (name.includes('tarte')) return 'mdi:pie';
    if (name.includes('gateau') || name.includes('gâteau')) return 'mdi:cake';
    if (name.includes('sandwich')) return 'mdi:food';
    if (name.includes('viennoiserie')) return 'mdi:pretzel';
    return 'mdi:food-variant';
  };

  return (
    <div className="space-y-6">
      {/* Information sur le client et la commande */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <Icon icon="mdi:account" className="text-xl text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{client.nom}</h3>
            <p className="text-sm text-gray-600">{client.adresse}</p>
          </div>
        </div>
        <div className="text-sm text-gray-600">
          Date de livraison: {new Date(commande.dateLivraison).toLocaleDateString('fr-FR')}
        </div>
      </div>

      {/* Information du produit en cours d'édition */}
      <div className="bg-amber-50 rounded-lg border border-amber-200 p-4">
        <h4 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
          <Icon icon="mdi:pencil-outline" />
          Modification du produit
        </h4>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-orange-600 rounded-lg flex items-center justify-center">
            <Icon
              icon={getProductIcon(produitRef?.nom || '')}
              className="text-xl text-white"
            />
          </div>
          <div>
            <h5 className="font-semibold text-gray-900">{produitRef?.nom || 'Produit inconnu'}</h5>
            <p className="text-sm text-gray-600">{produitRef?.description}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Quantité et prix */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Quantité commandée *"
            type="number"
            min="1"
            value={quantiteCommandee}
            onChange={(e) => setQuantiteCommandee(Number(e.target.value))}
            required
          />
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
              <span className="text-sm font-medium text-gray-700">Total réparti:</span>
              <span className={`text-sm font-bold ${totalRepartition === quantiteCommandee ? 'text-green-600' : 'text-red-600'}`}>
                {totalRepartition}
              </span>
              <span className="text-sm text-gray-500">/ {quantiteCommandee}</span>
            </div>
            {totalRepartition !== quantiteCommandee && (
              <div className="flex items-center gap-1 text-red-600">
                <Icon icon="mdi:alert-circle" className="text-sm" />
                <span className="text-xs">La répartition doit égaler la quantité commandée</span>
              </div>
            )}
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
              loading={isLoading}
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