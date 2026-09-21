import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useLivraisonStore } from '../../store/livraisonStore';
import toast from 'react-hot-toast';

interface ModalQuotaGlobalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ModalQuotaGlobal: React.FC<ModalQuotaGlobalProps> = ({
  isOpen,
  onClose
}) => {
  const { parametresLivraison, chargerParametresLivraison, sauvegarderParametresLivraison } = useLivraisonStore();
  const [pourcentage, setPourcentage] = useState<string>('10');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      chargerParametresLivraison().catch(console.error);
    }
  }, [isOpen, chargerParametresLivraison]);

  useEffect(() => {
    if (parametresLivraison?.pourcentageRetourGlobalMax !== undefined) {
      setPourcentage(String(parametresLivraison.pourcentageRetourGlobalMax));
    }
  }, [parametresLivraison]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(pourcentage);
    if (isNaN(num) || num < 0 || num > 100) {
      toast.error('Veuillez saisir un pourcentage valide entre 0 et 100%');
      return;
    }

    try {
      setIsSaving(true);
      await sauvegarderParametresLivraison({
        pourcentageRetourGlobalMax: num
      });
      toast.success(`Quota global de retour défini à ${num}%`);
      onClose();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du quota global:', error);
      toast.error('Erreur lors de la sauvegarde du quota global');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Paramètres du Quota Global de Retours">
      <form onSubmit={handleSave} className="space-y-4">
        <div className="bg-sand-50 p-4 rounded-xl border border-sand-200">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Icon icon="mdi:keyboard-return" className="text-xl" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-sand-900">
                Taux de retour maximal global (%)
              </h4>
              <p className="text-xs text-sand-600 mt-1 leading-relaxed">
                Ce pourcentage par défaut s'applique à tous les produits livrés aux clients.
                Si un produit ou un client dispose d'un taux spécifique personnalisé, celui-ci restera prioritaire.
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <div className="w-40">
              <Input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={pourcentage}
                onChange={(e) => setPourcentage(e.target.value)}
                placeholder="10"
                required
              />
            </div>
            <span className="text-sm font-bold text-sand-700">% de retour maximum autorisé</span>
          </div>
        </div>

        {/* Rappel de la règle de priorité */}
        <div className="bg-white border border-sand-200 rounded-lg p-3 text-xs text-sand-600 space-y-1.5">
          <div className="font-semibold text-sand-800 flex items-center gap-1.5">
            <Icon icon="mdi:order-bool-ascending-variant" className="text-sm text-terracotta-600" />
            Ordre de priorité du calcul :
          </div>
          <ol className="list-decimal list-inside space-y-1 pl-1 text-sand-600">
            <li><span className="font-medium text-sand-800">Exception Client :</span> Si le client a un taux défini pour un produit donné.</li>
            <li><span className="font-medium text-sand-800">Taux Produit :</span> Si le produit a son propre taux (ex: 10% pour la baguette).</li>
            <li><span className="font-medium text-sand-800">Taux Global :</span> Ce taux par défaut s'applique pour tout le reste.</li>
          </ol>
        </div>

        <div className="flex justify-end gap-2.5 pt-2 border-t border-sand-100">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Annuler
          </Button>
          <Button type="submit" isLoading={isSaving}>
            Enregistrer le quota
          </Button>
        </div>
      </form>
    </Modal>
  );
};
