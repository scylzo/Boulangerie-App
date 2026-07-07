import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router-dom';
import { useFacturationStore } from '../../store/facturationStore';
import { useReferentielStore } from '../../store/referentielStore';
import { formatCurrency } from '../../utils/currency';
import { TableLoader } from '../../components/ui/Loader';
import type { Facture } from '../../types';

const MS_JOUR = 1000 * 60 * 60 * 24;

// Date de référence pour le retard : échéance si dispo, sinon date de livraison
const dateRef = (f: Facture): Date => (f.echeance ? new Date(f.echeance) : new Date(f.dateLivraison));
const duDe = (f: Facture): number => (f.netAPayer ?? (f.totalTTC - (f.montantRegle || 0)));
const retardJours = (f: Facture): number => {
  const diff = Math.floor((Date.now() - dateRef(f).getTime()) / MS_JOUR);
  return diff > 0 ? diff : 0;
};

interface LigneDebiteur {
  clientId: string;
  nom: string;
  telephone?: string;
  totalDu: number;
  nbFactures: number;
  retardMax: number;
  plusVieille: Date;
}

export const GestionCreances: React.FC = () => {
  const navigate = useNavigate();
  const { getCreances } = useFacturationStore();
  const { clients, chargerClients } = useReferentielStore();

  const [creances, setCreances] = useState<Facture[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (clients.length === 0) chargerClients();
    getCreances().then(setCreances).catch(() => setCreances([])).finally(() => setIsLoading(false));
  }, [getCreances, chargerClients, clients.length]);

  const clientNom = (id: string) => {
    const c = clients.find(cl => cl.id === id);
    return c ? [c.prenom, c.nom].filter(Boolean).join(' ') : 'Client inconnu';
  };
  const clientTel = (id: string) => clients.find(cl => cl.id === id)?.telephone;

  // Synthèse globale + aging
  const synthese = useMemo(() => {
    const buckets = { aVenir: 0, b1_30: 0, b31_60: 0, b60: 0 };
    let total = 0;
    creances.forEach(f => {
      const du = duDe(f);
      total += du;
      const r = retardJours(f);
      if (r === 0) buckets.aVenir += du;
      else if (r <= 30) buckets.b1_30 += du;
      else if (r <= 60) buckets.b31_60 += du;
      else buckets.b60 += du;
    });
    const enRetard = buckets.b1_30 + buckets.b31_60 + buckets.b60;
    return { total, buckets, enRetard };
  }, [creances]);

  // Débiteurs (par client)
  const debiteurs = useMemo<LigneDebiteur[]>(() => {
    const map: Record<string, LigneDebiteur> = {};
    creances.forEach(f => {
      if (!map[f.clientId]) {
        map[f.clientId] = {
          clientId: f.clientId,
          nom: clientNom(f.clientId),
          telephone: clientTel(f.clientId),
          totalDu: 0,
          nbFactures: 0,
          retardMax: 0,
          plusVieille: dateRef(f),
        };
      }
      const d = map[f.clientId];
      d.totalDu += duDe(f);
      d.nbFactures += 1;
      d.retardMax = Math.max(d.retardMax, retardJours(f));
      if (dateRef(f) < d.plusVieille) d.plusVieille = dateRef(f);
    });
    return Object.values(map).sort((a, b) => b.totalDu - a.totalDu);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creances, clients]);

  const nbEnRetard = debiteurs.filter(d => d.retardMax > 0).length;

  const relancerWhatsApp = (d: LigneDebiteur) => {
    let msg = `*Chez Mina — Rappel de paiement*\n\n`;
    msg += `Bonjour ${d.nom},\n`;
    msg += `Nous vous rappelons qu'il reste *${formatCurrency(d.totalDu)}* à régler`;
    msg += d.nbFactures > 1 ? ` (${d.nbFactures} factures)` : '';
    if (d.retardMax > 0) msg += `, dont une échéance dépassée de ${d.retardMax} jour(s)`;
    msg += `.\nMerci de votre règlement. 🙏`;
    const tel = (d.telephone || '').replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const badge = (retard: number) => {
    if (retard === 0) return { label: 'À échéance', cls: 'bg-sand-100 text-sand-600 ring-sand-200' };
    if (retard <= 30) return { label: `Retard ${retard} j`, cls: 'bg-warning-50 text-warning-700 ring-warning-100' };
    return { label: `Retard ${retard} j`, cls: 'bg-danger-50 text-danger-700 ring-danger-100' };
  };

  return (
    <div className="min-h-screen bg-sand-100">
      {/* Header */}
      <div className="bg-white border-b border-sand-200 px-3 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => navigate('/comptabilite')}
            title="Retour Comptabilité"
            className="w-9 h-9 rounded-lg text-sand-500 hover:bg-sand-100 hover:text-sand-900 flex items-center justify-center shrink-0"
          >
            <Icon icon="mdi:arrow-left" className="text-xl" />
          </button>
          <div className="w-10 h-10 bg-terracotta-50 rounded-xl flex items-center justify-center shrink-0">
            <Icon icon="mdi:cash-clock" className="text-lg sm:text-2xl text-terracotta-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-base sm:text-2xl font-semibold text-sand-900 truncate">Créances clients</h1>
            <p className="text-xs sm:text-sm text-sand-500 truncate">
              {debiteurs.length} client(s) débiteur(s) · {creances.length} facture(s) impayée(s)
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
        {isLoading ? (
          <div className="bg-white rounded-2xl border border-sand-200 shadow-card"><TableLoader message="Chargement des créances..." /></div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white rounded-2xl border border-sand-200 shadow-card p-4">
                <div className="text-xs text-sand-500 mb-1">Total à encaisser</div>
                <div className="font-display text-xl sm:text-2xl font-semibold text-sand-900 tabular-nums">{formatCurrency(synthese.total)}</div>
              </div>
              <div className="bg-white rounded-2xl border border-sand-200 shadow-card p-4">
                <div className="text-xs text-sand-500 mb-1">Dont en retard</div>
                <div className="font-display text-xl sm:text-2xl font-semibold text-danger-600 tabular-nums">{formatCurrency(synthese.enRetard)}</div>
              </div>
              <div className="bg-white rounded-2xl border border-sand-200 shadow-card p-4">
                <div className="text-xs text-sand-500 mb-1">Clients débiteurs</div>
                <div className="font-display text-xl sm:text-2xl font-semibold text-sand-900 tabular-nums">{debiteurs.length}</div>
              </div>
              <div className="bg-white rounded-2xl border border-sand-200 shadow-card p-4">
                <div className="text-xs text-sand-500 mb-1">Dont en retard</div>
                <div className="font-display text-xl sm:text-2xl font-semibold text-warning-600 tabular-nums">{nbEnRetard}</div>
              </div>
            </div>

            {/* Aging */}
            <div className="bg-white rounded-2xl border border-sand-200 shadow-card overflow-hidden">
              <div className="px-5 py-3 border-b border-sand-200 bg-sand-50 flex items-center gap-2">
                <Icon icon="mdi:timer-sand" className="text-lg text-terracotta-600" />
                <h2 className="font-display text-base font-semibold text-sand-900">Ancienneté des créances</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-sand-200 tabular-nums">
                {[
                  { l: 'À échéance', v: synthese.buckets.aVenir, c: 'text-sand-900' },
                  { l: 'Retard 1-30 j', v: synthese.buckets.b1_30, c: 'text-warning-600' },
                  { l: 'Retard 31-60 j', v: synthese.buckets.b31_60, c: 'text-warning-700' },
                  { l: 'Retard +60 j', v: synthese.buckets.b60, c: 'text-danger-600' },
                ].map((b, i) => (
                  <div key={i} className="px-4 py-4">
                    <div className="text-[11px] text-sand-500 uppercase tracking-wide">{b.l}</div>
                    <div className={`font-display text-lg font-semibold ${b.c}`}>{formatCurrency(b.v)}</div>
                    <div className="text-[11px] text-sand-400">{synthese.total > 0 ? Math.round((b.v / synthese.total) * 100) : 0}%</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Débiteurs */}
            {debiteurs.length === 0 ? (
              <div className="bg-white rounded-2xl border border-sand-200 shadow-card text-center py-16">
                <div className="w-20 h-20 bg-success-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icon icon="mdi:check-circle-outline" className="text-4xl text-success-500" />
                </div>
                <h3 className="font-display text-xl font-semibold text-sand-900 mb-2">Aucune créance en cours</h3>
                <p className="text-sand-500">Toutes les factures sont réglées. 🎉</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-sand-200 shadow-card overflow-hidden">
                <div className="px-5 py-3 border-b border-sand-200 bg-sand-50 flex items-center gap-2">
                  <Icon icon="mdi:account-cash-outline" className="text-lg text-terracotta-600" />
                  <h2 className="font-display text-base font-semibold text-sand-900">Débiteurs</h2>
                  <span className="ml-auto text-xs text-sand-400">triés par montant dû</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wide text-sand-500 border-b border-sand-200">
                        <th className="font-semibold px-5 py-3">Client</th>
                        <th className="font-semibold px-3 py-3 text-right">Reste dû</th>
                        <th className="font-semibold px-3 py-3 text-center">Factures</th>
                        <th className="font-semibold px-3 py-3">Ancienneté</th>
                        <th className="font-semibold px-5 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="tabular-nums">
                      {debiteurs.map((d) => {
                        const b = badge(d.retardMax);
                        return (
                          <tr key={d.clientId} className="border-b border-sand-100 last:border-0 hover:bg-sand-50 transition-colors">
                            <td className="px-5 py-3">
                              <div className="font-medium text-sand-900">{d.nom}</div>
                              <div className="text-[11px] text-sand-400">plus vieille : {d.plusVieille.toLocaleDateString('fr-FR')}</div>
                            </td>
                            <td className="px-3 py-3 text-right font-semibold text-sand-900">{formatCurrency(d.totalDu)}</td>
                            <td className="px-3 py-3 text-center text-sand-600">{d.nbFactures}</td>
                            <td className="px-3 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ring-1 ring-inset ${b.cls}`}>{b.label}</span>
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => relancerWhatsApp(d)}
                                  disabled={!d.telephone}
                                  title={d.telephone ? 'Relancer par WhatsApp' : 'Aucun téléphone'}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-success-700 hover:bg-success-50 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  <Icon icon="mdi:whatsapp" className="text-base" />
                                  <span className="hidden sm:inline">Relancer</span>
                                </button>
                                <button
                                  onClick={() => navigate('/facturation')}
                                  title="Voir les factures"
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sand-600 hover:bg-sand-100 text-xs font-medium"
                                >
                                  <Icon icon="mdi:file-document-outline" className="text-base" />
                                  <span className="hidden sm:inline">Factures</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
