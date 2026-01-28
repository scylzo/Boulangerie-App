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
    sachetWeight: 0.5,
    // Nouveaux champs pour le prix
    prixUnitaire: '' as number | '', // Prix pour 1 unité de base (ex: 1kg) -> C'est celui qu'on stocke
    prixTotalPaye: '' as number | '', // Pour faciliter la saisie (ex: j'ai payé 20000 pour 50 sacs)
    inclusTVA: false // Si coché, on déduira la TVA (18%) pour trouver le HT
  });

  useEffect(() => {
    if (isOpen && selectedMatiere) {
      if (isEditing && initialData) {
        // Mode Édition
        let inputUnit: string = selectedMatiere.unite;
        let bagWeight = 50;
        let qte = initialData.quantite;

        if (initialData.motif && initialData.motif.includes('sac')) {
          inputUnit = 'sac';
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
          sachetWeight: 0.5,
          prixUnitaire: initialData.prixUnitaire || '',
          prixTotalPaye: (initialData.prixUnitaire && initialData.quantite) ? (initialData.prixUnitaire * initialData.quantite) : '',
          inclusTVA: false
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
          sachetWeight: 0.5,
          prixUnitaire: '',
          prixTotalPaye: '',
          inclusTVA: false
        });
      }
    }
  }, [isOpen, selectedMatiere, isEditing, initialData]);

  if (!isOpen || !selectedMatiere) return null;

  const calculatePrixUnitaire = (total: number, qty: number, withTVA: boolean, unitWeight: number) => {
    if (qty <= 0 || total <= 0) return '';

    const totalHT = withTVA ? (total / 1.18) : total;

    // Convertir qty en unité de base
    const totalBaseUnits = qty * unitWeight;

    return totalHT / totalBaseUnits;
  };

  const getUnitWeight = (unit: string, form: typeof formData) => {
    if (unit === 'sac') return form.bagWeight;
    if (unit === 'carton') return form.cartonWeight;
    if (unit === 'sachet') return form.sachetWeight;
    return 1;
  };

  const handleQuantiteChange = (val: string) => {
    const qty: number | '' = val === '' ? '' : parseFloat(val);

    // Si on a un prix total renseigné, on recalcule le prix unitaire
    // Si on a un prix unitaire renseigné et pas de total, on recalcule le total ??
    // Généralement: Si je change la quantité, et que j'ai un Total Fixe (ex: j'ai payé 50000), le prix unitaire change.
    // OU: Si je change la quantité, et que j'ai un Prix Unitaire Fixe, le total change.
    // UX: Souvent on saisit Qte puis Prix.

    // Cas: J'ai saisi Qte=10, PrixTotal=100. Unitaire=10.
    // Je change Qte=20. Est-ce que Total reste 100 (donc Unitaire=5) ou Unitaire reste 10 (donc Total=200) ?
    // Pour un stock, souvent le prix unitaire est la donnée "stable" du produit, mais pour un achat ponctuel, le total est la donnée "facture".
    // Gardons la logique précédente : Priorité au maintien du Prix Unitaire si déjà calculé ?
    // L'ancien code recalculait le Total. Gardons ça.

    let newFormData = { ...formData, quantite: qty };

    if (typeof qty === 'number' && typeof formData.prixUnitaire === 'number') {
      const factor = getUnitWeight(formData.inputUnit, formData);
      const totalBaseUnits = qty * factor;

      // Prix Unitaire est HT.
      const totalHT = totalBaseUnits * formData.prixUnitaire;

      // Le prix Total affiché doit être TTC si TVA cochée
      newFormData.prixTotalPaye = formData.inclusTVA ? (totalHT * 1.18) : totalHT;
    }

    setFormData(newFormData);
  };

  const handlePrixTotalChange = (val: string) => {
    const total: number | '' = val === '' ? '' : parseFloat(val);
    let newFormData = { ...formData, prixTotalPaye: total };

    // Recalcul du prix unitaire de BASE (toujours HT)
    const qty = typeof formData.quantite === 'number' ? formData.quantite : 0;
    if (qty > 0 && typeof total === 'number') {
      const factor = getUnitWeight(formData.inputUnit, formData);
      newFormData.prixUnitaire = calculatePrixUnitaire(total, qty, formData.inclusTVA, factor);
    }
    setFormData(newFormData);
  };

  const handleTVAChange = (checked: boolean) => {
    // On garde le Prix Total Payé affiché constant, mais on recalcule le Prix Unitaire HT stocké
    let newFormData = { ...formData, inclusTVA: checked };

    const qty = typeof formData.quantite === 'number' ? formData.quantite : 0;
    const total = typeof formData.prixTotalPaye === 'number' ? formData.prixTotalPaye : 0;

    if (qty > 0 && total > 0) {
      const factor = getUnitWeight(formData.inputUnit, formData);
      newFormData.prixUnitaire = calculatePrixUnitaire(total, qty, checked, factor);
    }

    setFormData(newFormData);
  };

  // Helper pour afficher le prix unitaire "compris par l'humain" (ex: prix du sac)
  const getHumanUnitPrice = () => {
    if (!formData.prixUnitaire || !formData.quantite) return null;
    let factor = 1;
    if (formData.inputUnit === 'sac') factor = formData.bagWeight;
    if (formData.inputUnit === 'carton') factor = formData.cartonWeight;
    if (formData.inputUnit === 'sachet') factor = formData.sachetWeight;

    const pricePerInputUnit = (formData.prixUnitaire as number) * factor;
    return Math.round(pricePerInputUnit).toLocaleString();
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      let finalQuantity = Number(formData.quantite) || 0;
      let motifSuffix = '';

      // Gestion conversion
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

      let finalMotif = formData.motif;
      if (formData.inputUnit !== selectedMatiere.unite) {
        finalMotif += motifSuffix;
      }

      const submitDate = new Date(formData.date);
      const now = new Date();
      // Si la date choisie est aujourd'hui, on met l'heure actuelle
      if (submitDate.toDateString() === now.toDateString()) {
        submitDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
      } else {
        // Sinon on fixe à midi pour éviter les décalages de fuseau horaire inverses qui changeraient la date
        submitDate.setHours(12, 0, 0, 0);
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
        prixUnitaire: formData.prixUnitaire !== '' ? Number(formData.prixUnitaire) : undefined,
        montantPaye: formData.prixTotalPaye !== '' ? Number(formData.prixTotalPaye) : undefined,
        inclusTVA: formData.inclusTVA
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
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, inputUnit: 'sachet' })}
                      className={`px-2 py-0.5 rounded ${formData.inputUnit === 'sachet' ? 'bg-orange-100 text-orange-700 font-bold' : 'text-gray-500 hover:bg-gray-100'}`}
                    >
                      Sachet
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

            {/* WEIGHT INPUTS START */}
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
              </div>
            )}
            {/* WEIGHT INPUTS END */}

            {/* PRICE INPUTS START (Only for Achat) */}
            {formData.type === 'achat' && (
              <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <h4 className="text-sm font-bold text-gray-700 mb-3">💰 Valorisation du Stock</h4>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Prix TOTAL Payé (FCFA)
                      <span className="text-gray-400 font-normal ml-1">(Facultatif si Prix Unitaire renseigné)</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="Ex: 50000"
                      value={formData.prixTotalPaye}
                      onChange={e => handlePrixTotalChange(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 outline-none font-medium"
                    />
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      id="checkTVA"
                      checked={formData.inclusTVA}
                      onChange={(e) => handleTVAChange(e.target.checked)}
                      className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                    />
                    <label htmlFor="checkTVA" className="text-sm text-gray-700">
                      Ce prix inclut la TVA (18%)
                    </label>
                  </div>

                  {/* Prix Unitaire calculé (informatif + override) */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Coût unitaire estimé (FCFA / {selectedMatiere.unite})
                      </label>
                      <div className="px-3 py-2 bg-white border border-gray-200 rounded-md text-gray-700 font-mono text-sm">
                        {formData.prixUnitaire ? (typeof formData.prixUnitaire === 'number' ? formData.prixUnitaire.toFixed(2) : formData.prixUnitaire) : '-'}
                      </div>
                    </div>
                    {getHumanUnitPrice() && (
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-orange-600 mb-1">
                          Soit prix par {formData.inputUnit}
                        </label>
                        <div className="px-3 py-2 bg-orange-50 border border-orange-100 rounded-md text-orange-800 font-bold text-sm">
                          {getHumanUnitPrice()} FCFA
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            {/* PRICE INPUTS END */}

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
