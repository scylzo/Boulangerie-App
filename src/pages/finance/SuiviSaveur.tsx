import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import { useReferentielStore } from '../../store/referentielStore';
import { usePosStore } from '../../store/posStore';
import { useBoutiqueStore } from '../../store/boutiqueStore';
import { useSaveurStore, type Saveur } from '../../store/saveurStore';
import { formatCurrency } from '../../utils/currency';
import { ConfirmModal } from '../../components/ui/ConfirmModal';

const SAVEURS: { key: Saveur; label: string; icon: string }[] = [
  { key: 'sale', label: 'Salé', icon: 'mdi:cheese' },
  { key: 'sucre', label: 'Sucré', icon: 'mdi:cupcake' },
];

export const SuiviSaveur: React.FC = () => {
  const { produits, chargerProduits } = useReferentielStore();
  const { getVentesParProduitPeriode, getPremiereDateVente } = usePosStore();
  const { getVentesBoutiqueParProduit, getPremiereDateVenteBoutique } = useBoutiqueStore();
  const { achats, chargerAchats, ajouterAchat, supprimerAchat } = useSaveurStore();

  const [periode, setPeriode] = useState(() => {
    const now = new Date();
    return {
      debut: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
      fin: now.toISOString().split('T')[0],
    };
  });
  const [source, setSource] = useState<'caisse' | 'boutique' | 'les_deux'>('les_deux');
  const [ventesProduit, setVentesProduit] = useState<Record<string, { qty: number; valeur: number }>>({});
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState<{ montant: string; saveur: Saveur; date: string; note: string }>(() => ({
    montant: '', saveur: 'sale', date: new Date().toISOString().split('T')[0], note: '',
  }));
  const [saving, setSaving] = useState(false);
  const [achatASupprimer, setAchatASupprimer] = useState<string | null>(null);

  useEffect(() => { if (produits.length === 0) chargerProduits(); }, [produits.length, chargerProduits]);

  // Vraie première date de vente enregistrée (ticket caisse + vente boutique les plus anciens)
  const [debutPremiereVente, setDebutPremiereVente] = useState<string | null>(null);
  useEffect(() => {
    let annule = false;
    (async () => {
      const [dPos, dBout] = await Promise.all([getPremiereDateVente(), getPremiereDateVenteBoutique()]);
      const candidats = [dPos, dBout].filter((d): d is string => !!d).sort();
      if (!annule) setDebutPremiereVente(candidats[0] || null);
    })();
    return () => { annule = true; };
  }, [getPremiereDateVente, getPremiereDateVenteBoutique]);

  // Repli : création du plus ancien produit tagué salé/sucré (si aucune vente lue)
  const debutPremierProduit = useMemo(() => {
    // createdAt peut être une Date, un Timestamp Firestore ({toDate/seconds}) ou une chaîne
    const toDate = (v: any): Date | null => {
      if (!v) return null;
      if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
      if (typeof v.toDate === 'function') return v.toDate();
      if (typeof v.seconds === 'number') return new Date(v.seconds * 1000);
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    };
    const dates = produits
      .filter(p => p.saveur === 'sale' || p.saveur === 'sucre')
      .map(p => toDate(p.createdAt))
      .filter((d): d is Date => d !== null);
    if (dates.length === 0) return null;
    return new Date(Math.min(...dates.map(d => d.getTime()))).toISOString().split('T')[0];
  }, [produits]);

  // Date de départ « Depuis le début » : 1re vente réelle, sinon création du 1er produit tagué
  const debutDepuisLeDebut = debutPremiereVente || debutPremierProduit;

  const debutPreset = (k: 'mois' | '3mois' | 'debut'): string => {
    const now = new Date();
    if (k === 'mois') return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    if (k === '3mois') return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).toISOString().split('T')[0];
    return debutDepuisLeDebut || now.toISOString().split('T')[0];
  };

  const appliquerPreset = (k: 'mois' | '3mois' | 'debut') => {
    setPeriode({ debut: debutPreset(k), fin: new Date().toISOString().split('T')[0] });
  };

  const presetActif = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    if (periode.fin !== today) return null;
    for (const k of ['mois', '3mois', 'debut'] as const) {
      if (periode.debut === debutPreset(k)) return k;
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periode, debutDepuisLeDebut]);

  useEffect(() => {
    let annule = false;
    setLoading(true);
    const debut = new Date(periode.debut + 'T00:00:00');
    const fin = new Date(periode.fin + 'T23:59:59');
    (async () => {
      const vide: Record<string, { qty: number; valeur: number }> = {};
      const [pos, bout] = await Promise.all([
        source !== 'boutique' ? getVentesParProduitPeriode(debut, fin) : Promise.resolve(vide),
        source !== 'caisse' ? getVentesBoutiqueParProduit(debut, fin) : Promise.resolve(vide),
      ]);
      const combined: Record<string, { qty: number; valeur: number }> = {};
      [pos, bout].forEach(src => {
        Object.entries(src).forEach(([id, v]) => {
          if (!combined[id]) combined[id] = { qty: 0, valeur: 0 };
          combined[id].qty += v.qty;
          combined[id].valeur += v.valeur;
        });
      });
      await chargerAchats(debut, fin);
      if (!annule) { setVentesProduit(combined); setLoading(false); }
    })();
    return () => { annule = true; };
  }, [periode.debut, periode.fin, source, getVentesParProduitPeriode, getVentesBoutiqueParProduit, chargerAchats]);

  const saveurDe = (id: string): Saveur | undefined => produits.find(p => p.id === id)?.saveur as Saveur | undefined;

  // Agrégat ventes par saveur
  const ventesParSaveur = useMemo(() => {
    const agg: Record<Saveur, { qty: number; valeur: number }> = { sale: { qty: 0, valeur: 0 }, sucre: { qty: 0, valeur: 0 } };
    Object.entries(ventesProduit).forEach(([id, v]) => {
      const s = saveurDe(id);
      if (s === 'sale' || s === 'sucre') { agg[s].qty += v.qty; agg[s].valeur += v.valeur; }
    });
    return agg;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ventesProduit, produits]);

  // Coût d'investissement par saveur (journal d'achats)
  const coutParSaveur = useMemo(() => {
    const agg: Record<Saveur, number> = { sale: 0, sucre: 0 };
    achats.forEach(a => { agg[a.saveur] = (agg[a.saveur] || 0) + a.montant; });
    return agg;
  }, [achats]);

  const produitsDe = (s: Saveur) => produits
    .filter(p => p.saveur === s && ventesProduit[p.id] && ventesProduit[p.id].qty !== 0)
    .map(p => ({ nom: p.nom, ...ventesProduit[p.id] }))
    .sort((a, b) => b.valeur - a.valeur);

  const ajouter = async () => {
    const montant = parseFloat(form.montant.replace(',', '.')) || 0;
    if (montant <= 0) { toast.error('Montant invalide'); return; }
    setSaving(true);
    try {
      await ajouterAchat({ date: form.date, montant, saveur: form.saveur, note: form.note.trim() || undefined });
      toast.success('Achat enregistré');
      setForm(f => ({ ...f, montant: '', note: '' }));
    } catch { toast.error("Erreur lors de l'enregistrement"); }
    finally { setSaving(false); }
  };

  const confirmerSuppression = async () => {
    if (!achatASupprimer) return;
    try { await supprimerAchat(achatASupprimer); toast.success('Achat supprimé'); }
    catch { toast.error('Erreur'); }
    finally { setAchatASupprimer(null); }
  };

  return (
    <div className="min-h-screen bg-sand-100">
      {/* Header */}
      <div className="bg-white border-b border-sand-200 px-3 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="w-10 h-10 bg-terracotta-50 rounded-xl flex items-center justify-center shrink-0">
              <Icon icon="mdi:scale-balance" className="text-lg sm:text-2xl text-terracotta-600" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-base sm:text-2xl font-semibold text-sand-900 truncate">Suivi Salé / Sucré</h1>
              <p className="text-xs sm:text-sm text-sand-500 truncate">Ventes vs coût d'investissement</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <div className="flex items-center gap-2">
              <input type="date" value={periode.debut} max={periode.fin}
                onChange={(e) => setPeriode(p => ({ ...p, debut: e.target.value }))}
                className="px-2.5 py-2 border border-sand-300 rounded-lg bg-white text-sm text-sand-900 focus:ring-2 focus:ring-terracotta-500 focus:border-transparent" />
              <span className="text-sand-400 text-sm">→</span>
              <input type="date" value={periode.fin} min={periode.debut}
                onChange={(e) => setPeriode(p => ({ ...p, fin: e.target.value }))}
                className="px-2.5 py-2 border border-sand-300 rounded-lg bg-white text-sm text-sand-900 focus:ring-2 focus:ring-terracotta-500 focus:border-transparent" />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {([
                { k: 'mois', l: 'Ce mois' },
                { k: '3mois', l: '3 mois' },
                { k: 'debut', l: 'Depuis le début' },
              ] as { k: 'mois' | '3mois' | 'debut'; l: string }[]).map(p => (
                <button key={p.k} onClick={() => appliquerPreset(p.k)}
                  disabled={p.k === 'debut' && !debutDepuisLeDebut}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${presetActif === p.k ? 'bg-terracotta-600 border-terracotta-600 text-white' : 'bg-white border-sand-200 text-sand-600 hover:bg-sand-50'}`}>
                  {p.l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Source des ventes */}
        <div className="bg-white rounded-2xl border border-sand-200 shadow-card p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <span className="text-sm font-medium text-sand-700 shrink-0">Source des ventes :</span>
          <div className="inline-flex items-center p-1 rounded-xl bg-sand-100 border border-sand-200 self-start">
            {([
              { v: 'caisse', l: 'Caisse' },
              { v: 'boutique', l: 'Boutique' },
              { v: 'les_deux', l: 'Les deux' },
            ] as { v: typeof source; l: string }[]).map(o => (
              <button key={o.v} onClick={() => setSource(o.v)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${source === o.v ? 'bg-white text-sand-900 shadow-sm' : 'text-sand-500 hover:text-sand-700'}`}>
                {o.l}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-sand-400 sm:ml-2">
            En mode Boutique « Avancé » (boutique = caisse), choisis <b>Caisse</b> ou <b>Boutique</b> seul pour éviter le double comptage.
          </p>
        </div>

        {/* Blocs Salé / Sucré */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {SAVEURS.map(s => {
            const ventes = ventesParSaveur[s.key];
            const cout = coutParSaveur[s.key];
            const marge = ventes.valeur - cout;
            const roi = cout > 0 ? (marge / cout) * 100 : null;
            const items = produitsDe(s.key);
            return (
              <div key={s.key} className="bg-white rounded-2xl border border-sand-200 shadow-card overflow-hidden">
                <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-sand-200 bg-sand-50">
                  <Icon icon={s.icon} className="text-xl text-terracotta-600" />
                  <h2 className="font-display text-base font-semibold text-sand-900">Produits {s.label}s</h2>
                  <span className="ml-auto text-xs text-sand-500 tabular-nums">{ventes.qty} vendu(s)</span>
                </div>

                <div className="grid grid-cols-3 divide-x divide-sand-200 border-b border-sand-200 tabular-nums">
                  <div className="px-4 py-3">
                    <div className="text-[11px] text-sand-500">Ventes</div>
                    <div className="font-display text-base sm:text-lg font-semibold text-success-600">{formatCurrency(ventes.valeur)}</div>
                  </div>
                  <div className="px-4 py-3">
                    <div className="text-[11px] text-sand-500">Coût d'achat</div>
                    <div className="font-display text-base sm:text-lg font-semibold text-danger-600">{formatCurrency(cout)}</div>
                  </div>
                  <div className="px-4 py-3">
                    <div className="text-[11px] text-sand-500">Marge {roi !== null && <span className="text-sand-400">({roi >= 0 ? '+' : ''}{roi.toFixed(0)}%)</span>}</div>
                    <div className={`font-display text-base sm:text-lg font-semibold ${marge >= 0 ? 'text-sand-900' : 'text-danger-600'}`}>{marge >= 0 ? '+' : ''}{formatCurrency(marge)}</div>
                  </div>
                </div>

                {/* Détail produits */}
                {loading ? (
                  <div className="px-5 py-6 text-center text-sm text-sand-400">Calcul…</div>
                ) : items.length === 0 ? (
                  <div className="px-5 py-6 text-center text-sm text-sand-400">Aucune vente sur la période.</div>
                ) : (
                  <div className="divide-y divide-sand-100">
                    {items.map((it, i) => (
                      <div key={i} className="flex items-center gap-3 px-5 py-2.5">
                        <span className="min-w-0 flex-1 text-sm text-sand-800 truncate uppercase">{it.nom}</span>
                        <span className="text-xs text-sand-500 tabular-nums shrink-0">{it.qty} u.</span>
                        <span className="text-sm font-medium text-sand-900 tabular-nums shrink-0 w-24 text-right">{formatCurrency(it.valeur)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Journal des achats (coût d'investissement) */}
        <div className="bg-white rounded-2xl border border-sand-200 shadow-card overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-sand-200 bg-sand-50">
            <Icon icon="mdi:receipt-text-outline" className="text-lg text-terracotta-600" />
            <h2 className="font-display text-base font-semibold text-sand-900">Coût d'achat (tickets de courses)</h2>
          </div>

          {/* Formulaire d'ajout */}
          <div className="p-4 border-b border-sand-100 flex flex-wrap sm:flex-nowrap items-end gap-2 sm:gap-3">
            <div className="w-[calc(50%-0.25rem)] sm:w-36">
              <label className="block text-[11px] font-medium text-sand-500 mb-1">Date</label>
              <input type="date" value={form.date} max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full px-2.5 py-2 border border-sand-300 rounded-lg text-sm focus:ring-2 focus:ring-terracotta-500 focus:border-transparent" />
            </div>
            <div className="w-[calc(50%-0.25rem)] sm:w-28">
              <label className="block text-[11px] font-medium text-sand-500 mb-1">Catégorie</label>
              <select value={form.saveur} onChange={(e) => setForm(f => ({ ...f, saveur: e.target.value as Saveur }))}
                className="w-full px-2.5 py-2 border border-sand-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-terracotta-500 focus:border-transparent">
                <option value="sale">Salé</option>
                <option value="sucre">Sucré</option>
              </select>
            </div>
            <div className="w-[calc(50%-0.25rem)] sm:w-28">
              <label className="block text-[11px] font-medium text-sand-500 mb-1">Montant (F)</label>
              <input type="number" min="0" value={form.montant} placeholder="0"
                onChange={(e) => setForm(f => ({ ...f, montant: e.target.value }))}
                className="w-full px-2.5 py-2 border border-sand-300 rounded-lg text-sm text-right tabular-nums focus:ring-2 focus:ring-terracotta-500 focus:border-transparent" />
            </div>
            <div className="flex-1 min-w-[8rem]">
              <label className="block text-[11px] font-medium text-sand-500 mb-1">Note</label>
              <input type="text" value={form.note} placeholder="Note (facultatif)"
                onChange={(e) => setForm(f => ({ ...f, note: e.target.value }))}
                className="w-full px-2.5 py-2 border border-sand-300 rounded-lg text-sm focus:ring-2 focus:ring-terracotta-500 focus:border-transparent" />
            </div>
            <button onClick={ajouter} disabled={saving}
              className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-lg bg-terracotta-600 hover:bg-terracotta-700 text-white shadow-sm disabled:opacity-50" title="Ajouter">
              <Icon icon={saving ? 'mdi:loading' : 'mdi:plus'} className={`text-lg ${saving ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Liste des achats */}
          {achats.length === 0 ? (
            <div className="px-5 py-6 text-center text-sm text-sand-400">Aucun achat saisi sur la période.</div>
          ) : (
            <div className="divide-y divide-sand-100">
              {achats.map(a => (
                <div key={a.id} className="flex items-center gap-3 px-5 py-2.5">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium shrink-0 ${a.saveur === 'sale' ? 'bg-warning-50 text-warning-700 ring-1 ring-inset ring-warning-100' : 'bg-info-50 text-info-600 ring-1 ring-inset ring-info-100'}`}>
                    <Icon icon={a.saveur === 'sale' ? 'mdi:cheese' : 'mdi:cupcake'} className="text-sm" />
                    {a.saveur === 'sale' ? 'Salé' : 'Sucré'}
                  </span>
                  <span className="text-xs text-sand-500 shrink-0 tabular-nums">{new Date(a.date + 'T12:00:00').toLocaleDateString('fr-FR')}</span>
                  <span className="min-w-0 flex-1 text-sm text-sand-600 truncate">{a.note || '—'}</span>
                  <span className="text-sm font-semibold text-sand-900 tabular-nums shrink-0">{formatCurrency(a.montant)}</span>
                  <button onClick={() => setAchatASupprimer(a.id!)} className="shrink-0 text-sand-400 hover:text-danger-600" title="Supprimer">
                    <Icon icon="mdi:trash-can-outline" className="text-base" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={!!achatASupprimer}
        onClose={() => setAchatASupprimer(null)}
        onConfirm={confirmerSuppression}
        title="Supprimer cet achat ?"
        message="Cette ligne de coût sera définitivement supprimée."
        confirmText="Supprimer"
        cancelText="Annuler"
        type="danger"
        position="center"
      />
    </div>
  );
};
