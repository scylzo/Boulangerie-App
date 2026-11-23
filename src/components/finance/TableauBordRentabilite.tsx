import React from 'react';
import {
    Award,
    AlertTriangle,
    CheckCircle2,
    Info,
    ArrowDownRight,
    Store,
    Truck,
    ShieldAlert,
    Gauge
} from 'lucide-react';
import type { RapportCompletRentabilite } from '../../utils/analyseRentabilite';

interface TableauBordRentabiliteProps {
    rapport: RapportCompletRentabilite;
    formatCurrency: (amount: number) => string;
}

export const TableauBordRentabilite: React.FC<TableauBordRentabiliteProps> = ({ rapport, formatCurrency }) => {
    const { sig, seuil, canaux, gaspillage, diagnostic, periode } = rapport;

    const estRentable = seuil.estRentable;

    // Helper de formatage de pourcentage
    const fmtPct = (val: number) => `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;

    return (
        <div className="space-y-6">
            {/* 1. CARTE SUPRÊME : VERDICT DE RENTABILITÉ & POINT MORT */}
            <div className={`p-6 sm:p-8 rounded-3xl border shadow-card relative overflow-hidden transition-all ${
                estRentable
                    ? 'bg-gradient-to-br from-success-50 via-white to-sand-50 border-success-200'
                    : 'bg-gradient-to-br from-danger-50 via-white to-sand-50 border-danger-200'
            }`}>
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
                    <div className="space-y-3 max-w-2xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm border ${
                            estRentable
                                ? 'bg-success-100 text-success-800 border-success-200'
                                : 'bg-danger-100 text-danger-800 border-danger-200'
                        }">
                            {estRentable ? (
                                <>
                                    <CheckCircle2 className="w-4 h-4 text-success-600" />
                                    Boulangerie Rentable sur la période
                                </>
                            ) : (
                                <>
                                    <AlertTriangle className="w-4 h-4 text-danger-600" />
                                    Activité en Déficit / Seuil non atteint
                                </>
                            )}
                        </div>

                        <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-sand-900 tracking-tight">
                            Résultat Net : <span className={estRentable ? 'text-success-600' : 'text-danger-600'}>
                                {estRentable ? '+' : ''}{formatCurrency(sig.resultatNet)}
                            </span>
                        </h2>

                        <p className="text-sm sm:text-base text-sand-600 leading-relaxed">
                            {estRentable ? (
                                <>
                                    Pour la période du <strong className="text-sand-900">{new Date(periode.debut).toLocaleDateString('fr-FR')}</strong> au <strong className="text-sand-900">{new Date(periode.fin).toLocaleDateString('fr-FR')}</strong> ({periode.nbJours} jours), la boulangerie dégage une marge nette de <strong className="text-success-700">{sig.tauxMargeNette.toFixed(1)}%</strong> et un EBE de <strong className="text-sand-900">{formatCurrency(sig.ebe)}</strong>.
                                    {seuil.jourPointMortDansPeriode && (
                                        <span className="block mt-1 text-sand-700 font-medium">
                                            🎯 Le seuil de rentabilité a été franchi au bout du <strong>{seuil.jourPointMortDansPeriode}e jour</strong> de la période.
                                        </span>
                                    )}
                                </>
                            ) : (
                                <>
                                    Sur cette période de {periode.nbJours} jours, le chiffre d'affaires réalisé (<strong className="text-sand-900">{formatCurrency(sig.caNet)}</strong>) ne permet pas de couvrir l'intégralité des charges d'exploitation et des matières premières consommées.
                                    <span className="block mt-1 text-danger-700 font-medium">
                                        Il manque <strong>{formatCurrency(Math.abs(seuil.margeSecurite))}</strong> pour atteindre l'équilibre financier.
                                    </span>
                                </>
                            )}
                        </p>
                    </div>

                    {/* Jauge d'atteinte du seuil de rentabilité */}
                    <div className="bg-white/80 backdrop-blur-sm p-5 rounded-2xl border border-sand-200/80 shadow-sm shrink-0 w-full sm:w-80">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-sand-500 uppercase tracking-wider flex items-center gap-1.5">
                                <Gauge className="w-4 h-4 text-sand-600" />
                                Objectif Point Mort
                            </span>
                            <span className={`text-sm font-bold tabular-nums ${seuil.pourcentageAtteinteSeuil >= 100 ? 'text-success-600' : 'text-warning-600'}`}>
                                {seuil.pourcentageAtteinteSeuil.toFixed(0)}%
                            </span>
                        </div>

                        <div className="w-full bg-sand-200 rounded-full h-3 overflow-hidden p-0.5">
                            <div
                                className={`h-full rounded-full transition-all duration-700 ${
                                    seuil.pourcentageAtteinteSeuil >= 100 ? 'bg-success-500' : 'bg-warning-500'
                                }`}
                                style={{ width: `${Math.min(100, seuil.pourcentageAtteinteSeuil)}%` }}
                            />
                        </div>

                        <div className="mt-3 pt-3 border-t border-sand-100 flex items-center justify-between text-xs">
                            <span className="text-sand-500">Seuil d'équilibre :</span>
                            <span className="font-semibold text-sand-800 tabular-nums">{formatCurrency(seuil.seuilRentabiliteFCFA)}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-xs">
                            <span className="text-sand-500">CA minimum / jour :</span>
                            <span className="font-semibold text-sand-800 tabular-nums">{formatCurrency(seuil.caEquilibreParJour)}/j</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. LES 4 PILIERS DE RENTABILITÉ DU SECTEUR BOULANGERIE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Ratio Coût Matières (Food Cost) */}
                <div className="bg-white p-5 rounded-2xl border border-sand-200 shadow-card">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-sand-500">Coût Matières (Food Cost)</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            sig.tauxFoodCost <= 30 ? 'bg-success-50 text-success-700' : 'bg-warning-50 text-warning-700'
                        }`}>
                            Norme: 22-30%
                        </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold font-display text-sand-900 tabular-nums">{sig.tauxFoodCost.toFixed(1)}%</span>
                        <span className="text-xs text-sand-500">du CA Net</span>
                    </div>
                    <p className="text-xs text-sand-600 mt-2">
                        Farine, levure & ingrédients : <strong className="text-sand-900">{formatCurrency(sig.coutMatieresConsommees)}</strong>
                    </p>
                    <div className="mt-3 w-full bg-sand-100 rounded-full h-1.5">
                        <div
                            className={`h-1.5 rounded-full ${sig.tauxFoodCost <= 30 ? 'bg-success-500' : 'bg-warning-500'}`}
                            style={{ width: `${Math.min(100, (sig.tauxFoodCost / 40) * 100)}%` }}
                        />
                    </div>
                </div>

                {/* Ratio Masse Salariale */}
                <div className="bg-white p-5 rounded-2xl border border-sand-200 shadow-card">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-sand-500">Masse Salariale</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            sig.tauxMasseSalariale <= 38 ? 'bg-success-50 text-success-700' : 'bg-warning-50 text-warning-700'
                        }`}>
                            Norme: 30-38%
                        </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold font-display text-sand-900 tabular-nums">{sig.tauxMasseSalariale.toFixed(1)}%</span>
                        <span className="text-xs text-sand-500">du CA Net</span>
                    </div>
                    <p className="text-xs text-sand-600 mt-2">
                        Salaires versés : <strong className="text-sand-900">{formatCurrency(sig.chargesPersonnel)}</strong>
                    </p>
                    <div className="mt-3 w-full bg-sand-100 rounded-full h-1.5">
                        <div
                            className={`h-1.5 rounded-full ${sig.tauxMasseSalariale <= 38 ? 'bg-info-500' : 'bg-warning-500'}`}
                            style={{ width: `${Math.min(100, (sig.tauxMasseSalariale / 50) * 100)}%` }}
                        />
                    </div>
                </div>

                {/* EBE (Rentabilité Opérationnelle) */}
                <div className="bg-white p-5 rounded-2xl border border-sand-200 shadow-card">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-sand-500">EBE / Marge Exploitation</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            sig.tauxEBE >= 12 ? 'bg-success-50 text-success-700' : 'bg-warning-50 text-warning-700'
                        }`}>
                            Norme: 12-20%
                        </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold font-display text-sand-900 tabular-nums">{sig.tauxEBE.toFixed(1)}%</span>
                        <span className="text-xs text-sand-500">du CA Net</span>
                    </div>
                    <p className="text-xs text-sand-600 mt-2">
                        Excédent Brut : <strong className={sig.ebe >= 0 ? 'text-success-700' : 'text-danger-700'}>{formatCurrency(sig.ebe)}</strong>
                    </p>
                    <div className="mt-3 w-full bg-sand-100 rounded-full h-1.5">
                        <div
                            className={`h-1.5 rounded-full ${sig.tauxEBE >= 12 ? 'bg-success-500' : sig.tauxEBE >= 0 ? 'bg-warning-500' : 'bg-danger-500'}`}
                            style={{ width: `${Math.min(100, Math.max(0, (sig.tauxEBE / 25) * 100))}%` }}
                        />
                    </div>
                </div>

                {/* Indice de Sécurité */}
                <div className="bg-white p-5 rounded-2xl border border-sand-200 shadow-card">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-sand-500">Coussin de Sécurité</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            seuil.indiceSecurite >= 10 ? 'bg-success-50 text-success-700' : 'bg-warning-50 text-warning-700'
                        }`}>
                            Point Mort
                        </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold font-display text-sand-900 tabular-nums">{fmtPct(seuil.indiceSecurite)}</span>
                    </div>
                    <p className="text-xs text-sand-600 mt-2">
                        Marge au-dessus du seuil : <strong className="text-sand-900">{formatCurrency(Math.max(0, seuil.margeSecurite))}</strong>
                    </p>
                    <div className="mt-3 w-full bg-sand-100 rounded-full h-1.5">
                        <div
                            className={`h-1.5 rounded-full ${seuil.indiceSecurite >= 15 ? 'bg-gold-500' : 'bg-sand-400'}`}
                            style={{ width: `${Math.min(100, Math.max(0, seuil.indiceSecurite))}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* 3. CASCADE DES SOLDES INTERMÉDIAIRES DE GESTION (SIG - TABLEAU DE BORD EXPERT) */}
            <div className="bg-white rounded-2xl shadow-card border border-sand-200 overflow-hidden">
                <div className="p-5 sm:p-6 border-b border-sand-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-sand-50/50">
                    <div>
                        <h3 className="font-display text-lg font-semibold text-sand-900 flex items-center gap-2">
                            <Award className="w-5 h-5 text-terracotta-500" />
                            Soldes Intermédiaires de Gestion (SIG)
                        </h3>
                        <p className="text-xs text-sand-500 mt-0.5">
                            Décomposition standardisée de la création de valeur et des étapes de rentabilité
                        </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-medium text-sand-600 bg-white px-3 py-1.5 rounded-lg border border-sand-200">
                        <span>Période : {periode.nbJours} jour(s)</span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-sand-100/60 text-sand-600 text-xs uppercase tracking-wider border-b border-sand-200">
                                <th className="py-3 px-4 font-semibold">Poste Comptable</th>
                                <th className="py-3 px-4 font-semibold text-right">Montant (FCFA)</th>
                                <th className="py-3 px-4 font-semibold text-right">% du CA Net</th>
                                <th className="py-3 px-4 font-semibold">Règle d'interprétation & Benchmark</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-sand-100 text-sm">
                            {/* CA NET */}
                            <tr className="bg-sand-50/30 font-medium">
                                <td className="py-3 px-4 text-sand-900 font-bold flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-info-500"></span>
                                    1. Chiffre d'Affaires Net
                                </td>
                                <td className="py-3 px-4 text-right font-bold text-sand-900 tabular-nums">
                                    {formatCurrency(sig.caNet)}
                                </td>
                                <td className="py-3 px-4 text-right font-bold text-sand-900 tabular-nums">
                                    100.0%
                                </td>
                                <td className="py-3 px-4 text-xs text-sand-500">
                                    Boutique : {formatCurrency(sig.caBoutiquePos)} ({canaux.boutique.pourcentageDuTotal.toFixed(0)}%) · Livraisons : {formatCurrency(sig.caLivraisonFacture)} ({canaux.livraison.pourcentageDuTotal.toFixed(0)}%)
                                </td>
                            </tr>

                            {/* COÛT MATIERES */}
                            <tr className="text-danger-700">
                                <td className="py-3 px-4 pl-8 flex items-center gap-2">
                                    <ArrowDownRight className="w-4 h-4 text-danger-500" />
                                    − Consommation de Matières Premières
                                </td>
                                <td className="py-3 px-4 text-right font-medium tabular-nums">
                                    −{formatCurrency(sig.coutMatieresConsommees)}
                                </td>
                                <td className="py-3 px-4 text-right font-medium tabular-nums">
                                    {sig.tauxFoodCost.toFixed(1)}%
                                </td>
                                <td className="py-3 px-4 text-xs text-sand-500">
                                    Farine, levure, sel, améliorants et emballages valorisés au PMP réel
                                </td>
                            </tr>

                            {/* MARGE BRUTE */}
                            <tr className="bg-sand-50/70 font-semibold text-sand-900">
                                <td className="py-3 px-4 flex items-center gap-2 font-bold text-success-800">
                                    <span className="w-2 h-2 rounded-full bg-success-500"></span>
                                    = Marge Brute Matières
                                </td>
                                <td className="py-3 px-4 text-right font-bold text-success-700 tabular-nums">
                                    {formatCurrency(sig.margeBrute)}
                                </td>
                                <td className="py-3 px-4 text-right font-bold text-success-700 tabular-nums">
                                    {sig.tauxMargeBrute.toFixed(1)}%
                                </td>
                                <td className="py-3 px-4 text-xs text-sand-600">
                                    {sig.tauxFoodCost <= 30 ? '✅ Excellent ratio matière (< 30%)' : '⚠️ Ratio matière élevé (> 30%), à surveiller'}
                                </td>
                            </tr>

                            {/* CHARGES EXTERNES */}
                            <tr className="text-danger-700">
                                <td className="py-3 px-4 pl-8 flex items-center gap-2">
                                    <ArrowDownRight className="w-4 h-4 text-danger-500" />
                                    − Charges Externes d'Exploitation
                                </td>
                                <td className="py-3 px-4 text-right font-medium tabular-nums">
                                    −{formatCurrency(sig.chargesExternes)}
                                </td>
                                <td className="py-3 px-4 text-right font-medium tabular-nums">
                                    {sig.tauxChargesExternes.toFixed(1)}%
                                </td>
                                <td className="py-3 px-4 text-xs text-sand-500">
                                    Électricité des fours, loyer, eau, carburant livraison, entretien
                                </td>
                            </tr>

                            {/* VALEUR AJOUTEE */}
                            <tr className="bg-sand-50/70 font-semibold text-sand-900">
                                <td className="py-3 px-4 flex items-center gap-2 font-bold text-sand-900">
                                    <span className="w-2 h-2 rounded-full bg-gold-500"></span>
                                    = Valeur Ajoutée (VA)
                                </td>
                                <td className="py-3 px-4 text-right font-bold text-sand-900 tabular-nums">
                                    {formatCurrency(sig.valeurAjoutee)}
                                </td>
                                <td className="py-3 px-4 text-right font-bold text-sand-900 tabular-nums">
                                    {sig.tauxValeurAjoutee.toFixed(1)}%
                                </td>
                                <td className="py-3 px-4 text-xs text-sand-600">
                                    Richesse brute générée par le travail de transformation de la boulangerie
                                </td>
                            </tr>

                            {/* CHARGES DE PERSONNEL */}
                            <tr className="text-danger-700">
                                <td className="py-3 px-4 pl-8 flex items-center gap-2">
                                    <ArrowDownRight className="w-4 h-4 text-danger-500" />
                                    − Charges de Personnel (Salaires)
                                </td>
                                <td className="py-3 px-4 text-right font-medium tabular-nums">
                                    −{formatCurrency(sig.chargesPersonnel)}
                                </td>
                                <td className="py-3 px-4 text-right font-medium tabular-nums">
                                    {sig.tauxMasseSalariale.toFixed(1)}%
                                </td>
                                <td className="py-3 px-4 text-xs text-sand-500">
                                    Boulangers, pâtissiers, vendeuses et livreurs (idéalement &lt; 38%)
                                </td>
                            </tr>

                            {/* EBE (EXCÉDENT BRUT D'EXPLOITATION) */}
                            <tr className="bg-info-50/60 font-bold text-info-950">
                                <td className="py-3.5 px-4 flex items-center gap-2 font-bold text-info-900">
                                    <span className="w-2.5 h-2.5 rounded-full bg-info-600"></span>
                                    = Excédent Brut d'Exploitation (EBE / EBITDA)
                                </td>
                                <td className="py-3.5 px-4 text-right font-bold text-info-800 text-base tabular-nums">
                                    {formatCurrency(sig.ebe)}
                                </td>
                                <td className="py-3.5 px-4 text-right font-bold text-info-800 text-base tabular-nums">
                                    {sig.tauxEBE.toFixed(1)}%
                                </td>
                                <td className="py-3.5 px-4 text-xs text-info-800">
                                    {sig.tauxEBE >= 12 ? '🌟 Forte rentabilité opérationnelle' : sig.tauxEBE >= 0 ? '👍 Rentabilité modérée' : '❌ Exploitation déficitaire'}
                                </td>
                            </tr>

                            {/* RÉSULTAT NET */}
                            <tr className={sig.resultatNet >= 0 ? 'bg-success-100/40 font-bold' : 'bg-danger-100/40 font-bold'}>
                                <td className="py-4 px-4 flex items-center gap-2 text-base font-extrabold text-sand-950">
                                    🏆 RÉSULTAT NET FINAL
                                </td>
                                <td className={`py-4 px-4 text-right font-extrabold text-lg tabular-nums ${sig.resultatNet >= 0 ? 'text-success-700' : 'text-danger-700'}`}>
                                    {sig.resultatNet > 0 ? '+' : ''}{formatCurrency(sig.resultatNet)}
                                </td>
                                <td className={`py-4 px-4 text-right font-extrabold text-lg tabular-nums ${sig.resultatNet >= 0 ? 'text-success-700' : 'text-danger-700'}`}>
                                    {sig.tauxMargeNette.toFixed(1)}%
                                </td>
                                <td className="py-4 px-4 text-xs font-semibold text-sand-700">
                                    Bénéfice net d'exploitation après couverture de tous les coûts
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 4. ANALYSE PAR CANAL & COÛT DU GASPILLAGE */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Comparatif Canaux : Boutique vs Livraison */}
                <div className="bg-white p-6 rounded-2xl shadow-card border border-sand-200 space-y-4">
                    <h3 className="font-display text-base sm:text-lg font-semibold text-sand-900 flex items-center gap-2">
                        <Store className="w-5 h-5 text-terracotta-500" />
                        Rentabilité par Canal de Vente
                    </h3>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Pôle Boutique */}
                        <div className="p-4 rounded-xl border border-sand-200 bg-sand-50/50 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-sand-700 uppercase flex items-center gap-1.5">
                                    <Store className="w-4 h-4 text-info-600" />
                                    Boutique (Comptoir)
                                </span>
                                <span className="text-xs font-bold text-info-700 bg-info-50 px-2 py-0.5 rounded-full">
                                    {canaux.boutique.pourcentageDuTotal.toFixed(0)}% du CA
                                </span>
                            </div>
                            <p className="text-xl font-bold font-display text-sand-900 tabular-nums">
                                {formatCurrency(canaux.boutique.ca)}
                            </p>
                            <p className="text-xs text-sand-500">
                                Vente directe au détail. Encaissement immédiat en caisse, marge brute optimale.
                            </p>
                        </div>

                        {/* Pôle Livraison B2B */}
                        <div className="p-4 rounded-xl border border-sand-200 bg-sand-50/50 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-sand-700 uppercase flex items-center gap-1.5">
                                    <Truck className="w-4 h-4 text-terracotta-600" />
                                    Livraison (B2B)
                                </span>
                                <span className="text-xs font-bold text-terracotta-700 bg-terracotta-50 px-2 py-0.5 rounded-full">
                                    {canaux.livraison.pourcentageDuTotal.toFixed(0)}% du CA
                                </span>
                            </div>
                            <p className="text-xl font-bold font-display text-sand-900 tabular-nums">
                                {formatCurrency(canaux.livraison.caFacture)}
                            </p>
                            <p className="text-xs text-sand-500">
                                Réseau revendeurs & kiosques. Prix de gros avec gestion des tournées.
                            </p>
                        </div>
                    </div>

                    {/* Focus risque Livraison */}
                    <div className="p-3.5 bg-warning-50/70 rounded-xl border border-warning-200 text-xs text-warning-900 space-y-1">
                        <div className="flex items-center justify-between font-bold">
                            <span>Points de vigilance Livraison :</span>
                            <span>Taux de retours : {canaux.livraison.tauxRetours.toFixed(1)}%</span>
                        </div>
                        <div className="flex items-center justify-between text-warning-800">
                            <span>• Valeur des retours pain non vendus déduits :</span>
                            <span className="font-semibold tabular-nums">{formatCurrency(canaux.livraison.montantRetours)}</span>
                        </div>
                        <div className="flex items-center justify-between text-warning-800">
                            <span>• Créances / Impayés sur la période :</span>
                            <span className="font-semibold tabular-nums">{formatCurrency(canaux.livraison.impayesPeriode)}</span>
                        </div>
                    </div>
                </div>

                {/* Coût du Gaspillage et Pertes */}
                <div className="bg-white p-6 rounded-2xl shadow-card border border-sand-200 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-display text-base sm:text-lg font-semibold text-sand-900 flex items-center gap-2">
                            <ShieldAlert className="w-5 h-5 text-danger-500" />
                            Coût du Gaspillage & Pertes de Marge
                        </h3>
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-danger-50 text-danger-700 border border-danger-100">
                            {gaspillage.pourcentageDuCA.toFixed(1)}% du CA Net
                        </span>
                    </div>

                    <p className="text-xs text-sand-500">
                        Total des invendus retournés par les clients et des pertes matières premières constatées en stock :
                    </p>

                    <div className="p-4 bg-danger-50/40 rounded-2xl border border-danger-100 flex items-center justify-between">
                        <div>
                            <span className="text-xs uppercase font-bold text-danger-600 tracking-wider">Perte Totale de Marge</span>
                            <h4 className="font-display text-2xl font-bold text-danger-700 tabular-nums">
                                {formatCurrency(gaspillage.totalGaspillage)}
                            </h4>
                        </div>
                        <div className="text-right text-xs text-sand-600">
                            <div>Retours clients : <strong className="text-sand-900">{formatCurrency(gaspillage.valeurRetoursClients)}</strong></div>
                            <div className="mt-1">Pertes matières : <strong className="text-sand-900">{formatCurrency(gaspillage.pertesMatieresStock)}</strong></div>
                        </div>
                    </div>

                    <div className="p-3 bg-sand-50 rounded-xl border border-sand-200 text-xs text-sand-600 flex items-start gap-2.5">
                        <Info className="w-4 h-4 text-sand-500 shrink-0 mt-0.5" />
                        <span>
                            <strong>Conseil d'optimisation :</strong> Réduire les retours de 50% grâce à un meilleur ajustement du programme de production permettrait de gagner directement <strong>+{formatCurrency(gaspillage.totalGaspillage * 0.5)}</strong> de bénéfice net.
                        </span>
                    </div>
                </div>
            </div>

            {/* 5. DIAGNOSTIC DE FIABILITÉ COMPTABLE */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-card border border-sand-200">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                    <div>
                        <h3 className="font-display text-base sm:text-lg font-semibold text-sand-900 flex items-center gap-2">
                            <CheckCircle2 className={`w-5 h-5 ${diagnostic.etat === 'fiable' ? 'text-success-600' : 'text-warning-500'}`} />
                            Diagnostic de Fiabilité Comptable
                        </h3>
                        <p className="text-xs text-sand-500 mt-0.5">
                            Contrôle de complétude des saisies avant validation du résultat comptable
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs text-sand-500">Score de complétude :</span>
                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                            diagnostic.etat === 'fiable'
                                ? 'bg-success-100 text-success-800'
                                : diagnostic.etat === 'acceptable'
                                ? 'bg-warning-100 text-warning-800'
                                : 'bg-danger-100 text-danger-800'
                        }`}>
                            {diagnostic.scoreFiabilite}/100 ({diagnostic.etat})
                        </span>
                    </div>
                </div>

                <div className="space-y-2.5">
                    {diagnostic.alertes.map((alt, idx) => (
                        <div
                            key={idx}
                            className={`p-3.5 rounded-xl border flex items-start gap-3 text-xs ${
                                alt.type === 'succes'
                                    ? 'bg-success-50/60 border-success-200 text-success-900'
                                    : alt.type === 'avertissement'
                                    ? 'bg-warning-50/60 border-warning-200 text-warning-900'
                                    : alt.type === 'erreur'
                                    ? 'bg-danger-50/60 border-danger-200 text-danger-900'
                                    : 'bg-sand-50 border-sand-200 text-sand-800'
                            }`}
                        >
                            {alt.type === 'succes' ? (
                                <CheckCircle2 className="w-4 h-4 text-success-600 shrink-0 mt-0.5" />
                            ) : alt.type === 'erreur' ? (
                                <AlertTriangle className="w-4 h-4 text-danger-600 shrink-0 mt-0.5" />
                            ) : alt.type === 'avertissement' ? (
                                <AlertTriangle className="w-4 h-4 text-warning-600 shrink-0 mt-0.5" />
                            ) : (
                                <Info className="w-4 h-4 text-sand-500 shrink-0 mt-0.5" />
                            )}
                            <div>
                                <strong className="font-semibold">{alt.titre} : </strong>
                                <span>{alt.message}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
