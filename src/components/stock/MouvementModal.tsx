import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useStockStore } from '../../store/stockStore';
import type { MatierePremiere, TypeMouvement } from '../../types';

interface MouvementModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMatiere?: MatierePremiere;
  initialData?: any; // Pour l'édition
  isEditing?: boolean;
}

export const MouvementModal: React.FC<MouvementModalProps> = ({
  isOpen,
  onClose,
  selectedMatiere,
  initialData,
  isEditing = false
}) => {
  const { addMouvement, updateMouvement, fournisseurs } = useStockStore();

  const [formData, setFormData] = useState({
    type: 'achat' as TypeMouvement,
    quantite: '' as number | '',
    motif: '',
    auteur: '',
    responsable: '',
    fournisseurId: '',
    referenceDocument: '',
    date: new Date().toISOString().split('T')[0],
    inputUnit: 'initial' as string,
    bagWeight: 50,
    cartonWeight: 10,
    sachetWeight: 0.5
  });

  useEffect(() => {
    if (isOpen && selectedMatiere) {
      if (isEditing && initialData) {
        // Mode Édition : Charger les données
        // Essayer de déduire l'unité d'entrée depuis le motif (ex: "3 sacs")
        let inputUnit: string = selectedMatiere.unite;
        let bagWeight = 50;
        let qte = initialData.quantite;

        // Simple heuristique pour pré-remplir le formulaire d'édition
        // Si le motif contient "sac", on se met en mode sac
        if (initialData.motif && initialData.motif.includes('sac')) {
          inputUnit = 'sac';
          // Trouver le poids approximatif si possible ou garder 50
          // Si qte = 150 et on a 'sacs', alors c'est peut-être 3 sacs de 50.
          // Mais pour l'édition "simple", on remet souvent en kg (unité de base) pour éviter des erreurs de conversion 
          // SAUF si on veut vraiment éditer le nombre de sacs.
          // Simplifions : on édite en unité de base (kg) par défaut, sauf si l'utilisateur change.
          // Pour l'instant on laisse en unité de base pour l'édition pour ne pas casser la data.
          inputUnit = selectedMatiere.unite;
        }

        setFormData({
          type: initialData.type,
          quantite: qte,
          motif: initialData.motif || '',
          auteur: initialData.auteur || '',
          responsable: initialData.responsable || '',
          fournisseurId: initialData.fournisseurId || '',
          referenceDocument: initialData.referenceDocument || '',
          date: new Date(initialData.date).toISOString().split('T')[0],
          inputUnit: inputUnit,
          bagWeight,
          cartonWeight: 10,
          sachetWeight: 0.5
        });
      } else {
        // Mode Création (Reset)
        setFormData({
          type: 'achat',
          quantite: '',
          motif: '',
          auteur: '',
          responsable: '',
          fournisseurId: '',
          referenceDocument: '',
          date: new Date().toISOString().split('T')[0],
          inputUnit: selectedMatiere.unite,
          bagWeight: 50,
          cartonWeight: 10,
          sachetWeight: 0.5
        });
      }
    }
  }, [isOpen, selectedMatiere, isEditing, initialData]);

  if (!isOpen || !selectedMatiere) return null;

  const handleQuantiteChange = (val: string) => {
    const qty = val === '' ? '' : parseFloat(val);
    setFormData({ ...formData, quantite: qty });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      let finalQuantity = Number(formData.quantite) || 0;
      let motifSuffix = '';

      // Gestion conversion (seulement si on change l'unité d'input)
      if (formData.inputUnit === 'sac') {
        finalQuantity *= (Number(formData.bagWeight) || 1);
        motifSuffix = ` (${formData.quantite} sacs de ${formData.bagWeight}kg)`;
      } else if (formData.inputUnit === 'carton') {
        finalQuantity *= (Number(formData.cartonWeight) || 1);
        motifSuffix = ` (${formData.quantite} cartons de ${formData.cartonWeight}kg)`;
      } else if (formData.inputUnit === 'sachet') {
        finalQuantity *= (Number(formData.sachetWeight) || 0.5);
        motifSuffix = ` (${formData.quantite} sachets de ${formData.sachetWeight}kg)`;
      }

      // Nettoyage motif pour éviter duplication suffixes en édition
      let finalMotif = formData.motif;
      if (motifSuffix && !finalMotif.includes(motifSuffix)) {
        // Si on ajoute, on concatène. Mais en édition attention.
        // En édition, l'utilisateur voit déjà le motif complet, s'il ne le change pas, on le garde.
        // S'il change la quantité/unité, on ajoute le suffixe.
      }
      // Simplification : si inputUnit est diff de base, on force le suffixe pour la clarté
      if (formData.inputUnit !== selectedMatiere.unite) {
        finalMotif += motifSuffix;
      }

      // create a new date object from formData.date (YYYY-MM-DD)
      const submitDate = new Date(formData.date);
      // If the selected date is today, use current time. Else default to noon or keep 00:00?
      // User requested "heure correcte". If date is today, let's inject current time.
      const now = new Date();
      if (submitDate.toDateString() === now.toDateString()) {
        submitDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
      } else {
        // If past date, user probably meant that day. 00:00 is technically correct for "that day generally".
        // But to avoid "00:00" looking like a bug, we could set it to 12:00? 
        // Or just leave it and let the List component hide it if it's 00:00 (which we just did).
        // However, if they edit, they might want to specify time? 
        // The current input is type="date" so it strips time. 
        // Let's stick to: "If Today -> Current Time". "If Other Day -> 00:00 (Hidden in List)".
      }

      const mouvementData = {
        date: submitDate,
        matiereId: selectedMatiere.id,
        type: formData.type,
        quantite: finalQuantity,
        motif: finalMotif,
        auteur: formData.auteur,
        responsable: formData.responsable,
        referenceDocument: formData.referenceDocument,
        fournisseurId: formData.fournisseurId || undefined,
        userId: 'current-user-id',
      };

      if (isEditing && initialData) {
        await updateMouvement(initialData.id, mouvementData);
      } else {
        await addMouvement(mouvementData);
      }

      onClose();
    } catch (error) {
      console.error("Erreur lors de l'enregistrement:", error);
      alert("Erreur lors de l'enregistrement. Vérifiez votre connexion.");
    }
  };

  const isSortie = ['consommation', 'perte', 'retour_fournisseur'].includes(formData.type);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md my-8 flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0">
          <h3 className="font-bold text-gray-800">
            {isEditing ? 'Modifier le Mouvement' : `Mouvement de Stock : ${selectedMatiere.nom}`}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              required
              value={formData.date}
              onChange={e => setFormData({ ...formData, date: e.target.value })}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type de mouvement</label>
            <select
              value={formData.type}
              onChange={e => setFormData({ ...formData, type: e.target.value as TypeMouvement })}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
            >
              <option value="achat">Achat / Entrée</option>
              <option value="consommation">Consommation (Production)</option>
              <option value="perte">Perte / Gâchis</option>
              <option value="retour_fournisseur">Retour Fournisseur</option>
              <option value="correction">Correction d'Inventaire</option>
            </select>
          </div>

          <div>
            {/* Unit Selection is now available for all movement types */}
            <div className="flex justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                {isSortie ? 'Quantité Sortante' : 'Quantité Entrante'}
              </label>
              <div className="flex items-center space-x-2 text-xs">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, inputUnit: selectedMatiere.unite })}
                  className={`px-2 py-0.5 rounded ${formData.inputUnit === selectedMatiere.unite ? 'bg-orange-100 text-orange-700 font-bold' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                  {selectedMatiere.unite}
                </button>
                {(selectedMatiere.unite === 'kg' || selectedMatiere.unite === 'g') && (
                  <>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, inputUnit: 'sac' })}
                      className={`px-2 py-0.5 rounded ${formData.inputUnit === 'sac' ? 'bg-orange-100 text-orange-700 font-bold' : 'text-gray-500 hover:bg-gray-100'}`}
                    >
                      Sac
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, inputUnit: 'carton' })}
                      className={`px-2 py-0.5 rounded ${formData.inputUnit === 'carton' ? 'bg-orange-100 text-orange-700 font-bold' : 'text-gray-500 hover:bg-gray-100'}`}
                    >
                      Carton
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={formData.quantite}
                  onChange={e => handleQuantiteChange(e.target.value)}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none font-bold text-lg"
                  placeholder="0.00"
                />
              </div>
              <div className="flex items-center justify-center bg-gray-50 px-3 rounded-lg border border-gray-200 text-gray-600 font-medium whitespace-nowrap">
                {formData.inputUnit === 'sac' ? 'Sacs' : formData.inputUnit === 'carton' ? 'Cartons' : formData.inputUnit === 'sachet' ? 'Sachets' : selectedMatiere.unite}
              </div>
            </div>

            {formData.inputUnit === 'sac' && (
              <div className="mt-2 p-3 bg-orange-50 rounded-lg border border-orange-100">
                <label className="block text-xs font-medium text-orange-800 mb-1">Poids par sac (kg)</label>
                <input
                  type="number"
                  min="1"
                  value={formData.bagWeight}
                  onChange={e => setFormData({ ...formData, bagWeight: Number(e.target.value) })}
                  className="w-full p-1.5 text-sm border-orange-200 rounded focus:ring-1 focus:ring-orange-500 outline-none"
                />
                <p className="text-xs text-orange-600 mt-1">
                  Total : <b>{(Number(formData.quantite) || 0) * (Number(formData.bagWeight) || 0)} kg</b> {isSortie ? 'retirés du' : 'ajoutés au'} stock.
                </p>
              </div>
            )}

            {formData.inputUnit === 'carton' && (
              <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <label className="block text-xs font-medium text-blue-800 mb-1">Poids par carton (kg)</label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={formData.cartonWeight}
                  onChange={e => setFormData({ ...formData, cartonWeight: Number(e.target.value) })}
                  className="w-full p-1.5 text-sm border-blue-200 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                />
                <p className="text-xs text-blue-600 mt-1">
                  Total : <b>{(Number(formData.quantite) || 0) * (Number(formData.cartonWeight) || 0)} kg</b> {isSortie ? 'retirés du' : 'ajoutés au'} stock.
                </p>
              </div>
            )}

            {formData.inputUnit === 'sachet' && (
              <div className="mt-2 p-3 bg-green-50 rounded-lg border border-green-100">
                <label className="block text-xs font-medium text-green-800 mb-1">Poids par sachet (kg)</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={formData.sachetWeight}
                  onChange={e => setFormData({ ...formData, sachetWeight: Number(e.target.value) })}
                  className="w-full p-1.5 text-sm border-green-200 rounded focus:ring-1 focus:ring-green-500 outline-none"
                />
                <p className="text-xs text-green-600 mt-1">
                  Total : <b>{((Number(formData.quantite) || 0) * (Number(formData.sachetWeight) || 0)).toFixed(2)} kg</b> {isSortie ? 'retirés du' : 'ajoutés au'} stock.
                </p>
              </div>
            )}
          </div>

          {formData.type === 'achat' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fournisseur (Optionnel)</label>
                <select
                  value={formData.fournisseurId}
                  onChange={e => setFormData({ ...formData, fournisseurId: e.target.value })}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                >
                  <option value="">Sélectionner...</option>
                  {fournisseurs.map(f => (
                    <option key={f.id} value={f.id}>{f.nom}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Référence Facture / BL</label>
                <input
                  type="text"
                  value={formData.referenceDocument}
                  onChange={e => setFormData({ ...formData, referenceDocument: e.target.value })}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Auteur (Celui qui sort)</label>
              <input
                type="text"
                required
                value={formData.auteur}
                onChange={e => setFormData({ ...formData, auteur: e.target.value })}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                placeholder="Ex: Boulanger"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Validé par (Responsable) {formData.type !== 'achat' && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                required={formData.type !== 'achat'}
                value={formData.responsable}
                onChange={e => setFormData({ ...formData, responsable: e.target.value })}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                placeholder={formData.type === 'achat' ? "Optionnel" : "Ex: Gérant"}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motif / Commentaire</label>
            <input
              type="text"
              value={formData.motif}
              onChange={e => setFormData({ ...formData, motif: e.target.value })}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
              placeholder={formData.type === 'perte' ? "Ex: Sac déchiré, Humidité..." : "Optionnel"}
            />
          </div>

          <div className="pt-4 flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              className={`flex-1 px-4 py-2 rounded-lg text-white font-medium ${isSortie ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
                }`}
            >
              Valider {isEditing ? 'la Modification' : (isSortie ? 'la Sortie' : "l'Entrée")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
