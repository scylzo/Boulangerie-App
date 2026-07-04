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

const getProductIcon = (nom: string): string => {
  const n = nom?.toLowerCase() || '';
  if (n.includes('baguette')) return 'mdi:baguette';
  if (n.includes('croissant')) return 'mdi:croissant';
  if (n.includes('brioche')) return 'mdi:muffin';
  if (n.includes('pain')) return 'mdi:bread-slice';
  if (n.includes('tarte')) return 'mdi:pie';
  if (n.includes('gateau') || n.includes('gâteau')) return 'mdi:cake';
  if (n.includes('sandwich')) return 'mdi:food';
  if (n.includes('viennoiserie')) return 'mdi:pretzel';
  return 'mdi:food-variant';
};

const prixDe = (p: Produit) => p.prixBoutique || p.prixClient || 0;

export const PointOfSale: React.FC = () => {
  const { produits, chargerProduits } = useReferentielStore();

  const [cart, setCart] = useState<Record<string, number>>({});
  const [categorie, setCategorie] = useState<CategorieFiltre>('tous');
  const [search, setSearch] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [paiement, setPaiement] = useState<ModePaiement>('espece');
  const [recu, setRecu] = useState('');

  useEffect(() => { chargerProduits(); }, [chargerProduits]);

  const produitsFiltres = useMemo(() => {
    return produits
      .filter(p => p.active)
      .filter(p => categorie === 'tous' || p.categorie === categorie)
      .filter(p => p.nom.toLowerCase().includes(search.toLowerCase().trim()));
  }, [produits, categorie, search]);

  const produitById = useMemo(() => {
    const m: Record<string, Produit> = {};
    produits.forEach(p => { m[p.id] = p; });
    return m;
  }, [produits]);

  const lignes = useMemo(() =>
    Object.entries(cart)
      .map(([id, qty]) => ({ produit: produitById[id], qty }))
      .filter(l => l.produit)
    , [cart, produitById]);

  const total = lignes.reduce((s, l) => s + prixDe(l.produit) * l.qty, 0);
  const nbArticles = lignes.reduce((s, l) => s + l.qty, 0);
  const recuNum = parseInt(recu) || 0;
  const rendu = Math.max(0, recuNum - total);

  const add = (id: string) => setCart(c => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const setQty = (id: string, qty: number) => setCart(c => {
    const next = { ...c };
    if (qty <= 0) delete next[id]; else next[id] = qty;
    return next;
  });
  const clearCart = () => setCart({});

  const ouvrirPaiement = () => {
    if (nbArticles === 0) return;
    setPaiement('espece');
    setRecu('');
    setShowPayment(true);
  };

  const imprimerTicket = () => {
    const w = window.open('', '_blank', 'width=340,height=640');
    if (!w) return;
    const modeLabel = paiement === 'espece' ? 'Espèces' : paiement === 'om' ? 'Orange Money' : 'Wave';
    const rows = lignes.map(l =>
      `<tr><td>${l.produit.nom}</td><td class="c">${l.qty}</td><td class="r">${(prixDe(l.produit) * l.qty).toLocaleString('fr-FR')}</td></tr>`
    ).join('');
    const cashRows = paiement === 'espece'
      ? `<div class="row"><span>Reçu</span><span>${recuNum.toLocaleString('fr-FR')} F</span></div><div class="row"><span>Rendu</span><span>${rendu.toLocaleString('fr-FR')} F</span></div>`
      : '';
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Ticket</title>
      <style>
        *{font-family:'Courier New',monospace;font-size:12px;color:#000}
        body{width:280px;margin:0 auto;padding:12px}
        h1{font-size:16px;text-align:center;margin:0 0 2px}
        .sub{text-align:center;font-size:11px;margin:0 0 10px;color:#333}
        hr{border:none;border-top:1px dashed #999;margin:8px 0}
        table{width:100%;border-collapse:collapse}
        td{padding:2px 0}
        .c{text-align:center;width:32px}.r{text-align:right;width:80px}
        .row{display:flex;justify-content:space-between;margin:2px 0}
        .tot{display:flex;justify-content:space-between;font-size:15px;font-weight:bold;margin:6px 0}
        .foot{text-align:center;margin-top:12px;font-size:11px}
      </style></head><body>
        <h1>CHEZ MINA NOFLAYE</h1>
        <p class="sub">Ticket de caisse · ${new Date().toLocaleString('fr-FR')}</p>
        <hr/>
        <table><thead><tr><td>Article</td><td class="c">Qté</td><td class="r">FCFA</td></tr></thead><tbody>${rows}</tbody></table>
        <hr/>
        <div class="tot"><span>TOTAL</span><span>${total.toLocaleString('fr-FR')} F</span></div>
        <div class="row"><span>Paiement</span><span>${modeLabel}</span></div>
        ${cashRows}
        <hr/>
        <p class="foot">${nbArticles} article(s) · Merci de votre visite !</p>
      </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 200);
  };

  const validerPaiement = () => {
    if (paiement === 'espece' && recuNum < total) {
      toast.error('Montant reçu insuffisant');
      return;
    }
    imprimerTicket();
    // TODO (persistance): brancher ici la vente réelle, ex.
    // await useBoutiqueStore.getState().validerVenteDirecte(new Date(), cart);
    toast.success(`Encaissement de ${formatCurrency(total)} enregistré`);
    clearCart();
    setShowPayment(false);
  };

  const montantsRapides = [1000, 2000, 5000, 10000];

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-7rem)]">
      {/* Colonne produits */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Barre catégories + recherche */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="flex items-center gap-1 bg-white border border-sand-200 rounded-xl p-1 shadow-soft">
            {([['tous', 'Tous'], ['boulangerie', 'Boulangerie'], ['viennoiserie', 'Viennoiserie']] as [CategorieFiltre, string][]).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setCategorie(val)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${categorie === val ? 'bg-sand-900 text-white' : 'text-sand-600 hover:bg-sand-100'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[160px]">
            <Icon icon="mdi:magnify" className="absolute left-3 top-1/2 -translate-y-1/2 text-sand-400 text-lg" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un produit…"
              className="w-full pl-10 pr-3 py-2 border border-sand-300 rounded-xl bg-white text-sm text-sand-900 focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Grille produits */}
        <div className="flex-1 overflow-y-auto pr-1">
          {produitsFiltres.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-sand-500">
              <Icon icon="mdi:basket-outline" className="text-5xl text-sand-300 mb-3" />
              <p>Aucun produit disponible</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {produitsFiltres.map((p) => (
                <button
                  key={p.id}
                  onClick={() => add(p.id)}
                  className="group relative bg-white border border-sand-200 rounded-2xl shadow-card hover:shadow-elevated hover:border-terracotta-300 transition-all p-4 text-left flex flex-col gap-3 active:scale-[0.98]"
                >
                  <div className="w-11 h-11 rounded-xl bg-sand-100 text-sand-700 flex items-center justify-center group-hover:bg-terracotta-50 group-hover:text-terracotta-600 transition-colors">
                    <Icon icon={getProductIcon(p.nom)} className="text-2xl" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sand-900 text-sm leading-tight line-clamp-2">{p.nom}</div>
                    <div className="font-display text-lg font-semibold text-sand-900 tabular-nums mt-1">
                      {prixDe(p).toLocaleString('fr-FR')} <span className="text-xs text-sand-400 font-normal">F</span>
                    </div>
                  </div>
                  {cart[p.id] > 0 && (
                    <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-terracotta-500 text-white text-xs font-semibold flex items-center justify-center tabular-nums">
                      {cart[p.id]}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Colonne ticket */}
      <div className="w-full lg:w-[360px] shrink-0">
        <div className="bg-white border border-sand-200 rounded-2xl shadow-card flex flex-col h-full overflow-hidden">
          {/* En-tête ticket */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-sand-200 bg-sand-50">
            <div className="flex items-center gap-2">
              <Icon icon="mdi:receipt-text-outline" className="text-lg text-terracotta-600" />
              <h2 className="font-display font-semibold text-sand-900">Ticket</h2>
              {nbArticles > 0 && (
                <span className="text-xs font-medium text-sand-500 bg-sand-100 px-2 py-0.5 rounded-full tabular-nums">{nbArticles}</span>
              )}
            </div>
            {nbArticles > 0 && (
              <button onClick={clearCart} className="text-sand-400 hover:text-danger-600 text-xs font-medium flex items-center gap-1">
                <Icon icon="mdi:delete-outline" /> Vider
              </button>
            )}
          </div>

          {/* Lignes */}
          <div className="flex-1 overflow-y-auto">
            {lignes.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-sand-400 px-6 py-10">
                <Icon icon="mdi:basket-outline" className="text-4xl mb-2" />
                <p className="text-sm">Panier vide — touchez un produit pour l'ajouter.</p>
              </div>
            ) : (
              <div className="divide-y divide-sand-100">
                {lignes.map(({ produit, qty }) => (
                  <div key={produit.id} className="flex items-center gap-2 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-sand-900 truncate">{produit.nom}</div>
                      <div className="text-xs text-sand-500 tabular-nums">{prixDe(produit).toLocaleString('fr-FR')} F × {qty}</div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => setQty(produit.id, qty - 1)} className="w-7 h-7 rounded-lg border border-sand-200 text-sand-600 hover:bg-sand-100 flex items-center justify-center">
                        <Icon icon="mdi:minus" />
                      </button>
                      <span className="w-6 text-center text-sm font-medium text-sand-900 tabular-nums">{qty}</span>
                      <button onClick={() => setQty(produit.id, qty + 1)} className="w-7 h-7 rounded-lg border border-sand-200 text-sand-600 hover:bg-sand-100 flex items-center justify-center">
                        <Icon icon="mdi:plus" />
                      </button>
                    </div>
                    <div className="w-20 text-right font-display font-semibold text-sand-900 text-sm tabular-nums shrink-0">
                      {(prixDe(produit) * qty).toLocaleString('fr-FR')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Total + encaisser */}
          <div className="border-t border-sand-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-sand-500">Total</span>
              <span className="font-display text-2xl font-semibold text-sand-900 tabular-nums">{formatCurrency(total)}</span>
            </div>
            <button
              onClick={ouvrirPaiement}
              disabled={nbArticles === 0}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 text-white font-semibold shadow-soft transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Icon icon="mdi:cash-register" className="text-lg" />
              Encaisser
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

          {/* Mode de paiement */}
          <div className="grid grid-cols-3 gap-2">
            {([
              { val: 'espece', label: 'Espèces', icon: 'mdi:cash' },
              { val: 'om', label: 'Orange Money', img: omLogo },
              { val: 'wave', label: 'Wave', img: waveLogo },
            ] as { val: ModePaiement; label: string; icon?: string; img?: string }[]).map((m) => (
              <button
                key={m.val}
                onClick={() => setPaiement(m.val)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${paiement === m.val ? 'border-terracotta-500 bg-terracotta-50 ring-1 ring-terracotta-500' : 'border-sand-200 hover:bg-sand-50'}`}
              >
                {m.img ? <img src={m.img} alt={m.label} className="w-7 h-7 object-contain" /> : <Icon icon={m.icon!} className="text-2xl text-sand-700" />}
                <span className="text-[11px] font-medium text-sand-700 text-center leading-tight">{m.label}</span>
              </button>
            ))}
          </div>

          {/* Espèces : montant reçu + rendu */}
          {paiement === 'espece' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-sand-700">Montant reçu</label>
              <input
                type="number"
                value={recu}
                onChange={(e) => setRecu(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2.5 border border-sand-300 rounded-lg text-right font-display text-lg font-semibold text-sand-900 tabular-nums focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
              />
              <div className="flex flex-wrap gap-2">
                {montantsRapides.map((m) => (
                  <button key={m} onClick={() => setRecu(String(m))} className="px-3 py-1.5 rounded-lg bg-sand-100 hover:bg-sand-200 text-sand-700 text-sm font-medium tabular-nums">
                    {m.toLocaleString('fr-FR')}
                  </button>
                ))}
                <button onClick={() => setRecu(String(total))} className="px-3 py-1.5 rounded-lg bg-sand-100 hover:bg-sand-200 text-sand-700 text-sm font-medium">Appoint</button>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-sm text-sand-500">Rendu monnaie</span>
                <span className={`font-display text-xl font-semibold tabular-nums ${recuNum >= total && recuNum > 0 ? 'text-success-600' : 'text-sand-400'}`}>
                  {formatCurrency(rendu)}
                </span>
              </div>
            </div>
          )}

          <button
            onClick={validerPaiement}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 text-white font-semibold shadow-soft transition-all"
          >
            <Icon icon="mdi:check-circle-outline" className="text-lg" />
            Valider & imprimer le ticket
          </button>
        </div>
      </Modal>
    </div>
  );
};
