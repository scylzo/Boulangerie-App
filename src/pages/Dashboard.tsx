import React, { useEffect, useMemo } from 'react';
import { Icon } from '@iconify/react';
import { useFacturationStore } from '../store/facturationStore';
import { useStockStore } from '../store/stockStore';
import { useProductionStore } from '../store/productionStore';
import { useReferentielStore } from '../store/referentielStore';
import { formatCurrency } from '../utils/currency';
import { ClientPerformanceWidget } from '../components/dashboard/ClientPerformanceWidget';

export const Dashboard: React.FC = () => {
    const { factures, chargerFactures } = useFacturationStore();
    const { matieres, chargerDonnees: chargerStock } = useStockStore();
    const { programmeActuel, chargerProgramme } = useProductionStore();
    const { clients, chargerClients } = useReferentielStore();

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

    return (
        <div className="space-y-4 sm:space-y-6 p-3 sm:p-4 md:p-6 pb-20 bg-gray-50 min-h-screen overflow-x-hidden">
            {/* Welcome Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                <div className="min-w-0 flex-1">
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 tracking-tight truncate">Tableau de bord</h1>
                    <p className="text-gray-500 mt-1 text-xs sm:text-sm truncate">Gestion centralisée de l'activité du jour</p>
                </div>
                <div className="flex bg-white px-3 sm:px-4 md:px-5 py-2 md:py-3 rounded-xl shadow-sm border border-gray-200 items-center gap-2 sm:gap-3 self-start sm:self-center shrink-0">
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                        <Icon icon="mdi:calendar-today" className="text-gray-600 text-lg md:text-xl" />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-[9px] md:text-[10px] text-gray-400 font-semibold uppercase tracking-wide leading-none mb-1">Date du jour</span>
                        <span className="font-semibold text-gray-700 capitalize text-xs sm:text-sm md:text-base truncate">
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
                    color="slate"
                />
                <StatCard
                    title="Encaissé ce jour"
                    value={formatCurrency(statsFinances.totalReceivedToday)}
                    subtitle="Recettes réelles (Cash)"
                    icon="mdi:cash-check"
                    color="slate"
                />
                <StatCard
                    title="Impayés du jour"
                    value={formatCurrency(statsFinances.todayUnpaid)}
                    subtitle={`Dette globale: ${formatCurrency(statsFinances.totalImpayeGlobal)}`}
                    icon="mdi:alert-circle-outline"
                    color="red"
                />
                <StatCard
                    title="Alertes Stock"
                    value={lowStockItems.length.toString()}
                    subtitle="Articles sous le seuil"
                    icon="mdi:warehouse"
                    color={lowStockItems.length > 0 ? "orange" : "slate"}
                />
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
                            <span className={`px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest ${programmeActuel?.statut === 'produit' ? 'bg-slate-100 text-slate-600' : 'bg-orange-50 text-orange-600'
                                }`}>
                                {programmeActuel?.statut === 'produit' ? 'Terminée' : 'En cours'}
                            </span>
                            <div className="flex flex-col items-end">
                                <span className="text-lg sm:text-xl font-black text-slate-900 leading-none">{productionProgress}%</span>
                                <span className="text-[8px] sm:text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Avancement</span>
                            </div>
                        </div>
                    }
                >
                    {!programmeActuel || !programmeActuel.totauxParProduit || programmeActuel.totauxParProduit.length === 0 ? (
                        <EmptyState message="Aucun programme de production pour aujourd'hui" />
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
                                            <span className="font-bold text-slate-700 group-hover:text-slate-900 transition-colors uppercase tracking-tight text-[10px] sm:text-xs truncate max-w-[120px]" title={item.produit?.nom}>{item.produit?.nom}</span>
                                            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                                                <span className="font-black text-slate-900 text-xs sm:text-sm">{produced}</span>
                                                <span className="text-slate-300">/</span>
                                                <span className="text-slate-500 font-medium text-xs sm:text-sm">{item.totalGlobal}</span>
                                            </div>
                                        </div>
                                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                            <div className={`h-full bg-slate-600 rounded-full transition-all duration-1000 ease-out`} style={{ width: `${percent}%` }} />
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
                                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                                        <Icon icon="mdi:check-circle" className="text-3xl text-slate-400" />
                                    </div>
                                    <p className="font-bold text-slate-900">Stock optimal</p>
                                    <p className="text-sm text-slate-400 mt-1">Aucun article n'est sous le seuil d'alerte pour le moment.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {lowStockItems.slice(0, 4).map(item => (
                                        <div key={item.id} className="flex items-center justify-between p-3 md:p-4 bg-white rounded-2xl border border-slate-100 group hover:border-slate-300 transition-all cursor-default shadow-sm shadow-slate-200/50">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 md:w-10 md:h-10 bg-slate-50 rounded-lg md:rounded-xl flex items-center justify-center text-slate-600 font-black text-xs md:text-sm">
                                                    {item.nom.charAt(0)}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <h4 className="font-bold text-slate-900 text-xs md:text-sm leading-tight uppercase tracking-tight truncate">{item.nom}</h4>
                                                    <p className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Seuil: {item.stockMinimum}</p>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <span className="font-black text-slate-700 text-lg md:text-xl leading-none">{item.stockActuel}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </DashboardBox>

                        {/* Client Box Small */}
                        <DashboardBox title="Base Clients" icon="mdi:account-group">
                            <div className="grid grid-cols-2 gap-3 md:gap-4 mb-6 md:mb-8">
                                <div className="bg-slate-50 p-3 md:p-4 rounded-2xl border border-slate-200">
                                    <p className="text-[9px] md:text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Actifs</p>
                                    <div className="text-xl md:text-2xl font-black text-slate-800">{statsClients.total}</div>
                                </div>
                                <div className="bg-slate-900 p-3 md:p-4 rounded-2xl">
                                    <p className="text-[9px] md:text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Kiosques</p>
                                    <div className="text-xl md:text-2xl font-black text-white">{statsClients.withKiosk}</div>
                                </div>
                                <div className="col-span-2 bg-white p-3 md:p-4 rounded-2xl border border-dashed border-slate-200">
                                    <p className="text-[9px] md:text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1 font-inter">Hors-kiosque</p>
                                    <div className="text-lg md:text-xl font-bold text-slate-600">{statsClients.noKiosk}</div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Nouveaux arrivés</h4>
                                {clients.slice(0, 3).map(client => (
                                    <div key={client.id} className="flex items-center gap-3 group p-1">
                                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-slate-100 flex items-center justify-center font-black text-[10px] md:text-sm text-slate-400 border border-slate-200 group-hover:bg-slate-900 group-hover:text-white transition-all">
                                            {client.nom.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs md:text-sm font-bold text-slate-800 truncate uppercase tracking-tight">{client.nom}</p>
                                            <p className="text-[10px] md:text-xs text-slate-400 font-medium truncate">{client.telephone || 'Aucun numéro'}</p>
                                        </div>
                                        <div className="flex gap-2 shrink-0">
                                            {client.aKiosque && (
                                                <div className="w-6 h-6 md:w-7 md:h-7 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600 border border-slate-200" title="Kiosque">
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
            <div className="mt-4 sm:mt-6">
                <ClientPerformanceWidget factures={factures} clients={clients} periodeDays={30} />
            </div>
        </div>
    );
};

const StatCard: React.FC<{ title: string; value: string; subtitle: string; icon: string; color: 'blue' | 'red' | 'orange' | 'green' | 'slate'; progress?: number }> = ({ title, value, subtitle, icon, color, progress }) => {
    const colorConfig = {
        blue: { bg: 'bg-gray-50', text: 'text-gray-600', accent: 'bg-gray-600', light: 'bg-gray-100' },
        red: { bg: 'bg-red-50', text: 'text-red-600', accent: 'bg-red-500', light: 'bg-red-100' },
        orange: { bg: 'bg-orange-50', text: 'text-orange-600', accent: 'bg-orange-500', light: 'bg-orange-100' },
        green: { bg: 'bg-emerald-50', text: 'text-emerald-600', accent: 'bg-emerald-500', light: 'bg-emerald-100' },
        slate: { bg: 'bg-gray-50', text: 'text-gray-600', accent: 'bg-gray-600', light: 'bg-gray-100' },
    };

    const cfg = colorConfig[color];

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5 md:p-6 relative overflow-hidden group hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-lg ${cfg.bg} ${cfg.text} flex items-center justify-center shrink-0`}>
                    <Icon icon={icon} className="text-xl sm:text-2xl" />
                </div>
                {progress !== undefined && (
                    <span className={`text-[9px] sm:text-[10px] font-semibold px-2 py-1 rounded-full ${cfg.bg} ${cfg.text} uppercase tracking-wide`}>Direct</span>
                )}
            </div>

            <div className="relative z-10 min-w-0">
                <h3 className="text-[9px] sm:text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1 sm:mb-2 truncate">{title}</h3>
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 tracking-tight mb-1 truncate" title={value}>{value}</p>
                <p className="text-[10px] sm:text-xs text-gray-500 truncate" title={subtitle}>{subtitle}</p>
            </div>
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
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col hover:shadow-md transition-all duration-200 ${className}`}>
        <div className="px-4 py-3 sm:px-5 sm:py-4 md:px-6 md:py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                    <Icon icon={icon} className="text-lg sm:text-xl text-gray-600" />
                </div>
                <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">{title}</h3>
            </div>
            {headerAction ? headerAction : (
                <button className="w-7 h-7 sm:w-8 sm:h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-colors shrink-0">
                    <Icon icon="mdi:dots-horizontal" className="text-lg sm:text-xl" />
                </button>
            )}
        </div>
        <div className="p-4 sm:p-5 md:p-6 flex-1 overflow-hidden">
            {children}
        </div>
    </div>
);

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
    <div className="flex flex-col items-center justify-center py-16 text-gray-300">
        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
            <Icon icon="mdi:rocket-launch-outline" className="text-5xl" />
        </div>
        <p className="text-sm font-bold uppercase tracking-widest text-center max-w-[200px] leading-relaxed">{message}</p>
    </div>
);
