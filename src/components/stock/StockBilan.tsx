import React, { useState, useMemo } from 'react';
import { Icon } from '@iconify/react';
import { useStockStore } from '../../store/stockStore';
import { useProductionStore } from '../../store/productionStore';
import { useAuthStore } from '../../store/authStore';
import { formatCurrency } from '../../utils/currency';
import { formaterQuantite } from '../../utils/calculations';
import { memeJour } from '../../utils/dateUtils';
import {
  getOptionsConditionnement,
  formaterNomUnite
} from '../../utils/conditionnementStock';
import { Modal } from '../ui/Modal';
import toast from 'react-hot-toast';

export const StockBilan: React.FC = () => {
  const { matieres, mouvements, declarerConsommationJournee, declarerConsommationPeriode, addMouvement, chargerDonnees } = useStockStore();
  const { programmeActuel } = useProductionStore();
  const { user } = useAuthStore();

  const now = new Date();
  const formatYMD = (d: Date) => d.toISOString().split('T')[0];

  const [sousOnglet, setSousOnglet] = useState<'journalier' | 'periode' | 'mensuel'>('journalier');

  // État Bilan Journalier
  const [dateJournee, setDateJournee] = useState<string>(formatYMD(now));
  const [saisiesJournee, setSaisiesJournee] = useState<Record<string, string>>({});
  const [unitesSaisieJour, setUnitesSaisieJour] = useState<Record<string, string>>({});
  const [isSubmittingJournee, setIsSubmittingJournee] = useState(false);

  // État Saisie par Période (Constante)
  const debutSemaineDefaut = useMemo(() => {
    const d = new Date(now);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const debutSem = new Date(d);
    debutSem.setDate(diff);
    return formatYMD(debutSem);
  }, []);

  const [dateDebutPeriode, setDateDebutPeriode] = useState<string>(debutSemaineDefaut);
  const [dateFinPeriode, setDateFinPeriode] = useState<string>(formatYMD(now));
  const [exclureDimanchesPeriode, setExclureDimanchesPeriode] = useState<boolean>(true);
  const [ecraserExistantPeriode, setEcraserExistantPeriode] = useState<boolean>(true);
  const [saisiesPeriode, setSaisiesPeriode] = useState<Record<string, string>>({});
  const [unitesSaisiePeriode, setUnitesSaisiePeriode] = useState<Record<string, string>>({});
  const [isSubmittingPeriode, setIsSubmittingPeriode] = useState(false);
  const [showConfirmPeriodeModal, setShowConfirmPeriodeModal] = useState(false);

  // État Bilan Mensuel
  const defautMois = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [moisSelectionne, setMoisSelectionne] = useState<string>(defautMois);
  const [saisiesMois, setSaisiesMois] = useState<Record<string, string>>({});
  const [unitesSaisieMois, setUnitesSaisieMois] = useState<Record<string, string>>({});
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
      .map(([matiereId, val]) => {
        const mat = matieres.find(m => m.id === matiereId);
        const options = mat ? getOptionsConditionnement(mat) : [];
        const unitId = unitesSaisieJour[matiereId] || (options[0]?.id ?? mat?.unite ?? 'kg');
        const selectedOpt = options.find(o => o.id === unitId);
        const factor = selectedOpt?.factor || 1;
        const qteSaisie = parseFloat(val.replace(',', '.'));
        const qteBase = Math.round((qteSaisie * factor + Number.EPSILON) * 100) / 100;

        return {
          matiereId,
          matiereNom: mat?.nom || 'Article',
          uniteBase: mat?.unite || '',
          qteSaisie,
          unitLabel: selectedOpt?.labelCourt || mat?.unite || '',
          quantiteBase: qteBase
        };
      })
      .filter(item => !isNaN(item.quantiteBase) && item.quantiteBase > 0);

    if (entrees.length === 0) {
      toast.error('Veuillez saisir au moins une quantité positive à déclarer.');
      return;
    }

    setIsSubmittingJournee(true);
    try {
      const payload = entrees.map(item => ({
        matiereId: item.matiereId,
        quantite: item.quantiteBase,
        motif:
          item.qteSaisie !== item.quantiteBase
            ? `Sortie journalière du ${dateJournee} (${item.qteSaisie} ${item.unitLabel})`
            : `Sortie journalière du ${dateJournee}`
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
  // LOGIQUE SAISIE PAR PÉRIODE (CONSTANTE)
  // ==========================================
  const appliquerRaccourciPeriode = (type: 'cette_semaine' | 'semaine_derniere' | 'quinzaine_1' | 'quinzaine_2' | 'mois_entier') => {
    const cur = new Date();
    const y = cur.getFullYear();
    const m = cur.getMonth();

    if (type === 'cette_semaine') {
      const day = cur.getDay();
      const diff = cur.getDate() - day + (day === 0 ? -6 : 1);
      const d1 = new Date(cur);
      d1.setDate(diff);
      const d2 = new Date(d1);
      d2.setDate(d1.getDate() + 6);
      setDateDebutPeriode(formatYMD(d1));
      setDateFinPeriode(formatYMD(d2));
    } else if (type === 'semaine_derniere') {
      const day = cur.getDay();
      const diff = cur.getDate() - day + (day === 0 ? -6 : 1) - 7;
      const d1 = new Date(cur);
      d1.setDate(diff);
      const d2 = new Date(d1);
      d2.setDate(d1.getDate() + 6);
      setDateDebutPeriode(formatYMD(d1));
      setDateFinPeriode(formatYMD(d2));
    } else if (type === 'quinzaine_1') {
      setDateDebutPeriode(formatYMD(new Date(y, m, 1)));
      setDateFinPeriode(formatYMD(new Date(y, m, 15)));
    } else if (type === 'quinzaine_2') {
      setDateDebutPeriode(formatYMD(new Date(y, m, 16)));
      setDateFinPeriode(formatYMD(new Date(y, m + 1, 0)));
    } else if (type === 'mois_entier') {
      setDateDebutPeriode(formatYMD(new Date(y, m, 1)));
      setDateFinPeriode(formatYMD(new Date(y, m + 1, 0)));
    }
  };

  const joursPeriode = useMemo(() => {
    if (!dateDebutPeriode || !dateFinPeriode) return [];
    const d1 = new Date(dateDebutPeriode + 'T00:00:00');
    const d2 = new Date(dateFinPeriode + 'T23:59:59');
    if (d1 > d2) return [];

    const list: Date[] = [];
    const cur = new Date(d1);
    while (cur <= d2) {
      if (!exclureDimanchesPeriode || cur.getDay() !== 0) {
        list.push(new Date(cur));
      }
      cur.setDate(cur.getDate() + 1);
    }
    return list;
  }, [dateDebutPeriode, dateFinPeriode, exclureDimanchesPeriode]);

  const nbJoursPeriode = joursPeriode.length;

  const recapitulatifPeriode = useMemo(() => {
    return Object.entries(saisiesPeriode)
      .map(([matiereId, val]) => {
        const mat = matieres.find(m => m.id === matiereId);
        const options = mat ? getOptionsConditionnement(mat) : [];
        const unitId = unitesSaisiePeriode[matiereId] || (options[0]?.id ?? mat?.unite ?? 'kg');
        const selectedOpt = options.find(o => o.id === unitId) || options[0];
        const factor = selectedOpt?.factor || 1;
        const qteSaisie = parseFloat(val.replace(',', '.'));
        const qteBaseJour = !isNaN(qteSaisie) && qteSaisie > 0
          ? Math.round((qteSaisie * factor + Number.EPSILON) * 100) / 100
          : 0;
        const totalBasePeriode = Math.round((qteBaseJour * nbJoursPeriode + Number.EPSILON) * 100) / 100;
        const totalSaisiePeriode = Math.round((qteSaisie * nbJoursPeriode + Number.EPSILON) * 100) / 100;
        const coutTotal = totalBasePeriode * (mat?.prixUnitaireMoyen || 0);

        return {
          matiereId,
          matiereNom: mat?.nom || 'Article',
          stockActuel: mat?.stockActuel || 0,
          uniteBase: mat?.unite || '',
          qteSaisieJour: qteSaisie,
          unitLabel: selectedOpt?.labelCourt || mat?.unite || '',
          factor,
          quantiteBaseJour: qteBaseJour,
          totalSaisiePeriode,
          totalBasePeriode,
          pmp: mat?.prixUnitaireMoyen || 0,
          coutTotal
        };
      })
      .filter(item => !isNaN(item.quantiteBaseJour) && item.quantiteBaseJour > 0);
  }, [saisiesPeriode, unitesSaisiePeriode, matieres, nbJoursPeriode]);

  const totalCoutPeriode = useMemo(() => {
    return recapitulatifPeriode.reduce((sum, item) => sum + item.coutTotal, 0);
  }, [recapitulatifPeriode]);

  const handleDemanderConfirmationPeriode = (e: React.FormEvent) => {
    e.preventDefault();
    if (recapitulatifPeriode.length === 0) {
      toast.error('Veuillez renseigner au moins une quantité journalière.');
      return;
    }
    if (nbJoursPeriode === 0) {
      toast.error('La période sélectionnée ne comporte aucun jour de production.');
      return;
    }
    setShowConfirmPeriodeModal(true);
  };

  const handleConfirmerEnregistrerPeriode = async () => {
    setIsSubmittingPeriode(true);
    try {
      const payload = recapitulatifPeriode.map(item => ({
        matiereId: item.matiereId,
        quantiteParJour: item.quantiteBaseJour,
        motif: `Consommation journalière (${item.qteSaisieJour} ${item.unitLabel})`
      }));

      const res = await declarerConsommationPeriode(
        new Date(dateDebutPeriode + 'T00:00:00'),
        new Date(dateFinPeriode + 'T23:59:59'),
        payload,
        {
          exclureDimanches: exclureDimanchesPeriode,
          ecraserExistant: ecraserExistantPeriode
        }
      );

      toast.success(
        `🎉 Consommations enregistrées sur ${res.nbJours} journées de production (${res.nbMouvements} sorties tracées) !`,
        { duration: 5000 }
      );
      setSaisiesPeriode({});
      setShowConfirmPeriodeModal(false);
      await chargerDonnees();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erreur lors de l'enregistrement de la période.");
    } finally {
      setIsSubmittingPeriode(false);
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
      .map(([matiereId, val]) => {
        const mat = matieres.find(m => m.id === matiereId);
        const options = mat ? getOptionsConditionnement(mat) : [];
        const unitId = unitesSaisieMois[matiereId] || (options[0]?.id ?? mat?.unite ?? 'kg');
        const selectedOpt = options.find(o => o.id === unitId);
        const factor = selectedOpt?.factor || 1;
        const qteSaisie = parseFloat(val.replace(',', '.'));
        const qteBase = Math.round((qteSaisie * factor + Number.EPSILON) * 100) / 100;

        return {
          matiereId,
          matiereNom: mat?.nom || 'Article',
          qteSaisie,
          unitLabel: selectedOpt?.labelCourt || mat?.unite || '',
          quantiteBase: qteBase
        };
      })
      .filter(item => !isNaN(item.quantiteBase) && item.quantiteBase > 0);

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
          quantite: item.quantiteBase,
          motif:
            item.qteSaisie !== item.quantiteBase
              ? `Bilan mensuel consommations : ${item.qteSaisie} ${item.unitLabel} (${item.quantiteBase} kg)`
              : `Bilan mensuel consommations (${nomMoisFormatte})`,
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
      {/* Bascule Sous-Onglets : Journalier / Période / Mensuel */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-sand-50/70 border border-sand-200 rounded-2xl p-3 sm:p-4">
        <div className="flex items-center gap-1.5 p-1 bg-white border border-sand-200 rounded-xl w-fit shadow-xs flex-wrap">
          <button
            onClick={() => setSousOnglet('journalier')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
              sousOnglet === 'journalier'
                ? 'bg-sand-900 text-white shadow-sm'
                : 'text-sand-600 hover:text-sand-900 hover:bg-sand-50'
            }`}
          >
            <Icon icon="mdi:calendar-today" className="w-4 h-4" />
            <span>Bilan Journalier</span>
          </button>

          <button
            onClick={() => setSousOnglet('periode')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
              sousOnglet === 'periode'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-sand-600 hover:text-sand-900 hover:bg-sand-50'
            }`}
          >
            <Icon icon="mdi:calendar-range" className="w-4 h-4" />
            <span>Saisie par Période (Constante)</span>
          </button>

          <button
            onClick={() => setSousOnglet('mensuel')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
              sousOnglet === 'mensuel'
                ? 'bg-sand-900 text-white shadow-sm'
                : 'text-sand-600 hover:text-sand-900 hover:bg-sand-50'
            }`}
          >
            <Icon icon="mdi:calendar-check" className="w-4 h-4" />
            <span>Bilan Mensuel</span>
          </button>
        </div>

        {/* Sélecteur de date / période / mois selon onglet */}
        <div className="flex items-center gap-2 text-xs sm:text-sm flex-wrap">
          {sousOnglet === 'journalier' && (
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-sand-200 shadow-xs">
              <span className="text-sand-500 font-medium">Journée :</span>
              <input
                type="date"
                value={dateJournee}
                onChange={e => setDateJournee(e.target.value)}
                className="font-bold text-sand-900 bg-transparent focus:outline-none"
              />
            </div>
          )}

          {sousOnglet === 'periode' && (
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-sand-200 shadow-xs flex-wrap">
              <span className="text-sand-500 font-medium">Du :</span>
              <input
                type="date"
                value={dateDebutPeriode}
                onChange={e => setDateDebutPeriode(e.target.value)}
                className="font-bold text-sand-900 bg-transparent focus:outline-none"
              />
              <span className="text-sand-500 font-medium">au :</span>
              <input
                type="date"
                value={dateFinPeriode}
                onChange={e => setDateFinPeriode(e.target.value)}
                className="font-bold text-sand-900 bg-transparent focus:outline-none"
              />
            </div>
          )}

          {sousOnglet === 'mensuel' && (
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
                <Icon icon="mdi:barley" className="w-6 h-6" />
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
                        <Icon icon="mdi:check-circle" className="w-3.5 h-3.5" /> Conforme au programme
                      </span>
                    ) : (
                      <span className="text-amber-700 font-semibold flex items-center gap-1">
                        <Icon icon="mdi:alert-circle" className="w-3.5 h-3.5" /> Écart : {farineConsommeeJour - farinePrevueProd} sacs
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
                <Icon icon="mdi:snowflake" className="w-6 h-6" />
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
                <Icon icon="mdi:check-circle" className="w-6 h-6" />
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
                  <Icon icon="mdi:plus-circle" className="w-4 h-4 text-emerald-600" />
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
                  className="text-xs text-sand-500 hover:text-sand-700 font-medium flex items-center gap-1 cursor-pointer"
                >
                  <Icon icon="mdi:restore" className="w-3.5 h-3.5" />
                  <span>Effacer la saisie</span>
                </button>
              )}
            </div>

            <form onSubmit={handleEnregistrerConsoJour} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {matieresActives.map(m => {
                  const val = saisiesJournee[m.id] ?? '';
                  const consoExistante = consommationsDuJour.find(c => c.matiereId === m.id);
                  const options = getOptionsConditionnement(m);
                  const aPlusieursOptions = options.length > 1;
                  const unitIdActif = unitesSaisieJour[m.id] || options[0].id;
                  const optionActive = options.find(o => o.id === unitIdActif) || options[0];
                  const qteNum = parseFloat(val.replace(',', '.'));
                  const qteBaseEquiv = !isNaN(qteNum) && qteNum > 0
                    ? Math.round((qteNum * optionActive.factor + Number.EPSILON) * 100) / 100
                    : null;

                  return (
                    <div
                      key={m.id}
                      className="p-3 rounded-xl border border-sand-200 bg-sand-50/40 hover:bg-sand-50 transition-colors space-y-2"
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-semibold text-xs text-sand-900 truncate" title={m.nom}>
                          {m.nom}
                        </span>
                        <span className="text-[11px] font-medium text-sand-500">
                          {formaterNomUnite(m.unite)}
                        </span>
                      </div>

                      {/* Sélecteur de conditionnement si applicable (ex: Sachet 500g / Carton / kg) */}
                      {aPlusieursOptions && (
                        <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-sand-200 text-[10px]">
                          {options.map(opt => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() =>
                                setUnitesSaisieJour(prev => ({ ...prev, [m.id]: opt.id }))
                              }
                              className={`flex-1 py-0.5 px-1 rounded font-semibold transition-all text-center ${
                                unitIdActif === opt.id
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'text-sand-600 hover:text-sand-900 hover:bg-sand-100'
                              }`}
                            >
                              {opt.labelCourt}
                            </button>
                          ))}
                        </div>
                      )}

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
                          className="w-full py-1.5 pl-3 pr-14 border border-sand-300 rounded-lg text-xs font-semibold text-sand-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-sand-500 font-semibold pointer-events-none truncate max-w-[50px]">
                          {optionActive.labelCourt}
                        </span>
                      </div>

                      {/* Équivalence en direct si facteur !== 1 */}
                      {qteBaseEquiv !== null && optionActive.factor !== 1 && (
                        <div className="text-[10px] font-bold text-emerald-700 bg-emerald-50/80 px-2 py-0.5 rounded-md">
                          = {qteBaseEquiv} {formaterNomUnite(m.unite, qteBaseEquiv > 1)} déduit du stock
                        </div>
                      )}

                      <div className="text-[10px] text-sand-500 flex justify-between">
                        <span>Dispo : {formaterQuantite(m.stockActuel, m.unite)}</span>
                        {consoExistante && (
                          <span className="text-cyan-700 font-semibold">
                            Saisi : {formaterQuantite(Math.abs(consoExistante.quantite), m.unite)}
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
                  <Icon icon="mdi:content-save" className="w-4 h-4" />
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
      {/* VUE 2 : SAISIE PAR PÉRIODE (CONSTANTE)                    */}
      {/* ========================================================= */}
      {sousOnglet === 'periode' && (
        <div className="space-y-6">
          {/* Bandeau supérieur : Explication & Raccourcis de sélection */}
          <div className="bg-white border border-sand-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-sand-100 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-sand-900 flex items-center gap-2">
                  <Icon icon="mdi:calendar-range" className="w-5 h-5 text-emerald-600" />
                  <span>Consommation Constante par Période</span>
                </h3>
                <p className="text-xs text-sand-500 mt-0.5">
                  Appliquez les mêmes sorties journalières de matières premières sur plusieurs jours en un seul clic.
                </p>
              </div>

              {/* Raccourcis rapides */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-semibold text-sand-400 mr-1">Raccourcis :</span>
                <button
                  type="button"
                  onClick={() => appliquerRaccourciPeriode('cette_semaine')}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-sand-100 hover:bg-sand-200 text-sand-700 transition-colors"
                >
                  Cette semaine
                </button>
                <button
                  type="button"
                  onClick={() => appliquerRaccourciPeriode('semaine_derniere')}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-sand-100 hover:bg-sand-200 text-sand-700 transition-colors"
                >
                  Semaine dernière
                </button>
                <button
                  type="button"
                  onClick={() => appliquerRaccourciPeriode('quinzaine_1')}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-sand-100 hover:bg-sand-200 text-sand-700 transition-colors"
                >
                  1re quinzaine (1-15)
                </button>
                <button
                  type="button"
                  onClick={() => appliquerRaccourciPeriode('quinzaine_2')}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-sand-100 hover:bg-sand-200 text-sand-700 transition-colors"
                >
                  2e quinzaine (16-fin)
                </button>
                <button
                  type="button"
                  onClick={() => appliquerRaccourciPeriode('mois_entier')}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-sand-100 hover:bg-sand-200 text-sand-700 transition-colors"
                >
                  Mois complet
                </button>
              </div>
            </div>

            {/* Cartouche d'information dynamique & options */}
            <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200 text-emerald-950 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Icon icon="mdi:repeat" className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-emerald-900 flex items-center gap-2">
                    <span>{nbJoursPeriode} journée{nbJoursPeriode > 1 ? 's' : ''} de production sélectionnée{nbJoursPeriode > 1 ? 's' : ''}</span>
                    <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-emerald-200/70 text-emerald-800">
                      du {dateDebutPeriode} au {dateFinPeriode}
                    </span>
                  </h4>
                  <p className="text-xs text-emerald-800 mt-1">
                    Chaque quantité saisie ci-dessous correspond à la <strong>quantité utilisée par jour</strong>. Le total sur les {nbJoursPeriode} jours est calculé et sera ventilé automatiquement jour par jour.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs font-medium flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-emerald-200 hover:bg-emerald-50/50 transition-colors shadow-2xs">
                  <input
                    type="checkbox"
                    checked={exclureDimanchesPeriode}
                    onChange={e => setExclureDimanchesPeriode(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Exclure dimanches</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-emerald-200 hover:bg-emerald-50/50 transition-colors shadow-2xs">
                  <input
                    type="checkbox"
                    checked={ecraserExistantPeriode}
                    onChange={e => setEcraserExistantPeriode(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Remplacer si déjà saisi</span>
                </label>
              </div>
            </div>
          </div>

          {/* Formulaire Grille Matières Premières */}
          <div className="bg-white border border-sand-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-sand-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-sand-900">
                  Quantités quotidiennes constantes
                </h3>
                <p className="text-xs text-sand-500">
                  Renseignez ce que vous consommez lors d'une journée de production habituelle.
                </p>
              </div>
              {Object.keys(saisiesPeriode).length > 0 && (
                <button
                  type="button"
                  onClick={() => setSaisiesPeriode({})}
                  className="text-xs text-sand-500 hover:text-sand-700 font-medium flex items-center gap-1 cursor-pointer"
                >
                  <Icon icon="mdi:restore" className="w-3.5 h-3.5" />
                  <span>Réinitialiser</span>
                </button>
              )}
            </div>

            <form onSubmit={handleDemanderConfirmationPeriode} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {matieresActives.map(m => {
                  const val = saisiesPeriode[m.id] ?? '';
                  const options = getOptionsConditionnement(m);
                  const aPlusieursOptions = options.length > 1;
                  const unitIdActif = unitesSaisiePeriode[m.id] || options[0].id;
                  const optionActive = options.find(o => o.id === unitIdActif) || options[0];
                  const qteNum = parseFloat(val.replace(',', '.'));
                  const qteValide = !isNaN(qteNum) && qteNum > 0;
                  const qteBaseJour = qteValide
                    ? Math.round((qteNum * optionActive.factor + Number.EPSILON) * 100) / 100
                    : null;
                  const totalBasePeriode = qteBaseJour !== null
                    ? Math.round((qteBaseJour * nbJoursPeriode + Number.EPSILON) * 100) / 100
                    : null;
                  const totalSaisiePeriode = qteValide
                    ? Math.round((qteNum * nbJoursPeriode + Number.EPSILON) * 100) / 100
                    : null;

                  return (
                    <div
                      key={m.id}
                      className={`p-3 rounded-xl border transition-all space-y-2 ${
                        qteValide
                          ? 'border-emerald-300 bg-emerald-50/20 shadow-2xs'
                          : 'border-sand-200 bg-sand-50/40 hover:bg-sand-50'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-semibold text-xs text-sand-900 truncate" title={m.nom}>
                          {m.nom}
                        </span>
                        <span className="text-[11px] font-medium text-sand-500">
                          Dispo: {formaterQuantite(m.stockActuel || 0, m.unite)}
                        </span>
                      </div>

                      {/* Sélecteur de conditionnement si applicable */}
                      {aPlusieursOptions && (
                        <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-sand-200 text-[10px]">
                          {options.map(opt => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() =>
                                setUnitesSaisiePeriode(prev => ({ ...prev, [m.id]: opt.id }))
                              }
                              className={`flex-1 py-0.5 px-1 rounded font-semibold transition-all text-center ${
                                unitIdActif === opt.id
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'text-sand-600 hover:text-sand-900 hover:bg-sand-100'
                              }`}
                            >
                              {opt.labelCourt}
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="relative">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="Qté par jour..."
                          value={val}
                          onChange={e =>
                            setSaisiesPeriode(prev => ({
                              ...prev,
                              [m.id]: e.target.value
                            }))
                          }
                          className="w-full py-1.5 pl-3 pr-14 border border-sand-300 rounded-lg text-xs font-semibold text-sand-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-sand-500 font-semibold pointer-events-none truncate max-w-[50px]">
                          {optionActive.labelCourt}/j
                        </span>
                      </div>

                      {/* Calcul dynamique du total sur la période */}
                      {qteValide && totalBasePeriode !== null && (
                        <div className="space-y-1 pt-1 border-t border-emerald-100/60">
                          <div className="flex items-center justify-between text-[11px] font-bold text-emerald-800">
                            <span>Total période ({nbJoursPeriode}j) :</span>
                            <span>{totalSaisiePeriode} {optionActive.labelCourt}</span>
                          </div>
                          {optionActive.factor !== 1 && (
                            <div className="text-[10px] text-emerald-700 font-medium">
                              = {formaterQuantite(totalBasePeriode, m.unite)}
                            </div>
                          )}
                          {m.prixUnitaireMoyen && m.prixUnitaireMoyen > 0 && (
                            <div className="text-[10px] text-sand-500">
                              ~ {formatCurrency(Math.round(totalBasePeriode * m.prixUnitaireMoyen))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Barre de validation et récapitulatif bas */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-sand-100">
                <div className="text-xs text-sand-600">
                  {recapitulatifPeriode.length > 0 ? (
                    <span className="font-semibold text-emerald-800">
                      {recapitulatifPeriode.length} matière{recapitulatifPeriode.length > 1 ? 's' : ''} configurée{recapitulatifPeriode.length > 1 ? 's' : ''} pour {nbJoursPeriode} jours • Coût estimé : {formatCurrency(totalCoutPeriode)}
                    </span>
                  ) : (
                    <span>Saisissez au moins une quantité par jour pour continuer</span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={recapitulatifPeriode.length === 0 || nbJoursPeriode === 0}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition-all cursor-pointer w-full sm:w-auto"
                >
                  <Icon icon="mdi:calendar-check" className="w-4 h-4 text-base" />
                  <span>Appliquer sur les {nbJoursPeriode} jours ({recapitulatifPeriode.length} matière{recapitulatifPeriode.length > 1 ? 's' : ''})</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE DE CONFIRMATION DE LA PÉRIODE */}
      {showConfirmPeriodeModal && (
        <Modal
          isOpen={showConfirmPeriodeModal}
          onClose={() => setShowConfirmPeriodeModal(false)}
          title={`Confirmer la saisie pour ${nbJoursPeriode} journées`}
          size="lg"
        >
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
              <p className="font-bold flex items-center gap-1.5 mb-1">
                <Icon icon="mdi:information-outline" className="text-base text-amber-700" />
                <span>Application groupée sur {nbJoursPeriode} jours</span>
              </p>
              <p>
                Le système va créer ou ajuster la consommation de chacun des {nbJoursPeriode} jours (du <strong>{dateDebutPeriode}</strong> au <strong>{dateFinPeriode}</strong>{exclureDimanchesPeriode ? ', dimanches exclus' : ''}).
              </p>
            </div>

            <div className="overflow-x-auto max-h-64 border border-sand-200 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-sand-100 text-sand-700 font-bold sticky top-0">
                  <tr>
                    <th className="p-2.5">Matière</th>
                    <th className="p-2.5 text-right">Qté / jour</th>
                    <th className="p-2.5 text-right">Total ({nbJoursPeriode}j)</th>
                    <th className="p-2.5 text-right">Équiv. Stock</th>
                    <th className="p-2.5 text-right">Coût estimé</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand-100">
                  {recapitulatifPeriode.map(item => (
                    <tr key={item.matiereId} className="hover:bg-sand-50/60">
                      <td className="p-2.5 font-semibold text-sand-900">{item.matiereNom}</td>
                      <td className="p-2.5 text-right text-sand-700">{item.qteSaisieJour} {item.unitLabel}/j</td>
                      <td className="p-2.5 text-right font-bold text-emerald-800">{item.totalSaisiePeriode} {item.unitLabel}</td>
                      <td className="p-2.5 text-right text-sand-600">{item.totalBasePeriode} {item.uniteBase}</td>
                      <td className="p-2.5 text-right font-medium text-sand-900">{formatCurrency(Math.round(item.coutTotal))}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-sand-50 font-bold text-sand-900 border-t border-sand-200">
                  <tr>
                    <td colSpan={4} className="p-2.5 text-right">Coût total estimé :</td>
                    <td className="p-2.5 text-right text-emerald-800">{formatCurrency(totalCoutPeriode)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-sand-100">
              <button
                type="button"
                onClick={() => setShowConfirmPeriodeModal(false)}
                className="px-4 py-2 border border-sand-300 rounded-xl text-xs font-semibold text-sand-700 hover:bg-sand-50 cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmerEnregistrerPeriode}
                disabled={isSubmittingPeriode}
                className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
              >
                <Icon icon="mdi:check" className="text-base" />
                <span>{isSubmittingPeriode ? 'Enregistrement...' : `Confirmer pour les ${nbJoursPeriode} jours`}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================= */}
      {/* VUE 3 : BILAN MENSUEL                                     */}
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
                  <Icon icon="mdi:calendar-check" className="w-4 h-4 text-terracotta-600" />
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
                  const options = getOptionsConditionnement(m);
                  const aPlusieursOptions = options.length > 1;
                  const unitIdActif = unitesSaisieMois[m.id] || options[0].id;
                  const optionActive = options.find(o => o.id === unitIdActif) || options[0];
                  const qteNum = parseFloat(val.replace(',', '.'));
                  const qteBaseEquiv = !isNaN(qteNum) && qteNum > 0
                    ? Math.round((qteNum * optionActive.factor + Number.EPSILON) * 100) / 100
                    : null;

                  return (
                    <div
                      key={m.id}
                      className="p-3 rounded-xl border border-sand-200 bg-sand-50/40 hover:bg-sand-50 transition-colors space-y-2"
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-semibold text-xs text-sand-900 truncate" title={m.nom}>
                          {m.nom}
                        </span>
                        <span className="text-[11px] font-medium text-sand-500">
                          {formaterNomUnite(m.unite)}
                        </span>
                      </div>

                      {/* Sélecteur de conditionnement si applicable (ex: Sachet 500g / Carton / kg) */}
                      {aPlusieursOptions && (
                        <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-sand-200 text-[10px]">
                          {options.map(opt => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() =>
                                setUnitesSaisieMois(prev => ({ ...prev, [m.id]: opt.id }))
                              }
                              className={`flex-1 py-0.5 px-1 rounded font-semibold transition-all text-center ${
                                unitIdActif === opt.id
                                  ? 'bg-terracotta-600 text-white shadow-xs'
                                  : 'text-sand-600 hover:text-sand-900 hover:bg-sand-100'
                              }`}
                            >
                              {opt.labelCourt}
                            </button>
                          ))}
                        </div>
                      )}

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
                          className="w-full py-1.5 pl-3 pr-14 border border-sand-300 rounded-lg text-xs font-semibold text-sand-900 bg-white focus:outline-none focus:ring-2 focus:ring-terracotta-500/20 focus:border-terracotta-500"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-sand-500 font-semibold pointer-events-none truncate max-w-[50px]">
                          {optionActive.labelCourt}
                        </span>
                      </div>

                      {/* Équivalence en direct si facteur !== 1 */}
                      {qteBaseEquiv !== null && optionActive.factor !== 1 && (
                        <div className="text-[10px] font-bold text-terracotta-700 bg-terracotta-50/80 px-2 py-0.5 rounded-md">
                          = {qteBaseEquiv} {formaterNomUnite(m.unite, qteBaseEquiv > 1)} déduit du stock
                        </div>
                      )}
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
                  <Icon icon="mdi:content-save" className="w-4 h-4" />
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
