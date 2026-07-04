import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { usePosStore, type TicketPOS, type ModePaiement, type TypeCommande } from '../../store/posStore';
import { formatCurrency } from '../../utils/currency';
import { TableLoader } from '../../components/ui/Loader';
import { Modal } from '../../components/ui/Modal';
import logo from '../../assets/logo.png';

const modeLabel: Record<ModePaiement, string> = { espece: 'Espèces', om: 'Orange Money', wave: 'Wave' };
const modeIcon: Record<ModePaiement, string> = { espece: 'mdi:cash', om: 'mdi:cellphone', wave: 'mdi:cellphone-wireless' };
const typeLabel: Record<TypeCommande, string> = { sur_place: 'Sur place', emporter: 'À emporter', livraison: 'Livraison' };

// createdAt peut être un Timestamp Firestore, une Date ou une string
const toDate = (v: any): Date => (v && typeof v.toDate === 'function') ? v.toDate() : new Date(v);
const heureDe = (t: TicketPOS) => toDate(t.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

export const HistoriqueTickets: React.FC = () => {
  const { ticketsDuJour, chargerTicketsDuJour, enregistrerTicket, getRetoursDeTicket, isSaving } = usePosStore();
  const [dateStr, setDateStr] = useState(() => new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(false);

  // Retour produit (avoir)
  const [retourTicket, setRetourTicket] = useState<TicketPOS | null>(null);
  const [retourQtes, setRetourQtes] = useState<Record<string, number>>({});
  const [dejaRetourne, setDejaRetourne] = useState<Record<string, number>>({});
  const [retourMode, setRetourMode] = useState<ModePaiement>('espece');
  const [motif, setMotif] = useState('');

  const rechargerJour = () => {
    setIsLoading(true);
    return chargerTicketsDuJour(new Date(dateStr + 'T12:00:00')).finally(() => setIsLoading(false));
  };

  useEffect(() => {
    let annule = false;
    setIsLoading(true);
    chargerTicketsDuJour(new Date(dateStr + 'T12:00:00')).finally(() => { if (!annule) setIsLoading(false); });
    return () => { annule = true; };
  }, [dateStr, chargerTicketsDuJour]);

  const ouvrirRetour = async (t: TicketPOS) => {
    setRetourTicket(t);
    setRetourMode(t.modePaiement);
    setMotif('');
    setRetourQtes(Object.fromEntries(t.lignes.map(l => [l.produitId, 0])));
    // Quantités déjà retournées pour ce ticket
    const retours = t.id ? await getRetoursDeTicket(t.id) : [];
    const cumul: Record<string, number> = {};
    retours.forEach(r => r.lignes.forEach(l => { cumul[l.produitId] = (cumul[l.produitId] || 0) + Math.abs(l.quantite); }));
    setDejaRetourne(cumul);
  };

  const fermerRetour = () => { setRetourTicket(null); setRetourQtes({}); setDejaRetourne({}); setMotif(''); };

  const maxRetour = (l: TicketPOS['lignes'][number]) => Math.max(0, l.quantite - (dejaRetourne[l.produitId] || 0));
  const setQteRetour = (produitId: string, val: number, max: number) =>
    setRetourQtes(q => ({ ...q, [produitId]: Math.min(Math.max(0, val), max) }));

  const lignesRetour = useMemo(() => {
    if (!retourTicket) return [];
    return retourTicket.lignes
      .map(l => ({ ...l, qteRetour: retourQtes[l.produitId] || 0 }))
      .filter(l => l.qteRetour > 0);
  }, [retourTicket, retourQtes]);

  const totalRetour = lignesRetour.reduce((s, l) => s + l.prixUnitaire * l.qteRetour, 0);
  const nbArticlesRetour = lignesRetour.reduce((s, l) => s + l.qteRetour, 0);

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

  const imprimerRetour = (r: TicketPOS) => {
    const w = window.open('', '_blank', 'width=340,height=640');
    if (!w) return;
    const rows = r.lignes.map(l => `<tr><td>${l.nom}</td><td class="c">${Math.abs(l.quantite)}</td><td class="r">${(l.prixUnitaire * Math.abs(l.quantite)).toLocaleString('fr-FR')}</td></tr>`).join('');
    const montant = Math.abs(r.total);
    const logoUrl = new URL(logo, window.location.origin).href;
    const dt = toDate(r.createdAt);
    const jour = dt.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    const heure = dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const motifRow = r.motifRetour ? `<div class="row"><span>Motif</span><span>${r.motifRetour}</span></div>` : '';
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Retour n°${r.numero}</title><style>*{font-family:'Courier New',monospace;font-size:12px;color:#000}body{width:280px;margin:0 auto;padding:12px}.logo{display:block;margin:0 auto 6px;max-width:160px;max-height:64px;object-fit:contain}.title{text-align:center;font-size:13px;font-weight:bold;margin:0 0 2px}.sub{text-align:center;font-size:11px;margin:0 0 8px;color:#333}hr{border:none;border-top:1px dashed #999;margin:8px 0}table{width:100%;border-collapse:collapse}td{padding:2px 0}.c{text-align:center;width:32px}.r{text-align:right;width:80px}.row{display:flex;justify-content:space-between;margin:2px 0}.tot{display:flex;justify-content:space-between;font-size:15px;font-weight:bold;margin:6px 0}.foot{text-align:center;margin-top:12px;font-size:11px}</style></head><body onload="setTimeout(function(){window.focus();window.print();},300)"><img class="logo" src="${logoUrl}" alt="Chez Mina" onerror="this.style.display='none'"/><p class="title">TICKET DE RETOUR</p><p class="sub">Retour n°${r.numero} · ${jour} ${heure}<br/>Réf. ticket vente n°${r.ticketOrigineNumero ?? '—'}</p><hr/><table><thead><tr><td>Article</td><td class="c">Qté</td><td class="r">FCFA</td></tr></thead><tbody>${rows}</tbody></table><hr/><div class="tot"><span>REMBOURSÉ</span><span>${montant.toLocaleString('fr-FR')} F</span></div><div class="row"><span>Mode</span><span>${modeLabel[r.modePaiement]}</span></div>${motifRow}<hr/><p class="foot">${Math.abs(r.nbArticles)} article(s) retourné(s)</p></body></html>`);
    w.document.close(); w.focus();
  };

  const validerRetour = async () => {
    if (!retourTicket) return;
    if (nbArticlesRetour <= 0) { toast.error('Sélectionnez au moins un article à retourner'); return; }
    try {
      const payload = {
        date: new Date().toISOString().split('T')[0],
        type: 'retour' as const,
        ...(retourTicket.id ? { ticketOrigineId: retourTicket.id } : {}),
        ticketOrigineNumero: retourTicket.numero,
        lignes: lignesRetour.map(l => ({ produitId: l.produitId, nom: l.nom, prixUnitaire: l.prixUnitaire, quantite: -l.qteRetour })),
        sousTotal: -totalRetour,
        total: -totalRetour,
        nbArticles: -nbArticlesRetour,
        modePaiement: retourMode,
        typeCommande: retourTicket.typeCommande,
        ...(motif.trim() ? { motifRetour: motif.trim() } : {}),
      };
      const numero = await enregistrerTicket(payload);
      imprimerRetour({ ...payload, numero, createdAt: new Date() } as TicketPOS);
      toast.success(`Retour n°${numero} · ${formatCurrency(totalRetour)} remboursé`);
      fermerRetour();
      rechargerJour();
    } catch {
      toast.error("Erreur lors de l'enregistrement du retour");
    }
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
                  {tickets.map((t) => {
                    const estRetour = t.type === 'retour';
                    return (
                    <tr key={t.id || t.numero} className={`border-b border-sand-100 last:border-0 transition-colors ${estRetour ? 'bg-danger-50/40 hover:bg-danger-50/70' : 'hover:bg-sand-50'}`}>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-sand-900">n°{t.numero}</span>
                        {estRetour && (
                          <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-danger-100 text-danger-700 ring-1 ring-inset ring-danger-200">
                            <Icon icon="mdi:keyboard-return" className="text-xs" /> retour n°{t.ticketOrigineNumero ?? '?'}
                          </span>
                        )}
                        {!estRetour && (t.remise ?? 0) > 0 && (
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
                      <td className={`px-4 py-3 text-right font-semibold ${estRetour ? 'text-danger-600' : 'text-sand-900'}`}>{formatCurrency(t.total)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {!estRetour && (
                            <button
                              onClick={() => ouvrirRetour(t)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-danger-600 hover:bg-danger-50 transition-colors text-xs font-medium"
                              title="Retourner un produit"
                            >
                              <Icon icon="mdi:keyboard-return" className="text-base" />
                              <span className="hidden sm:inline">Retour</span>
                            </button>
                          )}
                          <button
                            onClick={() => (estRetour ? imprimerRetour(t) : reimprimer(t))}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sand-600 hover:bg-sand-100 hover:text-sand-900 transition-colors text-xs font-medium"
                            title="Réimprimer le ticket"
                          >
                            <Icon icon="mdi:printer-outline" className="text-base" />
                            <span className="hidden sm:inline">Réimprimer</span>
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
      </div>

      {/* Modal retour produit */}
      <Modal
        isOpen={!!retourTicket}
        onClose={fermerRetour}
        title={retourTicket ? `Retour · ticket n°${retourTicket.numero}` : 'Retour'}
        size="md"
        position="center"
      >
        {retourTicket && (
          <div className="space-y-4">
            <p className="text-sm text-sand-500">
              Sélectionnez les quantités à retourner. Un ticket d'avoir sera généré et remboursé.
            </p>

            {/* Lignes */}
            <div className="border border-sand-200 rounded-xl divide-y divide-sand-100 overflow-hidden">
              {retourTicket.lignes.map((l) => {
                const max = maxRetour(l);
                const deja = dejaRetourne[l.produitId] || 0;
                const q = retourQtes[l.produitId] || 0;
                return (
                  <div key={l.produitId} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-sand-900 truncate">{l.nom}</div>
                      <div className="text-xs text-sand-500 tabular-nums">
                        {l.prixUnitaire.toLocaleString('fr-FR')} F · vendu {l.quantite}
                        {deja > 0 && <span className="text-danger-600"> · déjà retourné {deja}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setQteRetour(l.produitId, q - 1, max)}
                        disabled={q <= 0}
                        className="w-7 h-7 rounded-lg border border-sand-200 text-sand-600 hover:bg-sand-100 flex items-center justify-center disabled:opacity-40"
                      ><Icon icon="mdi:minus" /></button>
                      <span className="w-8 text-center text-sm font-medium text-sand-900 tabular-nums">{q}</span>
                      <button
                        onClick={() => setQteRetour(l.produitId, q + 1, max)}
                        disabled={q >= max}
                        className="w-7 h-7 rounded-lg border border-sand-200 text-sand-600 hover:bg-sand-100 flex items-center justify-center disabled:opacity-40"
                      ><Icon icon="mdi:plus" /></button>
                    </div>
                    <span className="w-8 text-right text-[11px] text-sand-400 shrink-0">/{max}</span>
                  </div>
                );
              })}
            </div>

            {/* Mode de remboursement */}
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-sand-500 mb-1.5">Mode de remboursement</div>
              <div className="grid grid-cols-3 gap-2">
                {(['espece', 'om', 'wave'] as ModePaiement[]).map(m => (
                  <button
                    key={m}
                    onClick={() => setRetourMode(m)}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-medium transition-all ${retourMode === m ? 'border-danger-500 bg-danger-50 text-danger-700 ring-1 ring-danger-500' : 'border-sand-200 text-sand-600 hover:bg-sand-50'}`}
                  >
                    <Icon icon={modeIcon[m]} className="text-base" /> {modeLabel[m]}
                  </button>
                ))}
              </div>
            </div>

            {/* Motif */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-sand-500 mb-1.5">Motif (facultatif)</label>
              <input
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder="Produit défectueux, erreur de saisie…"
                className="w-full px-3 py-2 border border-sand-300 rounded-lg text-sm focus:ring-2 focus:ring-danger-500 focus:border-transparent"
              />
            </div>

            {/* Total + validation */}
            <div className="flex items-center justify-between border-t border-sand-200 pt-3">
              <span className="font-semibold text-sand-900">Total à rembourser</span>
              <span className="font-display text-2xl font-semibold text-danger-600 tabular-nums">{formatCurrency(totalRetour)}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={fermerRetour} className="flex-1 py-2.5 rounded-xl border border-sand-300 text-sand-700 hover:bg-sand-50 font-medium">
                Annuler
              </button>
              <button
                onClick={validerRetour}
                disabled={isSaving || nbArticlesRetour <= 0}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-danger-600 hover:bg-danger-500 text-white font-semibold shadow-soft transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Icon icon={isSaving ? 'mdi:loading' : 'mdi:keyboard-return'} className={`text-lg ${isSaving ? 'animate-spin' : ''}`} />
                {isSaving ? 'Traitement…' : 'Valider le retour'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
