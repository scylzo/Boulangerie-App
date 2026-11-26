import React, { useState, useMemo } from 'react';
import { useStockStore } from '../../store/stockStore';
import { useProductionStore } from '../../store/productionStore';
import { useAuthStore } from '../../store/authStore';
import { formatCurrency } from '../../utils/currency';
import { formaterQuantite } from '../../utils/calculations';
import { memeJour } from '../../utils/dateUtils';
import {
  CalendarDays,
  CalendarCheck2,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  Save,
  Wheat,
  Snowflake,
  RotateCcw
} from 'lucide-react';
import toast from 'react-hot-toast';

export const StockBilan: React.FC = () => {
  const { matieres, mouvements, declarerConsommationJournee, addMouvement, chargerDonnees } = useStockStore();
  const { programmeActuel } = useProductionStore();
  const { user } = useAuthStore();

  const now = new Date();
  const formatYMD = (d: Date) => d.toISOString().split('T')[0];

  const [sousOnglet, setSousOnglet] = useState<'journalier' | 'mensuel'>('journalier');

  // État Bilan Journalier
  const [dateJournee, setDateJournee] = useState<string>(formatYMD(now));
  const [saisiesJournee, setSaisiesJournee] = useState<Record<string, string>>({});
  const [isSubmittingJournee, setIsSubmittingJournee] = useState(false);

  // État Bilan Mensuel
  const defautMois = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [moisSelectionne, setMoisSelectionne] = useState<string>(defautMois);
  const [saisiesMois, setSaisiesMois] = useState<Record<string, string>>({});
  const [isSubmittingMois, setIsSubmittingMois] = useState(false);

  // Matières actives avec Farine et Glace en tête
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

  // ==========================================
  // LOGIQUE BILAN JOURNALIER
  // ==========================================
  const cibleDateJournee = useMemo(() => {
    return new Date(dateJournee + 'T12:00:00');
  }, [dateJournee]);

  // Consommations enregistrées pour la date choisie
  const consommationsDuJour = useMemo(() => {
    return mouvements.filter(
      m => m.type === 'consommation' && memeJour(new Date(m.date), cibleDateJournee)
    );
  }, [mouvements, cibleDateJournee]);

  // Sacs de farine pétris dans le programme de prod (si c'est le même jour)
  const farinePrevueProd = useMemo(() => {
    if (programmeActuel && programmeActuel.dateProduction) {
      const dateProd = new Date(programmeActuel.dateProduction);
      if (memeJour(dateProd, cibleDateJournee)) {
        return programmeActuel.sacsFarinePetris || 0;
      }
    }
    return null;
  }, [programmeActuel, cibleDateJournee]);

  // Sacs de farine réellement consommés ce jour-là
  const farineConsommeeJour = useMemo(() => {
    const farineMatiere = matieres.find(m => m.nom.toLowerCase().includes('farine'));
    if (!farineMatiere) return 0;
    return consommationsDuJour
      .filter(m => m.matiereId === farineMatiere.id)
      .reduce((sum, m) => sum + Math.abs(m.quantite), 0);
  }, [matieres, consommationsDuJour]);

  // Total coût journalier
  const totalCoutJournee = useMemo(() => {
    return consommationsDuJour.reduce((sum, m) => {
      const mat = matieres.find(item => item.id === m.matiereId);
      const pmp = mat?.prixUnitaireMoyen || 0;
      return sum + Math.abs(m.quantite) * pmp;
    }, 0);
  }, [consommationsDuJour, matieres]);

  const handleEnregistrerConsoJour = async (e: React.FormEvent) => {
    e.preventDefault();

    const entrees = Object.entries(saisiesJournee)
      .map(([matiereId, val]) => ({
        matiereId,
        quantite: parseFloat(val.replace(',', '.'))
      }))
      .filter(item => !isNaN(item.quantite) && item.quantite > 0);

    if (entrees.length === 0) {
      toast.error('Veuillez saisir au moins une quantité positive à déclarer.');
      return;
    }

    setIsSubmittingJournee(true);
    try {
      const payload = entrees.map(item => ({
        matiereId: item.matiereId,
        quantite: item.quantite,
        motif: `Sortie journalière du ${dateJournee}`
      }));

      await declarerConsommationJournee(cibleDateJournee, payload);
      toast.success(`Consommations du ${dateJournee} enregistrées avec succès !`);
      setSaisiesJournee({});
      await chargerDonnees();
    } catch (err: any) {
      console.error(err);
      toast.error("Erreur lors de l'enregistrement de la journée.");
    } finally {
      setIsSubmittingJournee(false);
    }
  };

  // ==========================================
  // LOGIQUE BILAN MENSUEL
  // ==========================================
  const nomMoisFormatte = useMemo(() => {
    const [annee, mois] = moisSelectionne.split('-').map(Number);
    const dateMois = new Date(annee, mois - 1, 1);
    const dernierJour = new Date(annee, mois, 0).getDate();
    const moisNom = dateMois.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return `${moisNom.charAt(0).toUpperCase() + moisNom.slice(1)} (1 au ${dernierJour})`;
  }, [moisSelectionne]);

  // Mouvements du mois sélectionné
  const mouvementsMois = useMemo(() => {
    const [annee, mois] = moisSelectionne.split('-').map(Number);
    const dateDebutMois = new Date(annee, mois - 1, 1, 0, 0, 0);
    const dateFinMois = new Date(annee, mois, 0, 23, 59, 59, 999);

    return mouvements.filter(m => {
      const d = new Date(m.date);
      return d >= dateDebutMois && d <= dateFinMois;
    });
  }, [mouvements, moisSelectionne]);

  // Synthèse mensuelle par matière
  const syntheseMensuelle = useMemo(() => {
    return matieresActives.map(m => {
      const mouvsMat = mouvementsMois.filter(mv => mv.matiereId === m.id);
      let totalConso = 0;
      let totalAchat = 0;

      mouvsMat.forEach(mv => {
        if (mv.type === 'consommation') totalConso += Math.abs(mv.quantite);
        if (mv.type === 'achat') totalAchat += Math.abs(mv.quantite);
      });

      const coutConso = totalConso * (m.prixUnitaireMoyen || 0);

      return {
        matiere: m,
        totalAchat,
        totalConso,
        coutConso
      };
    });
  }, [matieresActives, mouvementsMois]);

  const totalCoutMois = useMemo(() => {
    return syntheseMensuelle.reduce((sum, item) => sum + item.coutConso, 0);
  }, [syntheseMensuelle]);

  const handleEnregistrerRegularisationMensuelle = async (e: React.FormEvent) => {
    e.preventDefault();

    const entrees = Object.entries(saisiesMois)
      .map(([matiereId, val]) => ({
        matiereId,
        quantite: parseFloat(val.replace(',', '.'))
      }))
      .filter(item => !isNaN(item.quantite) && item.quantite > 0);

    if (entrees.length === 0) {
      toast.error('Veuillez renseigner au moins une quantité pour le bilan mensuel.');
      return;
    }

    setIsSubmittingMois(true);
    try {
      const [annee, mois] = moisSelectionne.split('-').map(Number);
      const dateFinMois = new Date(annee, mois, 0, 18, 0, 0);
      const auteurNom = user ? `${user.prenom || ''} ${user.nom || ''}`.trim() : 'Gérant';

      for (const item of entrees) {
        await addMouvement({
          date: dateFinMois,
          matiereId: item.matiereId,
          type: 'consommation',
          quantite: item.quantite,
          motif: `Bilan mensuel consommations (${nomMoisFormatte})`,
          auteur: auteurNom,
          userId: user?.id || 'current-user-id'
        });
      }

      toast.success(`Bilan mensuel pour ${nomMoisFormatte} validé et enregistré !`);
      setSaisiesMois({});
      await chargerDonnees();
    } catch (err: any) {
      console.error(err);
      toast.error("Erreur lors de l'enregistrement du bilan mensuel.");
    } finally {
      setIsSubmittingMois(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Bascule Sous-Onglets : Journalier / Mensuel */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-sand-50/70 border border-sand-200 rounded-2xl p-3 sm:p-4">
        <div className="flex items-center gap-1.5 p-1 bg-white border border-sand-200 rounded-xl w-fit shadow-xs">
          <button
            onClick={() => setSousOnglet('journalier')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
              sousOnglet === 'journalier'
                ? 'bg-sand-900 text-white shadow-sm'
                : 'text-sand-600 hover:text-sand-900 hover:bg-sand-50'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            <span>Bilan Journalier</span>
          </button>

          <button
            onClick={() => setSousOnglet('mensuel')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
              sousOnglet === 'mensuel'
                ? 'bg-sand-900 text-white shadow-sm'
                : 'text-sand-600 hover:text-sand-900 hover:bg-sand-50'
            }`}
          >
            <CalendarCheck2 className="w-4 h-4" />
            <span>Bilan Mensuel</span>
          </button>
        </div>

        {/* Sélecteur de date / mois selon onglet */}
        <div className="flex items-center gap-2 text-xs sm:text-sm">
          {sousOnglet === 'journalier' ? (
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-sand-200 shadow-xs">
              <span className="text-sand-500 font-medium">Journée :</span>
              <input
                type="date"
                value={dateJournee}
                onChange={e => setDateJournee(e.target.value)}
                className="font-bold text-sand-900 bg-transparent focus:outline-none"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-sand-200 shadow-xs">
              <span className="text-sand-500 font-medium">Mois :</span>
              <input
                type="month"
                value={moisSelectionne}
                onChange={e => setMoisSelectionne(e.target.value)}
                className="font-bold text-sand-900 bg-transparent focus:outline-none"
              />
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* VUE 1 : BILAN JOURNALIER                                  */}
      {/* ========================================================= */}
      {sousOnglet === 'journalier' && (
        <div className="space-y-6">
          {/* Cartes Rapprochement Farine & Production */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Rapprochement Farine */}
            <div className="bg-white p-5 rounded-2xl border border-sand-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                <Wheat className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-sand-500 uppercase tracking-wide">
                  Farine du Jour
                </p>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-xl font-extrabold text-sand-900">
                    {farineConsommeeJour} sacs
                  </span>
                  {farinePrevueProd !== null && (
                    <span className="text-xs text-sand-500">
                      (prévu : {farinePrevueProd} sacs)
                    </span>
                  )}
                </div>
                <p className="text-[11px] mt-0.5">
                  {farinePrevueProd !== null ? (
                    farineConsommeeJour === farinePrevueProd ? (
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Conforme au programme
                      </span>
                    ) : (
                      <span className="text-amber-700 font-semibold flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Écart : {farineConsommeeJour - farinePrevueProd} sacs
                      </span>
                    )
                  ) : (
                    <span className="text-sand-400">Sorties déclarées au stock</span>
                  )}
                </p>
              </div>
            </div>

            {/* Total matières sorties */}
            <div className="bg-white p-5 rounded-2xl border border-sand-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center shrink-0">
                <Snowflake className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-sand-500 uppercase tracking-wide">
                  Matières Consommées
                </p>
                <p className="text-xl font-extrabold text-cyan-800 mt-0.5">
                  {consommationsDuJour.length} sortie{consommationsDuJour.length > 1 ? 's' : ''}
                </p>
                <p className="text-[11px] text-sand-400 mt-0.5">Pour le {dateJournee}</p>
              </div>
            </div>

            {/* Coût total estimé du jour */}
            <div className="bg-white p-5 rounded-2xl border border-sand-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-sand-500 uppercase tracking-wide">
                  Coût Matières Journée
                </p>
                <p className="text-xl font-extrabold text-emerald-700 mt-0.5">
                  {formatCurrency(totalCoutJournee)}
                </p>
                <p className="text-[11px] text-sand-400 mt-0.5">Valorisé au prix moyen pondéré</p>
              </div>
            </div>
          </div>

          {/* Formulaire de Saisie / Déclaration Rapide de la Journée */}
          <div className="bg-white border border-sand-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-sand-100 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-sand-900 flex items-center gap-2">
                  <PlusCircle className="w-4 h-4 text-emerald-600" />
                  <span>Saisie Rapide des Sorties du Jour ({dateJournee})</span>
                </h3>
                <p className="text-xs text-sand-500">
                  Déclarez les quantités consommées pour cette journée. Les stocks seront déduits automatiquement.
                </p>
              </div>
              {Object.keys(saisiesJournee).length > 0 && (
                <button
                  type="button"
                  onClick={() => setSaisiesJournee({})}
                  className="text-xs text-sand-500 hover:text-sand-700 font-medium flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Effacer la saisie</span>
                </button>
              )}
            </div>

            <form onSubmit={handleEnregistrerConsoJour} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {matieresActives.map(m => {
                  const val = saisiesJournee[m.id] ?? '';
                  const consoExistante = consommationsDuJour.find(c => c.matiereId === m.id);

                  return (
                    <div
                      key={m.id}
                      className="p-3 rounded-xl border border-sand-200 bg-sand-50/40 hover:bg-sand-50 transition-colors space-y-1.5"
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-semibold text-xs text-sand-900 truncate" title={m.nom}>
                          {m.nom}
                        </span>
                        <span className="text-[11px] font-medium text-sand-500">
                          {m.unite}
                        </span>
                      </div>

                      <div className="relative">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder={consoExistante ? `Déjà : ${Math.abs(consoExistante.quantite)}` : '0'}
                          value={val}
                          onChange={e =>
                            setSaisiesJournee(prev => ({
                              ...prev,
                              [m.id]: e.target.value
                            }))
                          }
                          className="w-full py-1.5 pl-3 pr-8 border border-sand-300 rounded-lg text-xs font-semibold text-sand-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-sand-400 font-medium">
                          {m.unite}
                        </span>
                      </div>

                      <div className="text-[10px] text-sand-500 flex justify-between">
                        <span>Dispo : {m.stockActuel}</span>
                        {consoExistante && (
                          <span className="text-cyan-700 font-semibold">
                            Saisi : {Math.abs(consoExistante.quantite)} {m.unite}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end pt-3 border-t border-sand-100">
                <button
                  type="submit"
                  disabled={isSubmittingJournee}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition-colors cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>
                    {isSubmittingJournee ? 'Enregistrement en cours...' : 'Enregistrer les sorties du jour'}
                  </span>
                </button>
              </div>
            </form>
          </div>

          {/* Liste détaillée des consommations déjà enregistrées ce jour-là */}
          {consommationsDuJour.length > 0 && (
            <div className="border border-sand-200 rounded-2xl overflow-hidden bg-white shadow-sm">
              <div className="bg-sand-50/70 px-4 py-3 border-b border-sand-200 flex items-center justify-between">
                <span className="text-xs font-bold text-sand-700 uppercase tracking-wide">
                  Détail des sorties enregistrées pour le {dateJournee}
                </span>
                <span className="text-xs text-sand-500">
                  {consommationsDuJour.length} ligne{consommationsDuJour.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className="divide-y divide-sand-100 text-xs sm:text-sm">
                {consommationsDuJour.map(c => {
                  const mat = matieres.find(m => m.id === c.matiereId);
                  const pmp = mat?.prixUnitaireMoyen || 0;
                  const cout = Math.abs(c.quantite) * pmp;

                  return (
                    <div key={c.id} className="p-3.5 flex items-center justify-between hover:bg-sand-50/50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-700 flex items-center justify-center font-bold">
                          -
                        </div>
                        <div>
                          <div className="font-semibold text-sand-900">{mat?.nom || 'Article'}</div>
                          <div className="text-[11px] text-sand-400">
                            {c.motif || 'Déclaration journalière'} • Par {c.auteur || 'Gérant'}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-bold text-cyan-800">
                          {formaterQuantite(Math.abs(c.quantite), mat?.unite || '')}
                        </div>
                        {cout > 0 && (
                          <div className="text-[11px] text-sand-500">
                            ~ {formatCurrency(Math.round(cout))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* VUE 2 : BILAN MENSUEL                                     */}
      {/* ========================================================= */}
      {sousOnglet === 'mensuel' && (
        <div className="space-y-6">
          {/* Synthèse du Mois */}
          <div className="bg-sand-900 text-white p-5 rounded-2xl shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-sand-400">
                Bilan Matières Premières
              </p>
              <h3 className="text-xl sm:text-2xl font-black mt-0.5">{nomMoisFormatte}</h3>
              <p className="text-xs text-sand-300 mt-1">
                Rapprochement comptable de tous les achats et consommations du mois.
              </p>
            </div>

            <div className="bg-sand-800/80 px-5 py-3 rounded-xl border border-sand-700/60 text-right">
              <span className="text-[11px] text-sand-400 block font-medium uppercase">
                Coût Total des Matières Consommées
              </span>
              <span className="text-xl sm:text-2xl font-black text-emerald-400">
                {formatCurrency(totalCoutMois)}
              </span>
            </div>
          </div>

          {/* Tableau de bord mensuel par Ingrédient */}
          <div className="border border-sand-200 rounded-2xl overflow-hidden bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-sand-50/70 border-b border-sand-200 text-sand-600 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Matière Première</th>
                    <th className="py-3 px-4 text-right">Stock Actuel</th>
                    <th className="py-3 px-4 text-right text-emerald-700">Achats du Mois</th>
                    <th className="py-3 px-4 text-right text-cyan-700">Consommation Mois</th>
                    <th className="py-3 px-4 text-right">PMP Unitaire</th>
                    <th className="py-3 px-4 text-right">Coût Consommé</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand-100">
                  {syntheseMensuelle.map(item => (
                    <tr key={item.matiere.id} className="hover:bg-sand-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-sand-900">{item.matiere.nom}</div>
                        <div className="text-[11px] text-sand-400">Unité : {item.matiere.unite}</div>
                      </td>

                      <td className="py-3 px-4 text-right text-sand-700 font-medium">
                        {formaterQuantite(item.matiere.stockActuel, item.matiere.unite)}
                      </td>

                      <td className="py-3 px-4 text-right font-semibold text-emerald-700">
                        {item.totalAchat > 0 ? `+${formaterQuantite(item.totalAchat, item.matiere.unite)}` : '—'}
                      </td>

                      <td className="py-3 px-4 text-right font-semibold text-cyan-700">
                        {item.totalConso > 0 ? `-${formaterQuantite(item.totalConso, item.matiere.unite)}` : '—'}
                      </td>

                      <td className="py-3 px-4 text-right text-sand-600 font-medium">
                        {item.matiere.prixUnitaireMoyen > 0
                          ? formatCurrency(Math.round(item.matiere.prixUnitaireMoyen))
                          : '—'}
                      </td>

                      <td className="py-3 px-4 text-right font-bold text-sand-900">
                        {item.coutConso > 0 ? formatCurrency(Math.round(item.coutConso)) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-sand-50/90 font-bold border-t border-sand-200 text-sand-900 text-xs sm:text-sm">
                  <tr>
                    <td colSpan={5} className="py-3 px-4 uppercase">
                      Total Consommations du Mois
                    </td>
                    <td className="py-3 px-4 text-right text-emerald-700 text-sm">
                      {formatCurrency(totalCoutMois)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Déclaration / Régularisation mensuelle des sachets / ingrédients */}
          <div className="bg-white border border-sand-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-sand-100 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-sand-900 flex items-center gap-2">
                  <CalendarCheck2 className="w-4 h-4 text-terracotta-600" />
                  <span>Régularisation Mensuelle des Sachets & Ingrédients</span>
                </h3>
                <p className="text-xs text-sand-500">
                  Si vous enregistrez vos ingrédients (glace, améliorants, levure...) par bilan global en fin de mois, saisissez-les ici.
                </p>
              </div>
            </div>

            <form onSubmit={handleEnregistrerRegularisationMensuelle} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {matieresActives.map(m => {
                  const val = saisiesMois[m.id] ?? '';
                  return (
                    <div
                      key={m.id}
                      className="p-3 rounded-xl border border-sand-200 bg-sand-50/40 hover:bg-sand-50 transition-colors space-y-1.5"
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-semibold text-xs text-sand-900 truncate" title={m.nom}>
                          {m.nom}
                        </span>
                        <span className="text-[11px] font-medium text-sand-500">
                          {m.unite}
                        </span>
                      </div>

                      <div className="relative">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="Qté mois..."
                          value={val}
                          onChange={e =>
                            setSaisiesMois(prev => ({
                              ...prev,
                              [m.id]: e.target.value
                            }))
                          }
                          className="w-full py-1.5 pl-3 pr-8 border border-sand-300 rounded-lg text-xs font-semibold text-sand-900 bg-white focus:outline-none focus:ring-2 focus:ring-terracotta-500/20 focus:border-terracotta-500"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-sand-400 font-medium">
                          {m.unite}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end pt-3 border-t border-sand-100">
                <button
                  type="submit"
                  disabled={isSubmittingMois}
                  className="flex items-center gap-2 px-5 py-2.5 bg-terracotta-600 hover:bg-terracotta-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition-colors cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>
                    {isSubmittingMois ? 'Validation...' : 'Valider le bilan mensuel'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
