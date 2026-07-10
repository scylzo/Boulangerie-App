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
    imageUrl: '' as string,
    prixClient: '' as number | '',
    prixBoutique: '' as number | '',
    categorie: 'boulangerie' as 'boulangerie' | 'viennoiserie',
    saveur: '' as '' | 'sale' | 'sucre',
    reconduisible: false,
    productionQuotidienne: false,
    defCar1: '' as number | '',
    defCar2: '' as number | '',
    defCarSoir: '' as number | '',
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
        imageUrl: produit.imageUrl || '',
        prixClient: produit.prixClient || '',
        prixBoutique: produit.prixBoutique || '',
        categorie: produit.categorie || 'boulangerie',
        saveur: produit.saveur || '',
        reconduisible: produit.reconduisible || false,
        productionQuotidienne: produit.productionQuotidienne || false,
        defCar1: produit.quantiteBoutiqueDefautCars?.car1_matin ?? (produit.quantiteBoutiqueDefaut ?? ''),
        defCar2: produit.quantiteBoutiqueDefautCars?.car2_matin ?? '',
        defCarSoir: produit.quantiteBoutiqueDefautCars?.car_soir ?? '',
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

  // Upload image : redimensionne dans le navigateur puis stocke en data URL (base64)
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 400;
        let { width, height } = img;
        if (width > height && width > MAX) { height = Math.round(height * MAX / width); width = MAX; }
        else if (height > MAX) { width = Math.round(width * MAX / height); height = MAX; }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
        setFormData(fd => ({ ...fd, imageUrl: canvas.toDataURL('image/jpeg', 0.8) }));
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const produitData = {
        nom: formData.nom,
        imageUrl: formData.imageUrl || '',
        prixClient: Number(formData.prixClient) || 0,
        prixBoutique: Number(formData.prixBoutique) || 0,
        categorie: formData.categorie,
        ...(formData.saveur ? { saveur: formData.saveur } : {}),
        reconduisible: formData.reconduisible,
        productionQuotidienne: formData.productionQuotidienne,
        quantiteBoutiqueDefautCars: formData.productionQuotidienne
          ? { car1_matin: Number(formData.defCar1) || 0, car2_matin: Number(formData.defCar2) || 0, car_soir: Number(formData.defCarSoir) || 0 }
          : { car1_matin: 0, car2_matin: 0, car_soir: 0 },
        quantiteBoutiqueDefaut: formData.productionQuotidienne
          ? (Number(formData.defCar1) || 0) + (Number(formData.defCar2) || 0) + (Number(formData.defCarSoir) || 0)
          : 0,
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
          imageUrl: '',
          prixClient: '',
          prixBoutique: '',
          categorie: 'boulangerie',
          saveur: '',
          reconduisible: false,
          productionQuotidienne: false,
          defCar1: '',
          defCar2: '',
          defCarSoir: '',
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
          <h4 className="font-medium text-sand-900 border-b pb-2">Informations Générales</h4>

          {/* Photo du produit */}
          <div>
            <label className="block text-sm font-medium text-sand-700 mb-2">Photo du produit</label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-xl border border-sand-200 bg-sand-50 overflow-hidden flex items-center justify-center shrink-0">
                {formData.imageUrl ? (
                  <img src={formData.imageUrl} alt="Aperçu" className="w-full h-full object-cover" />
                ) : (
                  <Icon icon="mdi:image-outline" className="text-3xl text-sand-300" />
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-sand-300 text-sand-700 text-sm font-medium hover:bg-sand-50 cursor-pointer w-fit">
                  <Icon icon="mdi:upload" /> {formData.imageUrl ? 'Changer la photo' : 'Choisir une image'}
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                </label>
                {formData.imageUrl && (
                  <button type="button" onClick={() => setFormData(fd => ({ ...fd, imageUrl: '' }))} className="text-xs text-danger-600 hover:text-danger-700 w-fit">
                    Retirer l'image
                  </button>
                )}
                <p className="text-xs text-sand-400">JPG/PNG · redimensionnée automatiquement (400px)</p>
              </div>
            </div>
          </div>

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
            <label className="block text-sm font-medium text-sand-700 mb-2">
              Catégorie *
            </label>
            <div className="flex gap-4">
              <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all ${formData.categorie === 'boulangerie' ? 'bg-warning-50 border-warning-100 ring-1 ring-warning-500' : 'bg-white border-sand-200 hover:bg-sand-50'}`}>
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
                    <span className="block text-sm font-medium text-sand-900">Boulangerie</span>
                    <span className="block text-xs text-sand-500">Pains, Baguettes...</span>
                  </div>
                </div>
              </label>

              <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all ${formData.categorie === 'viennoiserie' ? 'bg-warning-50 border-warning-100 ring-1 ring-warning-500' : 'bg-white border-sand-200 hover:bg-sand-50'}`}>
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
                    <span className="block text-sm font-medium text-sand-900">Viennoiserie</span>
                    <span className="block text-xs text-sand-500">Croissants, Pains choco...</span>
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Catégorie Salé / Sucré (suivi des ventes vs coût) */}
          <div>
            <label className="block text-sm font-medium text-sand-700 mb-2">
              Salé / Sucré <span className="text-sand-400 font-normal">(pour le suivi des ventes)</span>
            </label>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {([
                { val: '', label: 'Aucun', emoji: '—' },
                { val: 'sale', label: 'Salé', emoji: '🧀' },
                { val: 'sucre', label: 'Sucré', emoji: '🍩' },
              ] as { val: '' | 'sale' | 'sucre'; label: string; emoji: string }[]).map((s) => (
                <label
                  key={s.val || 'none'}
                  className={`flex items-center justify-center gap-2 p-3 border rounded-lg cursor-pointer transition-all ${formData.saveur === s.val ? 'bg-terracotta-50 border-terracotta-200 ring-1 ring-terracotta-500' : 'bg-white border-sand-200 hover:bg-sand-50'}`}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    name="saveur"
                    value={s.val}
                    checked={formData.saveur === s.val}
                    onChange={() => setFormData({ ...formData, saveur: s.val })}
                  />
                  <span className="text-lg">{s.emoji}</span>
                  <span className="text-sm font-medium text-sand-900">{s.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="bg-info-50 border border-info-100 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <input
                id="reconduisible"
                type="checkbox"
                checked={formData.reconduisible}
                onChange={(e) => setFormData({ ...formData, reconduisible: e.target.checked })}
                className="mt-1 h-4 w-4 text-info-600 focus:ring-info-500 border-sand-300 rounded"
              />
              <div className="flex-1">
                <label htmlFor="reconduisible" className="block text-sm font-medium text-sand-900 cursor-pointer">
                  Produit reconduisible
                </label>
                <p className="text-xs text-sand-600 mt-1">
                  Les invendus de ce produit peuvent être vendus le lendemain (ex: biscuits, pains spéciaux).
                  Si décoché, les invendus seront considérés comme des pertes (ex: baguettes fraîches, croissants).
                </p>
              </div>
            </div>
          </div>

          <div className="bg-sand-50 border border-sand-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <input
                id="productionQuotidienne"
                type="checkbox"
                checked={formData.productionQuotidienne}
                onChange={(e) => setFormData({ ...formData, productionQuotidienne: e.target.checked })}
                className="mt-1 h-4 w-4 text-terracotta-600 focus:ring-terracotta-500 border-sand-300 rounded"
              />
              <div className="flex-1">
                <label htmlFor="productionQuotidienne" className="block text-sm font-medium text-sand-900 cursor-pointer">
                  Produit quotidien (boutique)
                </label>
                <p className="text-xs text-sand-600 mt-1">
                  Fabriqué tous les jours pour la boutique. Il sera rappelé automatiquement dans le programme de production s'il manque (ex: baguette, pain).
                </p>
                {formData.productionQuotidienne && (
                  <div className="mt-3">
                    <p className="text-sm text-sand-700 mb-2">Quantités boutique par défaut (par car) :</p>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { key: 'defCar1' as const, label: 'Car 1 - Matin' },
                        { key: 'defCar2' as const, label: 'Car 2 - Matin' },
                        { key: 'defCarSoir' as const, label: 'Car Soir' },
                      ]).map((c) => (
                        <div key={c.key}>
                          <label className="block text-[11px] font-medium text-sand-500 mb-1">{c.label}</label>
                          <input
                            type="number"
                            min="0"
                            value={formData[c.key]}
                            onChange={(e) => setFormData({ ...formData, [c.key]: e.target.value === '' ? '' : Number(e.target.value) })}
                            placeholder="0"
                            className="w-full px-2 py-1.5 border border-sand-300 rounded-lg text-right text-sm tabular-nums focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
                          />
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] text-sand-500 mt-1.5 text-right">
                      Total : {(Number(formData.defCar1) || 0) + (Number(formData.defCar2) || 0) + (Number(formData.defCarSoir) || 0)} pièces
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center">
            <input
              id="active"
              type="checkbox"
              checked={formData.active}
              onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
              className="h-4 w-4 text-warning-600 focus:ring-warning-500 border-sand-300 rounded"
            />
            <label htmlFor="active" className="ml-2 block text-sm text-sand-900">
              Produit actif (visible pour la production)
            </label>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          <h4 className="font-medium text-sand-900 border-b pb-2 flex items-center justify-between">
            <span>Recette Technique (Ingrédients)</span>
            <span className="text-xs text-sand-500 font-normal">Optionnel</span>
          </h4>

          <div className="bg-sand-50 p-4 rounded-lg border border-sand-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3 items-end">
              <div className="md:col-span-1">
                <label className="block text-xs font-medium text-sand-700 mb-1">Matière Première</label>
                <select
                  value={newIngredient.matiereId}
                  onChange={(e) => setNewIngredient({ ...newIngredient, matiereId: e.target.value })}
                  className="w-full p-2 text-sm border border-sand-300 rounded-md focus:ring-1 focus:ring-warning-500 outline-none"
                >
                  <option value="">Choisir un ingrédient...</option>
                  {matieres.map(m => (
                    <option key={m.id} value={m.id}>{m.nom} ({m.unite})</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-1">
                <label className="block text-xs font-medium text-sand-700 mb-1">Quantité par unité</label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  placeholder="Ex: 0.25 (pour 250g de farine)"
                  value={newIngredient.quantite}
                  onChange={(e) => setNewIngredient({ ...newIngredient, quantite: e.target.value })}
                  className="w-full p-2 text-sm border border-sand-300 rounded-md focus:ring-1 focus:ring-warning-500 outline-none"
                />
              </div>
              <div className="md:col-span-1">
                <button
                  type="button"
                  onClick={handleAddIngredient}
                  disabled={!newIngredient.matiereId || !newIngredient.quantite || isNaN(parseFloat(newIngredient.quantite)) || parseFloat(newIngredient.quantite) <= 0}
                  className="w-full py-2 px-3 bg-sand-800 text-white text-sm rounded-md hover:bg-sand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                    <div key={index} className="flex items-center justify-between bg-white p-2 rounded border border-sand-200 shadow-sm">
                      <span className="text-sm font-medium text-sand-800">
                        {matiere ? matiere.nom : 'Matière inconnue'}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-sand-600 font-mono bg-sand-100 px-2 py-0.5 rounded">
                          {ing.quantite} {matiere?.unite}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveIngredient(index)}
                          className="text-danger-500 hover:text-danger-700 p-1"
                        >
                          <Icon icon="mdi:close" className="text-lg" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-4 text-sand-400 text-sm italic">
                Aucun ingrédient défini pour cette recette.
              </div>
            )}
          </div>
          <div className="bg-info-50 p-3 rounded-lg">
            <div className="flex items-start gap-2">
              <Icon icon="mdi:information" className="text-info-600 text-lg mt-0.5" />
              <div className="text-sm text-info-600">
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


        <div className="flex justify-end space-x-3 pt-4 border-t border-sand-100">
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