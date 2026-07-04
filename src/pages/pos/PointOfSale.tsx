import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import { Modal } from '../../components/ui/Modal';
import { useReferentielStore } from '../../store/referentielStore';
import { formatCurrency } from '../../utils/currency';
import type { Produit } from '../../types';
import omLogo from '../../assets/om.svg';
import waveLogo from '../../assets/wave.svg';

type CategorieFiltre = 'tous' | 'boulangerie' | 'viennoiserie';
type ModePaiement = 'espece' | 'om' | 'wave';
type TypeCommande = 'sur_place' | 'emporter' | 'livraison';

const CATS: { val: CategorieFiltre; label: string; icon: string }[] = [
  { val: 'tous', label: 'Tout le menu', icon: 'mdi:silverware-variant' },
  { val: 'boulangerie', label: 'Boulangerie', icon: 'mdi:baguette' },
  { val: 'viennoiserie', label: 'Viennoiserie', icon: 'mdi:croissant' },
];

const getProductIcon = (nom: string): string => {
  const n = nom?.toLowerCase() || '';
  if (n.includes('baguette')) return 'mdi:baguette';
  if (n.includes('croissant')) return 'mdi:croissant';
  if (n.includes('brioche')) return 'mdi:muffin';
  if (n.includes('pain')) return 'mdi:bread-slice';
  if (n.includes('tarte')) return 'mdi:pie';
  if (n.includes('gateau') || n.includes('gâteau')) return 'mdi:cake';
  if (n.includes('sandwich')) return 'mdi:food';
  return 'mdi:food-variant';
};
const prixDe = (p: Produit) => p.prixBoutique || p.prixClient || 0;
const catLabel = (c?: string) => c === 'viennoiserie' ? 'Viennoiserie' : c === 'boulangerie' ? 'Boulangerie' : 'Produit';

