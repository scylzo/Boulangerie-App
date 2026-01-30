import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { useStockStore } from '../../store/stockStore'; // Import stock store
import type { Produit, Ingredient } from '../../types';
import { Icon } from '@iconify/react'; // Import Iconify

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
  const { matieres, chargerDonnees: chargerStock } = useStockStore();

  const [formData, setFormData] = useState({
    nom: '',
    prixClient: '' as number | '',
    prixBoutique: '' as number | '',
    categorie: 'boulangerie' as 'boulangerie' | 'viennoiserie',
    active: true,
    recette: [] as Ingredient[]
  });

  // Load stock data for ingredients selection
  useEffect(() => {
    chargerStock();
  }, []);

  const [newIngredient, setNewIngredient] = useState({
    matiereId: '',
    quantite: '' as string
  });

  useEffect(() => {
    if (produit) {
      setFormData({
        nom: produit.nom,
        prixClient: produit.prixClient || '',
        prixBoutique: produit.prixBoutique || '',
        categorie: produit.categorie || 'boulangerie',
        active: produit.active,
        recette: produit.recette || []
      });
    }
  }, [produit]);

  const handleAddIngredient = () => {
    const quantiteNum = parseFloat(newIngredient.quantite);
    if (newIngredient.matiereId && newIngredient.quantite && !isNaN(quantiteNum) && quantiteNum > 0) {
      const existingIndex = formData.recette.findIndex(i => i.matiereId === newIngredient.matiereId);

      let updatedRecette = [...formData.recette];
      if (existingIndex >= 0) {
        // Update existing
        updatedRecette[existingIndex].quantite = quantiteNum;
      } else {
        // Add new
        updatedRecette.push({
          matiereId: newIngredient.matiereId,
          quantite: quantiteNum
        });
      }

      setFormData({ ...formData, recette: updatedRecette });
      setNewIngredient({ matiereId: '', quantite: '' });
    }
  };

  const handleRemoveIngredient = (index: number) => {
    const updatedRecette = [...formData.recette];
    updatedRecette.splice(index, 1);
    setFormData({ ...formData, recette: updatedRecette });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const produitData = {
        nom: formData.nom,
        prixClient: Number(formData.prixClient) || 0,
        prixBoutique: Number(formData.prixBoutique) || 0,
        categorie: formData.categorie,
        active: formData.active,
        recette: formData.recette, // Include recipe
        description: '',
        unite: 'piece' as const,
        prixUnitaire: Number(formData.prixBoutique) || 0 // Legacy
      };
      await onSave(produitData);
      // Reset form if adding new
      if (!produit) {
        setFormData({
          nom: '',
          prixClient: '',
          prixBoutique: '',
          categorie: 'boulangerie',
          active: true,
          recette: []
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
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900 border-b pb-2">Informations Générales</h4>
          <Input
            label="Nom du produit *"
            value={formData.nom}
            onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
            placeholder="ex: Baguette sénégalaise"
            required
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Prix client (FCFA) *"
              type="number"
              step="1"
              min="0"
              value={formData.prixClient}
              onChange={(e) => setFormData({ ...formData, prixClient: e.target.value === '' ? '' : parseFloat(e.target.value) })}
              placeholder="0"
              required
            />

            <Input
              label="Prix boutique (FCFA) *"
              type="number"
              step="1"
              min="0"
              value={formData.prixBoutique}
              onChange={(e) => setFormData({ ...formData, prixBoutique: e.target.value === '' ? '' : parseFloat(e.target.value) })}
              placeholder="0"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Catégorie *
            </label>
            <div className="flex gap-4">
              <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all ${formData.categorie === 'boulangerie' ? 'bg-orange-50 border-orange-200 ring-1 ring-orange-500' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                <input
                  type="radio"
                  className="sr-only"
                  name="categorie"
                  value="boulangerie"
                  checked={formData.categorie === 'boulangerie'}
                  onChange={() => setFormData({ ...formData, categorie: 'boulangerie' })}
                />
                <div className="flex items-center">
                  <span className="text-xl mr-2">🥖</span>
                  <div>
                    <span className="block text-sm font-medium text-gray-900">Boulangerie</span>
                    <span className="block text-xs text-gray-500">Pains, Baguettes...</span>
                  </div>
                </div>
              </label>

              <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all ${formData.categorie === 'viennoiserie' ? 'bg-amber-50 border-amber-200 ring-1 ring-amber-500' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                <input
                  type="radio"
                  className="sr-only"
                  name="categorie"
                  value="viennoiserie"
                  checked={formData.categorie === 'viennoiserie'}
                  onChange={() => setFormData({ ...formData, categorie: 'viennoiserie' })}
                />
                <div className="flex items-center">
                  <span className="text-xl mr-2">🥐</span>
                  <div>
                    <span className="block text-sm font-medium text-gray-900">Viennoiserie</span>
                    <span className="block text-xs text-gray-500">Croissants, Pains choco...</span>
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div className="flex items-center">
            <input
              id="active"
              type="checkbox"
              checked={formData.active}
              onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
              className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
            />
            <label htmlFor="active" className="ml-2 block text-sm text-gray-900">
              Produit actif (visible pour la production)
            </label>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          <h4 className="font-medium text-gray-900 border-b pb-2 flex items-center justify-between">
            <span>Recette Technique (Ingrédients)</span>
            <span className="text-xs text-gray-500 font-normal">Optionnel</span>
          </h4>

          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3 items-end">
              <div className="md:col-span-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">Matière Première</label>
                <select
                  value={newIngredient.matiereId}
                  onChange={(e) => setNewIngredient({ ...newIngredient, matiereId: e.target.value })}
                  className="w-full p-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-orange-500 outline-none"
                >
                  <option value="">Choisir un ingrédient...</option>
                  {matieres.map(m => (
                    <option key={m.id} value={m.id}>{m.nom} ({m.unite})</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">Quantité par unité</label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  placeholder="Ex: 0.25 (pour 250g de farine)"
                  value={newIngredient.quantite}
                  onChange={(e) => setNewIngredient({ ...newIngredient, quantite: e.target.value })}
                  className="w-full p-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-orange-500 outline-none"
                />
              </div>
              <div className="md:col-span-1">
                <button
                  type="button"
                  onClick={handleAddIngredient}
                  disabled={!newIngredient.matiereId || !newIngredient.quantite || isNaN(parseFloat(newIngredient.quantite)) || parseFloat(newIngredient.quantite) <= 0}
                  className="w-full py-2 px-3 bg-gray-800 text-white text-sm rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Icon icon="mdi:plus-circle" />
                  Ajouter
                </button>
              </div>
            </div>

            {/* Liste des ingrédients ajoutés */}
            {formData.recette.length > 0 ? (
              <div className="space-y-2 mt-4 max-h-40 overflow-y-auto">
                {formData.recette.map((ing, index) => {
                  const matiere = matieres.find(m => m.id === ing.matiereId);
                  return (
                    <div key={index} className="flex items-center justify-between bg-white p-2 rounded border border-gray-200 shadow-sm">
                      <span className="text-sm font-medium text-gray-800">
                        {matiere ? matiere.nom : 'Matière inconnue'}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-600 font-mono bg-gray-100 px-2 py-0.5 rounded">
                          {ing.quantite} {matiere?.unite}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveIngredient(index)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <Icon icon="mdi:close" className="text-lg" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-400 text-sm italic">
                Aucun ingrédient défini pour cette recette.
              </div>
            )}
          </div>
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="flex items-start gap-2">
              <Icon icon="mdi:information" className="text-blue-600 text-lg mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Comment utiliser :</p>
                <ul className="space-y-1 text-xs">
                  <li>• <b>Quantité par unité</b> = quantité nécessaire pour <b>1 pièce</b></li>
                  <li>• <b>Important :</b> Respectez l'unité affichée à côté de l'ingrédient choisi (ex: kg, g, L, pièce).</li>
                  <li>• Le système calcule automatiquement le coût de revient et la marge.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>


        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
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
            disabled={!formData.nom.trim() || !formData.prixClient || !formData.prixBoutique || Number(formData.prixClient) <= 0 || Number(formData.prixBoutique) <= 0}
          >
            {produit ? 'Enregistrer les modifications' : 'Créer le produit'}
          </Button>
        </div>
      </form>
    </Card>
  );
};