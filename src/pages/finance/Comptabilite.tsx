import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStockStore } from '../../store/stockStore';
import { useDepenseStore } from '../../store/depenseStore';
import { useFacturationStore } from '../../store/facturationStore';
import { useBoutiqueStore } from '../../store/boutiqueStore';
import { usePosStore } from '../../store/posStore';
import { useReferentielStore } from '../../store/referentielStore';
import { DonutChart } from '../../components/ui';
import { Modal } from '../../components/ui/Modal';
import { Icon } from '@iconify/react';
import omLogo from '../../assets/om.svg';
import waveLogo from '../../assets/wave.svg';
import { TableauBordFinanceSimple } from '../../components/finance/TableauBordFinanceSimple';
import { firestoreService, dateToTimestamp } from '../../firebase/collections';
import { where, limit } from 'firebase/firestore';
import type { ProgrammeProduction } from '../../types/production';

type EncaissEntry = { source: 'caisse' | 'livraison'; label: string; ref?: string; montant: number; date: Date };
import {
    TrendingUp,
    TrendingDown,
    PieChart as PieChartIcon,
    Activity,
    RefreshCw,
    Coins,
    Calendar,
    FileText,
    ArrowRight
} from 'lucide-react';


export const Comptabilite: React.FC = () => {
    const [periode, setPeriode] = useState<{ debut: string, fin: string }>(() => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return {
            debut: startOfMonth.toISOString().split('T')[0],
            fin: now.toISOString().split('T')[0]
        };
    });

    const navigate = useNavigate();
    // 2 vues : 'simple' (Bilan & Résultat) et 'tresorerie' (Trésorerie & Caisse)
    const [vue, setVue] = useState<'simple' | 'tresorerie'>('simple');
    const [showFormulaInfo, setShowFormulaInfo] = useState(false);
    const [programmes, setProgrammes] = useState<ProgrammeProduction[]>([]);
    const [isActualisant, setIsActualisant] = useState(false);

    const [stats, setStats] = useState({
        caBoutique: 0,
        caPos: 0,
        caLivraison: 0,            // facturé (TTC) — vue Marge
        caLivraisonEncaisse: 0,    // réellement réglé (montantRegle) — vue Trésorerie
        achatsMatieres: 0,         // matières consommées (stock × PMP) — vue Marge
        achatsCash: 0,             // achats matières payés (mouvements 'achat') — vue Trésorerie
        autresCharges: 0,          // charges au prorata — vue Marge
        chargesCash: 0,            // dépenses payées (montant plein) — vue Trésorerie
        totalCouts: 0,
        depensesParCategorie: {} as Record<string, number>,       // prorata — vue Marge
        chargesCashParCategorie: {} as Record<string, number>,    // cash — vue Trésorerie
        detailMatieres: {} as Record<string, number>,
        posParMode: { espece: 0, om: 0, wave: 0 } as Record<'espece' | 'om' | 'wave', number>,   // encaissements POS par moyen
        factParMode: { espece: 0, om: 0, wave: 0 } as Record<'espece' | 'om' | 'wave', number>,  // règlements factures par moyen
        encaissementsDetail: { espece: [], om: [], wave: [] } as Record<'espece' | 'om' | 'wave', EncaissEntry[]>, // détail par moyen (qui/quand)
        loading: false
    });

    // Modal détail d'un moyen de paiement
    const [modeDetail, setModeDetail] = useState<'espece' | 'om' | 'wave' | null>(null);

    const { chargerDepenses, getDepensesProRata, depenses } = useDepenseStore();
    const { chargerFactures, factures } = useFacturationStore();
    const { getVentesPeriode } = useBoutiqueStore();
    const { getTicketsPeriode } = usePosStore();
    const { clients, chargerClients } = useReferentielStore();
    const { chargerDonnees: chargerStock, mouvements, matieres } = useStockStore();

    // Charger les données au montage et quand la période change (affichage direct à 0ms via Zustand)
    useEffect(() => {
        calculerStats();
        chargerDonnees();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [periode.debut, periode.fin]);

    // Recalculer les stats quand les données des stores changent
    useEffect(() => {
        calculerStats();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [factures, depenses, mouvements, matieres]);

    // ── Calculs dérivés selon la vue active ────────────────────────────
    const estTreso = vue === 'tresorerie';
    const caBoutiquePos = stats.caBoutique + stats.caPos;

    // Valeurs affichées (basculent selon la vue)
    const caLivraisonAffiche = estTreso ? stats.caLivraisonEncaisse : stats.caLivraison;
    const matieresAffiche = estTreso ? stats.achatsCash : stats.achatsMatieres;
    const chargesAffiche = estTreso ? stats.chargesCash : stats.autresCharges;
    const chargesParCategAffiche = estTreso ? stats.chargesCashParCategorie : stats.depensesParCategorie;
    const detailMatieresAffiche: Record<string, number> = estTreso ? {} : stats.detailMatieres;

    const totalRecettes = caBoutiquePos + caLivraisonAffiche;
    const totalCouts = matieresAffiche + chargesAffiche;
    const resultat = totalRecettes - totalCouts;
    const marge = totalRecettes > 0 ? (resultat / totalRecettes) * 100 : 0;

    // Écart Marge ↔ Trésorerie (créances + décalage achats/conso), pour info
    const ecartMargeTreso = (stats.caLivraison - stats.caLivraisonEncaisse);

    // Encaissements réels par moyen de paiement (POS + règlements factures)
    const encaissementsParMode = {
        espece: stats.posParMode.espece + stats.factParMode.espece,
        om: stats.posParMode.om + stats.factParMode.om,
        wave: stats.posParMode.wave + stats.factParMode.wave,
    };
    const totalEncaisseMode = encaissementsParMode.espece + encaissementsParMode.om + encaissementsParMode.wave;

    // Libellés
    const L = estTreso
        ? { recettes: 'Encaissements', couts: 'Sorties', resultat: 'Solde de caisse', livraison: 'Livraisons réglées', matieres: 'Achats stock' }
        : { recettes: 'Chiffre d\'affaires', couts: 'Coûts totaux', resultat: 'Bénéfice net', livraison: 'Livraisons facturées', matieres: 'Matières consommées' };

    const chargerDonnees = async (forceStock = false) => {
        setStats(prev => ({ ...prev, loading: true }));

        const debut = new Date(periode.debut);
        debut.setHours(0, 0, 0, 0);

        const fin = new Date(periode.fin);
        fin.setHours(23, 59, 59, 999);

        try {
            // Charger les référentiels en arrière-plan sans bloquer
            if (clients.length === 0) chargerClients().catch(() => {});

            const doitChargerStock = forceStock || matieres.length === 0 || mouvements.length === 0;

            // Chargement parallèle des sources indispensables
            const [caBoutique, , , , tickets] = await Promise.all([
                getVentesPeriode(debut, fin).catch(err => { console.warn('Erreur ventes boutique:', err); return 0; }),
                chargerFactures(debut, fin).catch(err => { console.warn('Erreur factures:', err); }),
                chargerDepenses(debut, fin).catch(err => { console.warn('Erreur dépenses:', err); }),
                (doitChargerStock ? chargerStock() : Promise.resolve()).catch(err => { console.warn('Erreur stock:', err); }),
                getTicketsPeriode(debut, fin).catch(err => { console.warn('Erreur tickets POS:', err); return []; })
            ]);

            // Charger les programmes de production en arrière-plan sans bloquer l'UI
            firestoreService.getByQuery<ProgrammeProduction>('productionPrograms', [
                where('dateProduction', '>=', dateToTimestamp(debut)),
                where('dateProduction', '<=', dateToTimestamp(fin)),
                limit(60)
            ]).then(progs => {
                if (progs && progs.length > 0) setProgrammes(progs);
            }).catch(err => {
                console.warn('Programme production comptabilité non disponible ou quota:', err?.message || err);
            });

            const clientsList = useReferentielStore.getState().clients;
            const nomClient = (id: string) => {
                const c = clientsList.find(cl => cl.id === id);
                return c ? [c.prenom, c.nom].filter(Boolean).join(' ') : 'Client';
            };
            const dateTicket = (t: any): Date => (t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt));

            const posParMode: Record<'espece' | 'om' | 'wave', number> = { espece: 0, om: 0, wave: 0 };
            const factParMode: Record<'espece' | 'om' | 'wave', number> = { espece: 0, om: 0, wave: 0 };
            const detail: Record<'espece' | 'om' | 'wave', EncaissEntry[]> = { espece: [], om: [], wave: [] };

            // Caisse (POS) : chaque ticket → qui (vendeur) / quand
            (tickets || []).forEach(t => {
                const m = t.modePaiement as 'espece' | 'om' | 'wave';
                if (m !== 'espece' && m !== 'om' && m !== 'wave') return;
                posParMode[m] += (t.total || 0);
                detail[m].push({
                    source: 'caisse',
                    label: t.vendeur || 'Caisse',
                    ref: `Ticket n°${t.numero}${t.type === 'retour' ? ' · retour' : ''}`,
                    montant: t.total || 0,
                    date: dateTicket(t),
                });
            });

            // Règlements livraisons : extraits instantanément des factures sans requête réseau supplémentaire
            let caLivraisonEncaisse = 0;
            const facturesDuStore = useFacturationStore.getState().factures;
            const facturesPeriode = facturesDuStore.filter(f => {
                if (f.statut === 'annulee') return false;
                const d = new Date(f.dateLivraison);
                return d >= debut && d <= fin;
            });

            facturesPeriode.forEach(f => {
                (f.reglements || []).forEach((r: any) => {
                    const m = r.mode as 'espece' | 'om' | 'wave';
                    if (m !== 'espece' && m !== 'om' && m !== 'wave') return;
                    const dRaw: any = r.date;
                    const dReglement = dRaw instanceof Date ? dRaw : (dRaw?.toDate ? dRaw.toDate() : new Date(dRaw || Date.now()));
                    factParMode[m] += r.montant || 0;
                    caLivraisonEncaisse += r.montant || 0;
                    detail[m].push({
                        source: 'livraison',
                        label: nomClient(f.clientId),
                        ref: `Règlement facture ${f.numeroFacture}`,
                        montant: r.montant || 0,
                        date: dReglement,
                    });
                });
            });

            // Tri chronologique décroissant sécurisé dans chaque moyen
            (['espece', 'om', 'wave'] as const).forEach(m => {
                detail[m].sort((a, b) => {
                    const timeA = a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime();
                    const timeB = b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime();
                    return (timeB || 0) - (timeA || 0);
                });
            });

            const caPos = posParMode.espece + posParMode.om + posParMode.wave;

            setStats(prev => ({ ...prev, loading: false, caBoutique: caBoutique || 0, caPos, posParMode, factParMode, caLivraisonEncaisse, encaissementsDetail: detail }));
            setTimeout(() => calculerStats(), 0);
        } catch (e) {
            console.error("Erreur calcul compta:", e);
            setStats(prev => ({ ...prev, loading: false }));
        }
    };

    const handleActualiser = async () => {
        setIsActualisant(true);
        try {
            await chargerDonnees(true);
        } finally {
            setIsActualisant(false);
            setStats(prev => ({ ...prev, loading: false }));
        }
    };

    const calculerStats = () => {
        const debut = new Date(periode.debut);
        debut.setHours(0, 0, 0, 0);
        const fin = new Date(periode.fin);
        fin.setHours(23, 59, 59, 999);

        // 1. REVENUS LIVRAISON (Facturés)
        const facturesDuMois = factures.filter(f => {
            if (f.statut === 'annulee') return false;
            const d = new Date(f.dateLivraison);
            return d >= debut && d <= fin;
        });

        const facturesUniquesMap = new Map<string, typeof factures[0]>();
        facturesDuMois.forEach(f => {
            const dayKey = new Date(f.dateLivraison).toISOString().split('T')[0];
            const key = `${f.clientId}_${dayKey}`;

            if (!facturesUniquesMap.has(key)) {
                facturesUniquesMap.set(key, f);
            } else {
                const existing = facturesUniquesMap.get(key)!;
                const getScore = (statut: string) => {
                    switch (statut) {
                        case 'payee': return 5;
                        case 'envoyee': return 4;
                        case 'validee': return 3;
                        case 'en_attente_retours': return 2;
                        default: return 1;
                    }
                };
                const scoreNew = getScore(f.statut);
                const scoreExist = getScore(existing.statut);
                if (scoreNew > scoreExist) {
                    facturesUniquesMap.set(key, f);
                } else if (scoreNew === scoreExist) {
                    if (new Date(f.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
                        facturesUniquesMap.set(key, f);
                    }
                }
            }
        });

        const facturesNettoyees = Array.from(facturesUniquesMap.values());
        const caLivraison = facturesNettoyees.reduce((sum, f) => sum + f.totalTTC, 0);


        // 2. COUTS : MATIÈRES CONSOMMÉES (Comptabilité Analytique)
        // On ne regarde plus les factures d'achat ('Intrants'), mais la consommation réelle.
        let coutMatieresConsommees = 0;
        const detailMatieresTemp: Record<string, number> = {};

        mouvements.forEach(mvt => {
            const dateMvt = new Date(mvt.date);
            if (dateMvt >= debut && dateMvt <= fin && mvt.type === 'consommation') {
                // Trouver le prix unitaire moyen de la matière
                // Note: Idéalement le PMP devrait être historisé dans le mouvement pour exactitude parfaite
                // Ici on prend le PMP actuel (approximation acceptable pour PME)
                const matiere = matieres.find(m => m.id === mvt.matiereId);
                if (matiere && matiere.prixUnitaireMoyen) {
                    // mvt.quantite est positif dans la BDD pour 'consommation' via addMouvement ?
                    // Vérif: addMouvement stock signedQuantity dans 'newStock' calcul, mais enregistre 'mouvementData.quantite' tel quel.
                    // Dans MouvementModal, onSubmit passe 'quantite' tjrs positive. 
                    // Donc on prend mvt.quantite * PMP
                    const cout = (Math.abs(mvt.quantite) * matiere.prixUnitaireMoyen);
                    coutMatieresConsommees += cout;

                    if (detailMatieresTemp[matiere.nom]) {
                        detailMatieresTemp[matiere.nom] += cout;
                    } else {
                        detailMatieresTemp[matiere.nom] = cout;
                    }
                }
            }
        });


        // 3. COUTS : CHARGES EXTERNES (Dépenses Classiques)
        // On exclut strictement la catégorie 'Intrants' car elle est gérée par le stock ci-dessus
        // On exclut aussi 'Carburant Four' s'il est géré en stock maintenant.
        // La logique utilisateur est "plus de dépense intrant". Donc on filtre tout ce qui est Intrant.
        const statsCouts = getDepensesProRata(debut, fin);
        // Record<string> pour pouvoir omettre des clés historiques ('Carburant Four') hors du type
        const depensesParCategorie: Record<string, number> = { ...statsCouts.parCategorie };

        // SUPPRESSION DES INTRANTS + CARBURANT FOUR (données historiques) pour éviter doublon
        // Ces coûts sont déjà comptés via la consommation de stock (matières). On les ignore ici.
        const { Intrants: _ignored, 'Carburant Four': _carburantFour, ...depensesFiltrees } = depensesParCategorie;

        const totalChargesExternes = Object.values(depensesFiltrees).reduce((acc, curr) => acc + curr, 0);

        // TOTAL COUTS = MATIERES + CHARGES
        const totalCouts = coutMatieresConsommees + totalChargesExternes;

        // ── VUE TRÉSORERIE (encaissé / décaissé réel) ──────────────────
        // Note : caLivraisonEncaisse et factParMode viennent du journal des règlements
        // (calculés dans chargerDonnees, par date de règlement, cross-période).

        // Décaissements matières : achats payés (mouvements 'achat', cash out réel)
        const achatsCash = mouvements.reduce((sum, mvt) => {
            const dateMvt = new Date(mvt.date);
            if (mvt.type === 'achat' && dateMvt >= debut && dateMvt <= fin) {
                return sum + (mvt.montantPaye || (mvt.prixUnitaire ? mvt.prixUnitaire * Math.abs(mvt.quantite) : 0));
            }
            return sum;
        }, 0);

        // Décaissements charges : dépenses payées (montant plein, à la date de paiement, hors Intrants/Carburant Four)
        const estIntrant = (cat: string) => cat === 'Intrants' || cat === 'Carburant Four';
        const chargesCashParCategorie: Record<string, number> = {};
        let chargesCash = 0;
        depenses.forEach(d => {
            const dd = new Date(d.date);
            if (dd >= debut && dd <= fin && !estIntrant(d.categorie as string)) {
                chargesCash += d.montant;
                chargesCashParCategorie[d.categorie] = (chargesCashParCategorie[d.categorie] || 0) + d.montant;
            }
        });

        setStats(prev => ({
            ...prev,
            caLivraison,
            totalCouts,
            achatsMatieres: coutMatieresConsommees, // On remplace sémantiquement "Achats" par "Consommation"
            achatsCash,
            autresCharges: totalChargesExternes,
            chargesCash,
            depensesParCategorie: depensesFiltrees,
            chargesCashParCategorie,
            detailMatieres: detailMatieresTemp
        }));
    };



    const formatCurrency = (amount: number) => {
        return Math.round(amount).toLocaleString('fr-FR') + ' FCFA';
    };

    const genererRapportPDF = () => {
        const doc = new jsPDF();

        // Helper pour le formatage propre dans le PDF
        const formatPdfCurrency = (amount: number) => {
            return Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + ' FCFA';
        };

        // --- EN-TÊTE ---
        // Fond coloré pour l'en-tête
        doc.setFillColor(41, 128, 185);
        doc.rect(0, 0, 210, 40, 'F');

        // Titre blanc
        doc.setFontSize(24);
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.text("RAPPORT FINANCIER", 105, 20, { align: 'center' }); // Centré

        // Période et Date en blanc légèrement transparent
        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "normal");
        doc.text(`Période : ${new Date(periode.debut).toLocaleDateString('fr-FR')} au ${new Date(periode.fin).toLocaleDateString('fr-FR')}`, 105, 30, { align: 'center' });

        const generatedDate = `Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`;
        doc.setFontSize(8);
        doc.text(generatedDate, 200, 38, { align: 'right' });


        // --- CONTENU ---
        let finalY = 50;

        // 1. RÉSUMÉ FINANCIER
        doc.setFontSize(14);
        doc.setTextColor(41, 128, 185);
        doc.setFont("helvetica", "bold");
        doc.text("1. Synthèse Financière", 14, finalY);

        const summaryData = [
            ['Total Recettes', formatPdfCurrency(totalRecettes)],
            ['Total Dépenses', formatPdfCurrency(totalCouts)],
            ['RÉSULTAT NET', formatPdfCurrency(resultat)],
            ['Marge Nette', `${marge.toFixed(1)} %`]
        ];

        autoTable(doc, {
            startY: finalY + 5,
            head: [['Indicateur', 'Montant / Valeur']],
            body: summaryData,
            theme: 'striped',
            headStyles: {
                fillColor: [44, 62, 80],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'left'
            },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 100 },
                1: { halign: 'right', fontStyle: 'bold' } // Alignement à droite pour les chiffres
            },
            styles: { fontSize: 11, cellPadding: 4 },
            didParseCell: function (data) {
                // Mettre en évidence le Résultat Net
                if (data.row.index === 2 && data.section === 'body') {
                    data.cell.styles.textColor = resultat >= 0 ? [39, 174, 96] : [192, 57, 43]; // Vert ou Rouge
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        });

        finalY = (doc as any).lastAutoTable.finalY + 15;

        // 2. DÉTAIL DES RECETTES
        doc.setFontSize(14);
        doc.setTextColor(41, 128, 185); // Bleu
        doc.text("2. Détail des Recettes", 14, finalY);

        const recetteData = [
            ['Ventes Boutique (dont caisse)', formatPdfCurrency(caBoutiquePos)],
            [L.livraison, formatPdfCurrency(caLivraisonAffiche)],
            ['TOTAL RECETTES', formatPdfCurrency(totalRecettes)] // Ajout ligne total
        ];

        autoTable(doc, {
            startY: finalY + 5,
            head: [['Source', 'Montant']],
            body: recetteData,
            theme: 'grid',
            headStyles: { fillColor: [39, 174, 96], halign: 'left' }, // Vert
            columnStyles: {
                0: { cellWidth: 100 },
                1: { halign: 'right' }
            },
            didParseCell: function (data) {
                if (data.row.index === recetteData.length - 1 && data.section === 'body') {
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        });

        finalY = (doc as any).lastAutoTable.finalY + 10;
        if (estTreso) {
            doc.setFontSize(8);
            doc.setFont("helvetica", "italic");
            doc.setTextColor(120, 120, 120);
            const explanationText = "* Note : En mode Trésorerie, le montant des \"Livraisons réglées\" n'inclut que les règlements encaissés durant la période pour des factures livrées au cours de cette même période. Les recouvrements de créances/dettes antérieures sont exclus.";
            const splitText = doc.splitTextToSize(explanationText, 180);
            doc.text(splitText, 14, finalY);
            finalY += (splitText.length * 4) + 10;
        } else {
            finalY += 5;
        }

        // 3. DÉTAIL DES DÉPENSES
        doc.setFontSize(14);
        doc.setTextColor(192, 57, 43); // Rouge
        doc.setFont("helvetica", "bold");
        doc.text("3. Détail des Dépenses", 14, finalY);

        // Fusionner dépenses classiques et matières premières détaillées
        const allDepenses = [
            ...Object.entries(chargesParCategAffiche).map(([nom, montant]) => ({ nom, montant })),
            ...Object.entries(detailMatieresAffiche).map(([nom, montant]) => ({ nom: `${nom} (Intrant)`, montant }))
        ];

        // Trier par montant décroissant et mapper pour le tableau
        const depenseData = allDepenses
            .filter(d => d.montant > 0)
            .sort((a, b) => b.montant - a.montant)
            .map(d => [d.nom, formatPdfCurrency(d.montant)]);

        // Ajouter le total à la fin
        depenseData.push(['TOTAL DÉPENSES', formatPdfCurrency(totalCouts)]);

        autoTable(doc, {
            startY: finalY + 5,
            head: [['Catégorie', 'Montant']],
            body: depenseData,
            theme: 'grid',
            headStyles: { fillColor: [192, 57, 43], halign: 'left' }, // Rouge
            columnStyles: {
                0: { cellWidth: 100 },
                1: { halign: 'right' }
            },
            didParseCell: function (data) {
                // Mettre le total en gras
                if (data.row.index === depenseData.length - 1 && data.section === 'body') {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = [253, 237, 236]; // Fond rouge très clair
                }
            }
        });

        finalY = (doc as any).lastAutoTable.finalY + 15;

        // 4. DÉTAIL DES ENCAISSEMENTS LIVRAISONS (Si Trésorerie)
        if (estTreso) {
            const rawReglements: { date: Date; client: string; mode: string; ref: string; montant: number }[] = [];
            (['espece', 'om', 'wave'] as const).forEach(mode => {
                const entries = stats.encaissementsDetail[mode] || [];
                entries.forEach(e => {
                    if (e.source === 'livraison') {
                        rawReglements.push({
                            date: e.date,
                            client: e.label,
                            mode: mode === 'espece' ? 'Espèces' : mode === 'om' ? 'Orange Money' : 'Wave',
                            ref: e.ref || '-',
                            montant: e.montant
                        });
                    }
                });
            });

            if (rawReglements.length > 0) {
                // Trier par date décroissante
                rawReglements.sort((a, b) => b.date.getTime() - a.date.getTime());

                const listReglements = rawReglements.map(r => [
                    r.date.toLocaleDateString('fr-FR'),
                    r.client,
                    r.mode,
                    r.ref,
                    formatPdfCurrency(r.montant)
                ]);

                // Si on approche de la fin de page, on force un saut de page
                if (finalY > 220) {
                    doc.addPage();
                    finalY = 20;
                }

                doc.setFontSize(14);
                doc.setTextColor(41, 128, 185); // Bleu
                doc.setFont("helvetica", "bold");
                doc.text("4. Liste des règlements livraisons pris en compte", 14, finalY);

                autoTable(doc, {
                    startY: finalY + 5,
                    head: [['Date', 'Client', 'Moyen', 'Facture', 'Montant']],
                    body: listReglements,
                    theme: 'grid',
                    headStyles: { fillColor: [41, 128, 185], halign: 'left' }, // Bleu
                    columnStyles: {
                        0: { cellWidth: 25, halign: 'center' },
                        1: { cellWidth: 'auto' },
                        2: { cellWidth: 35, halign: 'center' },
                        3: { cellWidth: 35, halign: 'center' },
                        4: { cellWidth: 30, halign: 'right' }
                    }
                });

                finalY = (doc as any).lastAutoTable.finalY + 15;
            }
        }

        // --- PIED DE PAGE ---
        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Page ${i} / ${pageCount}`, 105, 290, { align: 'center' });
            doc.text("Boulangerie App - Document confidentiel", 14, 290, { align: 'left' });
        }

        doc.save(`Rapport_Financier_${periode.debut}_${periode.fin}.pdf`);
    };

    return (
        <div className="min-h-screen bg-sand-100 overflow-x-hidden">
            {/* Header */}
            <div className="bg-white border-b border-sand-200 px-4 sm:px-6 py-3 sm:py-4">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 sm:gap-4">
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                        <div className="w-10 h-10 bg-terracotta-500 rounded-xl flex items-center justify-center shrink-0">
                            <Coins className="w-5 h-5 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h1 className="text-lg sm:text-xl font-bold text-sand-900 truncate">Comptabilité</h1>
                            <p className="text-xs sm:text-sm text-sand-500 truncate">Suivi des ventes, coûts et résultats</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto justify-start lg:justify-end">
                        <button
                            onClick={genererRapportPDF}
                            disabled={isActualisant}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-sand-900 text-white rounded-lg hover:bg-sand-800 transition-colors shadow-sm text-xs sm:text-sm font-semibold disabled:opacity-50"
                            title="Télécharger le rapport PDF"
                        >
                            <FileText size={16} />
                            <span>Générer Rapport</span>
                        </button>

                        <button
                            onClick={handleActualiser}
                            disabled={isActualisant}
                            className="p-2 text-sand-600 hover:text-sand-900 hover:bg-sand-100 rounded-lg transition-colors border border-sand-200 shrink-0"
                            title="Actualiser les données"
                        >
                            <RefreshCw size={18} className={`${isActualisant ? "animate-spin text-terracotta-600" : ""}`} />
                        </button>

                        <div className="flex items-center gap-2 bg-sand-50 p-1.5 sm:p-2 rounded-lg border border-sand-200 text-xs sm:text-sm">
                            <Calendar size={16} className="text-sand-500 shrink-0" />
                            <span className="font-semibold text-sand-700 hidden sm:inline">Période :</span>
                            <input
                                type="date"
                                value={periode.debut}
                                onChange={(e) => setPeriode(p => ({ ...p, debut: e.target.value }))}
                                className="bg-white border border-sand-300 text-sand-900 text-xs sm:text-sm rounded-md p-1 focus:ring-terracotta-500 focus:border-terracotta-500 max-w-[130px]"
                            />
                            <span className="text-sand-400">à</span>
                            <input
                                type="date"
                                value={periode.fin}
                                onChange={(e) => setPeriode(p => ({ ...p, fin: e.target.value }))}
                                className="bg-white border border-sand-300 text-sand-900 text-xs sm:text-sm rounded-md p-1 focus:ring-terracotta-500 focus:border-terracotta-500 max-w-[130px]"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Contenu principal */}
            <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
                {/* Sélecteur de vue : Bilan & Résultat / Trésorerie & Caisse */}
                <div className="bg-white rounded-2xl shadow-card border border-sand-200 p-3 sm:p-4 space-y-3 overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center p-1 rounded-xl bg-sand-100 border border-sand-200 overflow-x-auto max-w-full no-scrollbar gap-1">
                            <button
                                onClick={() => { setVue('simple'); setShowFormulaInfo(false); }}
                                className={`inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0 ${vue === 'simple' ? 'bg-terracotta-600 text-white shadow-sm' : 'text-sand-600 hover:text-sand-900'}`}
                            >
                                <Icon icon="mdi:view-dashboard-outline" className="w-4 h-4" /> Bilan &amp; Résultat
                            </button>
                            <button
                                onClick={() => { setVue('tresorerie'); setShowFormulaInfo(false); }}
                                className={`inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0 ${vue === 'tresorerie' ? 'bg-success-600 text-white shadow-sm' : 'text-sand-600 hover:text-sand-900'}`}
                            >
                                <Coins size={15} /> Trésorerie &amp; Caisse
                            </button>
                        </div>

                        {ecartMargeTreso > 0 && (
                            <button
                                onClick={() => navigate('/facturation')}
                                title="Voir les factures en attente de règlement"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-warning-50 text-warning-800 text-xs font-semibold ring-1 ring-inset ring-warning-200 hover:bg-warning-100 transition-colors shrink-0 max-w-full"
                            >
                                <Coins size={14} className="shrink-0" />
                                <span className="truncate">Reste à encaisser : <strong>{formatCurrency(ecartMargeTreso)}</strong></span>
                                <ArrowRight size={14} className="shrink-0" />
                            </button>
                        )}
                    </div>

                    {/* Barre de formule + icône info (i) */}
                    <div className="border-t border-sand-100 pt-2.5 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-sand-700 font-medium">
                            {vue === 'simple' ? (
                                <>
                                    <span className="px-2 py-0.5 rounded-md bg-sand-100 text-sand-800 font-semibold">Chiffre d&apos;affaires</span>
                                    <span className="text-sand-400 font-bold">−</span>
                                    <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200/70 font-semibold">Matières consommées</span>
                                    <span className="text-sand-400 font-bold">−</span>
                                    <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 border border-rose-200/70 font-semibold">Dépenses</span>
                                    <span className="text-sand-400 font-bold">=</span>
                                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/70 font-bold">Bénéfice net</span>
                                </>
                            ) : (
                                <>
                                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/70 font-semibold">Encaissements réels</span>
                                    <span className="text-sand-400 font-bold">−</span>
                                    <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200/70 font-semibold">Achats stock</span>
                                    <span className="text-sand-400 font-bold">−</span>
                                    <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 border border-rose-200/70 font-semibold">Dépenses</span>
                                    <span className="text-sand-400 font-bold">=</span>
                                    <span className="px-2 py-0.5 rounded-md bg-sand-900 text-white font-bold">Solde de caisse</span>
                                </>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={() => setShowFormulaInfo(prev => !prev)}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border transition-colors ${
                                showFormulaInfo
                                    ? 'bg-sand-900 text-white border-sand-900'
                                    : 'bg-sand-50 text-sand-600 border-sand-200 hover:bg-sand-100 hover:text-sand-900'
                            }`}
                            title="Explication de la formule"
                            aria-expanded={showFormulaInfo}
                        >
                            <Icon icon="mdi:information-outline" className="w-4 h-4" />
                            <span className="hidden sm:inline">Détail du calcul</span>
                        </button>
                    </div>

                    {showFormulaInfo && (
                        <div className="bg-sand-50 border border-sand-200 rounded-xl p-3 text-xs text-sand-700 space-y-1.5">
                            {vue === 'simple' ? (
                                <>
                                    <p><strong className="text-sand-900">Chiffre d&apos;affaires :</strong> ventes encaissées en boutique (caisse) + factures de livraison sur la période.</p>
                                    <p><strong className="text-sand-900">Matières consommées :</strong> quantité réelle utilisée au fournil valorisée au prix moyen (module Stock).</p>
                                    <p><strong className="text-sand-900">Dépenses :</strong> frais de fonctionnement enregistrés sur la période (carburant, salaires, électricité, eau, glace, loyer, entretien…).</p>
                                </>
                            ) : (
                                <>
                                    <p><strong className="text-sand-900">Encaissements réels :</strong> paiements effectivement reçus en Espèces, Orange Money et Wave (hors factures impayées).</p>
                                    <p><strong className="text-sand-900">Achats stock :</strong> montant des réceptions de matières enregistrées dans le module Stock.</p>
                                    <p><strong className="text-sand-900">Dépenses :</strong> total des frais de fonctionnement réglés sur la période.</p>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {vue === 'simple' ? (
                    <TableauBordFinanceSimple
                        periode={periode}
                        onChangerPeriode={(debut, fin) => setPeriode({ debut, fin })}
                        caBoutiquePos={caBoutiquePos}
                        caLivraison={stats.caLivraison}
                        caLivraisonEncaisse={stats.caLivraisonEncaisse}
                        depenses={depenses}
                        mouvements={mouvements}
                        matieres={matieres}
                        programmes={programmes}
                        onRefresh={() => chargerDonnees(true)}
                    />
                ) : (
                    <>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
                    {/* Recettes */}
                    <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-card border border-sand-200 relative overflow-hidden">
                        <div className="flex items-center justify-between mb-3 sm:mb-4 relative z-10">
                            <div className="w-11 h-11 bg-success-50 rounded-full flex items-center justify-center">
                                <TrendingUp className="text-success-600" size={20} />
                            </div>
                            <span className="text-[10px] sm:text-xs font-medium text-success-700 bg-success-50 px-2 sm:px-3 py-1 rounded-full truncate">{L.recettes}</span>
                        </div>
                        <div className="space-y-2 relative z-10">
                            <h3 className="font-display text-2xl sm:text-3xl font-semibold tabular-nums text-sand-900 truncate">{formatCurrency(totalRecettes)}</h3>
                            <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm pt-2">
                                <div className="bg-success-50/50 p-2 rounded">
                                    <p className="text-success-700 text-[9px] sm:text-[10px] uppercase tracking-wide font-semibold leading-tight">Boutique (caisse)</p>
                                    <p className="font-medium text-success-700 truncate">{formatCurrency(caBoutiquePos)}</p>
                                </div>
                                <div className="bg-success-50/50 p-2 rounded">
                                    <p className="text-success-700 text-[9px] sm:text-[10px] uppercase tracking-wide font-semibold leading-tight">{L.livraison}</p>
                                    <p className="font-medium text-success-700 truncate">{formatCurrency(caLivraisonAffiche)}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Coûts */}
                    <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-card border border-sand-200 relative overflow-hidden">
                        <div className="flex items-center justify-between mb-3 sm:mb-4 relative z-10">
                            <div className="w-11 h-11 bg-danger-50 rounded-full flex items-center justify-center">
                                <TrendingDown className="text-danger-600" size={20} />
                            </div>
                            <span className="text-[10px] sm:text-xs font-medium text-danger-700 bg-danger-50 px-2 sm:px-3 py-1 rounded-full truncate">{L.couts}</span>
                        </div>
                        <div className="space-y-2 relative z-10">
                            <h3 className="font-display text-2xl sm:text-3xl font-semibold tabular-nums text-sand-900 truncate">{formatCurrency(totalCouts)}</h3>
                            <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm pt-2">
                                <div className="bg-danger-50/50 p-2 rounded">
                                    <p className="text-danger-700 text-[9px] sm:text-[10px] uppercase tracking-wide font-semibold leading-tight">{estTreso ? 'Achats' : 'Matières'}</p>
                                    <p className="font-medium text-danger-700 truncate">{formatCurrency(matieresAffiche)}</p>
                                </div>
                                <div className="bg-danger-50/50 p-2 rounded">
                                    <p className="text-danger-700 text-[9px] sm:text-[10px] uppercase tracking-wide font-semibold leading-tight">Charges</p>
                                    <p className="font-medium text-danger-700 truncate">{formatCurrency(chargesAffiche)}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Résultat */}
                    <div className={`bg-white p-5 sm:p-6 rounded-2xl shadow-card border relative overflow-hidden ${resultat >= 0 ? 'border-sand-200' : 'border-sand-200'}`}>
                        <div className="flex items-center justify-between mb-3 sm:mb-4 relative z-10">
                            <div className={`w-11 h-11 rounded-full flex items-center justify-center ${resultat >= 0 ? 'bg-info-50' : 'bg-warning-50'}`}>
                                <Activity className={resultat >= 0 ? 'text-info-600' : 'text-warning-600'} size={20} />
                            </div>
                            <span className={`text-[10px] sm:text-xs font-medium px-2 sm:px-3 py-1 rounded-full truncate ${resultat >= 0 ? 'text-info-600 bg-info-50' : 'text-warning-600 bg-warning-50'}`}>
                                {L.resultat}
                            </span>
                        </div>
                        <div className="space-y-2 relative z-10">
                            <h3 className={`font-display text-2xl sm:text-3xl font-semibold tabular-nums truncate ${resultat >= 0 ? 'text-info-600' : 'text-warning-600'}`}>
                                {resultat > 0 ? '+' : ''}{formatCurrency(resultat)}
                            </h3>
                            <div className="flex items-center justify-between pt-2">
                                <p className="text-xs sm:text-sm text-sand-500">Marge Nette</p>
                                <p className={`text-base sm:text-lg font-semibold ${marge >= 0 ? 'text-info-600' : 'text-warning-600'}`}>
                                    {marge.toFixed(1)}%
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Encaissements par moyen de paiement (réel) */}
                <div className="bg-white rounded-2xl shadow-card border border-sand-200 p-5 sm:p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base sm:text-lg font-semibold text-sand-800 flex items-center gap-2">
                            <Coins className="text-sand-500" size={18} />
                            <span className="truncate">Encaissements par moyen de paiement</span>
                        </h3>
                        <span className="text-xs text-sand-400 hidden sm:block">Caisse + règlements factures</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                        {([
                            { key: 'espece' as const, label: 'Espèces', icon: 'mdi:cash', color: 'success' },
                            { key: 'om' as const, label: 'Orange Money', img: omLogo, color: 'warning' },
                            { key: 'wave' as const, label: 'Wave', img: waveLogo, color: 'info' },
                        ]).map((m) => {
                            const montant = encaissementsParMode[m.key];
                            const pct = totalEncaisseMode > 0 ? Math.round((montant / totalEncaisseMode) * 100) : 0;
                            const nbOps = stats.encaissementsDetail[m.key]?.length || 0;
                            return (
                                <button
                                    key={m.key}
                                    onClick={() => setModeDetail(m.key)}
                                    className="text-left rounded-xl border border-sand-200 p-4 hover:border-sand-300 hover:shadow-elevated transition-all"
                                    title="Voir le détail (qui / quand)"
                                >
                                    <div className="flex items-center gap-2 mb-2">
                                        {m.img
                                            ? <img src={m.img} alt={m.label} className="w-6 h-6 object-contain" />
                                            : <span className="w-6 h-6 rounded-md bg-success-50 text-success-600 flex items-center justify-center"><Coins size={14} /></span>}
                                        <span className="text-sm font-medium text-sand-700">{m.label}</span>
                                        <span className="ml-auto text-xs font-semibold text-sand-400 tabular-nums">{pct}%</span>
                                    </div>
                                    <p className="font-display text-xl sm:text-2xl font-semibold text-sand-900 tabular-nums truncate">{formatCurrency(montant)}</p>
                                    <div className="mt-2 w-full bg-sand-100 rounded-full h-1.5">
                                        <div className={`h-1.5 rounded-full ${m.color === 'success' ? 'bg-success-500' : m.color === 'warning' ? 'bg-warning-500' : 'bg-info-500'}`} style={{ width: `${pct}%` }}></div>
                                    </div>
                                    <div className="mt-2 flex items-center gap-1 text-[11px] text-sand-400">
                                        <Icon icon="mdi:format-list-bulleted" className="text-sm" />
                                        {nbOps} opération{nbOps > 1 ? 's' : ''} · détail
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                    <div className="mt-4 pt-3 border-t border-sand-100 flex items-center justify-between">
                        <span className="text-sm text-sand-500">Total encaissé (tous moyens)</span>
                        <span className="font-display text-lg font-semibold text-sand-900 tabular-nums">{formatCurrency(totalEncaisseMode)}</span>
                    </div>
                </div>

                {/* Détails */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    {/* Graphique de répartition des Coûts */}
                    <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-card border border-sand-200">
                        <h3 className="text-base sm:text-lg font-semibold text-sand-800 mb-4 sm:mb-6 flex items-center">
                            <PieChartIcon className="mr-2 text-sand-500" size={18} />
                            <span className="truncate">Répartition des Charges</span>
                        </h3>
                        {(() => {
                            const palette = ['text-sand-900', 'text-gold-500', 'text-sand-500', 'text-warning-500', 'text-sand-400', 'text-gold-600', 'text-sand-300'];
                            let i = 0;
                            const slices: { label: string; value: number; className: string }[] = [];
                            if (matieresAffiche > 0) slices.push({ label: 'Matières premières', value: matieresAffiche, className: palette[i++ % palette.length] });
                            Object.entries(chargesParCategAffiche).forEach(([categ, montant]) => {
                                if (categ === 'Intrants' || !montant) return;
                                slices.push({ label: categ, value: montant as number, className: palette[i++ % palette.length] });
                            });
                            if (slices.length === 0) return null;
                            return (
                                <div className="flex flex-col sm:flex-row items-center gap-5 mb-6 pb-6 border-b border-sand-100">
                                    <DonutChart
                                        data={slices}
                                        size={140}
                                        stroke={20}
                                        centerValue={<span className="text-sm">{Math.round(totalCouts).toLocaleString('fr-FR')}</span>}
                                        centerLabel="FCFA"
                                    />
                                    <div className="flex-1 w-full space-y-1.5">
                                        {slices.map((s, idx) => (
                                            <div key={idx} className="flex items-center gap-2 text-xs">
                                                <span className={`w-2.5 h-2.5 rounded-full bg-current ${s.className} shrink-0`}></span>
                                                <span className="text-sand-600 truncate flex-1">{s.label}</span>
                                                <span className="text-sand-900 font-medium tabular-nums shrink-0">{totalCouts > 0 ? Math.round((s.value / totalCouts) * 100) : 0}%</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })()}
                        <div className="space-y-4 sm:space-y-6">
                            {/* Détail des Matières Premières */}
                            {Object.keys(detailMatieresAffiche).length > 0 ? (
                                Object.entries(detailMatieresAffiche)
                                    .sort((a, b) => b[1] - a[1])
                                    .map(([nom, montant]) => (
                                        <div key={nom}>
                                            <div className="flex justify-between text-xs sm:text-sm mb-2">
                                                <div className="flex items-center gap-2 truncate">
                                                    <span className="text-sand-600 truncate">{nom}</span>
                                                    <span className="text-[10px] bg-warning-50 text-warning-600 px-1.5 py-0.5 rounded-full font-medium border border-warning-100 shrink-0">Intrant</span>
                                                </div>
                                                <span className="font-semibold text-sand-900 shrink-0 ml-2">{totalCouts > 0 ? Math.round((montant / totalCouts) * 100) : 0}%</span>
                                            </div>
                                            <div className="w-full bg-sand-100 rounded-full h-2 sm:h-3">
                                                <div className="bg-warning-500 h-2 sm:h-3 rounded-full transition-all duration-500" style={{ width: `${totalCouts > 0 ? (montant / totalCouts) * 100 : 0}%` }}></div>
                                            </div>
                                            <p className="text-[10px] sm:text-xs text-sand-400 mt-1 text-right truncate">{formatCurrency(montant)}</p>
                                        </div>
                                    ))
                            ) : (
                                <div>
                                    <div className="flex justify-between text-xs sm:text-sm mb-2">
                                        <span className="text-sand-600 truncate">Matières Premières</span>
                                        <span className="font-semibold text-sand-900 shrink-0">{totalCouts > 0 ? Math.round((matieresAffiche / totalCouts) * 100) : 0}%</span>
                                    </div>
                                    <div className="w-full bg-sand-100 rounded-full h-2 sm:h-3">
                                        <div className="bg-warning-500 h-2 sm:h-3 rounded-full transition-all duration-500" style={{ width: `${totalCouts > 0 ? (matieresAffiche / totalCouts) * 100 : 0}%` }}></div>
                                    </div>
                                    <p className="text-[10px] sm:text-xs text-sand-400 mt-1 text-right truncate">{formatCurrency(matieresAffiche)}</p>
                                </div>
                            )}
                            {Object.entries(chargesParCategAffiche).map(([categ, montant]) => {
                                if (categ === 'Intrants' || montant === 0) return null;
                                return (
                                    <div key={categ}>
                                        <div className="flex justify-between text-xs sm:text-sm mb-2">
                                            <span className="text-sand-600 truncate">{categ}</span>
                                            <span className="font-semibold text-sand-900 shrink-0">{totalCouts > 0 ? Math.round(((montant as number) / totalCouts) * 100) : 0}%</span>
                                        </div>
                                        <div className="w-full bg-sand-100 rounded-full h-2 sm:h-3">
                                            <div className="bg-sand-500 h-2 sm:h-3 rounded-full transition-all duration-500" style={{ width: `${totalCouts > 0 ? ((montant as number) / totalCouts) * 100 : 0}%` }}></div>
                                        </div>
                                        <p className="text-[10px] sm:text-xs text-sand-400 mt-1 text-right truncate">{formatCurrency(montant as number)}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Structure du CA */}
                    <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-card border border-sand-200">
                        <h3 className="text-base sm:text-lg font-semibold text-sand-800 mb-4 sm:mb-6 flex items-center">
                            <Coins className="mr-2 text-sand-500" size={18} />
                            <span className="truncate">Sources de Revenus</span>
                        </h3>
                        <div className="space-y-4 sm:space-y-6">
                            <div>
                                <div className="flex justify-between text-xs sm:text-sm mb-2">
                                    <span className="text-sand-600 truncate">Ventes Boutique (caisse)</span>
                                    <span className="font-semibold text-sand-900 shrink-0">{totalRecettes > 0 ? Math.round((caBoutiquePos / totalRecettes) * 100) : 0}%</span>
                                </div>
                                <div className="w-full bg-sand-100 rounded-full h-2 sm:h-3">
                                    <div className="bg-info-500 h-2 sm:h-3 rounded-full transition-all duration-500" style={{ width: `${totalRecettes > 0 ? (caBoutiquePos / totalRecettes) * 100 : 0}%` }}></div>
                                </div>
                                <p className="text-[10px] sm:text-xs text-sand-400 mt-1 text-right truncate">{formatCurrency(caBoutiquePos)}</p>
                            </div>
                            <div>
                                <div className="flex justify-between text-xs sm:text-sm mb-2">
                                    <span className="text-sand-600 truncate">{L.livraison}</span>
                                    <span className="font-semibold text-sand-900 shrink-0">{totalRecettes > 0 ? Math.round((caLivraisonAffiche / totalRecettes) * 100) : 0}%</span>
                                </div>
                                <div className="w-full bg-sand-100 rounded-full h-2 sm:h-3">
                                    <div className="bg-terracotta-500 h-2 sm:h-3 rounded-full transition-all duration-500" style={{ width: `${totalRecettes > 0 ? (caLivraisonAffiche / totalRecettes) * 100 : 0}%` }}></div>
                                </div>
                                <p className="text-[10px] sm:text-xs text-sand-400 mt-1 text-right truncate">{formatCurrency(caLivraisonAffiche)}</p>
                            </div>
                        </div>
                    </div>
                </div>
                </>
            )}
            </div>

            {/* Détail des encaissements d'un moyen de paiement */}
            <Modal
                isOpen={modeDetail !== null}
                onClose={() => setModeDetail(null)}
                title={`Détail — ${modeDetail === 'espece' ? 'Espèces' : modeDetail === 'om' ? 'Orange Money' : 'Wave'}`}
                size="md"
                position="center"
            >
                {modeDetail && (() => {
                    const entries = stats.encaissementsDetail[modeDetail] || [];
                    const total = entries.reduce((s, e) => s + e.montant, 0);
                    return (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between px-1">
                                <span className="text-sm text-sand-500">{entries.length} opération(s)</span>
                                <span className="font-display text-lg font-semibold text-sand-900 tabular-nums">{formatCurrency(total)}</span>
                            </div>
                            {entries.length === 0 ? (
                                <div className="py-8 text-center text-sm text-sand-500">Aucun encaissement sur la période.</div>
                            ) : (
                                <div className="max-h-[55vh] overflow-y-auto rounded-xl border border-sand-200 divide-y divide-sand-100">
                                    {entries.map((e, i) => (
                                        <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                                            <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${e.source === 'caisse' ? 'bg-gold-50 text-gold-600' : 'bg-terracotta-50 text-terracotta-600'}`}>
                                                <Icon icon={e.source === 'caisse' ? 'mdi:cash-register' : 'mdi:truck-outline'} className="text-base" />
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-sm font-medium text-sand-900 truncate">{e.label}</div>
                                                <div className="text-[11px] text-sand-500 truncate">
                                                    {e.source === 'caisse' ? 'Caisse' : 'Livraison'}{e.ref ? ` · ${e.ref}` : ''} · {e.date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                            <span className={`shrink-0 font-semibold tabular-nums ${e.montant < 0 ? 'text-danger-600' : 'text-sand-900'}`}>{formatCurrency(e.montant)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })()}
            </Modal>
        </div>
    );
};
