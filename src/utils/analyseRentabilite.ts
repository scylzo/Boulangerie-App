import type { Facture } from '../types/facturation';
import type { MatierePremiere, MouvementStock } from '../types/stock';

export interface IndicateursSIG {
    // 1. Chiffre d'Affaires
    caBoutiquePos: number;
    caLivraisonFacture: number;
    caNet: number;

    // 2. Coût Matières & Marge Brute
    coutMatieresConsommees: number;
    margeBrute: number;
    tauxMargeBrute: number;      // Marge Brute / CA Net
    tauxFoodCost: number;        // Coût Matières / CA Net (standard boulangerie : 22-30%)

    // 3. Charges Externes & Valeur Ajoutée
    chargesExternes: number;     // Électricité, Eau, Carburant, Entretien, Transport, etc.
    tauxChargesExternes: number;
    valeurAjoutee: number;
    tauxValeurAjoutee: number;

    // 4. Personnel & EBE (Excédent Brut d'Exploitation)
    chargesPersonnel: number;    // Salaires
    tauxMasseSalariale: number;  // Salaires / CA Net (standard boulangerie : 30-38%)
    ebe: number;                 // EBE = Valeur Ajoutée - Salaires
    tauxEBE: number;             // EBE / CA Net (rentabilité d'exploitation réelle)

    // 5. Résultat d'Exploitation et Net
    resultatExploitation: number;
    resultatNet: number;
    tauxMargeNette: number;
}

export interface SeuilRentabilite {
    chargesFixes: number;        // Loyer, Salaires, Abonnements fixes, etc.
    chargesVariables: number;    // Matières, Carburant, quote-part énergie
    margeSurCoutVariable: number;
    tauxMCV: number;             // (CA - Charges Variables) / CA
    seuilRentabiliteFCFA: number;// CA minimum pour être à l'équilibre
    caEquilibreParJour: number;  // Seuil / nombre de jours de la période
    caMoyenParJour: number;      // CA réel / nombre de jours
    margeSecurite: number;       // CA Net - Seuil
    indiceSecurite: number;      // Marge de Sécurité / CA Net (%)
    jourPointMortDansPeriode: number | null; // Jour dans le mois ou la période où le seuil est franchi
    pourcentageAtteinteSeuil: number; // (CA Net / Seuil) * 100
    estRentable: boolean;
}

export interface AnalyseCanaux {
    boutique: {
        ca: number;
        pourcentageDuTotal: number;
    };
    livraison: {
        caFacture: number;
        caEncaisse: number;
        impayesPeriode: number;
        montantRetours: number;
        tauxRetours: number; // Retours / (CA Facture + Retours)
        pourcentageDuTotal: number;
    };
}

export interface GaspillageEtPertes {
    valeurRetoursClients: number;
    pertesMatieresStock: number;
    totalGaspillage: number;
    pourcentageDuCA: number;     // Impact direct sur la marge brute
}

export interface DiagnosticAlerte {
    type: 'erreur' | 'avertissement' | 'info' | 'succes';
    titre: string;
    message: string;
}

export interface DiagnosticComptable {
    scoreFiabilite: number;      // de 0 à 100
    etat: 'fiable' | 'acceptable' | 'incomplet';
    alertes: DiagnosticAlerte[];
}

export interface RapportCompletRentabilite {
    periode: {
        debut: Date;
        fin: Date;
        nbJours: number;
    };
    sig: IndicateursSIG;
    seuil: SeuilRentabilite;
    canaux: AnalyseCanaux;
    gaspillage: GaspillageEtPertes;
    diagnostic: DiagnosticComptable;
}

/**
 * Calcule l'ensemble des indicateurs comptables et de rentabilité pour une période donnée.
 */
