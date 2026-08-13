import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { TableLoader } from '../ui/Loader';
import type { Client, ModePaiement } from '../../types';
import { useFacturationStore } from '../../store/facturationStore';
import { downloadReleveVersementsPDF } from '../../utils/pdfGenerator';
import { formatCurrency } from '../../utils/currency';
import toast from 'react-hot-toast';
import omLogo from '../../assets/om.svg';
import waveLogo from '../../assets/wave.svg';

interface ReleveVersementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client;
}

interface ReglementAffiche {
  id: string;
  date: Date;
  mode: ModePaiement;
  montant: number;
  reference?: string;
  numeroFacture?: string;
}

export const ReleveVersementsModal: React.FC<ReleveVersementsModalProps> = ({
  isOpen,
  onClose,
  client
}) => {
  const [dateDebut, setDateDebut] = useState<string>(() => {
    const d = new Date();
    d.setDate(1); // Premier jour du mois en cours
    return d.toISOString().split('T')[0];
  });
  const [dateFin, setDateFin] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [reglements, setReglements] = useState<ReglementAffiche[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const { getReglementsClientPeriode, getFacturesClient } = useFacturationStore();

  useEffect(() => {
    if (isOpen) {
      chargerDonnees();
    }
  }, [isOpen, dateDebut, dateFin]);

  if (!isOpen) return null;

  const chargerDonnees = async () => {
    const start = new Date(dateDebut);
    start.setHours(0, 0, 0, 0);
    const end = new Date(dateFin);
    end.setHours(23, 59, 59, 999);

    if (start > end) {
      toast.error('La date de début doit être avant la date de fin');
      return;
    }

    setIsLoading(true);
    try {
      // Charger les règlements et les factures en parallèle
      const [regsRaw, facturesRaw] = await Promise.all([
        getReglementsClientPeriode(client.id, start, end),
        getFacturesClient(client.id)
      ]);

      // Créer une map pour associer factureId -> numeroFacture
      const facturesMap = new Map<string, string>();
      facturesRaw.forEach(f => {
        facturesMap.set(f.id, f.numeroFacture);
      });

      // Filtrer les règlements pour exclure ceux dont la facture associée est annulée ou introuvable
      const regsFiltres = regsRaw.filter(r => {
        if (!r.factureId) return true;
        const facture = facturesRaw.find(f => f.id === r.factureId);
        return facture && facture.statut !== 'annulee';
      });

      // Associer les règlements filtrés avec le numéro de facture correspondant
      const regsAffiche: ReglementAffiche[] = regsFiltres.map(r => {
        const facture = r.factureId ? facturesRaw.find(f => f.id === r.factureId) : undefined;
        return {
          id: r.id,
          date: r.date,
          mode: r.mode,
          montant: r.montant,
          reference: r.reference || undefined,
          numeroFacture: facture?.numeroFacture
        };
      });

      setReglements(regsAffiche);
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors du chargement des versements');
    } finally {
      setIsLoading(false);
    }
  };

  const totalVersements = reglements.reduce((sum, r) => sum + r.montant, 0);

  const handleGenerate = async () => {
    if (reglements.length === 0) {
      toast.error('Aucun versement trouvé pour cette période');
      return;
    }

    setIsGenerating(true);
    try {
      const start = new Date(dateDebut);
      start.setHours(0, 0, 0, 0);
      const end = new Date(dateFin);
      end.setHours(23, 59, 59, 999);

      await downloadReleveVersementsPDF(client, reglements, start, end);
      toast.success('Relevé des versements généré avec succès');
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la génération du PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  const getModePaiementInfo = (mode: ModePaiement) => {
    switch (mode) {
      case 'espece': 
        return { label: 'Espèces', color: 'bg-success-50 text-success-700 ring-success-100', icon: 'mdi:cash', isImage: false };
      case 'om': 
        return { label: 'Orange Money', color: 'bg-warning-50 text-warning-600 ring-warning-100', image: omLogo, isImage: true };
      case 'wave': 
        return { label: 'Wave', color: 'bg-info-50 text-info-600 ring-info-100', image: waveLogo, isImage: true };
      default: 
        return { label: mode, color: 'bg-sand-100 text-sand-700 ring-sand-200', icon: 'mdi:cash', isImage: false };
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-elevated w-full max-w-3xl overflow-hidden animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        
        {/* En-tête */}
        <div className="p-4 border-b border-sand-100 flex justify-between items-center bg-sand-50 shrink-0">
          <div className="flex items-center gap-2">
            <Icon icon="mdi:cash-multiple" className="text-xl text-primary-600 text-blue-600" />
            <h3 className="font-semibold text-sand-800">
              Relevé des Versements
            </h3>
          </div>
          <button onClick={onClose} className="text-sand-400 hover:text-sand-600 transition-colors">
            <Icon icon="mdi:close" className="text-xl" />
          </button>
        </div>

        {/* Corps */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          
          {/* Infos Client & Résumé */}
          <div className="flex flex-col md:flex-row justify-between gap-4 bg-blue-50 border border-blue-100 p-4 rounded-lg">
            <div className="min-w-0">
              <p className="text-xs text-blue-600 font-semibold uppercase tracking-wider mb-1">Client</p>
              <h4 className="font-semibold text-sand-900 text-base">{client.nom}</h4>
              <p className="text-xs text-sand-500 mt-1">
                {client.telephone ? `Tél : ${client.telephone}` : 'Pas de téléphone renseigné'}
                {client.adresse ? ` · ${client.adresse}` : ''}
              </p>
            </div>
            <div className="shrink-0 md:text-right">
              <p className="text-xs text-blue-600 font-semibold uppercase tracking-wider mb-1">Total versé sur la période</p>
              <p className="font-display text-2xl font-bold text-blue-700 tabular-nums">
                {formatCurrency(totalVersements)}
              </p>
              <p className="text-xs text-sand-500">{reglements.length} transaction(s)</p>
            </div>
          </div>

          {/* Sélecteurs de dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-sand-500 uppercase tracking-wider mb-1.5">Date de Début</label>
              <Input
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-sand-500 uppercase tracking-wider mb-1.5">Date de Fin</label>
              <Input
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                className="w-full"
              />
            </div>
          </div>

          {/* Tableau de visualisation à l'écran */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-sand-700 uppercase tracking-wider">Aperçu des versements</h4>
            
            {isLoading ? (
              <div className="border border-sand-200 rounded-lg p-8">
                <TableLoader message="Chargement des versements..." />
              </div>
            ) : reglements.length === 0 ? (
              <div className="border border-dashed border-sand-200 rounded-lg p-8 text-center text-sand-500 bg-sand-50/50">
                <Icon icon="mdi:cash-off" className="text-4xl mx-auto mb-2 text-sand-300" />
                <p className="text-sm">Aucun versement trouvé pour ce client sur cette période.</p>
              </div>
            ) : (
              <div className="border border-sand-200 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-sand-50 text-sand-500 text-xs uppercase font-medium border-b border-sand-200 sticky top-0">
                    <tr>
                      <th className="px-4 py-2.5">Date</th>
                      <th className="px-4 py-2.5">Moyen</th>
                      <th className="px-4 py-2.5">Référence</th>
                      <th className="px-4 py-2.5">N° Facture</th>
                      <th className="px-4 py-2.5 text-right">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sand-100 tabular-nums">
                    {reglements.map((r) => {
                      const info = getModePaiementInfo(r.mode);
                      return (
                        <tr key={r.id} className="hover:bg-sand-50/50">
                          <td className="px-4 py-2.5 text-sand-600">
                            {new Date(r.date).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${info.color}`}>
                              {info.isImage ? (
                                <img src={info.image} alt={info.label} className="w-3.5 h-3.5 object-contain" />
                              ) : (
                                <Icon icon={info.icon || ''} className="text-sm" />
                              )}
                              {info.label}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-sand-500 max-w-[150px] truncate" title={r.reference}>
                            {r.reference || '—'}
                          </td>
                          <td className="px-4 py-2.5 text-sand-500">
                            {r.numeroFacture || '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold text-sand-900">
                            {formatCurrency(r.montant)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-sand-100 flex justify-end gap-3 bg-sand-50 shrink-0">
          <Button variant="outline" onClick={onClose} disabled={isGenerating}>
            Annuler
          </Button>
          <Button 
            onClick={handleGenerate} 
            isLoading={isGenerating}
            disabled={isLoading || reglements.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Icon icon="mdi:printer" className="mr-2 text-lg" />
            Imprimer le Relevé
          </Button>
        </div>
      </div>
    </div>
  );
};