export const PointOfSale: React.FC = () => {
  const { produits, chargerProduits } = useReferentielStore();

  const [cart, setCart] = useState<Record<string, number>>({});
  const [categorie, setCategorie] = useState<CategorieFiltre>('tous');
  const [search, setSearch] = useState('');
  const [typeCommande, setTypeCommande] = useState<TypeCommande>('emporter');
  const [showPayment, setShowPayment] = useState(false);
  const [paiement, setPaiement] = useState<ModePaiement>('espece');
  const [recu, setRecu] = useState('');

  useEffect(() => { chargerProduits(); }, [chargerProduits]);

  const actifs = useMemo(() => produits.filter(p => p.active), [produits]);
  const count = (c: CategorieFiltre) => c === 'tous' ? actifs.length : actifs.filter(p => p.categorie === c).length;

  const produitsFiltres = useMemo(() =>
    actifs
      .filter(p => categorie === 'tous' || p.categorie === categorie)
      .filter(p => p.nom.toLowerCase().includes(search.toLowerCase().trim()))
    , [actifs, categorie, search]);

  const produitById = useMemo(() => Object.fromEntries(produits.map(p => [p.id, p])), [produits]);
  const lignes = useMemo(() =>
    Object.entries(cart).map(([id, qty]) => ({ produit: produitById[id] as Produit | undefined, qty })).filter(l => l.produit)
    , [cart, produitById]);

  const sousTotal = lignes.reduce((s, l) => s + prixDe(l.produit!) * l.qty, 0);
  const total = sousTotal;
  const nbArticles = lignes.reduce((s, l) => s + l.qty, 0);
  const recuNum = parseInt(recu) || 0;
  const rendu = Math.max(0, recuNum - total);

  const add = (id: string) => setCart(c => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const setQty = (id: string, qty: number) => setCart(c => {
    const n = { ...c }; if (qty <= 0) delete n[id]; else n[id] = qty; return n;
  });
  const clearAll = () => { setCart({}); };

  const heure = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const jour = new Date().toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const typeLabel: Record<TypeCommande, string> = { sur_place: 'Sur place', emporter: 'À emporter', livraison: 'Livraison' };

  const imprimerTicket = () => {
    const w = window.open('', '_blank', 'width=340,height=640');
    if (!w) return;
    const modeLabel = paiement === 'espece' ? 'Espèces' : paiement === 'om' ? 'Orange Money' : 'Wave';
    const rows = lignes.map(l => `<tr><td>${l.produit!.nom}</td><td class="c">${l.qty}</td><td class="r">${(prixDe(l.produit!) * l.qty).toLocaleString('fr-FR')}</td></tr>`).join('');
    const cashRows = paiement === 'espece' ? `<div class="row"><span>Reçu</span><span>${recuNum.toLocaleString('fr-FR')} F</span></div><div class="row"><span>Rendu</span><span>${rendu.toLocaleString('fr-FR')} F</span></div>` : '';
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Ticket</title><style>*{font-family:'Courier New',monospace;font-size:12px;color:#000}body{width:280px;margin:0 auto;padding:12px}h1{font-size:16px;text-align:center;margin:0 0 2px}.sub{text-align:center;font-size:11px;margin:0 0 8px;color:#333}hr{border:none;border-top:1px dashed #999;margin:8px 0}table{width:100%;border-collapse:collapse}td{padding:2px 0}.c{text-align:center;width:32px}.r{text-align:right;width:80px}.row{display:flex;justify-content:space-between;margin:2px 0}.tot{display:flex;justify-content:space-between;font-size:15px;font-weight:bold;margin:6px 0}.foot{text-align:center;margin-top:12px;font-size:11px}</style></head><body><h1>CHEZ MINA NOFLAYE</h1><p class="sub">${jour} ${heure} · ${typeLabel[typeCommande]}</p><hr/><table><thead><tr><td>Article</td><td class="c">Qté</td><td class="r">FCFA</td></tr></thead><tbody>${rows}</tbody></table><hr/><div class="tot"><span>TOTAL</span><span>${total.toLocaleString('fr-FR')} F</span></div><div class="row"><span>Paiement</span><span>${modeLabel}</span></div>${cashRows}<hr/><p class="foot">${nbArticles} article(s) · Merci de votre visite !</p></body></html>`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 200);
  };

  const validerPaiement = () => {
    if (paiement === 'espece' && recuNum < total) { toast.error('Montant reçu insuffisant'); return; }
    imprimerTicket();
    // TODO (persistance): brancher la vente réelle, ex.
    // await useBoutiqueStore.getState().validerVenteDirecte(new Date(), cart);
    toast.success(`Commande encaissée · ${formatCurrency(total)}`);
    clearAll(); setShowPayment(false);
  };

  const montantsRapides = [1000, 2000, 5000, 10000];

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-7rem)]">
      {/* ============ PANNEAU PRODUITS ============ */}
      <div className="flex-1 min-w-0 flex flex-col gap-4">
        {/* Barre date / heure / actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-sand-200 text-sm font-medium text-sand-800 shadow-soft">
              <Icon icon="mdi:calendar-blank-outline" className="text-lg text-gold-600" />{jour}
            </span>
            <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-sand-200 text-sm font-medium text-sand-800 shadow-soft">
              <Icon icon="mdi:clock-outline" className="text-lg text-gold-600" />{heure}
            </span>
          </div>
          {nbArticles > 0 && (
            <button onClick={clearAll} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-danger-600 hover:bg-danger-50 text-sm font-medium">
              <Icon icon="mdi:close-circle-outline" className="text-lg" /> Annuler la commande
            </button>
          )}
        </div>

        {/* Cartes catégories */}
        <div className="flex gap-3 overflow-x-auto pb-1">
          {CATS.map(c => {
            const actif = categorie === c.val;
            return (
              <button
                key={c.val}
                onClick={() => setCategorie(c.val)}
                className={`shrink-0 w-32 rounded-2xl border p-3 text-left transition-all ${actif ? 'bg-gold-50 border-gold-500 ring-1 ring-gold-500' : 'bg-white border-sand-200 hover:border-sand-300 shadow-soft'}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${actif ? 'bg-gold-600 text-white' : 'bg-sand-100 text-sand-500'}`}>
                  <Icon icon={c.icon} className="text-xl" />
                </div>
                <div className="font-semibold text-sand-900 text-sm truncate">{c.label}</div>
                <div className="text-xs text-sand-500">{count(c.val)} article{count(c.val) > 1 ? 's' : ''}</div>
              </button>
            );
          })}
        </div>

        {/* Recherche */}
        <div className="relative">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un produit…"
            className="w-full pl-4 pr-12 py-3 rounded-2xl bg-white border border-sand-200 text-sm text-sand-900 shadow-soft focus:ring-2 focus:ring-gold-500 focus:border-transparent"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl bg-sand-100 flex items-center justify-center text-sand-500">
            <Icon icon="mdi:magnify" className="text-lg" />
          </div>
        </div>

        {/* Grille produits */}
        <div className="flex-1 overflow-y-auto pr-1">
          {produitsFiltres.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-sand-400">
              <Icon icon="mdi:basket-outline" className="text-5xl text-sand-300 mb-3" />
              <p>Aucun produit disponible</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {produitsFiltres.map(p => (
                <button
                  key={p.id}
                  onClick={() => add(p.id)}
                  className="group relative bg-white border border-sand-200 rounded-2xl shadow-card hover:shadow-elevated hover:border-gold-300 transition-all p-3 text-left active:scale-[0.98]"
                >
                  <div className="aspect-square bg-sand-50 rounded-xl overflow-hidden flex items-center justify-center mb-3 relative">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.nom} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    ) : (
                      <Icon icon={getProductIcon(p.nom)} className="text-5xl text-sand-300" />
                    )}
                    {cart[p.id] > 0 && (
                      <span className="absolute top-2 right-2 min-w-6 h-6 px-1.5 rounded-full bg-gold-600 text-white text-xs font-semibold flex items-center justify-center tabular-nums ring-2 ring-white">
                        {cart[p.id]}
                      </span>
                    )}
                  </div>
                  <div className="font-medium text-sand-900 text-sm leading-tight truncate">{p.nom}</div>
                  <div className="flex items-center justify-between mt-2 gap-2">
                    <span className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-medium bg-sand-100 text-sand-600">{catLabel(p.categorie)}</span>
                    <span className="font-display font-semibold text-sand-900 tabular-nums shrink-0">{prixDe(p).toLocaleString('fr-FR')} F</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ============ PANNEAU COMMANDE ============ */}
      <div className="w-full lg:w-[380px] shrink-0">
        <div className="bg-white border border-sand-200 rounded-2xl shadow-card flex flex-col h-full overflow-hidden">
          {/* En-tête commande */}
          <div className="flex items-center gap-3 px-4 py-4 border-b border-sand-200">
            <div className="w-10 h-10 rounded-xl bg-gold-50 text-gold-600 flex items-center justify-center shrink-0">
              <Icon icon="mdi:receipt-text-outline" className="text-xl" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-display font-semibold text-sand-900">Commande en cours</div>
              <div className="text-xs text-sand-500">{nbArticles} article(s) · {typeLabel[typeCommande]}</div>
            </div>
            {nbArticles > 0 && (
              <button onClick={clearAll} title="Vider la commande" className="w-9 h-9 rounded-lg text-sand-400 hover:bg-danger-50 hover:text-danger-600 flex items-center justify-center">
                <Icon icon="mdi:delete-outline" className="text-lg" />
              </button>
            )}
          </div>

          {/* Type de commande */}
          <div className="px-4 py-3 border-b border-sand-200">
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(typeLabel) as TypeCommande[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTypeCommande(t)}
                  className={`py-2 rounded-lg text-xs font-medium transition-colors ${typeCommande === t ? 'bg-sand-900 text-white' : 'bg-sand-100 text-sand-600 hover:bg-sand-200'}`}
                >
                  {typeLabel[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Lignes */}
          <div className="flex-1 overflow-y-auto">
            {lignes.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-sand-400 px-6 py-10">
                <Icon icon="mdi:cart-outline" className="text-4xl mb-2" />
                <p className="text-sm">Aucun article sélectionné.</p>
              </div>
            ) : (
              <div className="divide-y divide-sand-100">
                {lignes.map(({ produit, qty }) => (
                  <div key={produit!.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-10 h-10 rounded-lg bg-sand-100 overflow-hidden flex items-center justify-center shrink-0">
                      {produit!.imageUrl ? <img src={produit!.imageUrl} alt="" className="w-full h-full object-cover" /> : <Icon icon={getProductIcon(produit!.nom)} className="text-lg text-sand-400" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-sand-900 truncate">{produit!.nom}</div>
                      <div className="text-xs text-sand-500 tabular-nums">{prixDe(produit!).toLocaleString('fr-FR')} F</div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => setQty(produit!.id, qty - 1)} className="w-7 h-7 rounded-lg border border-sand-200 text-sand-600 hover:bg-sand-100 flex items-center justify-center"><Icon icon="mdi:minus" /></button>
                      <span className="w-6 text-center text-sm font-medium text-sand-900 tabular-nums">{qty}</span>
                      <button onClick={() => setQty(produit!.id, qty + 1)} className="w-7 h-7 rounded-lg border border-sand-200 text-sand-600 hover:bg-sand-100 flex items-center justify-center"><Icon icon="mdi:plus" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Totaux + paiement */}
          <div className="border-t border-sand-200 p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-sand-500">Sous-total</span>
              <span className="text-sand-700 tabular-nums">{formatCurrency(sousTotal)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-dashed border-sand-200 pt-3">
              <span className="font-semibold text-sand-900">TOTAL</span>
              <span className="font-display text-2xl font-semibold text-sand-900 tabular-nums">{formatCurrency(total)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input placeholder="Code promo / bon" className="w-full pl-3 pr-9 py-2 rounded-lg border border-sand-300 bg-sand-50 text-sm focus:ring-2 focus:ring-gold-500 focus:border-transparent" />
                <Icon icon="mdi:ticket-percent-outline" className="absolute right-3 top-1/2 -translate-y-1/2 text-sand-400" />
              </div>
            </div>
            <button
              onClick={() => nbArticles > 0 && setShowPayment(true)}
              disabled={nbArticles === 0}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gold-600 hover:bg-gold-500 text-white font-semibold shadow-soft transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Icon icon="mdi:cash-register" className="text-lg" />
              Encaisser {nbArticles > 0 && `· ${formatCurrency(total)}`}
            </button>
          </div>
        </div>
      </div>

      {/* Modal paiement */}
      <Modal isOpen={showPayment} onClose={() => setShowPayment(false)} title="Encaissement" size="sm" position="center">
        <div className="space-y-5">
          <div className="text-center">
            <div className="text-xs uppercase tracking-wide text-sand-500 font-semibold">Total à payer</div>
            <div className="font-display text-4xl font-semibold text-sand-900 tabular-nums mt-1">{formatCurrency(total)}</div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {([
              { val: 'espece', label: 'Espèces', icon: 'mdi:cash' },
              { val: 'om', label: 'Orange Money', img: omLogo },
              { val: 'wave', label: 'Wave', img: waveLogo },
            ] as { val: ModePaiement; label: string; icon?: string; img?: string }[]).map(m => (
              <button
                key={m.val}
                onClick={() => setPaiement(m.val)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${paiement === m.val ? 'border-gold-600 bg-gold-50 ring-1 ring-gold-600' : 'border-sand-200 hover:bg-sand-50'}`}
              >
                {m.img ? <img src={m.img} alt={m.label} className="w-7 h-7 object-contain" /> : <Icon icon={m.icon!} className="text-2xl text-sand-700" />}
                <span className="text-[11px] font-medium text-sand-700 text-center leading-tight">{m.label}</span>
              </button>
            ))}
          </div>
          {paiement === 'espece' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-sand-700">Montant reçu</label>
              <input type="number" value={recu} onChange={(e) => setRecu(e.target.value)} placeholder="0" className="w-full px-3 py-2.5 border border-sand-300 rounded-lg text-right font-display text-lg font-semibold text-sand-900 tabular-nums focus:ring-2 focus:ring-gold-500 focus:border-transparent" />
              <div className="flex flex-wrap gap-2">
                {montantsRapides.map(m => (
                  <button key={m} onClick={() => setRecu(String(m))} className="px-3 py-1.5 rounded-lg bg-sand-100 hover:bg-sand-200 text-sand-700 text-sm font-medium tabular-nums">{m.toLocaleString('fr-FR')}</button>
                ))}
                <button onClick={() => setRecu(String(total))} className="px-3 py-1.5 rounded-lg bg-sand-100 hover:bg-sand-200 text-sand-700 text-sm font-medium">Appoint</button>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-sm text-sand-500">Rendu monnaie</span>
                <span className={`font-display text-xl font-semibold tabular-nums ${recuNum >= total && recuNum > 0 ? 'text-success-600' : 'text-sand-400'}`}>{formatCurrency(rendu)}</span>
              </div>
            </div>
          )}
          <button onClick={validerPaiement} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gold-600 hover:bg-gold-500 text-white font-semibold shadow-soft transition-all">
            <Icon icon="mdi:check-circle-outline" className="text-lg" />
            Valider & imprimer le ticket
          </button>
        </div>
      </Modal>
    </div>
  );
};
