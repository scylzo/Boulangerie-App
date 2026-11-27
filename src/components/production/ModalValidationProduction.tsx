import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import {
  getParametresRendement,
  saveParametresRendement,
  calculerRendementTheoriqueParSac
} from '../../utils/calculations';

interface ModalValidationProductionProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (sacsFarine: number) => Promise<void>;
  totalPains: number;
  dateProduction: Date;
  sacsInitiaux?: number;
}

export const ModalValidationProduction: React.FC<ModalValidationProductionProps> = ({
  isOpen,
  onClose,
  onConfirm,
  totalPains,
  dateProduction,
  sacsInitiaux
}) => {
  const [sacsFarine, setSacsFarine] = useState<number>(sacsInitiaux || 0);
  const [poidsBaguette, setPoidsBaguette] = useState<number>(() => getParametresRendement().poidsBaguetteGr);
  const [coeffRendement, setCoeffRendement] = useState<number>(() => getParametresRendement().coeffRendement);
  const [showParams, setShowParams] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSacsFarine(sacsInitiaux && sacsInitiaux > 0 ? sacsInitiaux : 0);
      const saved = getParametresRendement();
      setPoidsBaguette(saved.poidsBaguetteGr);
      setCoeffRendement(saved.coeffRendement);
    }
  }, [isOpen, sacsInitiaux]);

  const handlePoidsChange = (val: number) => {
    const clean = Math.max(1, val);
    setPoidsBaguette(clean);
    saveParametresRendement({ poidsBaguetteGr: clean, coeffRendement });
  };

  const handleCoeffChange = (val: number) => {
    const clean = Math.max(1, val);
    setCoeffRendement(clean);
    saveParametresRendement({ poidsBaguetteGr: poidsBaguette, coeffRendement: clean });
  };

  // Rendement théorique (50 kg × coeff ÷ poids baguette) et rendement constaté
  const rendementTheorique = calculerRendementTheoriqueParSac(poidsBaguette, coeffRendement);
  const rendementConstate = sacsFarine > 0 ? Math.round(totalPains / sacsFarine) : 0;
  const tauxAtteinte = rendementTheorique > 0 && rendementConstate > 0
    ? Math.round((rendementConstate / rendementTheorique) * 100)
    : 0;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(sacsFarine);
      onClose();
    } catch (error) {
      console.error('Erreur lors de la validation:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Clôturer la production">
      <div className="space-y-5">
        {/* En-tête informatif */}
        <div className="flex items-start gap-3 p-3.5 bg-sand-50 rounded-xl border border-sand-200">
          <Icon icon="mdi:bread-slice" className="w-8 h-8 text-terracotta-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-sand-900">
              Production du {new Date(dateProduction).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <p className="text-sand-600 text-xs mt-0.5">
              Total fabriqué : <strong className="text-sand-900">{totalPains} pièces</strong>
            </p>
          </div>
        </div>

        {/* Saisie des sacs de farine pétris */}
        <div className="space-y-3">
          <label className="block text-sm font-bold text-sand-900">
            Nombre de sacs de farine de 50 kg pétris :
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSacsFarine(prev => Math.max(0, Math.round((prev - 0.5) * 10) / 10))}
              className="w-12 h-12 flex items-center justify-center rounded-xl bg-sand-100 hover:bg-sand-200 text-sand-800 font-bold text-xl border border-sand-300 transition-colors"
            >
              −
            </button>
            <div className="flex-1 relative">
              <input
                type="number"
                step="0.5"
                min="0"
                value={sacsFarine || ''}
                placeholder="0"
                onChange={(e) => setSacsFarine(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full text-center text-2xl font-bold py-2.5 px-4 bg-white border-2 border-terracotta-400 focus:border-terracotta-600 focus:ring-0 rounded-xl text-sand-900 shadow-sm"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-sand-500 uppercase">
                sacs (50kg)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSacsFarine(prev => Math.round((prev + 0.5) * 10) / 10)}
              className="w-12 h-12 flex items-center justify-center rounded-xl bg-sand-100 hover:bg-sand-200 text-sand-800 font-bold text-xl border border-sand-300 transition-colors"
            >
              +
            </button>
          </div>
        </div>

        {/* Paramètres de référence (poids baguette & coefficient 1366) */}
        <div className="rounded-xl border border-sand-200 bg-sand-50/70 p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-sand-700">
              <span className="font-semibold text-sand-900">Norme théorique :</span>{' '}
              <strong className="text-terracotta-700">{rendementTheorique} pcs / sac</strong>{' '}
              <span className="text-sand-500">
                (50 kg × {(coeffRendement / 1000).toFixed(3).replace('.', ',')} ÷ {poidsBaguette} g)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowParams(prev => !prev)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-white border border-sand-200 text-sand-700 hover:bg-sand-100 transition-colors shrink-0"
            >
              <Icon icon="mdi:tune-variant" className="w-3.5 h-3.5" />
              <span>{showParams ? 'Masquer' : 'Modifier'}</span>
            </button>
          </div>

          {showParams && (
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-sand-200/80">
              <div>
                <label className="block text-[11px] font-semibold text-sand-600 mb-1">
                  Poids baguette (g)
                </label>
                <input
                  type="number"
                  min="50"
                  step="10"
                  value={poidsBaguette}
                  onChange={(e) => handlePoidsChange(parseFloat(e.target.value) || 300)}
                  className="w-full px-2.5 py-1.5 text-sm font-bold bg-white border border-sand-300 rounded-lg text-sand-900 focus:border-terracotta-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-sand-600 mb-1">
                  Coefficient rendement
                </label>
                <input
                  type="number"
                  min="500"
                  step="1"
                  value={coeffRendement}
                  onChange={(e) => handleCoeffChange(parseFloat(e.target.value) || 1366)}
                  className="w-full px-2.5 py-1.5 text-sm font-bold bg-white border border-sand-300 rounded-lg text-sand-900 focus:border-terracotta-500 outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Calcul du rendement en direct */}
        {sacsFarine > 0 && totalPains > 0 && (
          <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
            tauxAtteinte >= 95
              ? 'bg-success-50 border-success-200 text-success-900'
              : tauxAtteinte >= 88
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}>
            <div>
              <div className="text-xs font-bold uppercase tracking-wide opacity-80">Rendement constaté</div>
              <div className="text-xl font-bold mt-0.5">{rendementConstate} pièces / sac</div>
              <div className="text-[11px] opacity-80 mt-0.5">
                {tauxAtteinte}% de la norme ({rendementTheorique} pcs/sac)
              </div>
            </div>
            <div className="text-right text-xs font-semibold shrink-0">
              {tauxAtteinte >= 95 ? (
                <span className="inline-flex items-center gap-1 text-success-700">
                  <Icon icon="mdi:check-circle" className="w-5 h-5" /> Conforme
                </span>
              ) : tauxAtteinte >= 88 ? (
                <span className="inline-flex items-center gap-1 text-amber-700">
                  <Icon icon="mdi:alert" className="w-5 h-5" /> Sous la norme
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-rose-700">
                  <Icon icon="mdi:alert-circle" className="w-5 h-5" /> Écart important
                </span>
              )}
            </div>
          </div>
        )}

        {/* Note d'impact */}
        <p className="text-xs text-sand-500 bg-sand-50 p-3 rounded-lg border border-sand-200">
          En confirmant, la production sera marquée comme <strong>terminée</strong> et les{' '}
          <strong>{sacsFarine} sacs pétris</strong> seront enregistrés pour le suivi du rendement.
        </p>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            isLoading={isSubmitting}
            className="bg-terracotta-600 hover:bg-terracotta-700 text-white"
          >
            <Icon icon="mdi:check" className="w-5 h-5 mr-1" />
            Confirmer la production
          </Button>
        </div>
      </div>
    </Modal>
  );
};
