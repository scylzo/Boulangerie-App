import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Card } from '../ui/Card';
import type { Produit, QuantiteBoutique } from '../../types';

interface QuantiteBoutiqueFormProps {
  produits: Produit[];
  quantitesActuelles: QuantiteBoutique[];
  quantiteEnEdition?: QuantiteBoutique | null;
  onSave: (quantite: QuantiteBoutique) => void;
  onCancel: () => void;
}

export const QuantiteBoutiqueForm: React.FC<QuantiteBoutiqueFormProps> = ({
  produits,
  quantitesActuelles,
  quantiteEnEdition,
  onSave,
  onCancel
}) => {
  const [selectedProduitId, setSelectedProduitId] = useState('');
  const [car1Matin, setCar1Matin] = useState<number>(0);
  const [car2Matin, setCar2Matin] = useState<number>(0);
  const [carSoir, setCarSoir] = useState<number>(0);

  // Pré-remplir les champs quand on est en mode édition
  useEffect(() => {
    if (quantiteEnEdition) {
      setSelectedProduitId(quantiteEnEdition.produitId);

      // Toujours chercher la donnée la plus fraîche dans quantitesActuelles
      const quantiteFraiche = quantitesActuelles.find(q => q.produitId === quantiteEnEdition.produitId);
      const quantiteAUtiliser = quantiteFraiche || quantiteEnEdition;

      // Forcer la mise à jour avec les données fraîches
      if (quantiteAUtiliser.repartitionCars) {
        setCar1Matin(quantiteAUtiliser.repartitionCars.car1_matin || 0);
        setCar2Matin(quantiteAUtiliser.repartitionCars.car2_matin || 0);
        setCarSoir(quantiteAUtiliser.repartitionCars.car_soir || 0);
      } else {
        // Si pas de répartition définie, utiliser la répartition par défaut
        const quantiteTotal = quantiteAUtiliser.quantite;
        setCar1Matin(Math.ceil(quantiteTotal * 0.35));
        setCar2Matin(Math.ceil(quantiteTotal * 0.35));
        setCarSoir(quantiteTotal - Math.ceil(quantiteTotal * 0.35) - Math.ceil(quantiteTotal * 0.35));
      }

      // Log pour debug : vérifier que les bonnes données sont utilisées
      console.log('🔄 Mise à jour des champs avec données:', quantiteAUtiliser);
    } else {
      // Mode création : vider les champs
      setSelectedProduitId('');
      setCar1Matin(0);
      setCar2Matin(0);
      setCarSoir(0);
    }
  }, [quantiteEnEdition, quantitesActuelles]);

  // Exclure les produits déjà ajoutés, sauf celui en cours d'édition
  const produitsDisponibles = produits.filter(p =>
    !quantitesActuelles.some(q => q.produitId === p.id) ||
    (quantiteEnEdition && p.id === quantiteEnEdition.produitId)
  );

  const produitsOptions = [
    { value: '', label: 'Sélectionnez un produit' },
    ...produitsDisponibles.map(produit => ({
      value: produit.id,
      label: produit.nom
    }))
  ];

  // Calculer automatiquement la quantité totale à partir de la répartition
  const quantiteTotale = car1Matin + car2Matin + carSoir;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProduitId) {
      alert('Veuillez sélectionner un produit');
      return;
    }

    // Permettre l'ajout même avec quantité 0 pour planification
    // if (quantiteTotale <= 0) {
    //   alert('Veuillez saisir au moins une quantité dans un des cars');
    //   return;
    // }

    const produit = produits.find(p => p.id === selectedProduitId);

    if (produit) {
      const nouvelleQuantite = {
        produitId: selectedProduitId,
        produit,
        quantite: quantiteTotale, // Utiliser la quantité calculée
        repartitionCars: {
          car1_matin: car1Matin,
          car2_matin: car2Matin,
          car_soir: carSoir
        }
      };

      console.log('💾 Sauvegarde quantité boutique:', nouvelleQuantite);
      onSave(nouvelleQuantite);

      // Reset form
      setSelectedProduitId('');
      setCar1Matin(0);
      setCar2Matin(0);
      setCarSoir(0);
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
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Produit *"
            value={selectedProduitId}
            onChange={(e) => setSelectedProduitId(e.target.value)}
            options={produitsOptions}
            required
          />

          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700 mb-2">Quantité Totale (Calculée)</label>
            <div className="px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-green-600">{quantiteTotale}</span>
                <span className="text-sm text-gray-500">pièces</span>
                {quantiteTotale === 0 && (
                  <span className="text-xs text-gray-400 ml-2">→ Saisissez les répartitions ci-dessous</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Section Répartition par Cars */}
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Icon icon="mdi:truck-delivery" className="text-lg text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Répartition par Cars</h3>
              <p className="text-sm text-gray-500">Définissez comment répartir les quantités boutique entre les cars de livraison</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <Icon icon="mdi:truck" className="text-orange-600" />
                <label className="text-sm font-semibold text-gray-700">Car 1 - Matin</label>
              </div>
              <Input
                type="number"
                min="0"
                value={car1Matin || ''}
                onChange={(e) => setCar1Matin(parseInt(e.target.value) || 0)}
                placeholder="Quantité Car 1"
                className="text-center"
              />
            </div>

            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <Icon icon="mdi:truck-outline" className="text-blue-600" />
                <label className="text-sm font-semibold text-gray-700">Car 2 - Matin</label>
              </div>
              <Input
                type="number"
                min="0"
                value={car2Matin || ''}
                onChange={(e) => setCar2Matin(parseInt(e.target.value) || 0)}
                placeholder="Quantité Car 2"
                className="text-center"
              />
            </div>

            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <Icon icon="mdi:truck-fast" className="text-purple-600" />
                <label className="text-sm font-semibold text-gray-700">Car - Soir</label>
              </div>
              <Input
                type="number"
                min="0"
                value={carSoir || ''}
                onChange={(e) => setCarSoir(parseInt(e.target.value) || 0)}
                placeholder="Quantité Car Soir"
                className="text-center"
              />
            </div>
          </div>

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
            disabled={!selectedProduitId}
          >
            Ajouter
          </Button>
        </div>
      </form>
    </Card>
  );
};