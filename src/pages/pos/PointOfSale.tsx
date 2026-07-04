import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Modal } from '../../components/ui/Modal';
import { useReferentielStore } from '../../store/referentielStore';
import { usePosStore } from '../../store/posStore';
import { useAuthStore } from '../../store/authStore';
import { formatCurrency } from '../../utils/currency';
import type { Produit } from '../../types';
import omLogo from '../../assets/om.svg';
import waveLogo from '../../assets/wave.svg';
import logo from '../../assets/logo.png';

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

export const PointOfSale: React.FC = () => {
  const { produits, chargerProduits } = useReferentielStore();
  const { enregistrerTicket, isSaving } = usePosStore();
  const { user } = useAuthStore();

  const [cart, setCart] = useState<Record<string, number>>({});
  const [categorie, setCategorie] = useState<CategorieFiltre>('tous');
  const [search, setSearch] = useState('');
  const [typeCommande, setTypeCommande] = useState<TypeCommande>('emporter');
  const [showPayment, setShowPayment] = useState(false);
  const [paiement, setPaiement] = useState<ModePaiement>('espece');
  const [recu, setRecu] = useState('');
  const [remiseVal, setRemiseVal] = useState('');
  const [remiseType, setRemiseType] = useState<'montant' | 'pourcent'>('montant');

  // Session vendeur (déclaré à l'ouverture de la caisse, mémorisé localement)
  const [vendeur, setVendeur] = useState(() => localStorage.getItem('cm.pos.vendeur') || '');
  const [showVendeur, setShowVendeur] = useState(false);
  const [vendeurInput, setVendeurInput] = useState('');

  useEffect(() => { chargerProduits(); }, [chargerProduits]);

  // À l'ouverture, si aucun vendeur déclaré, proposer de le déclarer (pré-rempli avec l'utilisateur connecté)
  useEffect(() => {
    if (!vendeur) {
      setVendeurInput(user ? `${user.prenom || ''} ${user.nom || ''}`.trim() : '');
      setShowVendeur(true);
    }
  }, [vendeur, user]);

  const declarerVendeur = () => {
    const nom = vendeurInput.trim();
    if (!nom) { toast.error('Indiquez le nom du vendeur'); return; }
    localStorage.setItem('cm.pos.vendeur', nom);
    setVendeur(nom);
    setShowVendeur(false);
  };
  const ouvrirVendeur = () => { setVendeurInput(vendeur); setShowVendeur(true); };

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
  const remiseNum = parseFloat(remiseVal) || 0;
  const montantRemise = remiseType === 'pourcent'
    ? Math.round(sousTotal * Math.min(Math.max(remiseNum, 0), 100) / 100)
    : Math.min(Math.max(remiseNum, 0), sousTotal);
  const total = Math.max(0, sousTotal - montantRemise);
  const nbArticles = lignes.reduce((s, l) => s + l.qty, 0);
  const recuNum = parseInt(recu) || 0;
  const rendu = Math.max(0, recuNum - total);

  const add = (id: string) => setCart(c => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const setQty = (id: string, qty: number) => setCart(c => {
    const n = { ...c }; if (qty <= 0) delete n[id]; else n[id] = qty; return n;
  });
  const clearAll = () => { setCart({}); setRemiseVal(''); };

  const heure = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const jour = new Date().toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const typeLabel: Record<TypeCommande, string> = { sur_place: 'Sur place', emporter: 'À emporter', livraison: 'Livraison' };

  const imprimerTicket = (numero: number) => {
    const w = window.open('', '_blank', 'width=340,height=640');
    if (!w) return;
    const modeLabel = paiement === 'espece' ? 'Espèces' : paiement === 'om' ? 'Orange Money' : 'Wave';
    const rows = lignes.map(l => `<tr><td>${l.produit!.nom.toUpperCase()}</td><td class="c">${l.qty}</td><td class="r">${(prixDe(l.produit!) * l.qty).toLocaleString('fr-FR')}</td></tr>`).join('');
    const cashRows = paiement === 'espece' ? `<div class="row"><span>Reçu</span><span>${recuNum.toLocaleString('fr-FR')} F</span></div><div class="row"><span>Rendu</span><span>${rendu.toLocaleString('fr-FR')} F</span></div>` : '';
    const remiseRows = montantRemise > 0 ? `<div class="row"><span>Sous-total</span><span>${sousTotal.toLocaleString('fr-FR')} F</span></div><div class="row"><span>Remise${remiseType === 'pourcent' ? ` (${remiseNum}%)` : ''}</span><span>- ${montantRemise.toLocaleString('fr-FR')} F</span></div>` : '';
    const logoUrl = new URL(logo, window.location.origin).href;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Ticket</title><style>*{font-family:'Courier New',monospace;font-size:12px;color:#000}body{width:280px;margin:0 auto;padding:12px}.logo{display:block;margin:6px auto 2px;max-width:160px;max-height:64px;object-fit:contain}h1{font-size:16px;text-align:center;margin:0 0 2px}.sub{text-align:center;font-size:11px;margin:0 0 8px;color:#333}hr{border:none;border-top:1px dashed #999;margin:8px 0}table{width:100%;border-collapse:collapse}td{padding:2px 0}.c{text-align:center;width:32px}.r{text-align:right;width:80px}.row{display:flex;justify-content:space-between;margin:2px 0}.tot{display:flex;justify-content:space-between;font-size:15px;font-weight:bold;margin:6px 0}.foot{text-align:center;margin-top:12px;font-size:11px}</style></head><body onload="setTimeout(function(){window.focus();window.print();},300)"><p class="sub">Ticket n°${numero} · ${jour} ${heure} · ${typeLabel[typeCommande]}${vendeur.trim() ? `<br/>Vendeur : ${vendeur.trim()}` : ''}</p><hr/><table><thead><tr><td>Article</td><td class="c">Qté</td><td class="r">FCFA</td></tr></thead><tbody>${rows}</tbody></table><hr/>${remiseRows}<div class="tot"><span>TOTAL</span><span>${total.toLocaleString('fr-FR')} F</span></div><div class="row"><span>Paiement</span><span>${modeLabel}</span></div>${cashRows}<hr/><img class="logo" src="${logoUrl}" alt="Chez Mina" onerror="this.style.display='none'"/><p class="foot">${nbArticles} article(s) · Merci de votre visite !</p></body></html>`);
    w.document.close(); w.focus();
  };

  const validerPaiement = async () => {
    if (paiement === 'espece' && recuNum < total) { toast.error('Montant reçu insuffisant'); return; }
    try {
      const base = {
        date: new Date().toISOString().split('T')[0],
        lignes: lignes.map(l => ({ produitId: l.produit!.id, nom: l.produit!.nom, prixUnitaire: prixDe(l.produit!), quantite: l.qty })),
        sousTotal,
        total,
        nbArticles,
        modePaiement: paiement,
        typeCommande,
        ...(montantRemise > 0 ? { remise: montantRemise } : {}),
        ...(vendeur.trim() ? { vendeur: vendeur.trim() } : {}),
      };
      const payload = paiement === 'espece' ? { ...base, montantRecu: recuNum, rendu } : base;
      const numero = await enregistrerTicket(payload);
      imprimerTicket(numero);
      toast.success(`Ticket n°${numero} encaissé · ${formatCurrency(total)}`);
      clearAll();
      setShowPayment(false);
    } catch {
      toast.error("Erreur lors de l'enregistrement du ticket");
    }
  };

  const montantsRapides = [1000, 2000, 5000, 10000];

  return (
    <div className="flex flex-col lg:flex-row gap-3 h-[calc(100vh-6rem)]">
      {/* ============ PANNEAU PRODUITS ============ */}
      <div className="flex-1 min-w-0 flex flex-col gap-2.5">
        {/* Barre compacte : vendeur / heure / actions */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={ouvrirVendeur}
              title="Changer le vendeur"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-sand-200 text-sm font-medium text-sand-800 shadow-soft hover:bg-sand-50"
            >
              <Icon icon="mdi:account-circle-outline" className="text-base text-gold-600" />
              <span className="max-w-[110px] truncate">{vendeur || 'Vendeur ?'}</span>
              <Icon icon="mdi:pencil-outline" className="text-xs text-sand-400" />
            </button>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-sand-200 text-xs font-medium text-sand-500 shadow-soft">
              <Icon icon="mdi:clock-outline" className="text-sm text-gold-600" />{heure}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {nbArticles > 0 && (
              <button onClick={clearAll} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-danger-600 hover:bg-danger-50 text-sm font-medium">
                <Icon icon="mdi:close-circle-outline" className="text-base" /> <span className="hidden sm:inline">Annuler</span>
              </button>
            )}
            <Link to="/caisse/historique" className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-sand-200 text-sand-700 hover:bg-sand-50 text-sm font-medium shadow-soft">
              <Icon icon="mdi:receipt-text-clock-outline" className="text-base text-gold-600" /> <span className="hidden sm:inline">Historique</span>
            </Link>
          </div>
        </div>

        {/* Catégories (pills compactes) + recherche sur une seule ligne */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide flex-1 min-w-0">
            {CATS.map(c => {
              const actif = categorie === c.val;
              return (
                <button
                  key={c.val}
                  onClick={() => setCategorie(c.val)}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${actif ? 'bg-gold-600 border-gold-600 text-white shadow-soft' : 'bg-white border-sand-200 text-sand-700 hover:border-sand-300'}`}
                >
                  <Icon icon={c.icon} className="text-base" />
                  <span>{c.label}</span>
                  <span className={`text-xs tabular-nums ${actif ? 'text-white/80' : 'text-sand-400'}`}>{count(c.val)}</span>
                </button>
              );
            })}
          </div>
          <div className="relative w-36 sm:w-56 shrink-0">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher…"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-white border border-sand-200 text-sm text-sand-900 shadow-soft focus:ring-2 focus:ring-gold-500 focus:border-transparent"
            />
            <Icon icon="mdi:magnify" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sand-400 text-lg" />
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
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6 gap-2.5">
              {produitsFiltres.map(p => (
                <button
                  key={p.id}
                  onClick={() => add(p.id)}
                  className={`group relative bg-white border rounded-xl shadow-soft hover:shadow-elevated transition-all p-2 text-left active:scale-[0.97] ${cart[p.id] > 0 ? 'border-gold-500 ring-1 ring-gold-500' : 'border-sand-200 hover:border-gold-300'}`}
                >
                  <div className="aspect-square bg-sand-50 rounded-lg overflow-hidden flex items-center justify-center mb-2 relative">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.nom} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    ) : (
                      <Icon icon={getProductIcon(p.nom)} className="text-4xl text-sand-300" />
                    )}
                    {cart[p.id] > 0 && (
                      <span className="absolute top-1.5 right-1.5 min-w-6 h-6 px-1.5 rounded-full bg-gold-600 text-white text-xs font-semibold flex items-center justify-center tabular-nums ring-2 ring-white">
                        {cart[p.id]}
                      </span>
                    )}
                  </div>
                  <div className="font-medium text-sand-900 text-xs leading-tight line-clamp-2 min-h-[2rem] uppercase">{p.nom}</div>
                  <div className="mt-1 font-display font-semibold text-sand-900 text-sm tabular-nums">{prixDe(p).toLocaleString('fr-FR')} F</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ============ PANNEAU COMMANDE ============ */}
      <div className="w-full lg:w-[340px] shrink-0">
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
                      <div className="text-sm font-medium text-sand-900 truncate uppercase">{produit!.nom}</div>
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
            {/* Remise */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  min={0}
                  value={remiseVal}
                  onChange={(e) => setRemiseVal(e.target.value)}
                  placeholder="Remise"
                  className="w-full pl-3 pr-9 py-2 rounded-lg border border-sand-300 bg-sand-50 text-sm tabular-nums focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                />
                <Icon icon="mdi:ticket-percent-outline" className="absolute right-3 top-1/2 -translate-y-1/2 text-sand-400" />
              </div>
              <div className="flex rounded-lg border border-sand-300 overflow-hidden shrink-0">
                {(['montant', 'pourcent'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setRemiseType(t)}
                    className={`px-3 py-2 text-sm font-semibold transition-colors ${remiseType === t ? 'bg-gold-600 text-white' : 'bg-white text-sand-600 hover:bg-sand-50'}`}
                  >
                    {t === 'montant' ? 'F' : '%'}
                  </button>
                ))}
              </div>
            </div>
            {montantRemise > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gold-700">Remise{remiseType === 'pourcent' ? ` (${remiseNum}%)` : ''}</span>
                <span className="text-gold-700 font-medium tabular-nums">− {formatCurrency(montantRemise)}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-dashed border-sand-200 pt-3">
              <span className="font-semibold text-sand-900">TOTAL</span>
              <span className="font-display text-2xl font-semibold text-sand-900 tabular-nums">{formatCurrency(total)}</span>
            </div>
            {/* Moyen de paiement */}
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-sand-500 mb-1.5">Moyen de paiement</div>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { val: 'espece', label: 'Espèces', icon: 'mdi:cash' },
                  { val: 'om', label: 'Orange Money', img: omLogo },
                  { val: 'wave', label: 'Wave', img: waveLogo },
                ] as { val: ModePaiement; label: string; icon?: string; img?: string }[]).map(m => (
                  <button
                    key={m.val}
                    onClick={() => setPaiement(m.val)}
                    className={`flex flex-col items-center gap-1 py-2 rounded-xl border text-[11px] font-medium transition-all ${paiement === m.val ? 'border-gold-600 bg-gold-50 text-gold-700 ring-1 ring-gold-600' : 'border-sand-200 text-sand-600 hover:bg-sand-50'}`}
                  >
                    {m.img ? <img src={m.img} alt={m.label} className="w-6 h-6 object-contain" /> : <Icon icon={m.icon!} className="text-xl" />}
                    <span className="text-center leading-tight">{m.label}</span>
                  </button>
                ))}
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
          <button onClick={validerPaiement} disabled={isSaving} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gold-600 hover:bg-gold-500 text-white font-semibold shadow-soft transition-all disabled:opacity-60 disabled:cursor-not-allowed">
            <Icon icon={isSaving ? 'mdi:loading' : 'mdi:check-circle-outline'} className={`text-lg ${isSaving ? 'animate-spin' : ''}`} />
            {isSaving ? 'Enregistrement…' : 'Valider & imprimer le ticket'}
          </button>
        </div>
      </Modal>

      {/* Modal déclaration du vendeur */}
      <Modal isOpen={showVendeur} onClose={() => { if (vendeur) setShowVendeur(false); }} title="Vendeur en caisse" size="sm" position="center">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold-50 text-gold-600 flex items-center justify-center shrink-0">
              <Icon icon="mdi:account-circle-outline" className="text-xl" />
            </div>
            <p className="text-sm text-sand-500">Déclarez le vendeur qui tient la caisse. Son nom sera associé à chaque ticket.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-sand-700 mb-1.5">Nom du vendeur</label>
            <input
              value={vendeurInput}
              onChange={(e) => setVendeurInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') declarerVendeur(); }}
              placeholder="Ex. Awa Diop"
              autoFocus
              className="w-full px-3 py-2.5 border border-sand-300 rounded-lg text-sm focus:ring-2 focus:ring-gold-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={declarerVendeur}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gold-600 hover:bg-gold-500 text-white font-semibold shadow-soft transition-all"
          >
            <Icon icon="mdi:check-circle-outline" className="text-lg" />
            Démarrer la caisse
          </button>
        </div>
      </Modal>
    </div>
  );
};
