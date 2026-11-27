import React, { useState, useMemo } from 'react';
import { Icon } from '@iconify/react';
import { formatCurrency } from '../../utils/currency';
import { formaterQuantite } from '../../utils/calculations';
import type { MouvementStock, MatierePremiere } from '../../types/stock';
import type { Depense } from '../../types/depense';
import type { ProgrammeProduction } from '../../types/production';

interface TableauBordFinanceSimpleProps {
  periode: { debut: string; fin: string };
  onChangerPeriode: (debut: string, fin: string) => void;
  caBoutiquePos: number;
  caLivraison: number;
  caLivraisonEncaisse: number;
  depenses: Depense[];
  mouvements: MouvementStock[];
  matieres: MatierePremiere[];
  programmes: ProgrammeProduction[];
  onRefresh?: () => void;
}

export const TableauBordFinanceSimple: React.FC<TableauBordFinanceSimpleProps> = ({
  periode,
  onChangerPeriode,
  caBoutiquePos,
  caLivraison,
  caLivraisonEncaisse,
  depenses,
  mouvements,
  matieres,
  programmes
}) => {
  const [ongletDetail, setOngletDetail] = useState<'aucun' | 'matieres' | 'depenses'>('aucun');

  // Dates début et fin au format Date
  const debutDate = useMemo(() => {
    const d = new Date(periode.debut);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [periode.debut]);

  const finDate = useMemo(() => {
    const d = new Date(periode.fin);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [periode.fin]);

  // Raccourcis de sélection de période
  const appliquerPeriodeRapide = (type: 'aujourdhui' | 'semaine' | 'mois' | 'mois_dernier') => {
    const now = new Date();
    const toYMD = (d: Date) => d.toISOString().split('T')[0];

    if (type === 'aujourdhui') {
      const today = toYMD(now);
      onChangerPeriode(today, today);
    } else if (type === 'semaine') {
      const lundi = new Date(now);
      const day = lundi.getDay() || 7;
      lundi.setDate(lundi.getDate() - day + 1);
      onChangerPeriode(toYMD(lundi), toYMD(now));
    } else if (type === 'mois') {
      const premier = new Date(now.getFullYear(), now.getMonth(), 1);
      const dernier = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      onChangerPeriode(toYMD(premier), toYMD(dernier));
    } else if (type === 'mois_dernier') {
      const premier = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const dernier = new Date(now.getFullYear(), now.getMonth(), 0);
      onChangerPeriode(toYMD(premier), toYMD(dernier));
    }
  };

  // 1. VENTES
  const totalVentes = caBoutiquePos + caLivraison;
  const creancesEnAttente = Math.max(0, caLivraison - caLivraisonEncaisse);

  // 2. PRODUCTION & SACS PÉTRIS
  const { totalPains, sacsFarinePetris } = useMemo(() => {
    let pains = 0;
    let sacs = 0;

    programmes.forEach(p => {
      const d = new Date(p.dateProduction || p.createdAt);
      if (d >= debutDate && d <= finDate) {
        if (p.totauxParProduit) {
          pains += p.totauxParProduit.reduce((sum, item) => sum + (item.totalGlobal || 0), 0);
        }
        if (p.sacsFarinePetris) {
          sacs += p.sacsFarinePetris;
        }
      }
    });

    return { totalPains: pains, sacsFarinePetris: sacs };
  }, [programmes, debutDate, finDate]);

  // Rendement Farine : pains sortis par sac
  const rendementFarine = sacsFarinePetris > 0 && totalPains > 0
    ? Math.round(totalPains / sacsFarinePetris)
    : null;

  // 3. MATIÈRES PREMIÈRES CONSOMMÉES
  const { coutFarine, coutIngredients, detailMatieres, totalMatieres } = useMemo(() => {
    let farine = 0;
    let ingredients = 0;
    const detail: Record<string, { quantite: number; unite: string; cout: number }> = {};

    mouvements.forEach(mvt => {
      const d = new Date(mvt.date);
      if (d >= debutDate && d <= finDate && mvt.type === 'consommation') {
        const mat = matieres.find(m => m.id === mvt.matiereId);
        if (mat) {
          const qte = Math.abs(mvt.quantite);
          const pmp = mat.prixUnitaireMoyen || 0;
          const cout = qte * pmp;

          const isFarine = mat.nom.toLowerCase().includes('farine');
          if (isFarine) {
            farine += cout;
          } else {
            ingredients += cout;
          }

          if (!detail[mat.nom]) {
            detail[mat.nom] = { quantite: 0, unite: mat.unite, cout: 0 };
          }
          detail[mat.nom].quantite += qte;
          detail[mat.nom].cout += cout;
        }
      }
    });

    return {
      coutFarine: farine,
      coutIngredients: ingredients,
      detailMatieres: detail,
      totalMatieres: farine + ingredients
    };
  }, [mouvements, matieres, debutDate, finDate]);

  // 4. DÉPENSES OPÉRATIONNELLES (CHARGES)
  const { coutGasoil, coutSalaires, coutEnergie, totalDepenses, depensesParCat } = useMemo(() => {
    let gasoil = 0;
    let salaires = 0;
    let energie = 0;
    let autres = 0;
    const parCat: Record<string, number> = {};

    depenses.forEach(dep => {
      const d = new Date(dep.date);
      if (d >= debutDate && d <= finDate) {
        // Ignorer d'éventuelles anciennes lignes Intrants pour ne pas doubler avec le stock
        if (dep.categorie === 'Intrants') return;

        const cat = dep.categorie as string;
        const montant = dep.montant || 0;
        parCat[cat] = (parCat[cat] || 0) + montant;

        const catLower = cat.toLowerCase();
        const descLower = (dep.description || '').toLowerCase();

        if (catLower.includes('carburant') || descLower.includes('gasoil') || descLower.includes('essence')) {
          gasoil += montant;
        } else if (catLower.includes('salaire')) {
          salaires += montant;
        } else if (catLower.includes('électricité') || catLower.includes('eau')) {
          energie += montant;
        } else {
          autres += montant;
        }
      }
    });

    const total = gasoil + salaires + energie + autres;
    return {
      coutGasoil: gasoil,
      coutSalaires: salaires,
      coutEnergie: energie,
      coutAutres: autres,
      totalDepenses: total,
      depensesParCat: parCat
    };
  }, [depenses, debutDate, finDate]);

  // 5. BÉNÉFICE NET
  const beneficeNet = totalVentes - totalMatieres - totalDepenses;
  const tauxMarge = totalVentes > 0 ? (beneficeNet / totalVentes) * 100 : 0;
  const estRentable = beneficeNet >= 0;

  return (
    <div className="space-y-6">
      {/* ── BARRE DE CONTRÔLE RAPIDE ─────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-card border border-sand-200 p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 overflow-hidden">
        {/* Raccourcis de période */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-sand-500 uppercase tracking-wider mr-1">Période :</span>
          <button
            onClick={() => appliquerPeriodeRapide('aujourdhui')}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-sand-100 hover:bg-sand-200 text-sand-800 transition-colors"
          >
            Aujourd&apos;hui
          </button>
          <button
            onClick={() => appliquerPeriodeRapide('semaine')}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-sand-100 hover:bg-sand-200 text-sand-800 transition-colors"
          >
            Cette semaine
          </button>
          <button
            onClick={() => appliquerPeriodeRapide('mois')}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-terracotta-50 hover:bg-terracotta-100 text-terracotta-800 border border-terracotta-200 transition-colors"
          >
            Ce mois (du 01 au 30)
          </button>
          <button
            onClick={() => appliquerPeriodeRapide('mois_dernier')}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-sand-100 hover:bg-sand-200 text-sand-800 transition-colors"
          >
            Mois dernier
          </button>
        </div>
      </div>

      {/* ── LES 4 INDICATEURS CLÉS ─────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CARTE 1 : CHIFFRE D'AFFAIRES */}
        <div className="bg-white rounded-2xl shadow-card border border-sand-200 p-5 relative overflow-hidden flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-sand-500 truncate">
                  Chiffre d&apos;affaires
                </span>
                <span
                  className="text-sand-400 hover:text-sand-600 cursor-help shrink-0"
                  title="Total des ventes en boutique (caisse) + factures de livraison sur la période."
                >
                  <Icon icon="mdi:information-outline" className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Icon icon="mdi:cash-register" className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-sand-900 tracking-tight">
              {formatCurrency(totalVentes)}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-sand-100 text-xs text-sand-600 space-y-1">
            <div className="flex justify-between">
              <span>Boutique (Caisse) :</span>
              <strong className="text-sand-900">{formatCurrency(caBoutiquePos)}</strong>
            </div>
            <div className="flex justify-between">
              <span>Livraisons clients :</span>
              <strong className="text-sand-900">{formatCurrency(caLivraison)}</strong>
            </div>
          </div>
        </div>

        {/* CARTE 2 : MATIÈRES CONSOMMÉES */}
        <div className="bg-white rounded-2xl shadow-card border border-sand-200 p-5 relative overflow-hidden flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-sand-500 truncate">
                  Matières consommées
                </span>
                <span
                  className="text-sand-400 hover:text-sand-600 cursor-help shrink-0"
                  title="Quantités consommées au fournil × prix unitaire moyen (module Stock)."
                >
                  <Icon icon="mdi:information-outline" className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Icon icon="mdi:wheat" className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-900 tracking-tight">
              {formatCurrency(totalMatieres)}
            </div>
            <p className="text-[11px] text-amber-700 font-medium">
              Source : Stock (Consommations)
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-sand-100 text-xs text-sand-600 space-y-1">
            <div className="flex justify-between">
              <span>Farine consommée :</span>
              <strong className="text-sand-900">{formatCurrency(coutFarine)}</strong>
            </div>
            <div className="flex justify-between">
              <span>Levure, améliorant & sel :</span>
              <strong className="text-sand-900">{formatCurrency(coutIngredients)}</strong>
            </div>
          </div>
        </div>

        {/* CARTE 3 : DÉPENSES D'EXPLOITATION */}
        <div className="bg-white rounded-2xl shadow-card border border-sand-200 p-5 relative overflow-hidden flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-sand-500 truncate">
                  Dépenses d&apos;exploitation
                </span>
                <span
                  className="text-sand-400 hover:text-sand-600 cursor-help shrink-0"
                  title="Frais de fonctionnement : carburant, salaires, électricité, eau, glace, loyer, entretien (module Dépenses)."
                >
                  <Icon icon="mdi:information-outline" className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Icon icon="mdi:gas-station" className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-rose-900 tracking-tight">
              {formatCurrency(totalDepenses)}
            </div>
            <p className="text-[11px] text-rose-700 font-medium">
              Source : Dépenses
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-sand-100 text-xs text-sand-600 space-y-1">
            <div className="flex justify-between">
              <span>Gasoil / Carburant :</span>
              <strong className="text-sand-900">{formatCurrency(coutGasoil)}</strong>
            </div>
            <div className="flex justify-between">
              <span>Salaires & Énergie :</span>
              <strong className="text-sand-900">{formatCurrency(coutSalaires + coutEnergie)}</strong>
            </div>
          </div>
        </div>

        {/* CARTE 4 : BÉNÉFICE NET */}
        <div className={`rounded-2xl shadow-card border p-5 relative overflow-hidden flex flex-col justify-between ${
          estRentable
            ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-emerald-600'
            : 'bg-gradient-to-br from-rose-500 to-red-600 text-white border-rose-600'
        }`}>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-white/85 truncate">
                  Bénéfice net
                </span>
                <span
                  className="text-white/75 hover:text-white cursor-help shrink-0"
                  title="Chiffre d'affaires − Matières consommées − Dépenses d'exploitation."
                >
                  <Icon icon="mdi:information-outline" className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white shrink-0">
                <Icon icon={estRentable ? "mdi:check-circle" : "mdi:alert-circle"} className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black tracking-tight">
              {estRentable ? '+' : ''}{formatCurrency(beneficeNet)}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-white/20 text-xs text-white/90 flex items-center justify-between">
            <span>Marge nette :</span>
            <strong className="text-white text-sm">{tauxMarge.toFixed(1)}%</strong>
          </div>
        </div>
      </div>

      {/* ── BAROMÈTRE DU BOULANGER : LES INDICATEURS DU QUOTIDIEN ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Rendement Farine */}
        <div className="bg-white rounded-2xl shadow-card border border-sand-200 p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-terracotta-50 text-terracotta-600 flex items-center justify-center shrink-0">
            <Icon icon="mdi:scale-balance" className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-sand-500 uppercase tracking-wide">
              Rendement Farine (Baguettes / Sac)
            </p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-xl font-extrabold text-sand-900">
                {rendementFarine ? `${rendementFarine} pcs/sac` : '—'}
              </span>
              {sacsFarinePetris > 0 && (
                <span className="text-xs text-sand-500">
                  ({sacsFarinePetris} sacs pétris)
                </span>
              )}
            </div>
            {rendementFarine && (
              <p className={`text-[11px] font-semibold mt-1 inline-flex items-center gap-1 ${
                rendementFarine >= 125 ? 'text-emerald-600' : 'text-amber-600'
              }`}>
                <Icon icon={rendementFarine >= 125 ? 'mdi:check-circle-outline' : 'mdi:alert-outline'} className="w-3.5 h-3.5" />
                {rendementFarine >= 125
                  ? 'Bon rendement (≥ 125 baguettes/sac)'
                  : 'Rendement faible (surveiller le dosage)'}
              </p>
            )}
          </div>
        </div>

        {/* Focus Gasoil */}
        <div className="bg-white rounded-2xl shadow-card border border-sand-200 p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <Icon icon="mdi:fuel" className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-sand-500 uppercase tracking-wide">
              Consommation Gasoil
            </p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-xl font-extrabold text-sand-900">
                {formatCurrency(coutGasoil)}
              </span>
              {totalVentes > 0 && (
                <span className="text-xs font-medium text-sand-500">
                  ({((coutGasoil / totalVentes) * 100).toFixed(1)}% du CA)
                </span>
              )}
            </div>
            <p className="text-[11px] text-sand-500 mt-1 truncate">
              Véhicules de livraison & brûleur four
            </p>
          </div>
        </div>

        {/* Créances clients en attente */}
        <div className="bg-white rounded-2xl shadow-card border border-sand-200 p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Icon icon="mdi:account-cash" className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-sand-500 uppercase tracking-wide">
              Factures Livraisons à Encaisser
            </p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-xl font-extrabold text-amber-900">
                {formatCurrency(creancesEnAttente)}
              </span>
            </div>
            <p className="text-[11px] text-sand-500 mt-1">
              Encaissé : {formatCurrency(caLivraisonEncaisse)} sur {formatCurrency(caLivraison)}
            </p>
          </div>
        </div>
      </div>

      {/* ── VOLETS DE DÉTAIL (RÉTRACTABLES) ────────────────────── */}
      <div className="bg-white rounded-2xl shadow-card border border-sand-200 p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sand-100 pb-3">
          <span className="text-xs font-bold text-sand-700 uppercase tracking-wider">
            Consulter les détails :
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOngletDetail(ongletDetail === 'matieres' ? 'aucun' : 'matieres')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                ongletDetail === 'matieres'
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-sand-100 hover:bg-sand-200 text-sand-700'
              }`}
            >
              <Icon icon="mdi:wheat" className="w-4 h-4" />
              <span>Détail Matières consommées</span>
            </button>
            <button
              onClick={() => setOngletDetail(ongletDetail === 'depenses' ? 'aucun' : 'depenses')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                ongletDetail === 'depenses'
                  ? 'bg-rose-100 text-rose-900 border border-rose-300'
                  : 'bg-sand-100 hover:bg-sand-200 text-sand-700'
              }`}
            >
              <Icon icon="mdi:cash-minus" className="w-4 h-4" />
              <span>Détail Dépenses d&apos;exploitation</span>
            </button>
          </div>
        </div>

        {/* Détail Matières */}
        {ongletDetail === 'matieres' && (
          <div className="space-y-3 pt-2">
            <h4 className="text-sm font-bold text-sand-900">
              Matières consommées sur la période ({Object.keys(detailMatieres).length} matière(s))
            </h4>
            {Object.keys(detailMatieres).length === 0 ? (
              <p className="text-xs text-sand-500 py-4 text-center">
                Aucune consommation enregistrée sur cette période. Déclarez vos consommations dans le module Stock.
              </p>
            ) : (
              <div className="divide-y divide-sand-100">
                {Object.entries(detailMatieres).map(([nom, info]) => (
                  <div key={nom} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-sand-900">{nom}</span>
                      <span className="text-sand-500 ml-2">
                        ({formaterQuantite(info.quantite, info.unite)})
                      </span>
                    </div>
                    <span className="font-extrabold text-sand-900">
                      {formatCurrency(info.cout)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Détail Dépenses */}
        {ongletDetail === 'depenses' && (
          <div className="space-y-3 pt-2">
            <h4 className="text-sm font-bold text-sand-900">
              Dépenses de fonctionnement par catégorie
            </h4>
            {Object.keys(depensesParCat).length === 0 ? (
              <p className="text-xs text-sand-500 py-4 text-center">
                Aucune dépense enregistrée sur cette période.
              </p>
            ) : (
              <div className="divide-y divide-sand-100">
                {Object.entries(depensesParCat).map(([cat, montant]) => (
                  <div key={cat} className="py-2.5 flex items-center justify-between text-xs">
                    <span className="font-bold text-sand-900">{cat}</span>
                    <span className="font-extrabold text-sand-900">{formatCurrency(montant)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
