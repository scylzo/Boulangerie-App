import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type { Client, Facture } from '../../types';
import { downloadReleveFacturesPDF } from '../../utils/pdfGenerator';
import toast from 'react-hot-toast';

interface ReleveImpayesModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client;
  factures: Facture[];
}

export const ReleveImpayesModal: React.FC<ReleveImpayesModalProps> = ({
  isOpen,
  onClose,
  client,
  factures
}) => {
  const [dateDebut, setDateDebut] = useState<string>(() => {
    const d = new Date();
    d.setDate(1); // Premier jour du mois en cours
    return d.toISOString().split('T')[0];
  });
  const [dateFin, setDateFin] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    const start = new Date(dateDebut);
    start.setHours(0, 0, 0, 0);
    const end = new Date(dateFin);
    end.setHours(23, 59, 59, 999);

    if (start > end) {
      toast.error('La date de début doit être avant la date de fin');
      return;
    }

    // Filtrer les factures impayées dans l'intervalle
    const facturesImpayees = factures.filter(f => {
      const d = new Date(f.dateLivraison);
      const isUnpaid = f.statut !== 'payee' && f.statut !== 'annulee';
      return isUnpaid && d >= start && d <= end;
    }).sort((a, b) => new Date(a.dateLivraison).getTime() - new Date(b.dateLivraison).getTime());

    if (facturesImpayees.length === 0) {
      toast.error('Aucune facture impayée trouvée pour cette période');
      return;
    }

    setIsGenerating(true);
    try {
      await downloadReleveFacturesPDF(client, facturesImpayees, start, end);
      toast.success('Relevé généré avec succès');
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la génération du relevé');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-2">
            <Icon icon="mdi:file-document-outline" className="text-xl text-gray-700" />
            <h3 className="font-bold text-gray-800">Relevé des Impayés</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <Icon icon="mdi:close" className="text-xl" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
            <p className="text-sm text-blue-800 font-medium mb-1">Client : {client.nom}</p>
            <p className="text-xs text-blue-600">Générez un récapitulatif de toutes les factures en retard de paiement sur une seule page.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Date de Début</label>
              <Input
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Date de Fin</label>
              <Input
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                className="w-full"
              />
            </div>
          </div>

          <div className="text-xs text-gray-400 italic">
            * Seules les factures non payées seront incluses dans le relevé.
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
          <Button variant="outline" onClick={onClose} disabled={isGenerating}>
            Annuler
          </Button>
          <Button onClick={handleGenerate} isLoading={isGenerating}>
            <Icon icon="mdi:printer" className="mr-2" />
            Imprimer le Relevé
          </Button>
        </div>
      </div>
    </div>
  );
};
