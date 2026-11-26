import React, { useState, useMemo } from 'react';
import { useStockStore } from '../../store/stockStore';
import { formatCurrency } from '../../utils/currency';
import { formaterQuantite } from '../../utils/calculations';
import {
  CalendarRange,
  ArrowDownLeft,
  ArrowUpRight,
  Printer,
  Search,
  SlidersHorizontal,
  FileSpreadsheet
} from 'lucide-react';

type PeriodePreset = 'aujourdhui' | '7jours' | '30jours' | 'ce_mois' | 'mois_dernier' | 'personnalise';

export const StockRapportPeriode: React.FC = () => {
  const { matieres, mouvements } = useStockStore();

  const now = new Date();
  const formatYMD = (d: Date) => d.toISOString().split('T')[0];

  const [preset, setPreset] = useState<PeriodePreset>('ce_mois');
  const [dateDebut, setDateDebut] = useState<string>(() => {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return formatYMD(firstDay);
  });
  const [dateFin, setDateFin] = useState<string>(() => formatYMD(now));
  const [searchTerm, setSearchTerm] = useState('');

  // Gestion des presets
  const handleSelectPreset = (p: PeriodePreset) => {
    setPreset(p);
    const aujourdhui = new Date();
    aujourdhui.setHours(0, 0, 0, 0);

    if (p === 'aujourdhui') {
      const ymd = formatYMD(aujourdhui);
      setDateDebut(ymd);
      setDateFin(ymd);
    } else if (p === '7jours') {
      const start = new Date(aujourdhui);
      start.setDate(start.getDate() - 6);
      setDateDebut(formatYMD(start));
      setDateFin(formatYMD(aujourdhui));
    } else if (p === '30jours') {
      const start = new Date(aujourdhui);
      start.setDate(start.getDate() - 29);
      setDateDebut(formatYMD(start));
      setDateFin(formatYMD(aujourdhui));
    } else if (p === 'ce_mois') {
      const start = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 1);
      setDateDebut(formatYMD(start));
      setDateFin(formatYMD(aujourdhui));
    } else if (p === 'mois_dernier') {
      const start = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth() - 1, 1);
      const end = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 0);
      setDateDebut(formatYMD(start));
      setDateFin(formatYMD(end));
    }
  };

  // Filtrage des mouvements sur la période
  const mouvementsPeriode = useMemo(() => {
    if (!dateDebut || !dateFin) return [];
    const dDebut = new Date(dateDebut + 'T00:00:00');
    const dFin = new Date(dateFin + 'T23:59:59.999');

    return mouvements.filter(m => {
      const mDate = new Date(m.date);
      return mDate >= dDebut && mDate <= dFin;
    });
  }, [mouvements, dateDebut, dateFin]);

  // Agrégation par matière première
  const rapportParMatiere = useMemo(() => {
    // Map : matiereId -> données agrégées
    const map = new Map<
      string,
      {
        matiereId: string;
        nom: string;
        unite: string;
        prixPMP: number;
        achatsQte: number;
        achatsMontant: number;
        consommationsQte: number;
        consommationsCout: number;
        pertesQte: number;
        correctionsQte: number;
        nbMouvements: number;
      }
    >();

    // Initialiser avec toutes les matières connues
    matieres.forEach(m => {
      map.set(m.id, {
        matiereId: m.id,
        nom: m.nom,
        unite: m.unite,
        prixPMP: m.prixUnitaireMoyen || 0,
        achatsQte: 0,
        achatsMontant: 0,
        consommationsQte: 0,
        consommationsCout: 0,
        pertesQte: 0,
        correctionsQte: 0,
        nbMouvements: 0
      });
    });

    // Parcourir les mouvements de la période
    mouvementsPeriode.forEach(m => {
      let entry = map.get(m.matiereId);
      if (!entry) {
        // Matière supprimée ou archivée mais présente dans les mouvements
        const matiereTrouvee = matieres.find(mat => mat.id === m.matiereId);
        entry = {
          matiereId: m.matiereId,
          nom: matiereTrouvee?.nom || 'Article inconnu',
          unite: matiereTrouvee?.unite || '',
          prixPMP: matiereTrouvee?.prixUnitaireMoyen || 0,
          achatsQte: 0,
          achatsMontant: 0,
          consommationsQte: 0,
          consommationsCout: 0,
          pertesQte: 0,
          correctionsQte: 0,
          nbMouvements: 0
        };
        map.set(m.matiereId, entry);
      }

      entry.nbMouvements += 1;
      const qte = Math.abs(m.quantite || 0);

      switch (m.type) {
        case 'achat':
          entry.achatsQte += qte;
          entry.achatsMontant += (m.prixUnitaire && m.prixUnitaire > 0)
            ? qte * m.prixUnitaire
            : qte * entry.prixPMP;
          break;
        case 'consommation':
          entry.consommationsQte += qte;
          entry.consommationsCout += qte * entry.prixPMP;
          break;
        case 'perte':
          entry.pertesQte += qte;
          break;
        case 'correction':
          entry.correctionsQte += (m.quantite || 0);
          break;
        default:
          break;
      }
    });

    return Array.from(map.values())
      .filter(item => {
        // Garder les matières actives OU celles qui ont eu des mouvements sur la période
        const mat = matieres.find(m => m.id === item.matiereId);
        return (mat && mat.active !== false) || item.nbMouvements > 0;
      })
      .sort((a, b) => {
        // Mettre en premier celles qui ont eu le plus de mouvements ou le nom
        if (a.nbMouvements > 0 && b.nbMouvements === 0) return -1;
        if (a.nbMouvements === 0 && b.nbMouvements > 0) return 1;
        return a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' });
      });
  }, [matieres, mouvementsPeriode]);

  // Totaux globaux
  const totauxGlobaux = useMemo(() => {
    let totalAchatsFCFA = 0;
    let totalConsommationsFCFA = 0;
    let totalPertesLignes = 0;

    rapportParMatiere.forEach(r => {
      totalAchatsFCFA += r.achatsMontant;
      totalConsommationsFCFA += r.consommationsCout;
      if (r.pertesQte > 0) totalPertesLignes++;
    });

    return {
      totalAchatsFCFA,
      totalConsommationsFCFA,
      totalPertesLignes,
      nbMouvementsTotal: mouvementsPeriode.length
    };
  }, [rapportParMatiere, mouvementsPeriode]);

  // Filtrage par texte
  const rapportFiltre = useMemo(() => {
    if (!searchTerm.trim()) return rapportParMatiere;
    const term = searchTerm.toLowerCase();
    return rapportParMatiere.filter(r => r.nom.toLowerCase().includes(term));
  }, [rapportParMatiere, searchTerm]);

  const handleImprimer = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Barre de filtres et de presets */}
      <div className="bg-sand-50/70 border border-sand-200 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-sand-900 flex items-center gap-2">
            <CalendarRange className="w-5 h-5 text-terracotta-600" />
            <span>Rapport & Analyse par Période</span>
          </h2>
          <p className="text-xs sm:text-sm text-sand-600 mt-0.5">
            Suivi consolidé des livraisons reçues, consommations et dépenses en matières sur la plage choisie.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleImprimer}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-sand-100 text-sand-800 rounded-xl border border-sand-200 text-xs font-semibold shadow-sm transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-sand-600" />
            <span>Imprimer le rapport</span>
          </button>
        </div>
      </div>

      {/* Sélecteurs de dates & Presets */}
      <div className="bg-white border border-sand-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-sand-500 uppercase tracking-wide mr-1 flex items-center gap-1">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Période :
          </span>

          {[
            { id: 'aujourdhui', label: "Aujourd'hui" },
            { id: '7jours', label: '7 derniers jours' },
            { id: '30jours', label: '30 derniers jours' },
            { id: 'ce_mois', label: 'Ce mois-ci' },
            { id: 'mois_dernier', label: 'Mois dernier' }
          ].map(p => (
            <button
              key={p.id}
              onClick={() => handleSelectPreset(p.id as PeriodePreset)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                preset === p.id
                  ? 'bg-sand-900 text-white shadow-sm'
                  : 'bg-sand-100 hover:bg-sand-200 text-sand-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Date Début / Fin personnalisables */}
        <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-sand-100 text-xs sm:text-sm">
          <div className="flex items-center gap-2">
            <label className="text-sand-600 font-medium">Du :</label>
            <input
              type="date"
              value={dateDebut}
              onChange={e => {
                setDateDebut(e.target.value);
                setPreset('personnalise');
              }}
              className="py-1.5 px-3 bg-sand-50 border border-sand-200 rounded-xl font-semibold text-sand-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-terracotta-500/20"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sand-600 font-medium">Au :</label>
            <input
              type="date"
              value={dateFin}
              onChange={e => {
                setDateFin(e.target.value);
                setPreset('personnalise');
              }}
              className="py-1.5 px-3 bg-sand-50 border border-sand-200 rounded-xl font-semibold text-sand-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-terracotta-500/20"
            />
          </div>

          <div className="text-xs text-sand-400 italic">
            ({mouvementsPeriode.length} flux enregistrés sur cette période)
          </div>
        </div>
      </div>

      {/* Cartes KPI de synthèse sur la période */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Achats / Réceptions */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-sand-200 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-sand-500 uppercase tracking-wide">
              Livraisons & Achats
            </p>
            <p className="text-lg sm:text-xl font-extrabold text-emerald-700 truncate mt-0.5">
              {formatCurrency(totauxGlobaux.totalAchatsFCFA)}
            </p>
            <p className="text-[11px] text-sand-400 truncate">Entrées matières reçues</p>
          </div>
        </div>

        {/* Total Consommations */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-sand-200 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center shrink-0">
            <ArrowUpRight className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-sand-500 uppercase tracking-wide">
              Consommation Estimée
            </p>
            <p className="text-lg sm:text-xl font-extrabold text-cyan-800 truncate mt-0.5">
              {formatCurrency(totauxGlobaux.totalConsommationsFCFA)}
            </p>
            <p className="text-[11px] text-sand-400 truncate">Valorisation au PMP</p>
          </div>
        </div>

        {/* Nombre de mouvements */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-sand-200 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-sand-500 uppercase tracking-wide">
              Mouvements Réalisés
            </p>
            <p className="text-lg sm:text-xl font-extrabold text-sand-900 truncate mt-0.5">
              {totauxGlobaux.nbMouvementsTotal} flux
            </p>
            <p className="text-[11px] text-sand-400 truncate">Traçabilité complète</p>
          </div>
        </div>

        {/* Pertes signalées */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-sand-200 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-sand-100 text-sand-600 flex items-center justify-center shrink-0">
            <span className="text-base font-bold">⚠️</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-sand-500 uppercase tracking-wide">
              Pertes & Rebuts
            </p>
            <p className="text-lg sm:text-xl font-extrabold text-sand-800 truncate mt-0.5">
              {totauxGlobaux.totalPertesLignes} article{totauxGlobaux.totalPertesLignes > 1 ? 's' : ''}
            </p>
            <p className="text-[11px] text-sand-400 truncate">Signalés sur la période</p>
          </div>
        </div>
      </div>

      {/* Tableau détaillé par Matière Première */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-sand-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filtrer une matière..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-sand-200 rounded-xl text-xs sm:text-sm text-sand-800 placeholder-sand-400 focus:outline-none focus:ring-2 focus:ring-terracotta-500/20"
            />
          </div>
          <p className="text-xs text-sand-500">
            Affichage de <strong>{rapportFiltre.length}</strong> matière{rapportFiltre.length > 1 ? 's' : ''}
          </p>
        </div>

        <div className="border border-sand-200 rounded-2xl overflow-hidden bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-sand-50/70 border-b border-sand-200 text-sand-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Matière Première</th>
                  <th className="py-3 px-4 text-right">PMP Unitaire</th>
                  <th className="py-3 px-4 text-right text-emerald-700">Entrées (Achats)</th>
                  <th className="py-3 px-4 text-right text-cyan-700">Consommations</th>
                  <th className="py-3 px-4 text-right text-rose-700">Pertes</th>
                  <th className="py-3 px-4 text-right text-amber-700">Ajustements</th>
                  <th className="py-3 px-4 text-right">Montant Achats</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-100">
                {rapportFiltre.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-sand-400">
                      Aucune matière première trouvée pour cette période.
                    </td>
                  </tr>
                ) : (
                  rapportFiltre.map(r => (
                    <tr key={r.matiereId} className="hover:bg-sand-50/50 transition-colors">
                      {/* Nom */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-sand-900">{r.nom}</div>
                        <div className="text-[11px] text-sand-400">
                          Unité : <span className="font-medium text-sand-600">{r.unite}</span>
                        </div>
                      </td>

                      {/* PMP */}
                      <td className="py-3 px-4 text-right text-sand-600 font-medium">
                        {r.prixPMP > 0 ? formatCurrency(Math.round(r.prixPMP)) : '—'}
                      </td>

                      {/* Entrées */}
                      <td className="py-3 px-4 text-right font-semibold text-emerald-700">
                        {r.achatsQte > 0 ? `+${formaterQuantite(r.achatsQte, r.unite)}` : '—'}
                      </td>

                      {/* Consommations */}
                      <td className="py-3 px-4 text-right font-semibold text-cyan-700">
                        {r.consommationsQte > 0 ? `-${formaterQuantite(r.consommationsQte, r.unite)}` : '—'}
                      </td>

                      {/* Pertes */}
                      <td className="py-3 px-4 text-right font-semibold text-rose-700">
                        {r.pertesQte > 0 ? `-${formaterQuantite(r.pertesQte, r.unite)}` : '—'}
                      </td>

                      {/* Ajustements / Corrections */}
                      <td className="py-3 px-4 text-right font-medium">
                        {r.correctionsQte !== 0 ? (
                          <span className={r.correctionsQte > 0 ? 'text-amber-700' : 'text-rose-600'}>
                            {r.correctionsQte > 0 ? '+' : ''}{r.correctionsQte} {r.unite}
                          </span>
                        ) : (
                          <span className="text-sand-300">—</span>
                        )}
                      </td>

                      {/* Montant Achats FCFA */}
                      <td className="py-3 px-4 text-right font-bold text-sand-900">
                        {r.achatsMontant > 0 ? formatCurrency(Math.round(r.achatsMontant)) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-sand-50/90 font-bold border-t border-sand-200 text-sand-900 text-xs sm:text-sm">
                <tr>
                  <td className="py-3 px-4">TOTAL GÉNÉRAL</td>
                  <td className="py-3 px-4"></td>
                  <td className="py-3 px-4"></td>
                  <td className="py-3 px-4 text-right text-cyan-800">
                    {formatCurrency(totauxGlobaux.totalConsommationsFCFA)}
                  </td>
                  <td className="py-3 px-4"></td>
                  <td className="py-3 px-4"></td>
                  <td className="py-3 px-4 text-right text-emerald-800 text-sm">
                    {formatCurrency(totauxGlobaux.totalAchatsFCFA)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
