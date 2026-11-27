import React, { useState, useMemo } from 'react';
import { Icon } from '@iconify/react';
import { Modal } from '../ui/Modal';
import { useStockStore } from '../../store/stockStore';
import { useDepenseStore } from '../../store/depenseStore';
import { useAuthStore } from '../../store';
import { formatCurrency } from '../../utils/currency';
import { getOptionsConditionnement, formaterNomUnite } from '../../utils/conditionnementStock';
import toast from 'react-hot-toast';
import type { MatierePremiere } from '../../types/stock';

interface ModalReceptionStockProps {
  isOpen: boolean;
  onClose: () => void;
  matiereInitiale?: MatierePremiere;
  onSuccess?: () => void;
}

export const ModalReceptionStock: React.FC<ModalReceptionStockProps> = ({
  isOpen,
  onClose,
  matiereInitiale,
  onSuccess
}) => {
  const { matieres, fournisseurs, addMouvement } = useStockStore();
  const { ajouterDepense } = useDepenseStore();
  const { user } = useAuthStore();

  const [matiereId, setMatiereId] = useState<string>(matiereInitiale?.id || '');
  const [quantite, setQuantite] = useState<string>('');
  const [prixUnitaire, setPrixUnitaire] = useState<string>('');
  const [fournisseurId, setFournisseurId] = useState<string>('');
  const [reference, setReference] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [enregistrerEnDepense, setEnregistrerEnDepense] = useState(false);
  const [modePaiement, setModePaiement] = useState<'Especes' | 'Mobile Money' | 'Cheque'>('Especes');
  const [unitReceptionId, setUnitReceptionId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mettre à jour si matiereInitiale change
  React.useEffect(() => {
    if (matiereInitiale) {
      setMatiereId(matiereInitiale.id);
      if (matiereInitiale.prixUnitaireMoyen > 0) {
        setPrixUnitaire(String(Math.round(matiereInitiale.prixUnitaireMoyen)));
      }
    } else if (matieres.length > 0 && !matiereId) {
      const farine = matieres.find(m => m.nom.toLowerCase().includes('farine'));
      setMatiereId(farine?.id || matieres[0].id);
    }
  }, [matiereInitiale, matieres, matiereId]);

  const selectedMatiere = useMemo(() => {
    return matieres.find(m => m.id === matiereId);
  }, [matieres, matiereId]);

  const optionsConditionnement = useMemo(() => {
    if (!selectedMatiere) return [];
    return getOptionsConditionnement(selectedMatiere);
  }, [selectedMatiere]);

  // Définir l'unité par défaut (carton si achat de levure/magimix, sinon première option)
  const optionActive = useMemo(() => {
    if (optionsConditionnement.length === 0) return null;
    if (unitReceptionId) {
      const found = optionsConditionnement.find(o => o.id === unitReceptionId);
      if (found) return found;
    }
    const cartonOpt = optionsConditionnement.find(o => o.id === 'carton');
    return cartonOpt || optionsConditionnement[0];
  }, [optionsConditionnement, unitReceptionId]);

  // Si l'utilisateur choisit une matière différente, pré-remplir le prix unitaire moyen existant
  const handleMatiereChange = (id: string) => {
    setMatiereId(id);
    setUnitReceptionId('');
    const m = matieres.find(mat => mat.id === id);
    if (m && m.prixUnitaireMoyen > 0) {
      const opts = getOptionsConditionnement(m);
      const cartonOpt = opts.find(o => o.id === 'carton');
      const factor = cartonOpt ? cartonOpt.factor : (opts[0]?.factor || 1);
      setPrixUnitaire(String(Math.round(m.prixUnitaireMoyen * factor)));
    }
  };

  const isFarine = selectedMatiere?.nom.toLowerCase().includes('farine');
  const isGlace = selectedMatiere?.nom.toLowerCase().includes('glace');

  const montantTotal = useMemo(() => {
    const q = parseFloat(quantite) || 0;
    const pu = parseFloat(prixUnitaire) || 0;
    return q * pu;
  }, [quantite, prixUnitaire]);

  const quantiteBaseCalculee = useMemo(() => {
    const q = parseFloat(quantite) || 0;
    const factor = optionActive?.factor || 1;
    return Math.round((q * factor + Number.EPSILON) * 100) / 100;
  }, [quantite, optionActive]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMatiere) {
      toast.error('Veuillez sélectionner une matière première.');
      return;
    }

    const qteNum = parseFloat(quantite);
    if (isNaN(qteNum) || qteNum <= 0) {
      toast.error('Veuillez entrer une quantité valide (> 0).');
      return;
    }

    const factor = optionActive?.factor || 1;
    const qteBase = Math.round((qteNum * factor + Number.EPSILON) * 100) / 100;
    const puNum = parseFloat(prixUnitaire) || 0;
    const puBase = qteBase > 0 && montantTotal > 0
      ? Math.round(montantTotal / qteBase)
      : puNum;

    setIsSubmitting(true);
    try {
      const dateObj = new Date(date);
      dateObj.setHours(12, 0, 0, 0);

      const unitLabelBase = formaterNomUnite(selectedMatiere.unite);
      const motifTexte = factor !== 1
        ? `Réception livraison : ${qteNum} ${optionActive?.labelCourt || ''} (${qteBase} ${unitLabelBase}) de ${selectedMatiere.nom}`
        : `Réception livraison : ${qteNum} ${unitLabelBase} de ${selectedMatiere.nom}`;

      // 1. Enregistrer le mouvement d'entrée en stock
      await addMouvement({
        matiereId: selectedMatiere.id,
        type: 'achat',
        quantite: qteBase,
        prixUnitaire: puBase,
        montantPaye: montantTotal > 0 ? montantTotal : undefined,
        motif: motifTexte,
        fournisseurId: fournisseurId || undefined,
        referenceDocument: reference.trim() || undefined,
        auteur: user?.nom || 'Gérant',
        responsable: 'Responsable Stock',
        date: dateObj,
        userId: user?.id || 'system'
      });

      // 2. Si coché, enregistrer automatiquement la sortie d'argent dans Dépenses
      if (enregistrerEnDepense && montantTotal > 0) {
        await ajouterDepense({
          date: dateObj,
          montant: montantTotal,
          categorie: 'Intrants',
          intrant: selectedMatiere.nom,
          description: `Achat stock : ${qteNum} ${optionActive?.labelCourt || unitLabelBase} de ${selectedMatiere.nom}${reference ? ` (Réf: ${reference})` : ''}`,
          fournisseur: fournisseurs.find(f => f.id === fournisseurId)?.nom,
          moyenPaiement: modePaiement,
          userId: user?.id || 'system'
        });
      }

      toast.success(
        `Réception enregistrée : +${qteNum} ${optionActive?.labelCourt || unitLabelBase} (+${qteBase} ${unitLabelBase}) de ${selectedMatiere.nom} !`
      );

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error('Erreur réception marchandise:', err);
      toast.error("Erreur lors de l'enregistrement de la réception.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Réception de marchandise" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* En-tête informatif sobre */}
        <div className="p-3 bg-sand-50/80 border border-sand-200/70 rounded-xl flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center justify-center shrink-0">
            <Icon icon="mdi:truck-delivery-outline" className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-sand-900">Entrée en stock direct</p>
            <p className="text-[11px] text-sand-500 truncate">
              Ajoute immédiatement les quantités livrées à votre réserve de matières premières.
            </p>
          </div>
        </div>

        {/* Sélection de la Matière */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-sand-700 flex items-center gap-1.5">
              <Icon icon="mdi:package-variant-closed" className="w-4 h-4 text-sand-500" />
              <span>Matière première</span>
            </label>
            {selectedMatiere && (
              <span className="text-[11px] text-sand-500 font-medium bg-sand-100 px-2 py-0.5 rounded-md">
                Stock actuel : <strong className="text-sand-900">{selectedMatiere.stockActuel} {formaterNomUnite(selectedMatiere.unite, selectedMatiere.stockActuel > 1)}</strong>
              </span>
            )}
          </div>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-sand-500 pointer-events-none flex items-center">
              <Icon
                icon={
                  selectedMatiere?.nom.toLowerCase().includes('farine')
                    ? 'mdi:barley'
                    : selectedMatiere?.nom.toLowerCase().includes('glace')
                    ? 'mdi:snowflake'
                    : selectedMatiere?.nom.toLowerCase().includes('levure')
                    ? 'mdi:yeast'
                    : 'mdi:cube-outline'
                }
                className="w-4 h-4 text-emerald-700"
              />
            </div>
            <select
              value={matiereId}
              onChange={(e) => handleMatiereChange(e.target.value)}
              className="w-full py-2.5 pl-9 pr-8 bg-white border border-sand-200 rounded-xl text-sm font-semibold text-sand-900 focus:ring-2 focus:ring-sand-900/10 focus:border-sand-900 outline-none transition-all cursor-pointer shadow-xs"
              required
            >
              {matieres.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nom} ({formaterNomUnite(m.unite)})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Choix de l'unité de livraison si plusieurs conditionnements (ex: Carton de 20 sachets, Sachet, kg) */}
        {optionsConditionnement.length > 1 && (
          <div>
            <label className="block text-xs font-semibold text-sand-700 mb-1.5">
              Unité reçue :
            </label>
            <div className="grid grid-cols-3 gap-2">
              {optionsConditionnement.map((opt) => {
                const isSelected = optionActive?.id === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setUnitReceptionId(opt.id)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white hover:bg-sand-50 text-sand-700 border-sand-200'
                    }`}
                  >
                    <div>{opt.labelCourt}</div>
                    {opt.description && (
                      <div className={`text-[10px] font-normal truncate mt-0.5 ${isSelected ? 'text-emerald-100' : 'text-sand-400'}`}>
                        {opt.factor !== 1 ? `x${opt.factor} ${selectedMatiere?.unite}` : 'base'}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Quantité & Prix unitaire */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-sand-700 mb-1.5">
              Quantité reçue ({optionActive?.labelCourt || formaterNomUnite(selectedMatiere?.unite || '')}) <span className="text-danger-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="any"
                min="0.1"
                placeholder={isFarine ? 'Ex: 50' : isGlace ? 'Ex: 8' : '0'}
                value={quantite}
                onChange={(e) => setQuantite(e.target.value)}
                className="w-full py-2 pl-3 pr-24 text-sm font-semibold bg-white border border-sand-200 rounded-xl text-sand-900 placeholder:text-sand-300 focus:ring-2 focus:ring-sand-900/10 focus:border-sand-900 outline-none transition-all shadow-xs"
                required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-sand-500 bg-sand-50 px-1.5 py-0.5 rounded truncate max-w-[85px]">
                {optionActive?.labelCourt || formaterNomUnite(selectedMatiere?.unite || '') || 'unité'}
              </span>
            </div>
            {optionActive && optionActive.factor !== 1 && quantiteBaseCalculee > 0 && (
              <p className="text-[11px] font-semibold text-emerald-700 mt-1">
                = {quantiteBaseCalculee} {formaterNomUnite(selectedMatiere?.unite || '', quantiteBaseCalculee > 1)} ajoutés au stock
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-sand-700 mb-1.5">
              Prix payé par {optionActive?.labelCourt || formaterNomUnite(selectedMatiere?.unite || '')}
            </label>
            <div className="relative">
              <input
                type="number"
                step="1"
                min="0"
                placeholder={isFarine ? '18000' : isGlace ? '1500' : '0'}
                value={prixUnitaire}
                onChange={(e) => setPrixUnitaire(e.target.value)}
                className="w-full py-2 pl-3 pr-24 text-sm font-semibold bg-white border border-sand-200 rounded-xl text-sand-900 placeholder:text-sand-300 focus:ring-2 focus:ring-sand-900/10 focus:border-sand-900 outline-none transition-all shadow-xs"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-sand-500 bg-sand-50 px-1.5 py-0.5 rounded">
                F/{optionActive?.labelCourt || formaterNomUnite(selectedMatiere?.unite || '') || 'u'}
              </span>
            </div>
          </div>
        </div>

        {/* Récapitulatif montant total */}
        {montantTotal > 0 && (
          <div className="px-3.5 py-2.5 bg-emerald-50/60 border border-emerald-200/60 rounded-xl flex items-center justify-between">
            <span className="text-xs text-emerald-900 font-medium">Coût total calculé</span>
            <span className="text-sm font-bold text-emerald-700">
              {formatCurrency(montantTotal)}
            </span>
          </div>
        )}

        {/* Détails logistiques : Date & Fournisseur */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-sand-700 mb-1.5 flex items-center gap-1.5">
              <Icon icon="mdi:calendar" className="w-3.5 h-3.5 text-sand-500" />
              <span>Date de livraison</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full py-2 px-3 text-sm font-medium bg-white border border-sand-200 rounded-xl text-sand-900 focus:ring-2 focus:ring-sand-900/10 focus:border-sand-900 outline-none transition-all shadow-xs cursor-pointer"
              required
            />
          </div>

          <div>
            <label className="text-xs font-medium text-sand-700 mb-1.5 flex items-center gap-1.5">
              <Icon icon="mdi:domain" className="w-3.5 h-3.5 text-sand-500" />
              <span>Fournisseur</span>
              <span className="text-[11px] text-sand-400 font-normal">(optionnel)</span>
            </label>
            <select
              value={fournisseurId}
              onChange={(e) => setFournisseurId(e.target.value)}
              className="w-full py-2 px-3 text-sm bg-white border border-sand-200 rounded-xl text-sand-900 focus:ring-2 focus:ring-sand-900/10 focus:border-sand-900 outline-none transition-all shadow-xs cursor-pointer"
            >
              <option value="">Sélectionner un fournisseur...</option>
              {fournisseurs.map(f => (
                <option key={f.id} value={f.id}>{f.nom}</option>
              ))}
            </select>
          </div>
        </div>

        {/* N° BL / Facture */}
        <div>
          <label className="text-xs font-medium text-sand-700 mb-1.5 flex items-center gap-1.5">
            <Icon icon="mdi:file-document-outline" className="w-3.5 h-3.5 text-sand-500" />
            <span>Référence BL ou Facture</span>
            <span className="text-[11px] text-sand-400 font-normal">(optionnel)</span>
          </label>
          <input
            type="text"
            placeholder="Ex : BL-10492 ou Facture n°442"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className="w-full py-2 px-3 text-sm bg-white border border-sand-200 rounded-xl text-sand-900 placeholder:text-sand-300 focus:ring-2 focus:ring-sand-900/10 focus:border-sand-900 outline-none transition-all shadow-xs"
          />
        </div>

        {/* Option : Enregistrer aussi en dépense / sortie de caisse */}
        <div className={`p-3.5 border rounded-xl transition-all ${
          enregistrerEnDepense
            ? 'bg-sand-50/90 border-sand-300'
            : 'bg-white border-sand-200 hover:border-sand-300'
        }`}>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={enregistrerEnDepense}
              onChange={(e) => setEnregistrerEnDepense(e.target.checked)}
              className="mt-0.5 rounded border-sand-300 text-sand-900 focus:ring-sand-900/20 w-4 h-4 cursor-pointer"
            />
            <div className="flex-1">
              <span className="block text-xs font-semibold text-sand-900 flex items-center gap-1.5">
                <Icon icon="mdi:cash-register" className="w-4 h-4 text-emerald-700" />
                <span>Enregistrer le règlement immédiat (Dépense)</span>
              </span>
              <span className="block text-[11px] text-sand-500 mt-0.5">
                Crée automatiquement une charge dans le journal des dépenses pour refléter la sortie d&apos;argent.
              </span>
            </div>
          </label>

          {enregistrerEnDepense && (
            <div className="mt-3 pt-3 border-t border-sand-200 animate-in fade-in duration-200">
              <span className="block text-[11px] font-medium text-sand-600 mb-1.5">
                Mode de règlement utilisé :
              </span>
              <div className="grid grid-cols-3 gap-2">
                {(['Especes', 'Mobile Money', 'Cheque'] as const).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setModePaiement(mode)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium border text-center transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      modePaiement === mode
                        ? 'bg-sand-900 text-white border-sand-900 shadow-xs'
                        : 'bg-white text-sand-700 border-sand-200 hover:bg-sand-100/60'
                    }`}
                  >
                    {mode === 'Especes' ? (
                      <>
                        <Icon icon="mdi:cash" className="w-3.5 h-3.5" />
                        <span>Espèces</span>
                      </>
                    ) : mode === 'Mobile Money' ? (
                      <>
                        <Icon icon="mdi:cellphone" className="w-3.5 h-3.5" />
                        <span>Wave / OM</span>
                      </>
                    ) : (
                      <>
                        <Icon icon="mdi:bank-outline" className="w-3.5 h-3.5" />
                        <span>Chèque / Vir.</span>
                      </>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-sand-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-sand-700 hover:bg-sand-100 border border-sand-200 transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition-colors disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Icon icon="mdi:loading" className="w-4 h-4 animate-spin" />
                <span>Enregistrement...</span>
              </>
            ) : (
              <>
                <Icon icon="mdi:check" className="w-4 h-4" />
                <span>Confirmer l&apos;entrée en stock</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
