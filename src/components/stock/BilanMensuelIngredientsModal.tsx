import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from '@iconify/react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useStockStore } from '../../store/stockStore';
import { formatCurrency } from '../../utils/currency';
import { formaterQuantite } from '../../utils/calculations';
import toast from 'react-hot-toast';

interface BilanMensuelIngredientsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface LigneSaisieIngredient {
  matiereId: string;
  nom: string;
  unite: string;
  stockActuel: number;
  prixUnitaireMoyen: number;
  quantiteSaisie: string;
}

export const BilanMensuelIngredientsModal: React.FC<BilanMensuelIngredientsModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { matieres, chargerDonnees, addMatiere, addMouvement } = useStockStore();

  // Mois sélectionné : format "YYYY-MM"
  const now = new Date();
  const defautMois = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [moisSelectionne, setMoisSelectionne] = useState<string>(defautMois);

  const [lignes, setLignes] = useState<LigneSaisieIngredient[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAjoutantGlace, setIsAjoutantGlace] = useState(false);

  useEffect(() => {
    if (isOpen) {
      chargerDonnees();
    }
  }, [isOpen, chargerDonnees]);

  // Toutes les matières premières actives (avec la Farine et la Glace mises en tête de liste)
  const matieresAffichees = useMemo(() => {
    return matieres
      .filter(m => m.active)
      .sort((a, b) => {
        const nomA = a.nom.toLowerCase();
        const nomB = b.nom.toLowerCase();
        const isFarineA = nomA.includes('farine');
        const isFarineB = nomB.includes('farine');
        if (isFarineA && !isFarineB) return -1;
        if (!isFarineA && isFarineB) return 1;

        const isGlaceA = nomA.includes('glace');
        const isGlaceB = nomB.includes('glace');
        if (isGlaceA && !isGlaceB) return -1;
        if (!isGlaceA && isGlaceB) return 1;

        return a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' });
      });
  }, [matieres]);

  const aGlace = useMemo(() => {
    return matieres.some(m => m.nom.toLowerCase().includes('glace'));
  }, [matieres]);

  const handleAjouterGlaceRapide = async () => {
    setIsAjoutantGlace(true);
    try {
      await addMatiere({
        nom: 'Glace',
        unite: 'sac',
        stockActuel: 0,
        stockMinimum: 16,
        prixUnitaireMoyen: 1500,
        active: true,
        createdAt: new Date()
      });
      await chargerDonnees();
      toast.success("Matière 'Glace' (1 500 FCFA / sac) ajoutée au stock !");
    } catch (e) {
      console.error(e);
      toast.error("Impossible d'ajouter la matière Glace.");
    } finally {
      setIsAjoutantGlace(false);
    }
  };

  useEffect(() => {
    if (matieresAffichees.length > 0) {
      setLignes(
        matieresAffichees.map(m => ({
          matiereId: m.id,
          nom: m.nom,
          unite: m.unite,
          stockActuel: m.stockActuel,
          prixUnitaireMoyen: m.prixUnitaireMoyen || 0,
          quantiteSaisie: ''
        }))
      );
    }
  }, [matieresAffichees]);

  const handleQuantiteChange = (matiereId: string, val: string) => {
    setLignes(prev =>
      prev.map(l => (l.matiereId === matiereId ? { ...l, quantiteSaisie: val } : l))
    );
  };

  // Calcul du coût total estimé des sachets/ingrédients saisis
  const totalCoutEstime = useMemo(() => {
    return lignes.reduce((sum, l) => {
      const qte = parseFloat(l.quantiteSaisie);
      if (!isNaN(qte) && qte > 0) {
        return sum + qte * l.prixUnitaireMoyen;
      }
      return sum;
    }, 0);
  }, [lignes]);

  // Nombre de lignes renseignées
  const nbLignesRenseignees = useMemo(() => {
    return lignes.filter(l => {
      const q = parseFloat(l.quantiteSaisie);
      return !isNaN(q) && q > 0;
    }).length;
  }, [lignes]);

  // Libellé du mois (ex: Novembre 2026 : du 01 au 30)
  const nomMoisFormatte = useMemo(() => {
    const [annee, mois] = moisSelectionne.split('-').map(Number);
    const dateMois = new Date(annee, mois - 1, 1);
    const dernierJour = new Date(annee, mois, 0).getDate();
    const moisNom = dateMois.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return `${moisNom.charAt(0).toUpperCase() + moisNom.slice(1)} (du 01 au ${dernierJour})`;
  }, [moisSelectionne]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const aEnregistrer = lignes.filter(l => {
      const q = parseFloat(l.quantiteSaisie);
      return !isNaN(q) && q > 0;
    });

    if (aEnregistrer.length === 0) {
      toast.error('Veuillez renseigner au moins un nombre de sachets ou quantité.');
      return;
    }

    setIsSubmitting(true);
    try {
      const [annee, mois] = moisSelectionne.split('-').map(Number);
      // Date de fin de mois pour l'enregistrement comptable
      const dateFinMois = new Date(annee, mois, 0, 18, 0, 0);

      for (const ligne of aEnregistrer) {
        const qte = parseFloat(ligne.quantiteSaisie);
        await addMouvement({
          matiereId: ligne.matiereId,
          quantite: qte,
          type: 'consommation',
          motif: `Bilan mensuel ${nomMoisFormatte} : ${qte} ${ligne.unite} consommé(s)`,
          auteur: 'Gérant',
          responsable: 'Responsable Stock',
          referenceDocument: `BILAN-${moisSelectionne}`,
          date: dateFinMois,
          userId: 'system'
        });
      }

      toast.success(`Bilan mensuel enregistré pour ${aEnregistrer.length} ingrédient(s) !`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error('Erreur enregistrement bilan mensuel:', error);
      toast.error("Erreur lors de l'enregistrement du bilan mensuel.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Bilan Mensuel des Matières & Ingrédients">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* En-tête explicatif */}
        <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-3">
          <Icon icon="mdi:calendar-month-outline" className="w-6 h-6 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm text-amber-950">
              Bilan périodique : Farine, Levure, Améliorant & Ingrédients
            </p>
            <p className="mt-1 text-amber-800">
              Indiquez le nombre de sacs (farine), sachets ou unités consommés sur l&apos;ensemble du mois. 
              Le système déduira le stock et valorisera le coût dans vos finances mensuelles.
            </p>
          </div>
        </div>

        {/* Sélecteur de mois */}
        <div className="flex items-center justify-between bg-sand-50 p-3 rounded-xl border border-sand-200">
          <label className="text-xs font-bold uppercase tracking-wider text-sand-700">
            Période du bilan :
          </label>
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={moisSelectionne}
              onChange={(e) => setMoisSelectionne(e.target.value)}
              className="text-xs font-bold py-1.5 px-3 bg-white border border-sand-300 rounded-lg text-sand-900 shadow-2xs focus:ring-terracotta-500 focus:border-terracotta-500"
            />
          </div>
        </div>

        {/* Bannière d'ajout rapide pour la Glace si elle n'est pas encore enregistrée */}
        {!aGlace && (
          <div className="p-3 bg-cyan-50/90 border border-cyan-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-cyan-950">
              <span className="w-8 h-8 rounded-lg bg-cyan-100 flex items-center justify-center shrink-0 text-base">❄️</span>
              <div>
                <p className="font-bold text-cyan-950">Glace de pétrin (8 sacs tous les ~2 jours à 1 500 F) :</p>
                <p className="text-cyan-800 text-[11px] mt-0.5">Cliquez pour ajouter &quot;Glace&quot; (unité : sac, PMP : 1 500 FCFA) et l&apos;intégrer à ce bilan mensuel.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleAjouterGlaceRapide}
              disabled={isAjoutantGlace}
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg shrink-0 shadow-xs flex items-center gap-1.5 transition-all self-end sm:self-center"
            >
              <Icon icon="mdi:plus" className="w-4 h-4" />
              <span>{isAjoutantGlace ? 'Ajout...' : 'Ajouter "Glace" (1 500 F/sac)'}</span>
            </button>
          </div>
        )}

        <p className="text-xs font-semibold text-sand-700">
          📅 Consommation pour : <span className="text-terracotta-700">{nomMoisFormatte}</span>
        </p>

        {/* Liste des ingrédients */}
        <div className="max-h-[320px] overflow-y-auto space-y-2.5 pr-1 divide-y divide-sand-100">
          {lignes.length === 0 ? (
            <p className="text-center text-xs text-sand-500 py-6">
              Aucune matière première trouvée.
            </p>
          ) : (
            lignes.map((l) => {
              const isFarine = l.nom.toLowerCase().includes('farine');
              const isGlace = l.nom.toLowerCase().includes('glace');
              return (
                <div
                  key={l.matiereId}
                  className={`pt-2.5 flex items-center justify-between gap-3 ${
                    isFarine ? 'bg-amber-50/50 p-2 rounded-lg' : isGlace ? 'bg-cyan-50/50 p-2 rounded-lg' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-sand-900 truncate">{l.nom}</p>
                      {isFarine && (
                        <span className="px-1.5 py-0.5 text-[10px] font-extrabold bg-amber-200 text-amber-900 rounded shrink-0">
                          🌾 Farine
                        </span>
                      )}
                      {isGlace && (
                        <span className="px-1.5 py-0.5 text-[10px] font-extrabold bg-cyan-200 text-cyan-900 rounded shrink-0">
                          ❄️ Glace (pétrin)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-sand-500 mt-0.5">
                      Stock actuel : <span className={`font-semibold ${l.stockActuel < 0 ? 'text-amber-700' : 'text-sand-800'}`}>{formaterQuantite(l.stockActuel, l.unite)}</span>
                      {l.prixUnitaireMoyen > 0 && (
                        <span> · PMP : {formatCurrency(Math.round(l.prixUnitaireMoyen))}/{l.unite}</span>
                      )}
                    </p>
                  </div>

                  <div className="w-36 flex items-center gap-1.5">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0"
                      value={l.quantiteSaisie}
                      onChange={(e) => handleQuantiteChange(l.matiereId, e.target.value)}
                      className="w-full text-right text-sm font-bold py-1.5 px-2.5 bg-white border border-sand-300 focus:border-terracotta-500 focus:ring-0 rounded-lg text-sand-900"
                    />
                    <span className="text-xs text-sand-500 font-semibold shrink-0 w-12 truncate">
                      {l.unite}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Récapitulatif du coût total */}
        {totalCoutEstime > 0 && (
          <div className="p-3 bg-sand-100 rounded-xl flex items-center justify-between text-xs font-bold text-sand-900">
            <span>Coût total estimé des ingrédients saisis ({nbLignesRenseignees} renseigné(s)) :</span>
            <span className="text-sm font-extrabold text-terracotta-700">
              {formatCurrency(totalCoutEstime)}
            </span>
          </div>
        )}

        {/* Boutons d'action */}
        <div className="flex justify-end gap-3 pt-3 border-t border-sand-200">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting} type="button">
            Annuler
          </Button>
          <Button
            variant="primary"
            type="submit"
            isLoading={isSubmitting}
            className="bg-terracotta-600 hover:bg-terracotta-700 text-white font-semibold"
          >
            <Icon icon="mdi:check-circle" className="w-4 h-4 mr-1.5" />
            Valider le bilan du mois
          </Button>
        </div>
      </form>
    </Modal>
  );
};
