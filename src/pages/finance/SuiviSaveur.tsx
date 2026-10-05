import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import { useReferentielStore } from '../../store/referentielStore';
import { usePosStore } from '../../store/posStore';
import { useBoutiqueStore } from '../../store/boutiqueStore';
import { useFacturationStore } from '../../store/facturationStore';
import { useSaveurStore, type Saveur } from '../../store/saveurStore';
import { formatCurrency } from '../../utils/currency';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Modal } from '../../components/ui/Modal';
import { genererRapportSaveurPDF, exporterSaveurCSV, type TypeRapportSaveur, type VenteSaveurDetail } from '../../utils/saveurReport';
import { determinerSaveur, estSamoussa, normaliserTexte } from '../../utils/saveurUtils';

const SAVEURS: { key: Saveur; label: string; icon: string }[] = [
  { key: 'sale', label: 'Salé', icon: 'mdi:cheese' },
  { key: 'sucre', label: 'Sucré', icon: 'mdi:cupcake' },
];

type VentesMap = Record<string, { qty: number; valeur: number }>;

// Cache mémoire des agrégats de ventes (évite de relire Firestore à chaque
// bascule de source/période). Clé = type:debut:fin[:payées]. TTL 3 min.
const _ventesCache = new Map<string, { t: number; data: VentesMap }>();
const CACHE_TTL = 3 * 60 * 1000;
async function ventesEnCache(cle: string, charger: () => Promise<VentesMap>): Promise<VentesMap> {
  const hit = _ventesCache.get(cle);
  if (hit && Date.now() - hit.t < CACHE_TTL) return hit.data;
  const data = await charger();
  _ventesCache.set(cle, { t: Date.now(), data });
  return data;
}
// Cache de la première date d'activité Salé / Sucré (achats de courses)
let _premiereDateSaveurCache: { t: number; val: string | null } | null = null;

