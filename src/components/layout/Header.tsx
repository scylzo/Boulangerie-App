import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { Menu } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStockStore } from '../../store/stockStore';
import { useReferentielStore } from '../../store/referentielStore';
import { formaterQuantite } from '../../utils/calculations';
import { APP_MODULES } from '../../constants/modules';

type ResultatRecherche = { type: 'page' | 'produit' | 'client'; label: string; sous?: string; icon: string; href: string };

interface HeaderProps {
  onMenuClick: () => void;
  onToggleCollapse: () => void;
  collapsed: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick, onToggleCollapse }) => {
  const location = useLocation();
  const navigate = useNavigate();

  // Alertes de rupture de stock (matières premières)
  const matieres = useStockStore((s) => s.matieres);
  const chargerDonnees = useStockStore((s) => s.chargerDonnees);
  const [showAlerts, setShowAlerts] = useState(false);

  useEffect(() => {
    if (matieres.length === 0) chargerDonnees();
  }, [matieres.length, chargerDonnees]);

  const alertes = useMemo(
    () =>
      matieres
        .filter((m) => m.active && m.stockActuel <= m.stockMinimum)
        .sort((a, b) => a.stockActuel - b.stockActuel),
    [matieres]
  );
  const nbAlertes = alertes.length;

  const allerAuStock = () => {
    setShowAlerts(false);
    navigate('/stocks');
  };

  // ── Recherche globale (écrans + produits + clients) ────────────────
  const { produits, clients, chargerProduits, chargerClients } = useReferentielStore();
  const [q, setQ] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const chargerRecherche = () => {
    if (produits.length === 0) chargerProduits();
    if (clients.length === 0) chargerClients();
  };

  const resultats = useMemo<ResultatRecherche[]>(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    const match = (s?: string) => (s || '').toLowerCase().includes(term);

    const pages: ResultatRecherche[] = APP_MODULES
      .filter((m) => match(m.name))
      .slice(0, 5)
      .map((m) => ({ type: 'page', label: m.name, icon: m.icon, href: m.href }));

    const prods: ResultatRecherche[] = produits
      .filter((p) => match(p.nom))
      .slice(0, 6)
      .map((p) => ({ type: 'produit', label: p.nom.toUpperCase(), sous: p.categorie, icon: 'mdi:bread-slice-outline', href: `/admin/produits?q=${encodeURIComponent(p.nom)}` }));

    const clis: ResultatRecherche[] = clients
      .filter((c) => match(c.nom) || match((c as any).prenom))
      .slice(0, 6)
      .map((c) => {
        const nomComplet = [(c as any).prenom, c.nom].filter(Boolean).join(' ');
        return { type: 'client', label: nomComplet, sous: (c as any).typeClient, icon: 'mdi:account-outline', href: `/admin/clients?q=${encodeURIComponent(c.nom)}` };
      });

    return [...pages, ...prods, ...clis];
  }, [q, produits, clients]);

  const choisirResultat = (r: ResultatRecherche) => {
    setQ('');
    setSearchOpen(false);
    navigate(r.href);
  };

  const groupes: { cle: ResultatRecherche['type']; titre: string }[] = [
    { cle: 'page', titre: 'Écrans' },
    { cle: 'produit', titre: 'Produits' },
    { cle: 'client', titre: 'Clients' },
  ];

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/dashboard') return 'Tableau de bord';
    if (path === '/caisse/historique') return 'Historique de caisse';
    if (path === '/caisse') return 'Caisse';
    if (path === '/production') return 'Programme Production';
    if (path === '/boulanger') return 'Vue Boulanger';
    if (path === '/livraison') return 'Livraisons';
    if (path === '/retours') return 'Retours Clients';
    if (path === '/boutique') return 'Boutique';
    if (path === '/facturation') return 'Facturation';
    if (path === '/stocks') return 'Gestion des Stocks';
    if (path === '/admin/produits') return 'Gestion Produits';
    if (path === '/admin/clients') return 'Gestion Clients';
    if (path === '/admin/livreurs') return 'Gestion Livreurs';
    if (path === '/admin/users') return 'Gestion Utilisateurs';
    if (path === '/depenses') return 'Dépenses';
    if (path === '/comptabilite') return 'Comptabilité';
    return 'Tableau de bord';
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-sand-200">
      <div className="h-16 px-4 sm:px-6 flex items-center justify-between gap-4">
        {/* Gauche : toggles + titre */}
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 -ml-2 text-sand-500 hover:bg-sand-100 rounded-lg transition-colors"
            title="Menu"
          >
            <Menu size={20} />
          </button>
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex p-2 -ml-2 text-sand-500 hover:bg-sand-100 rounded-lg transition-colors"
            title="Réduire / déployer le menu"
          >
            <Icon icon="mdi:menu" className="text-xl" />
          </button>
          <h2 className="text-sm font-semibold text-sand-900 truncate">{getPageTitle()}</h2>
        </div>

        {/* Droite : recherche + actions */}
        <div className="flex items-center gap-1">
          {/* Recherche globale */}
          <div className="hidden md:block relative">
            <div className="flex items-center gap-2 h-10 px-3.5 rounded-xl bg-sand-100 text-sand-500 text-sm w-72 focus-within:ring-2 focus-within:ring-terracotta-500/40">
              <Icon icon="mdi:magnify" className="text-lg shrink-0" />
              <input
                value={q}
                onChange={(e) => { setQ(e.target.value); setSearchOpen(true); }}
                onFocus={() => { chargerRecherche(); setSearchOpen(true); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && resultats[0]) choisirResultat(resultats[0]);
                  if (e.key === 'Escape') { setQ(''); setSearchOpen(false); }
                }}
                placeholder="Rechercher un écran, un produit, un client…"
                className="flex-1 bg-transparent outline-none text-sand-900 placeholder:text-sand-400"
              />
              {q && (
                <button onClick={() => { setQ(''); setSearchOpen(false); }} className="text-sand-400 hover:text-sand-600 shrink-0">
                  <Icon icon="mdi:close-circle" className="text-base" />
                </button>
              )}
            </div>

            {searchOpen && q.trim() && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setSearchOpen(false)} />
                <div className="absolute right-0 mt-2 w-80 max-h-[70vh] overflow-y-auto bg-white rounded-xl border border-sand-200 shadow-overlay z-30">
                  {resultats.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-sand-500">Aucun résultat pour « {q} »</div>
                  ) : (
                    groupes.map((g) => {
                      const items = resultats.filter((r) => r.type === g.cle);
                      if (items.length === 0) return null;
                      return (
                        <div key={g.cle} className="py-1.5">
                          <p className="px-4 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sand-400">{g.titre}</p>
                          {items.map((r, i) => (
                            <button
                              key={`${g.cle}-${i}`}
                              onClick={() => choisirResultat(r)}
                              className="w-full flex items-center gap-3 px-4 py-2 hover:bg-sand-50 transition-colors text-left"
                            >
                              <span className="w-8 h-8 rounded-lg bg-sand-100 text-sand-600 flex items-center justify-center shrink-0">
                                <Icon icon={r.icon} className="text-lg" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-medium text-sand-900 truncate">{r.label}</span>
                                {r.sous && <span className="block text-xs text-sand-500 capitalize truncate">{r.sous}</span>}
                              </span>
                              <Icon icon="mdi:arrow-top-left" className="text-sand-300 shrink-0" />
                            </button>
                          ))}
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>

          {/* Alertes rupture de stock */}
          <div className="relative">
            <button
              onClick={() => setShowAlerts((v) => !v)}
              className="relative w-10 h-10 rounded-xl text-sand-500 hover:bg-sand-100 flex items-center justify-center transition-colors"
              title={nbAlertes > 0 ? `${nbAlertes} alerte(s) de stock` : 'Aucune alerte de stock'}
            >
              <Icon icon={nbAlertes > 0 ? 'mdi:bell-alert-outline' : 'mdi:bell-outline'} className={`text-xl ${nbAlertes > 0 ? 'text-danger-600' : ''}`} />
              {nbAlertes > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 rounded-full bg-danger-500 text-white text-[9px] font-semibold flex items-center justify-center ring-2 ring-white">
                  {nbAlertes > 9 ? '9+' : nbAlertes}
                </span>
              )}
            </button>

            {showAlerts && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowAlerts(false)} />
                <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-xl border border-sand-200 shadow-overlay z-30 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-sand-100 bg-sand-50">
                    <Icon icon="mdi:alert-circle-outline" className="text-lg text-danger-600" />
                    <h3 className="text-sm font-semibold text-sand-900">Alertes de stock</h3>
                    {nbAlertes > 0 && (
                      <span className="ml-auto text-xs font-semibold text-danger-700 bg-danger-50 px-2 py-0.5 rounded-full">{nbAlertes}</span>
                    )}
                  </div>

                  {nbAlertes === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <Icon icon="mdi:check-circle-outline" className="text-3xl text-success-500 mx-auto mb-2" />
                      <p className="text-sm text-sand-500">Aucune rupture · tous les stocks sont au-dessus du seuil.</p>
                    </div>
                  ) : (
                    <>
                      <div className="max-h-80 overflow-y-auto divide-y divide-sand-100">
                        {alertes.map((m) => {
                          const rupture = m.stockActuel <= 0;
                          return (
                            <button
                              key={m.id}
                              onClick={allerAuStock}
                              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-sand-50 transition-colors text-left"
                            >
                              <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${rupture ? 'bg-danger-50 text-danger-600' : 'bg-warning-50 text-warning-600'}`}>
                                <Icon icon={rupture ? 'mdi:alert-octagon-outline' : 'mdi:alert-outline'} className="text-lg" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-medium text-sand-900 truncate uppercase">{m.nom}</span>
                                <span className="block text-xs text-sand-500 tabular-nums">
                                  Stock : {formaterQuantite(m.stockActuel, m.unite)} · seuil {formaterQuantite(m.stockMinimum, m.unite)}
                                </span>
                              </span>
                              <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${rupture ? 'bg-danger-100 text-danger-700' : 'bg-warning-100 text-warning-700'}`}>
                                {rupture ? 'Rupture' : 'Bas'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <button
                        onClick={allerAuStock}
                        className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 border-t border-sand-100 text-sm font-semibold text-terracotta-600 hover:bg-sand-50 transition-colors"
                      >
                        Gérer les stocks <Icon icon="mdi:arrow-right" className="text-base" />
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
