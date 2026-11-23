import React, { useState, useMemo } from 'react';
import { Icon } from '@iconify/react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useStockStore } from '../../store/stockStore';
import { useDepenseStore } from '../../store/depenseStore';
import { useAuthStore } from '../../store';
import { formatCurrency } from '../../utils/currency';
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

  // Si l'utilisateur choisit une matière différente, pré-remplir le prix unitaire moyen existant
  const handleMatiereChange = (id: string) => {
    setMatiereId(id);
    const m = matieres.find(mat => mat.id === id);
    if (m && m.prixUnitaireMoyen > 0) {
      setPrixUnitaire(String(Math.round(m.prixUnitaireMoyen)));
    }
  };

  const isFarine = selectedMatiere?.nom.toLowerCase().includes('farine');
  const isGlace = selectedMatiere?.nom.toLowerCase().includes('glace');

  const montantTotal = useMemo(() => {
    const q = parseFloat(quantite) || 0;
    const pu = parseFloat(prixUnitaire) || 0;
    return q * pu;
  }, [quantite, prixUnitaire]);

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

    const puNum = parseFloat(prixUnitaire) || 0;

    setIsSubmitting(true);
    try {
      const dateObj = new Date(date);
      dateObj.setHours(12, 0, 0, 0);

      // 1. Enregistrer le mouvement d'entrée en stock
      await addMouvement({
        matiereId: selectedMatiere.id,
        type: 'achat',
        quantite: qteNum,
        prixUnitaire: puNum,
        montantPaye: montantTotal > 0 ? montantTotal : undefined,
        motif: `Réception livraison : ${qteNum} ${selectedMatiere.unite} de ${selectedMatiere.nom}`,
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
          description: `Achat stock : ${qteNum} ${selectedMatiere.unite} de ${selectedMatiere.nom}${reference ? ` (Réf: ${reference})` : ''}`,
          fournisseur: fournisseurs.find(f => f.id === fournisseurId)?.nom,
          moyenPaiement: modePaiement,
          userId: user?.id || 'system'
        });
      }

      toast.success(
        `Réception enregistrée : +${qteNum} ${selectedMatiere.unite} de ${selectedMatiere.nom} !`
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
    <Modal isOpen={isOpen} onClose={onClose} title="Réception de Marchandise (Entrée Stock)">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* En-tête informatif */}
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-xs text-emerald-900">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <Icon icon="mdi:truck-delivery" className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold">Ajout direct à la réserve</p>
            <p className="text-emerald-800 text-[11px]">
              Enregistrez l&apos;arrivée de vos sacs de farine, sacs de glace, levure ou ingrédients.
            </p>
          </div>
        </div>

        {/* Sélection de la Matière */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-sand-700 mb-1.5">
            Matière Première Réceptionnée :
          </label>
          <select
            value={matiereId}
            onChange={(e) => handleMatiereChange(e.target.value)}
            className="w-full py-2.5 px-3 bg-white border border-sand-300 rounded-xl text-sm font-semibold text-sand-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
            required
          >
            {matieres.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nom.toLowerCase().includes('farine') ? '🌾 ' : m.nom.toLowerCase().includes('glace') ? '❄️ ' : '📦 '}
                {m.nom} ({m.unite})
              </option>
            ))}
          </select>
        </div>

        {/* Quantité & Prix unitaire */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-sand-700 mb-1.5">
              Quantité reçue ({selectedMatiere?.unite || 'unités'}) :
            </label>
            <div className="relative">
              <input
                type="number"
                step="any"
                min="0.1"
                placeholder={isFarine ? 'Ex: 50 (sacs)' : isGlace ? 'Ex: 8 (sacs)' : '0'}
                value={quantite}
                onChange={(e) => setQuantite(e.target.value)}
                className="w-full py-2 px-3 text-sm font-bold bg-white border border-sand-300 rounded-xl text-sand-900 focus:ring-emerald-500 focus:border-emerald-500"
                required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-sand-400">
                {selectedMatiere?.unite}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-sand-700 mb-1.5">
              Prix unitaire payé (FCFA) :
            </label>
            <div className="relative">
              <input
                type="number"
                step="1"
                min="0"
                placeholder={isFarine ? '18 000' : isGlace ? '1 500' : '0'}
                value={prixUnitaire}
                onChange={(e) => setPrixUnitaire(e.target.value)}
                className="w-full py-2 px-3 text-sm font-bold bg-white border border-sand-300 rounded-xl text-sand-900 focus:ring-emerald-500 focus:border-emerald-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-sand-400">
                FCFA/{selectedMatiere?.unite}
              </span>
            </div>
          </div>
        </div>

        {/* Date, Fournisseur & Référence */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-sand-700 mb-1.5">
              Date de réception :
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full py-2 px-3 text-sm font-semibold bg-white border border-sand-300 rounded-xl text-sand-900"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-sand-700 mb-1.5">
              Fournisseur (Optionnel) :
            </label>
            <select
              value={fournisseurId}
              onChange={(e) => setFournisseurId(e.target.value)}
              className="w-full py-2 px-3 text-sm bg-white border border-sand-300 rounded-xl text-sand-900"
            >
              <option value="">Non spécifié</option>
              {fournisseurs.map(f => (
                <option key={f.id} value={f.id}>{f.nom}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-sand-700 mb-1.5">
              N° BL / Facture (Optionnel) :
            </label>
            <input
              type="text"
              placeholder="Ex: BL-10492"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full py-2 px-3 text-sm bg-white border border-sand-300 rounded-xl text-sand-900"
            />
          </div>
        </div>

        {/* Montant Total estimé */}
        {montantTotal > 0 && (
          <div className="p-3 bg-sand-100 rounded-xl flex items-center justify-between text-xs">
            <span className="font-semibold text-sand-700">Coût total de la livraison :</span>
            <span className="text-base font-extrabold text-emerald-700">
              {formatCurrency(montantTotal)}
            </span>
          </div>
        )}

        {/* Option : Enregistrer aussi en sortie de caisse */}
        <div className="p-3 bg-sand-50 border border-sand-200 rounded-xl space-y-2">
          <label className="flex items-center gap-2 text-xs font-bold text-sand-800 cursor-pointer">
            <input
              type="checkbox"
              checked={enregistrerEnDepense}
              onChange={(e) => setEnregistrerEnDepense(e.target.checked)}
              className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
            />
            <span>Enregistrer aussi en sortie d&apos;argent (Dépense payée au comptant)</span>
          </label>

          {enregistrerEnDepense && (
            <div className="pt-2 border-t border-sand-200 flex items-center gap-3 text-xs">
              <span className="text-sand-600">Moyen de paiement :</span>
              <div className="flex gap-2">
                {(['Especes', 'Mobile Money', 'Cheque'] as const).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setModePaiement(mode)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                      modePaiement === mode
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-sand-700 border-sand-300'
                    }`}
                  >
                    {mode === 'Especes' ? '💵 Espèces (Caisse)' : mode === 'Mobile Money' ? '📱 Wave/OM' : '🏦 Chèque/Vir'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Boutons d'action */}
        <div className="flex justify-end gap-2 pt-2 border-t border-sand-100">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button
            variant="primary"
            type="submit"
            isLoading={isSubmitting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Icon icon="mdi:check" className="w-5 h-5 mr-1" />
            Confirmer l&apos;entrée en stock
          </Button>
        </div>
      </form>
    </Modal>
  );
};