export function calculerAnalyseRentabilite(params: {
    debut: Date;
    fin: Date;
    caBoutiquePos: number;
    factures: Facture[];
    depensesProrata: { total: number; parCategorie: Record<string, number> };
    coutMatieresConsommees: number;
    mouvements: MouvementStock[];
    matieres: MatierePremiere[];
    caLivraisonEncaisse?: number;
}): RapportCompletRentabilite {
    const {
        debut,
        fin,
        caBoutiquePos,
        factures,
        depensesProrata,
        coutMatieresConsommees,
        mouvements,
        matieres,
        caLivraisonEncaisse = 0
    } = params;

    // Nombre de jours dans la période (minimum 1 jour)
    const diffTime = Math.abs(fin.getTime() - debut.getTime());
    const nbJours = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1);

    // 1. Chiffre d'Affaires Livraison & Retours clients
    const facturesPeriode = factures.filter(f => {
        if (f.statut === 'annulee') return false;
        const d = new Date(f.dateLivraison);
        return d >= debut && d <= fin;
    });

    // Dédoublonnage sécurisé par client et jour
    const facturesMap = new Map<string, Facture>();
    facturesPeriode.forEach(f => {
        const dayKey = new Date(f.dateLivraison).toISOString().split('T')[0];
        const key = `${f.clientId}_${dayKey}`;
        if (!facturesMap.has(key)) {
            facturesMap.set(key, f);
        } else {
            const existing = facturesMap.get(key)!;
            if (new Date(f.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
                facturesMap.set(key, f);
            }
        }
    });

    const facturesNettoyees = Array.from(facturesMap.values());
    const caLivraisonFacture = facturesNettoyees.reduce((sum, f) => sum + (f.totalTTC || 0), 0);

    // Calcul de la valeur des retours clients sur les livraisons de la période
    let valeurRetoursClients = 0;
    facturesNettoyees.forEach(f => {
        if (f.lignes && Array.isArray(f.lignes)) {
            f.lignes.forEach(l => {
                const retours = l.quantiteRetournee || 0;
                const pu = l.prixUnitaire || 0;
                valeurRetoursClients += (retours * pu);
            });
        }
    });

    const caNet = caBoutiquePos + caLivraisonFacture;

    // 2. Ventilation des dépenses prorata
    const categs = depensesProrata.parCategorie || {};

    // Salaires (Charges de personnel)
    const chargesPersonnel = categs['Salaires'] || 0;

    // Loyer (Charge fixe structurelle)
    const chargeLoyer = categs['Loyer'] || 0;

    // Carburants (Liés à la livraison et aux déplacements)
    const chargeCarburant = (categs['Carburant Véhicule'] || 0) + (categs['Carburant Moto'] || 0);

    // Électricité et Eau (Énergies nécessaires à la cuisson et production)
    const chargeElectricite = categs['Électricité'] || 0;
    const chargeEau = categs['Eau'] || 0;

    // Autres charges externes
    const chargeEntretien = categs['Entretien'] || 0;
    const chargeTransport = categs['Transport'] || 0;
    const chargeMarketing = categs['Marketing'] || 0;
    const chargeDivers = categs['Divers'] || 0;

    // Total des charges externes (hors salaires et hors intrants déjà gérés par stock)
    const chargesExternes = chargeLoyer + chargeCarburant + chargeElectricite + chargeEau + chargeEntretien + chargeTransport + chargeMarketing + chargeDivers;

    // 3. Calculs des SIG (Soldes Intermédiaires de Gestion)
    const margeBrute = caNet - coutMatieresConsommees;
    const tauxMargeBrute = caNet > 0 ? (margeBrute / caNet) * 100 : 0;
    const tauxFoodCost = caNet > 0 ? (coutMatieresConsommees / caNet) * 100 : 0;

    const valeurAjoutee = margeBrute - chargesExternes;
    const tauxValeurAjoutee = caNet > 0 ? (valeurAjoutee / caNet) * 100 : 0;
    const tauxChargesExternes = caNet > 0 ? (chargesExternes / caNet) * 100 : 0;

    const ebe = valeurAjoutee - chargesPersonnel;
    const tauxMasseSalariale = caNet > 0 ? (chargesPersonnel / caNet) * 100 : 0;
    const tauxEBE = caNet > 0 ? (ebe / caNet) * 100 : 0;

    const resultatExploitation = ebe; // Hors dotations amortissements
    const resultatNet = resultatExploitation;
    const tauxMargeNette = caNet > 0 ? (resultatNet / caNet) * 100 : 0;

    // 4. Seuil de rentabilité (Point Mort)
    // Charges Fixes : Loyer + Salaires + 30% des charges d'énergie et entretien récurrentes
    const chargesFixes = chargeLoyer + chargesPersonnel + ((chargeElectricite + chargeEau + chargeEntretien) * 0.3);

    // Charges Variables : Matières premières consommées + Carburant + 70% énergie/eau
    const chargesVariables = coutMatieresConsommees + chargeCarburant + chargeTransport + chargeDivers + ((chargeElectricite + chargeEau + chargeEntretien) * 0.7);

    const margeSurCoutVariable = caNet - chargesVariables;
    const tauxMCV = caNet > 0 ? (margeSurCoutVariable / caNet) : 0;

    // Seuil de Rentabilité en FCFA = Charges Fixes / Taux MCV
    const seuilRentabiliteFCFA = tauxMCV > 0 ? (chargesFixes / tauxMCV) : 0;
    const caEquilibreParJour = nbJours > 0 ? (seuilRentabiliteFCFA / nbJours) : 0;
    const caMoyenParJour = nbJours > 0 ? (caNet / nbJours) : 0;

    const margeSecurite = caNet - seuilRentabiliteFCFA;
    const indiceSecurite = caNet > 0 ? (margeSecurite / caNet) * 100 : 0;
    const pourcentageAtteinteSeuil = seuilRentabiliteFCFA > 0 ? (caNet / seuilRentabiliteFCFA) * 100 : (caNet > 0 ? 100 : 0);

    // Estimation du jour de point mort franchi
    let jourPointMortDansPeriode: number | null = null;
    if (caMoyenParJour > 0 && seuilRentabiliteFCFA > 0) {
        const joursRequis = seuilRentabiliteFCFA / caMoyenParJour;
        if (joursRequis <= nbJours) {
            jourPointMortDansPeriode = Math.ceil(joursRequis);
        }
    }

    const estRentable = caNet >= seuilRentabiliteFCFA && resultatNet > 0;

    // 5. Pertes de stock matières premières
    let pertesMatieresStock = 0;
    mouvements.forEach(mvt => {
        const d = new Date(mvt.date);
        if (d >= debut && d <= fin && mvt.type === 'perte') {
            const matiere = matieres.find(m => m.id === mvt.matiereId);
            const pmp = matiere?.prixUnitaireMoyen || mvt.prixUnitaire || 0;
            pertesMatieresStock += Math.abs(mvt.quantite) * pmp;
        }
    });

    const totalGaspillage = valeurRetoursClients + pertesMatieresStock;
    const pourcentageGaspillage = caNet > 0 ? (totalGaspillage / caNet) * 100 : 0;

    // 6. Analyse des Canaux
    const totalVentes = caNet;
    const impayesLivraison = Math.max(0, caLivraisonFacture - caLivraisonEncaisse);
    const totalVolumeLivreEtRetour = caLivraisonFacture + valeurRetoursClients;
    const tauxRetoursLivraison = totalVolumeLivreEtRetour > 0 ? (valeurRetoursClients / totalVolumeLivreEtRetour) * 100 : 0;

    const canaux: AnalyseCanaux = {
        boutique: {
            ca: caBoutiquePos,
            pourcentageDuTotal: totalVentes > 0 ? (caBoutiquePos / totalVentes) * 100 : 0
        },
        livraison: {
            caFacture: caLivraisonFacture,
            caEncaisse: caLivraisonEncaisse,
            impayesPeriode: impayesLivraison,
            montantRetours: valeurRetoursClients,
            tauxRetours: tauxRetoursLivraison,
            pourcentageDuTotal: totalVentes > 0 ? (caLivraisonFacture / totalVentes) * 100 : 0
        }
    };

    // 7. Diagnostic de Fiabilité Comptable
    const alertes: DiagnosticAlerte[] = [];
    let score = 100;

    if (nbJours >= 15 && chargesPersonnel === 0) {
        score -= 30;
        alertes.push({
            type: 'avertissement',
            titre: 'Salaires non enregistrés',
            message: `Aucune dépense de salaires n'est renseignée pour cette période de ${nbJours} jours. Le bénéfice affiché est potentiellement surévalué.`
        });
    }

    if (nbJours >= 15 && chargeElectricite === 0) {
        score -= 20;
        alertes.push({
            type: 'avertissement',
            titre: 'Facture d\'électricité absente',
            message: 'Les fours et pétrins sont de gros consommateurs d\'énergie. Pensez à enregistrer la facture d\'électricité.'
        });
    }

    if (nbJours >= 20 && chargeLoyer === 0) {
        score -= 15;
        alertes.push({
            type: 'info',
            titre: 'Loyer absent',
            message: 'Aucun loyer enregistré pour cette période mensuelle.'
        });
    }

    if (coutMatieresConsommees === 0 && caNet > 0) {
        score -= 35;
        alertes.push({
            type: 'erreur',
            titre: 'Aucune matière première consommée',
            message: 'Des ventes sont constatées sans aucune consommation de farine ou d\'ingrédients enregistrée.'
        });
    }

    if (tauxFoodCost > 38) {
        alertes.push({
            type: 'avertissement',
            titre: 'Ratio matières élevé (Food Cost > 38%)',
            message: `Le coût matière représente ${tauxFoodCost.toFixed(1)}% du CA (norme boulangerie : 22-30%). Risque de surdosage, hausse de prix farine ou coulage.`
        });
    }

    if (tauxRetoursLivraison > 12) {
        alertes.push({
            type: 'avertissement',
            titre: 'Taux de retours livraisons élevé',
            message: `Les retours clients atteignent ${tauxRetoursLivraison.toFixed(1)}% des livraisons. Cela impacte directement la rentabilité du pôle livraison.`
        });
    }

    if (alertes.length === 0) {
        alertes.push({
            type: 'succes',
            titre: 'Données complètes et cohérentes',
            message: 'Toutes les catégories de coûts clés (salaires, matières, énergie, loyer) sont renseignées.'
        });
    }

    score = Math.max(10, Math.min(100, score));
    const etat: 'fiable' | 'acceptable' | 'incomplet' = score >= 80 ? 'fiable' : score >= 50 ? 'acceptable' : 'incomplet';

    return {
        periode: { debut, fin, nbJours },
        sig: {
            caBoutiquePos,
            caLivraisonFacture,
            caNet,
            coutMatieresConsommees,
            margeBrute,
            tauxMargeBrute,
            tauxFoodCost,
            chargesExternes,
            tauxChargesExternes,
            valeurAjoutee,
            tauxValeurAjoutee,
            chargesPersonnel,
            tauxMasseSalariale,
            ebe,
            tauxEBE,
            resultatExploitation,
            resultatNet,
            tauxMargeNette
        },
        seuil: {
            chargesFixes,
            chargesVariables,
            margeSurCoutVariable,
            tauxMCV,
            seuilRentabiliteFCFA,
            caEquilibreParJour,
            caMoyenParJour,
            margeSecurite,
            indiceSecurite,
            jourPointMortDansPeriode,
            pourcentageAtteinteSeuil,
            estRentable
        },
        canaux,
        gaspillage: {
            valeurRetoursClients,
            pertesMatieresStock,
            totalGaspillage,
            pourcentageDuCA: pourcentageGaspillage
        },
        diagnostic: {
            scoreFiabilite: score,
            etat,
            alertes
        }
    };
}
