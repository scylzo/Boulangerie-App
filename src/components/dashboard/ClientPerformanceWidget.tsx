import React, { useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { formatCurrency } from '../../utils/currency';
import type { Facture, Client } from '../../types';

interface ClientPerformance {
    client: Client;
    totalAchats: number;
    nombreFactures: number;
    moyenneParFacture: number;
    dernierAchat: Date | null;
    tauxPaiement: number; // % de factures payées
    quantiteTotale: number; // Total des quantités livrées
    quantiteRetournee: number; // Total des quantités retournées
    tauxRetour: number; // % de retours (quantiteRetournee / quantiteTotale)
    scorePerformance: number; // Score global (0-100) basé sur CA, paiement et retours
}

interface ClientPerformanceWidgetProps {
    factures: Facture[];
    clients: Client[];
    periodeDays?: number; // Nombre de jours à analyser (par défaut 30)
}

export const ClientPerformanceWidget: React.FC<ClientPerformanceWidgetProps> = ({
    factures,
    clients,
    periodeDays = 30
}) => {
    const [selectedPeriod, setSelectedPeriod] = useState(periodeDays);

    const clientsPerformance = useMemo(() => {
        const now = new Date();
        const startDate = new Date();
        startDate.setDate(now.getDate() - selectedPeriod);
        startDate.setHours(0, 0, 0, 0);

        // Filtrer les factures de la période
        const facturesPeriode = factures.filter(f => {
            const factureDate = new Date(f.dateLivraison);
            return factureDate >= startDate && f.statut !== 'annulee';
        });

        // Calculer les performances par client
        const performanceMap = new Map<string, ClientPerformance>();

        facturesPeriode.forEach(facture => {
            const client = clients.find(c => c.id === facture.clientId);
            if (!client) return;

            const existing = performanceMap.get(facture.clientId);
            const factureTotal = facture.totalTTC;
            const isPaid = facture.statut === 'payee';

            // Calculer les quantités livrées et retournées
            let quantiteLivree = 0;
            let quantiteRetournee = 0;
            facture.lignes.forEach(ligne => {
                quantiteLivree += ligne.quantiteLivree;
                quantiteRetournee += ligne.quantiteRetournee;
            });

            if (existing) {
                existing.totalAchats += factureTotal;
                existing.nombreFactures += 1;
                existing.moyenneParFacture = existing.totalAchats / existing.nombreFactures;
                existing.tauxPaiement = ((existing.tauxPaiement * (existing.nombreFactures - 1) + (isPaid ? 100 : 0)) / existing.nombreFactures);
                existing.quantiteTotale += quantiteLivree;
                existing.quantiteRetournee += quantiteRetournee;
                existing.tauxRetour = existing.quantiteTotale > 0 ? (existing.quantiteRetournee / existing.quantiteTotale) * 100 : 0;

                const factureDate = new Date(facture.dateLivraison);
                if (!existing.dernierAchat || factureDate > existing.dernierAchat) {
                    existing.dernierAchat = factureDate;
                }
            } else {
                const tauxRetour = quantiteLivree > 0 ? (quantiteRetournee / quantiteLivree) * 100 : 0;
                performanceMap.set(facture.clientId, {
                    client,
                    totalAchats: factureTotal,
                    nombreFactures: 1,
                    moyenneParFacture: factureTotal,
                    dernierAchat: new Date(facture.dateLivraison),
                    tauxPaiement: isPaid ? 100 : 0,
                    quantiteTotale: quantiteLivree,
                    quantiteRetournee: quantiteRetournee,
                    tauxRetour: tauxRetour,
                    scorePerformance: 0
                });
            }
        });

        // Calculer le score de performance pour chaque client
        const performances = Array.from(performanceMap.values());
        const maxCA = Math.max(...performances.map(p => p.totalAchats), 1);

        performances.forEach(perf => {
            // Score basé sur 3 critères (0-100) :
            // 1. CA (40%) : Proportionnel au CA max
            const scoreCA = (perf.totalAchats / maxCA) * 40;

            // 2. Taux de paiement (30%)
            const scorePaiement = (perf.tauxPaiement / 100) * 30;

            // 3. Taux de retours (30%) : Inversé (moins de retours = meilleur)
            const scoreRetours = (1 - Math.min(perf.tauxRetour / 100, 1)) * 30;

            perf.scorePerformance = scoreCA + scorePaiement + scoreRetours;
        });

        // Trier par score de performance
        return performances.sort((a, b) => {
            const scoreDiff = b.scorePerformance - a.scorePerformance;
            return scoreDiff !== 0 ? scoreDiff : b.totalAchats - a.totalAchats;
        });
    }, [factures, clients, selectedPeriod]);

    const topClients = clientsPerformance.slice(0, 10);
    const totalRevenue = clientsPerformance.reduce((sum, c) => sum + c.totalAchats, 0);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col hover:shadow-md transition-all duration-200">
            {/* Header */}
            <div className="px-4 py-3 sm:px-5 sm:py-4 md:px-6 md:py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                        <div className="w-8 h-8 sm:w-9 sm:h-9 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                            <Icon icon="mdi:trophy" className="text-lg sm:text-xl text-blue-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Top Clients</h3>
                            <p className="text-xs text-gray-500">Score: CA (40%) + Paiement (30%) + Retours (30%)</p>
                        </div>
                    </div>

                    {/* Sélecteur de période */}
                    <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm border border-gray-200">
                        {[7, 30, 90].map(days => (
                            <button
                                key={days}
                                onClick={() => setSelectedPeriod(days)}
                                className={`px-2 sm:px-3 py-1 text-xs font-semibold rounded transition-all ${selectedPeriod === days
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                {days}J
                            </button>
                        ))}
                    </div>
                </div>

                {/* Stats globales */}
                <div className="grid grid-cols-3 gap-2 mt-4">
                    <div className="bg-white rounded-lg p-2 border border-blue-100">
                        <p className="text-[9px] text-gray-500 font-semibold uppercase tracking-wide">Total</p>
                        <p className="text-sm font-bold text-gray-900">{formatCurrency(totalRevenue)}</p>
                    </div>
                    <div className="bg-white rounded-lg p-2 border border-blue-100">
                        <p className="text-[9px] text-gray-500 font-semibold uppercase tracking-wide">Clients actifs</p>
                        <p className="text-sm font-bold text-gray-900">{clientsPerformance.length}</p>
                    </div>
                    <div className="bg-white rounded-lg p-2 border border-blue-100">
                        <p className="text-[9px] text-gray-500 font-semibold uppercase tracking-wide">Moy./Client</p>
                        <p className="text-sm font-bold text-gray-900">
                            {clientsPerformance.length > 0 ? formatCurrency(totalRevenue / clientsPerformance.length) : '0 F'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Liste des clients */}
            <div className="p-4 sm:p-5 md:p-6 flex-1 overflow-hidden">
                {topClients.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 border border-gray-100">
                            <Icon icon="mdi:chart-line" className="text-3xl text-gray-400" />
                        </div>
                        <p className="font-bold text-gray-900">Aucune donnée</p>
                        <p className="text-sm text-gray-400 mt-1">Aucune vente sur cette période</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {topClients.map((perf, index) => {
                            const partRevenue = (perf.totalAchats / totalRevenue) * 100;
                            const isTop3 = index < 3;

                            return (
                                <div
                                    key={perf.client.id}
                                    className={`relative p-3 sm:p-4 rounded-xl border transition-all hover:shadow-md ${isTop3
                                        ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200'
                                        : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    {/* Rang */}
                                    <div className="absolute -left-2 -top-2">
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs shadow-md ${index === 0 ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white' :
                                            index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white' :
                                                index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-500 text-white' :
                                                    'bg-gray-600 text-white'
                                            }`}>
                                            {index + 1}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between gap-3 ml-4">
                                        {/* Info client */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-bold text-gray-900 text-sm truncate">
                                                    {perf.client.nom}
                                                </h4>
                                                {perf.client.aKiosque && (
                                                    <Icon icon="mdi:store" className="text-blue-600 text-sm shrink-0" />
                                                )}
                                                {/* Score de performance */}
                                                <div className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${perf.scorePerformance >= 80 ? 'bg-green-100 text-green-700' :
                                                    perf.scorePerformance >= 60 ? 'bg-blue-100 text-blue-700' :
                                                        perf.scorePerformance >= 40 ? 'bg-orange-100 text-orange-700' :
                                                            'bg-red-100 text-red-700'
                                                    }`}>
                                                    {perf.scorePerformance.toFixed(0)}/100
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                                                <span className="inline-flex items-center gap-1">
                                                    <Icon icon="mdi:receipt-text" className="text-xs" />
                                                    {perf.nombreFactures} facture{perf.nombreFactures > 1 ? 's' : ''}
                                                </span>
                                                <span className="text-gray-300">•</span>
                                                <span className="inline-flex items-center gap-1">
                                                    <Icon icon="mdi:chart-line" className="text-xs" />
                                                    {formatCurrency(perf.moyenneParFacture)}/facture
                                                </span>
                                                <span className="text-gray-300">•</span>
                                                <span className={`inline-flex items-center gap-1 font-semibold ${perf.tauxRetour <= 5 ? 'text-green-600' :
                                                    perf.tauxRetour <= 15 ? 'text-orange-600' :
                                                        'text-red-600'
                                                    }`}>
                                                    <Icon icon="mdi:package-variant-closed-remove" className="text-xs" />
                                                    {perf.tauxRetour.toFixed(1)}% retours
                                                </span>
                                            </div>

                                            {/* Barre de progression */}
                                            <div className="mt-2">
                                                <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
                                                    <span>{partRevenue.toFixed(1)}% du CA</span>
                                                    <span className={`font-semibold ${perf.tauxPaiement === 100 ? 'text-green-600' :
                                                        perf.tauxPaiement >= 50 ? 'text-orange-600' :
                                                            'text-red-600'
                                                        }`}>
                                                        {perf.tauxPaiement.toFixed(0)}% payé
                                                    </span>
                                                </div>
                                                <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-500 ${isTop3 ? 'bg-gradient-to-r from-amber-500 to-yellow-500' : 'bg-blue-500'
                                                            }`}
                                                        style={{ width: `${Math.min(100, partRevenue * 2)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Total */}
                                        <div className="text-right shrink-0">
                                            <p className="text-lg sm:text-xl font-black text-gray-900">
                                                {formatCurrency(perf.totalAchats)}
                                            </p>
                                            {perf.dernierAchat && (
                                                <p className="text-[10px] text-gray-500 mt-1">
                                                    {new Date(perf.dernierAchat).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
