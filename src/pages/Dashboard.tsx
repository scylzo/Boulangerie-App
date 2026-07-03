import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { useFacturationStore } from '../store/facturationStore';
import { useStockStore } from '../store/stockStore';
import { useProductionStore } from '../store/productionStore';
import { useReferentielStore } from '../store/referentielStore';
import { formatCurrency } from '../utils/currency';
import { formaterQuantite } from '../utils/calculations';
import { ClientPerformanceWidget } from '../components/dashboard/ClientPerformanceWidget';
import { PeriodeSelector } from '../components/dashboard/PeriodeSelector';
import { EmptyState, TrendChart, RadialGauge } from '../components/ui';

export const Dashboard: React.FC = () => {
    const { factures, chargerFactures } = useFacturationStore();
    const { matieres, chargerDonnees: chargerStock } = useStockStore();
    const { programmeActuel, chargerProgramme } = useProductionStore();
    const { clients, chargerClients } = useReferentielStore();

    // État pour la période de performance
    const [dateDebut, setDateDebut] = useState(() => {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        return date.toISOString().split('T')[0];
    });
    const [dateFin, setDateFin] = useState(() => {
        return new Date().toISOString().split('T')[0];
    });

    useEffect(() => {
        const init = async () => {
            await Promise.all([
                chargerFactures(),
                chargerStock(),
                chargerProgramme(new Date()),
                chargerClients()
            ]);
        };
        init();
    }, []);

    // Stats Facturation
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const statsFinances = useMemo(() => {
        // Invoices DELIVERED today
        const invoicesToday = factures.filter(f => {
            const d = new Date(f.dateLivraison);
            d.setHours(0, 0, 0, 0);
            return d.getTime() === today.getTime() && f.statut !== 'annulee';
        });

        const totalVentesToday = invoicesToday.reduce((sum, f) => sum + f.totalTTC, 0);

        // Unpaid from TODAY'S deliveries
        const todayUnpaid = invoicesToday
            .filter(f => f.statut !== 'payee')
            .reduce((sum, f) => sum + (f.netAPayer ?? f.totalTTC), 0);

        // Actually received TODAY (can be for today's or past invoices)
        const totalReceivedToday = factures
            .filter(f => f.paidAt && (f.statut === 'payee' || (f.montantRegle || 0) > 0))
            .filter(f => {
                const lp = new Date(f.paidAt!);
                lp.setHours(0, 0, 0, 0);
                return lp.getTime() === today.getTime();
            })
            .reduce((sum, f) => sum + (f.montantRegle || 0), 0);

        const totalImpayeGlobal = factures
            .filter(f => f.statut !== 'payee' && f.statut !== 'annulee')
            .reduce((sum, f) => sum + (f.netAPayer ?? f.totalTTC), 0);

        return {
            totalVentesToday,
            todayUnpaid,
            totalReceivedToday,
            totalImpayeGlobal,
            countToday: invoicesToday.length
        };
    }, [factures]);

    // Stats Stock
    const lowStockItems = useMemo(() => {
        return matieres.filter(m => m.active && m.stockActuel <= m.stockMinimum);
    }, [matieres]);

    // Stats Production
    const productionProgress = useMemo(() => {
        if (!programmeActuel || !programmeActuel.totauxParProduit) return 0;

        const totalPlanned = programmeActuel.totauxParProduit.reduce((sum, p) => sum + (p.totalGlobal || 0), 0);
        if (totalPlanned === 0) return 0;

        const totalProduced = programmeActuel.totauxParProduit.reduce((sum, item) => {
            const actualRecorded = programmeActuel.productionReelle?.find(p => p.produitId === item.produitId);
            const val = actualRecorded
                ? actualRecorded.quantite
                : (programmeActuel.statut === 'produit' ? item.totalGlobal : 0);
            return sum + val;
        }, 0);

        return Math.round((totalProduced / totalPlanned) * 100);
    }, [programmeActuel]);

    // Stats Clients
    const statsClients = useMemo(() => {
        const activeClients = clients.filter(c => c.active);
        const withKiosk = activeClients.filter(c => c.aKiosque).length;
        const noKiosk = activeClients.length - withKiosk;
        return { total: activeClients.length, withKiosk, noKiosk };
    }, [clients]);

    // Série CA — 7 derniers jours (à partir des factures livrées, hors annulées)
    const caSeries = useMemo(() => {
        const days: { label: string; value: number }[] = [];
        for (let i = 6; i >= 0; i--) {
            const day = new Date();
            day.setHours(0, 0, 0, 0);
            day.setDate(day.getDate() - i);
            const next = new Date(day);
            next.setDate(day.getDate() + 1);
            const total = factures
                .filter(f => f.statut !== 'annulee')
                .filter(f => {
                    const d = new Date(f.dateLivraison);
                    return d >= day && d < next;
                })
                .reduce((s, f) => s + f.totalTTC, 0);
            days.push({
                label: day.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', ''),
                value: total,
            });
        }
        return days;
    }, [factures]);

    return (
        <div className="space-y-4 sm:space-y-6 p-3 sm:p-4 md:p-6 pb-20 bg-sand-100 min-h-screen overflow-x-hidden">
            {/* Welcome Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                <div className="min-w-0 flex-1">
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold text-sand-900 tracking-tight truncate">Tableau de bord</h1>
                    <p className="text-sand-500 mt-1 text-xs sm:text-sm">Gestion centralisée de l'activité du jour</p>
                </div>
                <div className="flex bg-white px-3 sm:px-4 md:px-5 py-2 md:py-3 rounded-xl shadow-card border border-sand-200 items-center gap-2 sm:gap-3 self-start sm:self-center shrink-0">
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-terracotta-50 rounded-lg flex items-center justify-center">
                        <Icon icon="mdi:calendar-today" className="text-terracotta-600 text-lg md:text-xl" />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-[9px] md:text-[10px] text-sand-500 font-semibold uppercase tracking-wide leading-none mb-1">Date du jour</span>
                        <span className="font-semibold text-sand-700 capitalize text-xs sm:text-sm md:text-base truncate">
                            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </span>
                    </div>
                </div>
            </div>

            {/* Main Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
                <StatCard
                    title="Ventes du jour"
                    value={formatCurrency(statsFinances.totalVentesToday)}
                    subtitle={`${statsFinances.countToday} factures livrées`}
                    icon="mdi:truck-delivery"
                    color="brand"
                />
                <StatCard
                    title="Encaissé ce jour"
                    value={formatCurrency(statsFinances.totalReceivedToday)}
                    subtitle="Recettes réelles (Cash)"
                    icon="mdi:cash-check"
                    color="success"
                />
                <StatCard
                    title="Impayés du jour"
                    value={formatCurrency(statsFinances.todayUnpaid)}
                    subtitle={`Dette globale: ${formatCurrency(statsFinances.totalImpayeGlobal)}`}
                    icon="mdi:alert-circle-outline"
                    color="danger"
                />
                <StatCard
                    title="Alertes Stock"
                    value={lowStockItems.length.toString()}
                    subtitle="Articles sous le seuil"
                    icon="mdi:warehouse"
                    color={lowStockItems.length > 0 ? "warning" : "neutral"}
                />
            </div>

            {/* Tendance CA — 7 derniers jours */}
            <div className="bg-white border border-sand-200 rounded-xl shadow-card p-4 sm:p-5 overflow-hidden">
                <div className="flex items-center justify-between mb-4 gap-3">
                    <div className="min-w-0">
                        <h2 className="text-sm font-semibold text-sand-900">Chiffre d'affaires</h2>
                        <p className="text-xs text-sand-500">7 derniers jours</p>
                    </div>
                    <span className="text-xs font-medium text-sand-500 tabular-nums shrink-0">
                        Total&nbsp;: {formatCurrency(caSeries.reduce((s, d) => s + d.value, 0))}
                    </span>
                </div>
                <TrendChart data={caSeries} height={150} className="text-sand-900" valueFormat={(v) => formatCurrency(v)} />
            </div>

            {/* Grid Layout for details */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                {/* Production Details */}
                <DashboardBox
                    title="Production du jour"
                    icon="mdi:bread"
                    className="md:col-span-2"
                    headerAction={
                        <div className="flex items-center gap-2 sm:gap-3">
                            <span className={`px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-semibold uppercase tracking-widest ${programmeActuel?.statut === 'produit' ? 'bg-success-50 text-success-700' : 'bg-terracotta-50 text-terracotta-700'
                                }`}>
                                {programmeActuel?.statut === 'produit' ? 'Terminée' : 'En cours'}
                            </span>
                            <RadialGauge value={productionProgress} size={52} stroke={6} className="text-sand-900" />

                        </div>
                    }
                >
                    {!programmeActuel || !programmeActuel.totauxParProduit || programmeActuel.totauxParProduit.length === 0 ? (
                        <EmptyState icon="mdi:bread" title="Aucun programme de production" description="Aucun programme de production n'est planifié pour aujourd'hui." />
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6">
                            {programmeActuel.totauxParProduit.map(item => {
                                const actualRecorded = programmeActuel.productionReelle?.find(p => p.produitId === item.produitId);
                                const produced = actualRecorded
                                    ? actualRecorded.quantite
                                    : (programmeActuel.statut === 'produit' ? item.totalGlobal : 0);

                                const percent = Math.min(100, Math.round((produced / item.totalGlobal) * 100));
                                return (
                                    <div key={item.produitId} className="group">
                                        <div className="flex justify-between text-sm mb-2 px-1">
                                            <span className="font-semibold text-sand-700 group-hover:text-sand-900 transition-colors uppercase tracking-tight text-[10px] sm:text-xs truncate max-w-[120px]" title={item.produit?.nom}>{item.produit?.nom}</span>
                                            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                                                <span className="font-semibold text-sand-900 text-xs sm:text-sm">{produced}</span>
                                                <span className="text-sand-300">/</span>
                                                <span className="text-sand-500 font-medium text-xs sm:text-sm">{item.totalGlobal}</span>
                                            </div>
                                        </div>
                                        <div className="h-2 w-full bg-sand-200 rounded-full overflow-hidden">
                                            <div className={`h-full bg-terracotta-500 rounded-full transition-all duration-1000 ease-out`} style={{ width: `${percent}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </DashboardBox>

                <div className="space-y-6 md:space-y-8 flex flex-col md:col-span-2 xl:col-span-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-6 md:gap-8">
                        {/* Stock Alerts Small Box */}
                        <DashboardBox title="Alertes Stock" icon="mdi:alert-box" className="h-full">
                            {lowStockItems.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-10 text-center">
                                    <div className="w-16 h-16 bg-success-50 rounded-full flex items-center justify-center mb-4 border border-success-100">
                                        <Icon icon="mdi:check-circle" className="text-3xl text-success-500" />
                                    </div>
                                    <p className="font-semibold text-sand-900">Stock optimal</p>
                                    <p className="text-sm text-sand-500 mt-1">Aucun article n'est sous le seuil d'alerte pour le moment.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {lowStockItems.slice(0, 4).map(item => (
                                        <div key={item.id} className="flex items-center justify-between p-3 md:p-4 bg-white rounded-xl border border-sand-200 group hover:border-terracotta-300 transition-all cursor-default shadow-soft">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 md:w-10 md:h-10 bg-terracotta-50 rounded-lg md:rounded-xl flex items-center justify-center text-terracotta-600 font-semibold text-xs md:text-sm">
                                                    {item.nom.charAt(0)}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <h4 className="font-semibold text-sand-900 text-xs md:text-sm leading-tight uppercase tracking-tight truncate">{item.nom}</h4>
                                                    <p className="text-[9px] md:text-[10px] text-sand-500 font-semibold uppercase tracking-widest mt-0.5">Seuil: {item.stockMinimum}</p>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <span className="font-display font-semibold text-warning-600 text-lg md:text-xl leading-none">
                                                    {formaterQuantite(item.stockActuel)}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </DashboardBox>

                        {/* Client Box Small */}
                        <DashboardBox title="Base Clients" icon="mdi:account-group">
                            <div className="grid grid-cols-2 gap-3 md:gap-4 mb-6 md:mb-8">
                                <div className="bg-sand-100 p-3 md:p-4 rounded-xl border border-sand-200">
                                    <p className="text-[9px] md:text-[10px] text-sand-500 font-semibold uppercase tracking-widest mb-1">Actifs</p>
                                    <div className="font-display text-xl md:text-2xl font-semibold text-sand-900">{statsClients.total}</div>
                                </div>
                                <div className="bg-sand-900 p-3 md:p-4 rounded-xl">
                                    <p className="text-[9px] md:text-[10px] text-sand-400 font-semibold uppercase tracking-widest mb-1">Kiosques</p>
                                    <div className="font-display text-xl md:text-2xl font-semibold text-white">{statsClients.withKiosk}</div>
                                </div>
                                <div className="col-span-2 bg-white p-3 md:p-4 rounded-xl border border-dashed border-sand-300">
                                    <p className="text-[9px] md:text-[10px] text-sand-500 font-semibold uppercase tracking-widest mb-1">Hors-kiosque</p>
                                    <div className="font-display text-lg md:text-xl font-semibold text-sand-700">{statsClients.noKiosk}</div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-[10px] font-semibold text-sand-500 uppercase tracking-[0.2em] mb-4">Nouveaux arrivés</h4>
                                {clients.slice(0, 3).map(client => (
                                    <div key={client.id} className="flex items-center gap-3 group p-1">
                                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-sand-100 flex items-center justify-center font-semibold text-[10px] md:text-sm text-sand-500 border border-sand-200 group-hover:bg-terracotta-500 group-hover:text-white group-hover:border-terracotta-500 transition-all">
                                            {client.nom.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs md:text-sm font-semibold text-sand-800 truncate uppercase tracking-tight">{client.nom}</p>
                                            <p className="text-[10px] md:text-xs text-sand-500 font-medium truncate">{client.telephone || 'Aucun numéro'}</p>
                                        </div>
                                        <div className="flex gap-2 shrink-0">
                                            {client.aKiosque && (
                                                <div className="w-6 h-6 md:w-7 md:h-7 bg-terracotta-50 rounded-lg flex items-center justify-center text-terracotta-600 border border-terracotta-100" title="Kiosque">
                                                    <Icon icon="mdi:store" className="text-sm md:text-lg" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </DashboardBox>
                    </div>
                </div>
            </div>

            {/* Widget Performances Clients - Pleine largeur */}
            <div className="mt-4 sm:mt-6 space-y-4">
                <PeriodeSelector
                    dateDebut={dateDebut}
                    dateFin={dateFin}
                    onDateDebutChange={setDateDebut}
                    onDateFinChange={setDateFin}
                />
                <ClientPerformanceWidget
                    factures={factures}
                    clients={clients}
                    dateDebut={dateDebut}
                    dateFin={dateFin}
                />
            </div>
        </div>
    );
};

const StatCard: React.FC<{ title: string; value: string; subtitle: string; icon: string; color: 'brand' | 'danger' | 'warning' | 'success' | 'neutral' }> = ({ title, value, subtitle, icon, color }) => {
    const colorConfig = {
        brand: { bg: 'bg-terracotta-50', text: 'text-terracotta-600' },
        danger: { bg: 'bg-danger-50', text: 'text-danger-600' },
        warning: { bg: 'bg-warning-50', text: 'text-warning-600' },
        success: { bg: 'bg-success-50', text: 'text-success-600' },
        neutral: { bg: 'bg-sand-100', text: 'text-sand-600' },
    };

    const cfg = colorConfig[color];

    return (
        <div className="bg-white rounded-2xl shadow-card border border-sand-200 p-5 overflow-hidden group hover:shadow-elevated transition-all duration-200">
            <div className="flex items-center justify-between gap-2 mb-4">
                <h3 className="text-[10px] sm:text-xs font-semibold text-sand-500 uppercase tracking-wide truncate">{title}</h3>
                <div className={`w-11 h-11 rounded-full ${cfg.bg} ${cfg.text} flex items-center justify-center shrink-0`}>
                    <Icon icon={icon} className="text-xl" />
                </div>
            </div>
            <p className="font-display text-2xl sm:text-3xl font-semibold text-sand-900 tracking-tight truncate tabular-nums" title={value}>{value}</p>
            <p className="mt-2 text-xs text-sand-500 truncate" title={subtitle}>{subtitle}</p>
        </div>
    );
};

const DashboardBox: React.FC<{
    title: string;
    icon: string;
    children: React.ReactNode;
    className?: string;
    headerAction?: React.ReactNode;
}> = ({ title, icon, children, className, headerAction }) => (
    <div className={`bg-white rounded-xl shadow-card border border-sand-200 overflow-hidden flex flex-col hover:shadow-elevated transition-all duration-200 ${className}`}>
        <div className="px-4 py-3 sm:px-5 sm:py-4 md:px-6 md:py-4 border-b border-sand-200 flex items-center justify-between bg-sand-50">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <div className="w-8 h-8 sm:w-9 sm:h-9 bg-terracotta-50 rounded-lg flex items-center justify-center shrink-0">
                    <Icon icon={icon} className="text-lg sm:text-xl text-terracotta-600" />
                </div>
                <h3 className="font-display font-semibold text-sand-900 text-sm sm:text-base truncate">{title}</h3>
            </div>
            {headerAction ? headerAction : (
                <button className="w-7 h-7 sm:w-8 sm:h-8 rounded-full hover:bg-sand-100 flex items-center justify-center text-sand-500 transition-colors shrink-0">
                    <Icon icon="mdi:dots-horizontal" className="text-lg sm:text-xl" />
                </button>
            )}
        </div>
        <div className="p-4 sm:p-5 md:p-6 flex-1 overflow-hidden">
            {children}
        </div>
    </div>
);