export const SuiviSaveur: React.FC = () => {
  const { produits, chargerProduits, clients, chargerClients, ajouterProduit, modifierProduit } = useReferentielStore();
  const { getVentesParProduitPeriode, getVentesPOSDetaillees } = usePosStore();
  const { getVentesBoutiqueParProduit, getVentesBoutiqueDetaillees } = useBoutiqueStore();
  const { getVentesFactureParProduit, getVentesFactureDetaillees } = useFacturationStore();
  const { achats, chargerAchats, ajouterAchat, supprimerAchat, getPremiereDateAchat } = useSaveurStore();

  const [creantSamoussa, setCreantSamoussa] = useState(false);
  const syncedProductIdsRef = useRef<Set<string>>(new Set());

  // Auto-synchronisation protégée : ne s'exécute qu'une seule fois par produit non synchronisé
  // pour éliminer toute boucle ou requête Firestore redondante.
  useEffect(() => {
    if (produits.length === 0) return;
    const aMettreAJour = produits.filter(p => !p.saveur && !syncedProductIdsRef.current.has(p.id));
    if (aMettreAJour.length === 0) return;

    aMettreAJour.forEach(p => {
      syncedProductIdsRef.current.add(p.id);
      const auto = determinerSaveur(undefined, p.nom);
      if (auto) {
        modifierProduit(p.id, { saveur: auto }).catch(err => {
          console.warn('Auto-saveur sync failed for', p.nom, err);
        });
      }
    });
  }, [produits, modifierProduit]);

  const handleCreerSamoussa = async () => {
    setCreantSamoussa(true);
    try {
      await ajouterProduit({
        nom: 'Samoussa',
        saveur: 'sale',
        categorie: 'viennoiserie',
        unite: 'piece',
        prixBoutique: 250,
        prixClient: 200,
        active: true,
      });
      toast.success('Produit Samoussa ajouté avec succès au catalogue Salé !');
    } catch (e) {
      console.error(e);
      toast.error('Erreur lors de la création du produit Samoussa');
    } finally {
      setCreantSamoussa(false);
    }
  };

  const [periode, setPeriode] = useState(() => {
    const now = new Date();
    return {
      debut: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
      fin: now.toISOString().split('T')[0],
    };
  });
  const [source, setSource] = useState<'caisse' | 'boutique' | 'livraison' | 'toutes'>('toutes');
  const [payeesUniquement, setPayeesUniquement] = useState(false);
  const [ventesBrutes, setVentesBrutes] = useState<{ pos: VentesMap; bout: VentesMap; liv: VentesMap }>({ pos: {}, bout: {}, liv: {} });
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState<{ montant: string; saveur: Saveur; date: string; note: string }>(() => ({
    montant: '', saveur: 'sale', date: new Date().toISOString().split('T')[0], note: '',
  }));
  const [saving, setSaving] = useState(false);
  const [achatASupprimer, setAchatASupprimer] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [typeRapport, setTypeRapport] = useState<TypeRapportSaveur>('sale');

  useEffect(() => { if (produits.length === 0) chargerProduits(); }, [produits.length, chargerProduits]);
  useEffect(() => { if (clients.length === 0) chargerClients(); }, [clients.length, chargerClients]);

  // Vraie première date d'achat d'investissement Salé/Sucré (dans saveur_achats)
  const [debutPremierAchat, setDebutPremierAchat] = useState<string | null>(() => _premiereDateSaveurCache?.val || null);
  useEffect(() => {
    let annule = false;
    (async () => {
      if (_premiereDateSaveurCache && Date.now() - _premiereDateSaveurCache.t < CACHE_TTL) {
        if (!annule) setDebutPremierAchat(_premiereDateSaveurCache.val);
        return;
      }
      const d = await getPremiereDateAchat();
      _premiereDateSaveurCache = { t: Date.now(), val: d };
      if (!annule) setDebutPremierAchat(d);
    })();
    return () => { annule = true; };
  }, [getPremiereDateAchat]);

  // Date du plus ancien achat actuellement en mémoire (achats chargés)
  const plusAncienAchatEnMemoire = useMemo(() => {
    if (achats.length === 0) return null;
    const dates = achats.map(a => a.date).filter(Boolean).sort();
    const d = dates[0] || null;
    return d && d >= '2026-01-01' ? d : null;
  }, [achats]);

  // Date du plus ancien produit tagué salé/sucré (exclut les dates d'initialisation de 2025)
  const debutPremierProduit = useMemo(() => {
    const toDate = (v: any): Date | null => {
      if (!v) return null;
      if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
      if (typeof v.toDate === 'function') return v.toDate();
      if (typeof v.seconds === 'number') return new Date(v.seconds * 1000);
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    };
    const dates = produits
      .filter(p => determinerSaveur(p.saveur, p.nom) === 'sale' || determinerSaveur(p.saveur, p.nom) === 'sucre')
      .map(p => toDate(p.createdAt))
      .filter((d): d is Date => d !== null);
    if (dates.length === 0) return null;
    const minD = new Date(Math.min(...dates.map(d => d.getTime())));
    const iso = minD.toISOString().split('T')[0];
    if (iso < '2026-01-01') return null; // Ignore les résidus de template 2025
    return iso;
  }, [produits]);

  // Date de départ « Depuis le début » :
  // Priorité absolue au premier achat d'ingrédients / investissements Salé/Sucré,
  // ou plus ancien achat en mémoire, ou création du 1er produit salé/sucré.
  // Ne renvoie JAMAIS les factures générales de 2025.
  const debutDepuisLeDebut = useMemo(() => {
    const candidats = [debutPremierAchat, plusAncienAchatEnMemoire, debutPremierProduit]
      .filter((d): d is string => !!d && d >= '2026-01-01')
      .sort();
    if (candidats.length > 0) return candidats[0];
    // Repli de sécurité : 1er du mois en cours
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  }, [debutPremierAchat, plusAncienAchatEnMemoire, debutPremierProduit]);

  const presetChoisiRef = React.useRef<'mois' | '3mois' | 'debut' | null>(null);

  const debutPreset = (k: 'mois' | '3mois' | 'debut'): string => {
    const now = new Date();
    if (k === 'mois') return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    if (k === '3mois') return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).toISOString().split('T')[0];
    return debutDepuisLeDebut;
  };

  const appliquerPreset = (k: 'mois' | '3mois' | 'debut') => {
    presetChoisiRef.current = k;
    setPeriode({ debut: debutPreset(k), fin: new Date().toISOString().split('T')[0] });
  };

  // Synchronise automatiquement periode.debut si le preset 'debut' est actif et que la date réelle est chargée
  useEffect(() => {
    if (presetChoisiRef.current === 'debut' && debutDepuisLeDebut) {
      setPeriode(p => ({ ...p, debut: debutDepuisLeDebut }));
    }
  }, [debutDepuisLeDebut]);

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
      // En mode Boutique « Avancé », shopSales est alimenté depuis la caisse (POS) :
      // additionner Caisse + Boutique doublerait. « Toutes » prend donc UN SEUL
      // canal comptoir selon le mode (POS si avancé, boutique si classique) + livraison.
      // Correction : la Caisse POS doit TOUJOURS être incluse dans Toutes pour ne pas
      // masquer les ventes comptoir enregistrées en caisse.
      const modeBoutique = (typeof localStorage !== 'undefined' && localStorage.getItem('cm.boutique.mode')) || 'classique';
      const avance = modeBoutique !== 'classique';
      let inclCaisse: boolean, inclBoutique: boolean, inclLivraison: boolean;
      if (source === 'toutes') {
        inclLivraison = true;
        inclCaisse = true;        // Toujours inclure la caisse (POS)
        inclBoutique = !avance;   // Boutique uniquement si pas en mode avancé (pour éviter doublon POS)
      } else {
        inclCaisse = source === 'caisse';
        inclBoutique = source === 'boutique';
        inclLivraison = source === 'livraison';
      }
      const dk = periode.debut, fk = periode.fin;
      const [pos, bout, liv] = await Promise.all([
        inclCaisse ? ventesEnCache(`pos:${dk}:${fk}`, () => getVentesParProduitPeriode(debut, fin)) : Promise.resolve(vide),
        inclBoutique ? ventesEnCache(`bout:${dk}:${fk}`, () => getVentesBoutiqueParProduit(debut, fin)) : Promise.resolve(vide),
        inclLivraison ? ventesEnCache(`liv:${dk}:${fk}:${payeesUniquement}`, () => getVentesFactureParProduit(debut, fin, payeesUniquement)) : Promise.resolve(vide),
      ]);
      setVentesBrutes({ pos, bout, liv });
      await chargerAchats(debut, fin);
      if (!annule) { setLoading(false); }
    })();
    return () => { annule = true; };
  }, [periode.debut, periode.fin, source, payeesUniquement, getVentesParProduitPeriode, getVentesBoutiqueParProduit, getVentesFactureParProduit, chargerAchats]);

  // Index rapide des produits en mémoire (recherche en O(1) sans recalcul de normalisation)
  const produitsIndex = useMemo(() => {
    const byId = new Map<string, typeof produits[0]>();
    const byNomNorm = new Map<string, typeof produits[0]>();
    produits.forEach(p => {
      byId.set(p.id, p);
      if (p.nom) byNomNorm.set(normaliserTexte(p.nom), p);
    });
    return { byId, byNomNorm };
  }, [produits]);

  const trouverProduit = useCallback((idOrNom: string) => {
    if (!idOrNom) return undefined;
    const direct = produitsIndex.byId.get(idOrNom);
    if (direct) return direct;
    return produitsIndex.byNomNorm.get(normaliserTexte(idOrNom));
  }, [produitsIndex]);

  // Agrégat des ventes par produit : calculé en mémoire en temps quasi-nul (< 1 ms),
  // sans jamais refaire d'appel réseau vers Firestore quand les produits changent !
  const ventesProduit = useMemo(() => {
    const combined: Record<string, { qty: number; valeur: number }> = {};
    [ventesBrutes.pos, ventesBrutes.bout, ventesBrutes.liv].forEach(src => {
      Object.entries(src).forEach(([idOrNom, v]) => {
        const prod = trouverProduit(idOrNom);
        const targetKey = prod ? prod.id : idOrNom;
        if (!combined[targetKey]) combined[targetKey] = { qty: 0, valeur: 0 };
        combined[targetKey].qty += v.qty;
        combined[targetKey].valeur += v.valeur;
      });
    });
    return combined;
  }, [ventesBrutes, trouverProduit]);

  const saveurDe = useCallback((idOrNom: string): Saveur | undefined => {
    const prod = trouverProduit(idOrNom);
    if (prod) {
      return determinerSaveur(prod.saveur, prod.nom);
    }
    return determinerSaveur(undefined, idOrNom);
  }, [trouverProduit]);

  // Agrégat ventes par saveur
  const ventesParSaveur = useMemo(() => {
    const agg: Record<Saveur, { qty: number; valeur: number }> = { sale: { qty: 0, valeur: 0 }, sucre: { qty: 0, valeur: 0 } };
    Object.entries(ventesProduit).forEach(([idOrNom, v]) => {
      const s = saveurDe(idOrNom);
      if (s === 'sale' || s === 'sucre') { agg[s].qty += v.qty; agg[s].valeur += v.valeur; }
    });
    return agg;
  }, [ventesProduit, saveurDe]);

  // Coût d'investissement par saveur (journal d'achats)
  const coutParSaveur = useMemo(() => {
    const agg: Record<Saveur, number> = { sale: 0, sucre: 0 };
    achats.forEach(a => { agg[a.saveur] = (agg[a.saveur] || 0) + a.montant; });
    return agg;
  }, [achats]);

  const produitsDe = useCallback((s: Saveur) => {
    // 1. Tous les produits du catalogue qui correspondent à cette saveur
    const prods = produits.filter(p => determinerSaveur(p.saveur, p.nom) === s);

    // Mappe avec les ventes (ou 0 si aucune vente sur la période)
    const list: Array<{ id?: string; nom: string; qty: number; valeur: number }> = prods.map(p => {
      const v = ventesProduit[p.id] || { qty: 0, valeur: 0 };
      return { id: p.id, nom: p.nom, qty: v.qty, valeur: v.valeur };
    });

    // 2. Inclut également d'éventuelles ventes orphelines ayant cette saveur
    Object.entries(ventesProduit).forEach(([idOrNom, v]) => {
      if (v.qty === 0) return;
      const dejaPresent = list.some(item => item.id === idOrNom || normaliserTexte(item.nom) === normaliserTexte(idOrNom));
      if (!dejaPresent) {
        const sav = saveurDe(idOrNom);
        if (sav === s) {
          list.push({ id: idOrNom, nom: idOrNom, qty: v.qty, valeur: v.valeur });
        }
      }
    });

    return list.sort((a, b) => b.valeur - a.valeur || a.nom.localeCompare(b.nom));
  }, [produits, ventesProduit, saveurDe]);

  // Totaux globaux
  const totalVentes = ventesParSaveur.sale.valeur + ventesParSaveur.sucre.valeur;
  const totalQty = ventesParSaveur.sale.qty + ventesParSaveur.sucre.qty;
  const totalCout = coutParSaveur.sale + coutParSaveur.sucre;
  const totalMarge = totalVentes - totalCout;
  const totalRoi = totalCout > 0 ? (totalMarge / totalCout) * 100 : null;

  const recupererVentesDetaillees = async (): Promise<VenteSaveurDetail[]> => {
    const debut = new Date(periode.debut + 'T00:00:00');
    const fin = new Date(periode.fin + 'T23:59:59');
    const modeBoutique = (typeof localStorage !== 'undefined' && localStorage.getItem('cm.boutique.mode')) || 'classique';
    const avance = modeBoutique !== 'classique';
    let inclCaisse: boolean, inclBoutique: boolean, inclLivraison: boolean;
    if (source === 'toutes') {
      inclLivraison = true;
      inclCaisse = true;
      inclBoutique = !avance;
    } else {
      inclCaisse = source === 'caisse';
      inclBoutique = source === 'boutique';
      inclLivraison = source === 'livraison';
    }

    const [posLignes, boutLignes, livLignes] = await Promise.all([
      inclCaisse ? getVentesPOSDetaillees(debut, fin) : Promise.resolve([]),
      inclBoutique ? getVentesBoutiqueDetaillees(debut, fin) : Promise.resolve([]),
      inclLivraison ? getVentesFactureDetaillees(debut, fin, payeesUniquement) : Promise.resolve([]),
    ]);

    const clientMap = new Map<string, string>();
    clients.forEach((c) => {
      const nom = c.prenom ? `${c.prenom} ${c.nom}` : c.nom;
      if (nom) clientMap.set(c.id, nom);
    });

    const produitMap = new Map<string, { nom: string; saveur?: Saveur }>();
    produits.forEach((p) => {
      const sav = determinerSaveur(p.saveur, p.nom);
      produitMap.set(p.id, { nom: p.nom, saveur: sav });
      produitMap.set(normaliserTexte(p.nom), { nom: p.nom, saveur: sav });
    });

    const res: VenteSaveurDetail[] = [];

    // Factures (Livraison)
    livLignes.forEach((l) => {
      const prod = produitMap.get(l.produitId) || produitMap.get(normaliserTexte(l.nomProduit || l.produitId));
      const saveur = prod?.saveur || determinerSaveur(undefined, l.nomProduit || l.produitId);
      if (saveur !== 'sale' && saveur !== 'sucre') return;
      const nomCl = clientMap.get(l.clientId) || l.clientNom || 'Client';
      res.push({
        date: l.date,
        clientNom: nomCl,
        produitNom: prod?.nom || l.nomProduit || 'Article',
        saveur,
        quantite: l.quantite,
        valeur: l.montant,
        source: 'livraison',
        numeroFacture: l.numeroFacture,
      });
    });

    // POS (Caisse)
    posLignes.forEach((l) => {
      const prod = produitMap.get(l.produitId) || produitMap.get(normaliserTexte(l.nomProduit || l.produitId));
      const saveur = prod?.saveur || determinerSaveur(undefined, l.nomProduit || l.produitId);
      if (saveur !== 'sale' && saveur !== 'sucre') return;
      res.push({
        date: l.date,
        clientNom: 'Vente Caisse (Comptoir)',
        produitNom: prod?.nom || l.nomProduit || 'Article',
        saveur,
        quantite: l.quantite,
        valeur: l.montant,
        source: 'caisse',
        numeroFacture: l.numeroFacture,
      });
    });

    // Boutique
    boutLignes.forEach((l) => {
      const prod = produitMap.get(l.produitId) || produitMap.get(normaliserTexte(l.nomProduit || l.produitId));
      const saveur = prod?.saveur || determinerSaveur(undefined, l.nomProduit || l.produitId);
      if (saveur !== 'sale' && saveur !== 'sucre') return;
      res.push({
        date: l.date,
        clientNom: 'Vente Boutique',
        produitNom: prod?.nom || l.nomProduit || 'Article',
        saveur,
        quantite: l.quantite,
        valeur: l.montant,
        source: 'boutique',
        numeroFacture: l.numeroFacture,
      });
    });

    return res;
  };

  const handleGenererPDF = async (choix?: TypeRapportSaveur) => {
    const typeChoisi = choix || typeRapport;
    try {
      setGeneratingPdf(true);
      const ventesDetaillees = await recupererVentesDetaillees();
      await genererRapportSaveurPDF({
        periode,
        source,
        payeesUniquement,
        typeSelection: typeChoisi,
        ventesParSaveur,
        coutParSaveur,
        produitsSale: produitsDe('sale').filter(p => p.qty > 0),
        produitsSucre: produitsDe('sucre').filter(p => p.qty > 0),
        achats,
        ventesDetaillees,
      });
      toast.success('Rapport PDF généré avec succès');
      setShowReportModal(false);
    } catch (e) {
      console.error('Erreur génération rapport PDF:', e);
      toast.error('Erreur lors de la génération du rapport PDF');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleExporterCSV = async (choix?: TypeRapportSaveur) => {
    const typeChoisi = choix || typeRapport;
    try {
      const ventesDetaillees = await recupererVentesDetaillees();
      exporterSaveurCSV({
        periode,
        source,
        payeesUniquement,
        typeSelection: typeChoisi,
        ventesParSaveur,
        coutParSaveur,
        produitsSale: produitsDe('sale').filter(p => p.qty > 0),
        produitsSucre: produitsDe('sucre').filter(p => p.qty > 0),
        achats,
        ventesDetaillees,
      });
      toast.success('Export CSV téléchargé');
      setShowReportModal(false);
    } catch (e) {
      console.error('Erreur export CSV:', e);
      toast.error("Erreur lors de l'export CSV");
    }
  };

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
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
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
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <button
                onClick={() => setShowReportModal(true)}
                disabled={loading || generatingPdf}
                className="h-9 inline-flex items-center justify-center gap-2 px-3.5 bg-sand-900 hover:bg-sand-800 text-white rounded-lg text-xs sm:text-sm font-medium transition-all shadow-sm active:scale-[0.98] disabled:opacity-50 shrink-0"
                title="Générer un rapport (Salé, Sucré ou les deux)"
              >
                <Icon
                  icon={generatingPdf ? 'mdi:loading' : 'mdi:file-pdf-box'}
                  className={`text-base sm:text-lg text-red-400 ${generatingPdf ? 'animate-spin' : ''}`}
                />
                <span>{generatingPdf ? 'Génération…' : 'Générer Rapport'}</span>
              </button>

              <button
                onClick={() => setShowReportModal(true)}
                disabled={loading}
                className="h-9 inline-flex items-center justify-center gap-1.5 px-3 bg-white border border-sand-300 hover:bg-sand-50 text-sand-700 rounded-lg text-xs sm:text-sm font-medium transition-colors shadow-sm disabled:opacity-50 shrink-0"
                title="Exporter les données au format CSV (compatible Excel)"
              >
                <Icon icon="mdi:file-delimited-outline" className="text-base sm:text-lg text-emerald-600" />
                <span>Export CSV</span>
              </button>

              <div className="h-5 w-px bg-sand-200 hidden sm:block mx-0.5" />

              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={periode.debut}
                  max={periode.fin}
                  onChange={(e) => setPeriode(p => ({ ...p, debut: e.target.value }))}
                  className="h-9 px-2.5 border border-sand-300 rounded-lg bg-white text-xs sm:text-sm text-sand-900 focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
                />
                <span className="text-sand-400 text-xs sm:text-sm">→</span>
                <input
                  type="date"
                  value={periode.fin}
                  min={periode.debut}
                  onChange={(e) => setPeriode(p => ({ ...p, fin: e.target.value }))}
                  className="h-9 px-2.5 border border-sand-300 rounded-lg bg-white text-xs sm:text-sm text-sand-900 focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {([
                { k: 'mois', l: 'Ce mois' },
                { k: '3mois', l: '3 mois' },
                { k: 'debut', l: 'Depuis le début' },
              ] as { k: 'mois' | '3mois' | 'debut'; l: string }[]).map(p => (
                <button
                  key={p.k}
                  onClick={() => appliquerPreset(p.k)}
                  disabled={p.k === 'debut' && !debutDepuisLeDebut}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-medium border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    presetActif === p.k
                      ? 'bg-terracotta-600 border-terracotta-600 text-white'
                      : 'bg-white border-sand-200 text-sand-600 hover:bg-sand-50'
                  }`}
                >
                  {p.l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Source des ventes */}
        <div className="bg-white rounded-2xl border border-sand-200 shadow-card p-3 sm:p-4 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <span className="text-sm font-medium text-sand-700 shrink-0">Source des ventes :</span>
            <div className="inline-flex items-center p-1 rounded-xl bg-sand-100 border border-sand-200 self-start">
              {([
                { v: 'caisse', l: 'Caisse' },
                { v: 'boutique', l: 'Boutique' },
                { v: 'livraison', l: 'Livraison' },
                { v: 'toutes', l: 'Toutes' },
              ] as { v: typeof source; l: string }[]).map(o => (
                <button key={o.v} onClick={() => setSource(o.v)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${source === o.v ? 'bg-white text-sand-900 shadow-sm' : 'text-sand-500 hover:text-sand-700'}`}>
                  {o.l}
                </button>
              ))}
            </div>
            {/* Filtre payées (uniquement pertinent quand la livraison est incluse) */}
            {(source === 'livraison' || source === 'toutes') && (
              <label className="flex items-center gap-2 self-start sm:ml-1 cursor-pointer select-none">
                <button type="button" role="switch" aria-checked={payeesUniquement}
                  onClick={() => setPayeesUniquement(v => !v)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${payeesUniquement ? 'bg-terracotta-600' : 'bg-sand-300'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${payeesUniquement ? 'translate-x-4' : ''}`} />
                </button>
                <span className="text-xs font-medium text-sand-600">Factures payées seulement</span>
              </label>
            )}
          </div>
          <p className="text-[11px] text-sand-400">
            <b>Toutes</b> = comptoir + livraison, <b>sans double comptage</b> : le comptoir est pris depuis la <b>caisse</b> si Boutique est en mode « Avancé », sinon depuis la <b>boutique</b> (car en Avancé, boutique = caisse). Les options <b>Caisse</b> / <b>Boutique</b> / <b>Livraison</b> servent à inspecter une source isolée.
          </p>
        </div>

        {/* Synthèse globale combinée */}
        <div className="bg-white rounded-2xl border border-sand-200 shadow-card p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-sand-100">
            <div className="flex items-center gap-2">
              <Icon icon="mdi:chart-box-outline" className="text-xl text-terracotta-600" />
              <h2 className="font-display text-sm sm:text-base font-semibold text-sand-900">
                Synthèse Globale Salé + Sucré
              </h2>
            </div>
            <div className="text-xs text-sand-500 tabular-nums">
              Total volume :{' '}
              {loading ? (
                <span className="inline-block w-8 h-3.5 bg-sand-200 animate-pulse rounded align-middle" />
              ) : (
                <>
                  <span className="font-semibold text-sand-900">{totalQty}</span> unité{totalQty > 1 ? 's' : ''}
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3.5">
            <div className="bg-sand-50 rounded-xl p-3 border border-sand-100">
              <div className="text-[11px] font-medium text-sand-500 mb-0.5">Chiffre d'Affaires</div>
              <div className="font-display text-base sm:text-lg font-semibold text-sand-900 tabular-nums">
                {loading ? <div className="h-5 w-20 bg-sand-200 rounded animate-pulse my-0.5" /> : formatCurrency(totalVentes)}
              </div>
            </div>
            <div className="bg-sand-50 rounded-xl p-3 border border-sand-100">
              <div className="text-[11px] font-medium text-sand-500 mb-0.5">Coûts d'Achats</div>
              <div className="font-display text-base sm:text-lg font-semibold text-danger-600 tabular-nums">
                {loading ? <div className="h-5 w-20 bg-sand-200 rounded animate-pulse my-0.5" /> : formatCurrency(totalCout)}
              </div>
            </div>
            <div className="bg-sand-50 rounded-xl p-3 border border-sand-100">
              <div className="text-[11px] font-medium text-sand-500 mb-0.5">Marge Nette Globale</div>
              <div className={`font-display text-base sm:text-lg font-semibold tabular-nums ${totalMarge >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                {loading ? <div className="h-5 w-20 bg-sand-200 rounded animate-pulse my-0.5" /> : `${totalMarge >= 0 ? '+' : ''}${formatCurrency(totalMarge)}`}
              </div>
            </div>
            <div className="bg-sand-50 rounded-xl p-3 border border-sand-100">
              <div className="text-[11px] font-medium text-sand-500 mb-0.5">Rentabilité (ROI)</div>
              <div className="font-display text-base sm:text-lg font-semibold text-sand-900 tabular-nums">
                {loading ? <div className="h-5 w-16 bg-sand-200 rounded animate-pulse my-0.5" /> : (totalRoi !== null ? `${totalRoi >= 0 ? '+' : ''}${totalRoi.toFixed(1)} %` : '—')}
              </div>
            </div>
          </div>
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
                  <span className="ml-auto text-xs text-sand-500 tabular-nums">
                    {loading ? (
                      <span className="inline-block w-12 h-3 bg-sand-200 animate-pulse rounded" />
                    ) : (
                      `${ventes.qty} vendu(s)`
                    )}
                  </span>
                </div>

                <div className="grid grid-cols-3 divide-x divide-sand-200 border-b border-sand-200 tabular-nums">
                  <div className="px-4 py-3">
                    <div className="text-[11px] text-sand-500">Ventes</div>
                    <div className="font-display text-base sm:text-lg font-semibold text-success-600">
                      {loading ? <div className="h-5 w-16 bg-sand-200 rounded animate-pulse my-0.5" /> : formatCurrency(ventes.valeur)}
                    </div>
                  </div>
                  <div className="px-4 py-3">
                    <div className="text-[11px] text-sand-500">Coût d'achat</div>
                    <div className="font-display text-base sm:text-lg font-semibold text-danger-600">
                      {loading ? <div className="h-5 w-16 bg-sand-200 rounded animate-pulse my-0.5" /> : formatCurrency(cout)}
                    </div>
                  </div>
                  <div className="px-4 py-3">
                    <div className="text-[11px] text-sand-500">Marge {roi !== null && <span className="text-sand-400">({roi >= 0 ? '+' : ''}{roi.toFixed(0)}%)</span>}</div>
                    <div className={`font-display text-base sm:text-lg font-semibold ${marge >= 0 ? 'text-sand-900' : 'text-danger-600'}`}>
                      {loading ? <div className="h-5 w-16 bg-sand-200 rounded animate-pulse my-0.5" /> : `${marge >= 0 ? '+' : ''}${formatCurrency(marge)}`}
                    </div>
                  </div>
                </div>

                {/* Bannière d'aide pour Samoussa si absent du catalogue */}
                {s.key === 'sale' && !produits.some(p => estSamoussa(p.nom)) && (
                  <div className="mx-4 my-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs">
                    <div className="flex items-center gap-2 text-amber-900">
                      <Icon icon="mdi:information-outline" className="text-base text-amber-700 shrink-0" />
                      <span>Le produit <b>Samoussa</b> n'est pas encore présent dans le catalogue.</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCreerSamoussa}
                      disabled={creantSamoussa}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-terracotta-600 hover:bg-terracotta-700 text-white rounded-lg font-medium text-xs shadow-sm transition-all shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      <Icon icon={creantSamoussa ? "mdi:loading" : "mdi:plus"} className={`text-sm ${creantSamoussa ? 'animate-spin' : ''}`} />
                      <span>Ajouter Samoussa au catalogue Salé</span>
                    </button>
                  </div>
                )}

                {/* Détail produits */}
                {loading ? (
                  <div className="py-10 flex flex-col items-center justify-center gap-2.5 text-sand-500">
                    <Icon icon="mdi:loading" className="text-2xl text-terracotta-600 animate-spin" />
                    <span className="text-xs text-sand-400 font-medium">Chargement des données…</span>
                  </div>
                ) : items.length === 0 ? (
                  <div className="px-5 py-6 text-center text-sm text-sand-400">Aucun produit {s.label.toLowerCase()} sur la période.</div>
                ) : (
                  <div className="divide-y divide-sand-100">
                    {items.map((it, i) => (
                      <div key={i} className="flex items-center gap-3 px-5 py-2.5">
                        <span className="min-w-0 flex-1 text-sm text-sand-800 truncate uppercase flex items-center gap-2">
                          {it.nom}
                          {it.qty === 0 && (
                            <span className="text-[10px] normal-case px-1.5 py-0.5 rounded bg-sand-100 text-sand-500 font-normal">
                              0 vente
                            </span>
                          )}
                        </span>
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
          {loading ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-sand-500">
              <Icon icon="mdi:loading" className="text-2xl text-terracotta-600 animate-spin" />
              <span className="text-xs text-sand-400 font-medium">Chargement des achats…</span>
            </div>
          ) : achats.length === 0 ? (
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

      {/* Modal de génération de rapport avec choix du type */}
      <Modal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        title="Générer un rapport — Salé / Sucré"
        size="md"
      >
        <div className="p-4 sm:p-6 space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-sand-500 mb-2.5">
              Type de produits à inclure
            </label>
            <div className="space-y-2.5">
              {[
                {
                  id: 'sale' as const,
                  label: 'Salé uniquement',
                  badge: 'Par défaut',
                  desc: 'Ventes de produits salés et tickets de courses salés',
                  icon: 'mdi:cheese',
                  color: 'text-amber-700',
                  bg: 'bg-amber-100',
                  borderActive: 'border-amber-600 ring-2 ring-amber-500/20 bg-amber-50/50',
                },
                {
                  id: 'sucre' as const,
                  label: 'Sucré uniquement',
                  desc: 'Ventes de produits sucrés et tickets de courses sucrés',
                  icon: 'mdi:cupcake',
                  color: 'text-indigo-700',
                  bg: 'bg-indigo-100',
                  borderActive: 'border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/50',
                },
                {
                  id: 'tous' as const,
                  label: 'Les deux (Salé & Sucré)',
                  desc: 'Rapport complet avec comparatif, ventes salées & sucrées et tous les achats',
                  icon: 'mdi:scale-balance',
                  color: 'text-sand-800',
                  bg: 'bg-sand-200',
                  borderActive: 'border-sand-900 ring-2 ring-sand-900/10 bg-sand-100/60',
                },
              ].map((opt) => {
                const active = typeRapport === opt.id;
                return (
                  <div
                    key={opt.id}
                    onClick={() => setTypeRapport(opt.id)}
                    className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      active ? opt.borderActive : 'border-sand-200 hover:border-sand-300 hover:bg-sand-50/60'
                    }`}
                  >
                    <div className="pt-0.5">
                      <input
                        type="radio"
                        name="typeRapportSelection"
                        checked={active}
                        onChange={() => setTypeRapport(opt.id)}
                        className="w-4 h-4 text-terracotta-600 focus:ring-terracotta-500 cursor-pointer"
                      />
                    </div>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${opt.bg}`}>
                      <Icon icon={opt.icon} className={`text-lg ${opt.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-sand-900">{opt.label}</span>
                        {opt.badge && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-sand-500 mt-0.5 leading-relaxed">{opt.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rappel paramètres */}
          <div className="bg-sand-50 rounded-xl p-3 border border-sand-200 text-xs text-sand-600 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sand-500">Période :</span>
              <span className="font-medium text-sand-900">
                Du {new Date(periode.debut + 'T12:00:00').toLocaleDateString('fr-FR')} au{' '}
                {new Date(periode.fin + 'T12:00:00').toLocaleDateString('fr-FR')}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sand-500">Canal des ventes :</span>
              <span className="font-medium text-sand-900 capitalize">
                {source === 'toutes' ? 'Toutes sources (Comptoir + Livraison)' : source}
                {payeesUniquement ? ' (factures payées)' : ''}
              </span>
            </div>
            <div className="pt-1 border-t border-sand-200/60 flex items-center gap-1.5 text-[11px] text-terracotta-700">
              <Icon icon="mdi:information-outline" className="text-sm shrink-0" />
              <span>Inclut la répartition par client et le journal détaillé des ventes avec les dates.</span>
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-3 border-t border-sand-100">
            <button
              type="button"
              onClick={() => setShowReportModal(false)}
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-sand-600 hover:bg-sand-100 transition-colors"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => handleExporterCSV()}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-white border border-sand-300 hover:bg-sand-50 text-sand-800 rounded-xl text-xs sm:text-sm font-medium transition-colors shadow-sm"
              title="Exporter les données sélectionnées en CSV"
            >
              <Icon icon="mdi:file-delimited-outline" className="text-base text-emerald-600" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={() => handleGenererPDF()}
              disabled={generatingPdf}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-sand-900 hover:bg-sand-800 text-white rounded-xl text-xs sm:text-sm font-medium transition-all shadow-sm active:scale-[0.98] disabled:opacity-50"
            >
              <Icon
                icon={generatingPdf ? 'mdi:loading' : 'mdi:file-pdf-box'}
                className={`text-base text-red-400 ${generatingPdf ? 'animate-spin' : ''}`}
              />
              <span>{generatingPdf ? 'Génération…' : 'Télécharger le PDF'}</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
