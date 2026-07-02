import React, { useState, useEffect } from 'react';

import { Icon } from '@iconify/react';
import { useStockStore } from '../../store/stockStore';
import { Modal } from '../ui/Modal';
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
  const { addMouvement, updateMouvement } = useStockStore();

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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Modifier le Mouvement' : `Mouvement : ${selectedMatiere.nom}`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-sand-700 mb-1">Date</label>
          <input
            type="date"
            required
            value={formData.date}
            onChange={e => setFormData({ ...formData, date: e.target.value })}
            className="w-full p-2.5 border border-sand-200 rounded-xl focus:ring-2 focus:ring-warning-500/20 focus:border-warning-500 outline-none transition-all"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-sand-700 mb-1">Type de mouvement</label>
          <select
            value={formData.type}
            onChange={e => setFormData({ ...formData, type: e.target.value as TypeMouvement })}
            className="w-full p-2.5 border border-sand-200 rounded-xl focus:ring-2 focus:ring-warning-500/20 focus:border-warning-500 outline-none transition-all"
          >
            <option value="achat">Achat / Entrée</option>
            <option value="consommation">Consommation (Production)</option>
            <option value="perte">Perte / Gâchis</option>
            <option value="retour_fournisseur">Retour Fournisseur</option>
            <option value="correction">Correction d'Inventaire</option>
          </select>
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <label className="block text-sm font-medium text-sand-700">
              {isSortie ? 'Quantité Sortante' : 'Quantité Entrante'}
            </label>
            <div className="flex items-center space-x-2 text-[10px] font-bold uppercase tracking-wider">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, inputUnit: selectedMatiere.unite })}
                className={`px-2 py-0.5 rounded transition-colors ${formData.inputUnit === selectedMatiere.unite ? 'bg-warning-600 text-white' : 'bg-sand-100 text-sand-500 hover:bg-sand-200'}`}
              >
                {selectedMatiere.unite}
              </button>
              {(selectedMatiere.unite === 'kg' || selectedMatiere.unite === 'g') && (
                <>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, inputUnit: 'sac' })}
                    className={`px-2 py-0.5 rounded transition-colors ${formData.inputUnit === 'sac' ? 'bg-warning-600 text-white' : 'bg-sand-100 text-sand-500 hover:bg-sand-200'}`}
                  >
                    Sac
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, inputUnit: 'carton' })}
                    className={`px-2 py-0.5 rounded transition-colors ${formData.inputUnit === 'carton' ? 'bg-warning-600 text-white' : 'bg-sand-100 text-sand-500 hover:bg-sand-200'}`}
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
                className="w-full p-3 border border-sand-200 rounded-xl focus:ring-2 focus:ring-warning-500/20 focus:border-warning-500 outline-none font-black text-xl text-sand-800 transition-all"
                placeholder="0.00"
              />
            </div>
            <div className="flex items-center justify-center bg-sand-50 px-4 rounded-xl border border-sand-200 text-sand-600 font-bold text-sm uppercase">
              {formData.inputUnit === 'sac' ? 'Sacs' : formData.inputUnit === 'carton' ? 'Cartons' : selectedMatiere.unite}
            </div>
          </div>

          {formData.inputUnit === 'sac' && (
            <div className="mt-3 p-3 bg-sand-50 rounded-xl border border-sand-200">
              <label className="block text-[10px] font-black text-sand-400 uppercase tracking-widest mb-1">Poids par sac (kg)</label>
              <input
                type="number"
                min="1"
                value={formData.bagWeight}
                onChange={e => setFormData({ ...formData, bagWeight: Number(e.target.value) })}
                className="w-full p-2 text-sm border-sand-200 rounded-lg focus:ring-1 focus:ring-warning-500 outline-none font-bold"
              />
            </div>
          )}
        </div>

        {formData.type === 'achat' && (
          <div className="p-4 bg-sand-50/50 rounded-2xl border border-sand-200/60 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 bg-sand-100 rounded-md flex items-center justify-center text-sand-600">
                <Icon icon="mdi:cash" />
              </div>
              <h4 className="text-xs font-black text-sand-900 uppercase tracking-wider">Valorisation</h4>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-sand-400 uppercase tracking-tight mb-1">
                  Prix TOTAL Payé (FCFA)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="Ex: 50000"
                  value={formData.prixTotalPaye}
                  onChange={e => handlePrixTotalChange(e.target.value)}
                  className="w-full p-2.5 border border-sand-200 rounded-xl focus:ring-2 focus:ring-success-500/20 outline-none font-black text-sand-800"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={formData.inclusTVA}
                  onChange={(e) => handleTVAChange(e.target.checked)}
                  className="w-4 h-4 rounded border-sand-300 text-warning-600 focus:ring-warning-500"
                />
                <span className="text-xs font-medium text-sand-600 group-hover:text-sand-900 transition-colors">Ce prix inclut la TVA (18%)</span>
              </label>

              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-sand-400 uppercase mb-1">Coût Unitaire HT ({selectedMatiere.unite})</label>
                  <div className="px-3 py-2 bg-white border border-sand-200 rounded-lg text-sand-600 font-mono text-xs font-bold">
                    {formData.prixUnitaire ? (typeof formData.prixUnitaire === 'number' ? formData.prixUnitaire.toFixed(2) : formData.prixUnitaire) : '-'}
                  </div>
                </div>
                {getHumanUnitPrice() && (
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold text-warning-600 uppercase mb-1">Prix par {formData.inputUnit}</label>
                    <div className="px-3 py-2 bg-warning-50 border border-warning-100 rounded-lg text-warning-600 font-black text-xs">
                      {getHumanUnitPrice()} FCFA
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-sand-700 mb-1">Auteur</label>
            <input
              type="text"
              required
              value={formData.auteur}
              onChange={e => setFormData({ ...formData, auteur: e.target.value })}
              className="w-full p-2.5 border border-sand-200 rounded-xl focus:ring-2 focus:ring-warning-500/20 outline-none transition-all"
              placeholder="Ex: Moussa Ndiaye"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-sand-700 mb-1 text-pretty flex items-center gap-1">
              Responsable {formData.type !== 'achat' && <span className="text-danger-500">*</span>}
            </label>
            <input
              type="text"
              required={formData.type !== 'achat'}
              value={formData.responsable}
              onChange={e => setFormData({ ...formData, responsable: e.target.value })}
              className="w-full p-2.5 border border-sand-200 rounded-xl focus:ring-2 focus:ring-warning-500/20 outline-none transition-all"
              placeholder="Ex: Modou (Gérant)"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-sand-700 mb-1">Motif / Commentaire</label>
          <input
            type="text"
            value={formData.motif}
            onChange={e => setFormData({ ...formData, motif: e.target.value })}
            className="w-full p-2.5 border border-sand-200 rounded-xl focus:ring-2 focus:ring-warning-500/20 outline-none transition-all"
            placeholder="Ex: Arrivage Grands Moulins"
          />
        </div>

        <div className="flex gap-3 pt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-5 py-3 text-sm font-semibold text-sand-700 bg-white hover:bg-sand-50 border border-sand-300 rounded-xl transition-all"
          >
            Annuler
          </button>
          <button
            type="submit"
            className={`flex-1 px-5 py-3 text-sm font-bold text-white rounded-xl shadow-sm hover:shadow-md transition-all ${isSortie ? 'bg-danger-600 hover:bg-danger-700' : 'bg-success-600 hover:bg-success-700'
              }`}
          >
            {isEditing ? 'Modifier' : (isSortie ? 'Valider la Sortie' : "Valider l'Entrée")}
          </button>
        </div>
      </form>
    </Modal>
  );
};
