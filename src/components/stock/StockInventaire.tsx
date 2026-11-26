import React, { useState, useMemo } from 'react';
import { useStockStore } from '../../store/stockStore';
import { useAuthStore } from '../../store/authStore';
import { formaterQuantite } from '../../utils/calculations';
import { ClipboardCheck, CheckCircle2, ArrowRight, RotateCcw, Search, Sparkles } from 'lucide-react';
import { ConfirmModal } from '../ui/ConfirmModal';
import toast from 'react-hot-toast';

export const StockInventaire: React.FC = () => {
  const { matieres, addMouvement, chargerDonnees } = useStockStore();
  const { user } = useAuthStore();

  const [dateInventaire, setDateInventaire] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [saisies, setSaisies] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Trier les matières (Farine, Glace en tête, puis alphabétique)
  const matieresActives = useMemo(() => {
    return matieres
      .filter(m => m.active !== false)
      .sort((a, b) => {
        const nomA = a.nom.toLowerCase();
        const nomB = b.nom.toLowerCase();
        if (nomA.includes('farine') && !nomB.includes('farine')) return -1;
        if (!nomA.includes('farine') && nomB.includes('farine')) return 1;
        if (nomA.includes('glace') && !nomB.includes('glace')) return -1;
        if (!nomA.includes('glace') && nomB.includes('glace')) return 1;
        return nomA.localeCompare(nomB, 'fr', { sensitivity: 'base' });
      });
  }, [matieres]);

  const matieresFiltrees = useMemo(() => {
    if (!searchTerm.trim()) return matieresActives;
    const term = searchTerm.toLowerCase();
    return matieresActives.filter(m => m.nom.toLowerCase().includes(term));
  }, [matieresActives, searchTerm]);

  const handleSaisieChange = (id: string, val: string) => {
    setSaisies(prev => ({
      ...prev,
      [id]: val
    }));
  };

  const handlePreRemplirTheorique = () => {
    const nouveau: Record<string, string> = {};
    matieresActives.forEach(m => {
      nouveau[m.id] = String(Math.max(0, m.stockActuel));
    });
    setSaisies(nouveau);
    toast.success('Valeurs théoriques pré-remplies. Vous pouvez ajuster les écarts réels.');
  };

  const handleReinitialiser = () => {
    setSaisies({});
    toast('Champs d\'inventaire réinitialisés', { icon: '🧹' });
  };

  // Calcul des deltas
  const lignesAvecDelta = useMemo(() => {
    return matieresActives.map(m => {
      const saisie = saisies[m.id];
      const hasValue = saisie !== undefined && saisie.trim() !== '';
      const quantiteReelle = hasValue ? parseFloat(saisie.replace(',', '.')) : null;
      const valide = quantiteReelle !== null && !isNaN(quantiteReelle) && quantiteReelle >= 0;

      let delta = 0;
      let statut: 'non_saisi' | 'conforme' | 'surplus' | 'manquant' = 'non_saisi';

      if (valide && quantiteReelle !== null) {
        const d = Math.round((quantiteReelle - m.stockActuel + Number.EPSILON) * 100) / 100;
        delta = d;
        if (d === 0) statut = 'conforme';
        else if (d > 0) statut = 'surplus';
        else statut = 'manquant';
      }

      return {
        matiere: m,
        hasValue,
        valide,
        quantiteReelle,
        delta,
        statut
      };
    });
  }, [matieresActives, saisies]);

  // Écarts réels à corriger
  const ecartsACorriger = useMemo(() => {
    return lignesAvecDelta.filter(l => l.valide && l.delta !== 0);
  }, [lignesAvecDelta]);

  const totalSaisis = useMemo(() => {
    return lignesAvecDelta.filter(l => l.valide).length;
  }, [lignesAvecDelta]);

  const handleValiderInventaire = async () => {
    if (ecartsACorriger.length === 0) {
      toast('Aucun écart à corriger.', { icon: 'ℹ️' });
      setShowConfirmModal(false);
      return;
    }

    setIsSubmitting(true);
    setShowConfirmModal(false);

    try {
      const auteurNom = user ? `${user.prenom || ''} ${user.nom || ''}`.trim() : 'Gérant';
      const dateCible = new Date(dateInventaire + 'T12:00:00');

      let succesCount = 0;
      for (const item of ecartsACorriger) {
        await addMouvement({
          date: dateCible,
          matiereId: item.matiere.id,
          type: 'correction',
          quantite: item.delta,
          motif: `Inventaire physique du ${dateInventaire} (${item.delta > 0 ? '+' : ''}${item.delta} ${item.matiere.unite})`,
          auteur: auteurNom,
          userId: user?.id || 'current-user-id'
        });
        succesCount++;
      }

      toast.success(`Inventaire validé ! ${succesCount} stock${succesCount > 1 ? 's' : ''} mis à jour.`);
      setSaisies({});
      await chargerDonnees();
    } catch (err: any) {
      console.error("Erreur lors de l'application de l'inventaire:", err);
      toast.error("Erreur lors de l'enregistrement de l'inventaire.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête d'action d'inventaire */}
      <div className="bg-sand-50/70 border border-sand-200 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-sand-900 flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-emerald-600" />
            <span>Inventaire Physique de la Réserve</span>
          </h2>
          <p className="text-xs sm:text-sm text-sand-600 mt-0.5">
            Comptez les sacs et matières réels en réserve. Le système calculera automatiquement les écarts et alignera les stocks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-sand-200 text-xs">
            <span className="text-sand-500 font-medium">Date d'inventaire :</span>
            <input
              type="date"
              value={dateInventaire}
              onChange={e => setDateInventaire(e.target.value)}
              className="font-semibold text-sand-900 bg-transparent focus:outline-none"
            />
          </div>

          <button
            onClick={handlePreRemplirTheorique}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-sand-100 text-sand-700 text-xs font-semibold rounded-xl border border-sand-200 shadow-sm transition-colors"
            title="Pré-remplir avec les stocks théoriques pour ne modifier que les écarts"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Pré-remplir</span>
          </button>

          {totalSaisis > 0 && (
            <button
              onClick={handleReinitialiser}
              className="flex items-center gap-1.5 px-2.5 py-2 text-sand-500 hover:text-sand-700 text-xs font-medium transition-colors"
              title="Effacer la saisie en cours"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Effacer</span>
            </button>
          )}

          <button
            onClick={() => setShowConfirmModal(true)}
            disabled={isSubmitting || ecartsACorriger.length === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition-all ${
              ecartsACorriger.length > 0
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                : 'bg-sand-200 text-sand-400 cursor-not-allowed'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {isSubmitting
                ? 'Enregistrement...'
                : ecartsACorriger.length > 0
                ? `Valider (${ecartsACorriger.length} écart${ecartsACorriger.length > 1 ? 's' : ''})`
                : 'Aucun écart'}
            </span>
          </button>
        </div>
      </div>

      {/* Barre de recherche & Statistiques directes */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-sand-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher une matière (farine, levure, sel...)"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-sand-200 rounded-xl text-xs sm:text-sm text-sand-800 placeholder-sand-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-3 text-xs text-sand-600">
          <span className="bg-sand-100 px-2.5 py-1 rounded-lg">
            <strong>{totalSaisis}</strong> / {matieresActives.length} comptés
          </span>
          {ecartsACorriger.length > 0 && (
            <span className="bg-amber-100 text-amber-800 font-semibold px-2.5 py-1 rounded-lg">
              {ecartsACorriger.length} écart{ecartsACorriger.length > 1 ? 's' : ''} à ajuster
            </span>
          )}
        </div>
      </div>

      {/* Tableau d'inventaire */}
      <div className="border border-sand-200 rounded-2xl overflow-hidden bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-sand-50/70 border-b border-sand-200 text-sand-600 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Matière Première</th>
                <th className="py-3 px-4 text-right">Stock Théorique</th>
                <th className="py-3 px-4 w-44">Quantité Réelle Comptée</th>
                <th className="py-3 px-4 text-center">Écart (Delta)</th>
                <th className="py-3 px-4 text-right">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {matieresFiltrees.map(m => {
                const ligne = lignesAvecDelta.find(l => l.matiere.id === m.id);
                const saisieVal = saisies[m.id] ?? '';
                const statut = ligne?.statut || 'non_saisi';
                const delta = ligne?.delta || 0;

                return (
                  <tr
                    key={m.id}
                    className={`transition-colors ${
                      statut === 'surplus'
                        ? 'bg-amber-50/30'
                        : statut === 'manquant'
                        ? 'bg-rose-50/30'
                        : statut === 'conforme'
                        ? 'bg-emerald-50/20'
                        : 'hover:bg-sand-50/40'
                    }`}
                  >
                    {/* Nom Matière */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-sand-900">{m.nom}</div>
                      <div className="text-[11px] text-sand-400">
                        Unité : <span className="font-medium text-sand-600">{m.unite}</span>
                        {m.stockMinimum ? ` • Seuil alerte : ${m.stockMinimum} ${m.unite}` : ''}
                      </div>
                    </td>

                    {/* Stock Théorique */}
                    <td className="py-3 px-4 text-right font-medium text-sand-700">
                      {formaterQuantite(m.stockActuel, m.unite)}
                    </td>

                    {/* Saisie Réelle */}
                    <td className="py-3 px-4">
                      <div className="relative">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder={String(m.stockActuel)}
                          value={saisieVal}
                          onChange={e => handleSaisieChange(m.id, e.target.value)}
                          className="w-full py-1.5 pl-3 pr-10 border border-sand-300 rounded-xl text-xs sm:text-sm font-semibold text-sand-900 bg-sand-50/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-sand-400 font-medium pointer-events-none">
                          {m.unite}
                        </span>
                      </div>
                    </td>

                    {/* Écart Delta */}
                    <td className="py-3 px-4 text-center font-bold">
                      {statut === 'non_saisi' ? (
                        <span className="text-sand-300">—</span>
                      ) : statut === 'conforme' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5" /> 0 {m.unite}
                        </span>
                      ) : statut === 'surplus' ? (
                        <span className="inline-flex items-center gap-1 text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full text-xs font-bold">
                          +{delta} {m.unite}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-full text-xs font-bold">
                          {delta} {m.unite}
                        </span>
                      )}
                    </td>

                    {/* Statut */}
                    <td className="py-3 px-4 text-right">
                      {statut === 'non_saisi' && (
                        <span className="text-[11px] text-sand-400">Non renseigné</span>
                      )}
                      {statut === 'conforme' && (
                        <span className="text-[11px] font-semibold text-emerald-700">Conforme</span>
                      )}
                      {statut === 'surplus' && (
                        <span className="text-[11px] font-semibold text-amber-700">Surplus (+ stock)</span>
                      )}
                      {statut === 'manquant' && (
                        <span className="text-[11px] font-semibold text-rose-700">Perte / Manquant</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de confirmation détaillée */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleValiderInventaire}
        title="Confirmer l'ajustement des stocks"
        message={
          <div>
            <p className="text-sm text-sand-700 mb-3">
              Vous allez enregistrer <strong>{ecartsACorriger.length} ajustement(s) d'inventaire</strong> pour la date du{' '}
              <strong>{dateInventaire}</strong>.
            </p>
            <div className="max-h-48 overflow-y-auto space-y-1.5 border border-sand-200 rounded-xl p-2.5 bg-sand-50/50 text-xs">
              {ecartsACorriger.map(item => (
                <div key={item.matiere.id} className="flex justify-between items-center py-1 border-b border-sand-100 last:border-0">
                  <span className="font-medium text-sand-800">{item.matiere.nom} :</span>
                  <span className="font-bold flex items-center gap-1.5">
                    <span className="text-sand-400 line-through">{item.matiere.stockActuel}</span>
                    <ArrowRight className="w-3 h-3 text-sand-400" />
                    <span className={item.delta > 0 ? 'text-amber-700' : 'text-rose-700'}>
                      {item.quantiteReelle} {item.matiere.unite} ({item.delta > 0 ? '+' : ''}{item.delta})
                    </span>
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-sand-500 mt-3">
              Ces mouvements seront archivés sous le type « Correction d'inventaire » et le stock disponible sera immédiatement mis à niveau.
            </p>
          </div>
        }
        confirmText="Confirmer et appliquer l'inventaire"
        cancelText="Annuler"
        type="warning"
      />
    </div>
  );
};
