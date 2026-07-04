import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import { usePosStore, type TicketPOS, type ModePaiement, type TypeCommande } from '../../store/posStore';
import { formatCurrency } from '../../utils/currency';
import { TableLoader } from '../../components/ui/Loader';
import logo from '../../assets/logo.png';

const modeLabel: Record<ModePaiement, string> = { espece: 'Espèces', om: 'Orange Money', wave: 'Wave' };
const modeIcon: Record<ModePaiement, string> = { espece: 'mdi:cash', om: 'mdi:cellphone', wave: 'mdi:cellphone-wireless' };
const typeLabel: Record<TypeCommande, string> = { sur_place: 'Sur place', emporter: 'À emporter', livraison: 'Livraison' };

// createdAt peut être un Timestamp Firestore, une Date ou une string
const toDate = (v: any): Date => (v && typeof v.toDate === 'function') ? v.toDate() : new Date(v);
const heureDe = (t: TicketPOS) => toDate(t.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

export const HistoriqueTickets: React.FC = () => {
  const { ticketsDuJour, chargerTicketsDuJour } = usePosStore();
  const [dateStr, setDateStr] = useState(() => new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let annule = false;
    setIsLoading(true);
    chargerTicketsDuJour(new Date(dateStr + 'T12:00:00')).finally(() => { if (!annule) setIsLoading(false); });
    return () => { annule = true; };
  }, [dateStr, chargerTicketsDuJour]);

  const tickets = useMemo(
    () => [...ticketsDuJour].sort((a, b) => (b.numero || 0) - (a.numero || 0)),
    [ticketsDuJour]
  );

  const caTotal = tickets.reduce((s, t) => s + (t.total || 0), 0);
  const nbArticles = tickets.reduce((s, t) => s + (t.nbArticles || 0), 0);
  const parMode = (m: ModePaiement) => tickets.filter(t => t.modePaiement === m).reduce((s, t) => s + (t.total || 0), 0);

  const reimprimer = (t: TicketPOS) => {
    const w = window.open('', '_blank', 'width=340,height=640');
    if (!w) return;
    const rows = t.lignes.map(l => `<tr><td>${l.nom}</td><td class="c">${l.quantite}</td><td class="r">${(l.prixUnitaire * l.quantite).toLocaleString('fr-FR')}</td></tr>`).join('');
    const remiseRows = (t.remise && t.remise > 0)
      ? `<div class="row"><span>Sous-total</span><span>${(t.sousTotal ?? t.total).toLocaleString('fr-FR')} F</span></div><div class="row"><span>Remise</span><span>- ${t.remise.toLocaleString('fr-FR')} F</span></div>`
      : '';
    const cashRows = t.modePaiement === 'espece' && t.montantRecu != null
      ? `<div class="row"><span>Reçu</span><span>${t.montantRecu.toLocaleString('fr-FR')} F</span></div><div class="row"><span>Rendu</span><span>${(t.rendu ?? 0).toLocaleString('fr-FR')} F</span></div>`
      : '';
    const logoUrl = new URL(logo, window.location.origin).href;
    const dt = toDate(t.createdAt);
    const jour = dt.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    const heure = dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Ticket n°${t.numero}</title><style>*{font-family:'Courier New',monospace;font-size:12px;color:#000}body{width:280px;margin:0 auto;padding:12px}.logo{display:block;margin:0 auto 6px;max-width:160px;max-height:64px;object-fit:contain}.sub{text-align:center;font-size:11px;margin:0 0 8px;color:#333}hr{border:none;border-top:1px dashed #999;margin:8px 0}table{width:100%;border-collapse:collapse}td{padding:2px 0}.c{text-align:center;width:32px}.r{text-align:right;width:80px}.row{display:flex;justify-content:space-between;margin:2px 0}.tot{display:flex;justify-content:space-between;font-size:15px;font-weight:bold;margin:6px 0}.foot{text-align:center;margin-top:12px;font-size:11px}</style></head><body onload="setTimeout(function(){window.focus();window.print();},300)"><img class="logo" src="${logoUrl}" alt="Chez Mina" onerror="this.style.display='none'"/><p class="sub">Ticket n°${t.numero} · ${jour} ${heure} · ${typeLabel[t.typeCommande]} (copie)</p><hr/><table><thead><tr><td>Article</td><td class="c">Qté</td><td class="r">FCFA</td></tr></thead><tbody>${rows}</tbody></table><hr/>${remiseRows}<div class="tot"><span>TOTAL</span><span>${t.total.toLocaleString('fr-FR')} F</span></div><div class="row"><span>Paiement</span><span>${modeLabel[t.modePaiement]}</span></div>${cashRows}<hr/><p class="foot">${t.nbArticles} article(s) · Merci de votre visite !</p></body></html>`);
    w.document.close(); w.focus();
  };

  const estAujourdhui = dateStr === new Date().toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-sand-100">
      {/* Header */}
      <div className="bg-white border-b border-sand-200 px-3 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <div className="w-10 h-10 bg-terracotta-50 rounded-xl flex items-center justify-center shrink-0">
              <Icon icon="mdi:receipt-text-clock-outline" className="text-lg sm:text-2xl text-terracotta-600" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-base sm:text-2xl font-semibold text-sand-900 truncate">
                Historique de caisse
              </h1>
              <p className="text-xs sm:text-sm text-sand-500 truncate">
                {tickets.length} ticket(s){estAujourdhui ? " · aujourd'hui" : ''} · CA {formatCurrency(caTotal)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="date"
              value={dateStr}
              max={new Date().toISOString().split('T')[0]}
              onChange={(e) => setDateStr(e.target.value)}
              className="flex-1 sm:flex-none px-3 py-2 border border-sand-300 rounded-lg bg-white text-sm text-sand-900 focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
            />
            <Link
              to="/caisse"
              className="flex items-center justify-center gap-2 px-4 py-2 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-lg transition-all shadow-soft text-sm font-medium whitespace-nowrap"
            >
              <Icon icon="mdi:cash-register" className="text-lg" />
              <span className="hidden sm:inline">Caisse</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Synthèse */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white rounded-2xl border border-sand-200 shadow-card p-4">
            <div className="text-xs text-sand-500 mb-1">Chiffre d'affaires</div>
            <div className="font-display text-xl sm:text-2xl font-semibold text-sand-900 tabular-nums">{formatCurrency(caTotal)}</div>
          </div>
          <div className="bg-white rounded-2xl border border-sand-200 shadow-card p-4">
            <div className="text-xs text-sand-500 mb-1">Tickets · articles</div>
            <div className="font-display text-xl sm:text-2xl font-semibold text-sand-900 tabular-nums">{tickets.length} · {nbArticles}</div>
          </div>
          <div className="bg-white rounded-2xl border border-sand-200 shadow-card p-4">
            <div className="text-xs text-sand-500 mb-1 flex items-center gap-1"><Icon icon="mdi:cash" className="text-success-600" /> Espèces</div>
            <div className="font-display text-lg sm:text-xl font-semibold text-sand-900 tabular-nums">{formatCurrency(parMode('espece'))}</div>
          </div>
          <div className="bg-white rounded-2xl border border-sand-200 shadow-card p-4">
            <div className="text-xs text-sand-500 mb-1 flex items-center gap-1"><Icon icon="mdi:cellphone" className="text-gold-600" /> OM · Wave</div>
            <div className="font-display text-lg sm:text-xl font-semibold text-sand-900 tabular-nums">{formatCurrency(parMode('om') + parMode('wave'))}</div>
          </div>
        </div>

        {/* Liste des tickets */}
        {isLoading ? (
          <div className="bg-white rounded-2xl border border-sand-200 shadow-card">
            <TableLoader message="Chargement des tickets..." />
          </div>
        ) : tickets.length === 0 ? (
          <div className="bg-white rounded-2xl border border-sand-200 shadow-card text-center py-16">
            <div className="w-20 h-20 bg-sand-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Icon icon="mdi:receipt-text-outline" className="text-4xl text-sand-400" />
            </div>
            <h3 className="font-display text-xl font-semibold text-sand-900 mb-2">Aucun ticket ce jour</h3>
            <p className="text-sand-500 max-w-md mx-auto px-4">
              Les encaissements réalisés en caisse apparaîtront ici.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-sand-200 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[680px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-sand-500 border-b border-sand-200 bg-sand-50">
                    <th className="font-semibold px-4 py-3">Ticket</th>
                    <th className="font-semibold px-4 py-3">Heure</th>
                    <th className="font-semibold px-4 py-3">Type</th>
                    <th className="font-semibold px-4 py-3">Paiement</th>
                    <th className="font-semibold px-4 py-3 text-right">Articles</th>
                    <th className="font-semibold px-4 py-3 text-right">Total</th>
                    <th className="font-semibold px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {tickets.map((t) => (
                    <tr key={t.id || t.numero} className="border-b border-sand-100 last:border-0 hover:bg-sand-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-semibold text-sand-900">n°{t.numero}</span>
                        {(t.remise ?? 0) > 0 && (
                          <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gold-50 text-gold-700 ring-1 ring-inset ring-gold-100">
                            <Icon icon="mdi:ticket-percent-outline" className="text-xs" /> remise
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sand-600">{heureDe(t)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-sand-100 text-sand-600 ring-1 ring-inset ring-sand-200">
                          {typeLabel[t.typeCommande]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-sand-700">
                          <Icon icon={modeIcon[t.modePaiement]} className="text-base text-sand-500" />
                          {modeLabel[t.modePaiement]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-sand-700">{t.nbArticles}</td>
                      <td className="px-4 py-3 text-right font-semibold text-sand-900">{formatCurrency(t.total)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end">
                          <button
                            onClick={() => reimprimer(t)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sand-600 hover:bg-sand-100 hover:text-sand-900 transition-colors text-xs font-medium"
                            title="Réimprimer le ticket"
                          >
                            <Icon icon="mdi:printer-outline" className="text-base" />
                            <span className="hidden sm:inline">Réimprimer</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
