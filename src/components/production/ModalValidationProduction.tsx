import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

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
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSacsFarine(sacsInitiaux && sacsInitiaux > 0 ? sacsInitiaux : 0);
    }
  }, [isOpen, sacsInitiaux]);

  // Rendement : nombre de pièces par sac
  const rendement = sacsFarine > 0 ? Math.round(totalPains / sacsFarine) : 0;

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
      <div className="space-y-6">
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

        {/* Calcul du rendement en direct */}
        {sacsFarine > 0 && totalPains > 0 && (
          <div className="p-4 rounded-xl border bg-sand-50 border-sand-200 text-sand-900 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-sand-500">Rendement constaté</div>
              <div className="text-xl font-bold mt-0.5">{rendement} pièces / sac de 50 kg</div>
            </div>
          </div>
        )}

        {/* Note d'impact */}
        <p className="text-xs text-sand-500 bg-sand-50 p-3 rounded-lg border border-sand-200">
          ℹ️ En confirmant, la production sera marquée comme <strong>terminée</strong> et le rendement par sac (<strong>{sacsFarine} sacs pétris</strong>) sera enregistré pour le suivi.
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
