import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Icon } from '@iconify/react';
import { useReferentielStore } from '../../store/referentielStore';
import { useLivraisonStore } from '../../store/livraisonStore';
import { useLivreurStore } from '../../store/livreurStore';
import { TableLoader } from '../../components/ui/Loader';
import { formatCurrency } from '../../utils/currency';

// Création d'icônes personnalisées pour les différents niveaux de performance
const createCustomIcon = (color: string) => {
    return new L.DivIcon({
        className: 'custom-marker',
        html: `
            <div style="
                background-color: ${color};
                width: 30px;
                height: 30px;
                border-radius: 50% 50% 50% 0;
                transform: rotate(-45deg);
                display: flex;
                align-items: center;
                justify-content: center;
                border: 2px solid white;
                box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            ">
                <div style="
                    width: 12px;
                    height: 12px;
                    background-color: rgba(255,255,255,0.8);
                    border-radius: 50%;
                    transform: rotate(45deg);
                "></div>
            </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -30]
    });
};

const icons = {
    excellent: createCustomIcon('#10b981'), // Emerald 500
    moyen: createCustomIcon('#f59e0b'),    // Amber 500
    faible: createCustomIcon('#ef4444'),    // Red 500
    inconnu: createCustomIcon('#6b11cb')    // Indigo 600 (par défaut)
};

// Couleurs pour les zones de livraison
const ZONE_COLORS = [
    '#3b82f6', // Blue
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#f97316', // Orange
    '#84cc16', // Lime
];

export const CarteKiosques: React.FC = () => {
    const { clients, chargerClients, isLoadingClients } = useReferentielStore();
    const { invendusClients, chargerInvendusDuJour } = useLivraisonStore();
    const { livreurs, chargerLivreurs } = useLivreurStore();

    const [counts, setCounts] = useState({ total: 0, mapped: 0 });
    const [dateSelectionnee] = useState(new Date());
    const [afficherZones, setAfficherZones] = useState(true);

    useEffect(() => {
        chargerClients();
        chargerLivreurs();
        chargerInvendusDuJour(dateSelectionnee);
    }, [chargerClients, chargerLivreurs, chargerInvendusDuJour, dateSelectionnee]);

    useEffect(() => {
        const kiosques = clients.filter(c => c.aKiosque);
        const mapped = kiosques.filter(c => c.latitude && c.longitude);
        setCounts({
            total: kiosques.length,
            mapped: mapped.length
        });
    }, [clients]);

    // Calcul de la performance par client
    const performanceData = useMemo(() => {
        const stats: Record<string, { taux: number; montantVendu: number }> = {};
        invendusClients.forEach(inv => {
            let totalLivré = 0;
            let totalVendu = 0;
            let totalValeurVendu = 0;
            inv.produits.forEach(p => {
                totalLivré += p.quantiteLivree;
                totalVendu += p.vendu;
                totalValeurVendu += p.vendu * (p.produit?.prixClient || 0);
            });
            if (totalLivré > 0) {
                stats[inv.clientId] = {
                    taux: (totalVendu / totalLivré) * 100,
                    montantVendu: totalValeurVendu
                };
            }
        });
        return stats;
    }, [invendusClients]);

    // Groupement des clients par livreur pour les zones
    const zonesLivraison = useMemo(() => {
        const zones: Record<string, { points: [number, number][]; color: string; livreurNom: string }> = {};

        clients.forEach((client) => {
            if (client.latitude && client.longitude && client.livreurId) {
                if (!zones[client.livreurId]) {
                    const livreur = livreurs.find(l => l.id === client.livreurId);
                    const colorIndex = Object.keys(zones).length % ZONE_COLORS.length;
                    zones[client.livreurId] = {
                        points: [],
                        color: ZONE_COLORS[colorIndex],
                        livreurNom: livreur?.nom || 'Livreur Inconnu'
                    };
                }
                zones[client.livreurId].points.push([client.latitude, client.longitude]);
            }
        });

        return zones;
    }, [clients, livreurs]);

    const center: [number, number] = [14.7167, -17.4677];

    if (isLoadingClients || isLoadingClients) {
        return <TableLoader message="Initialisation des systèmes cartographiques..." />;
    }

    const kiosquesMapped = clients.filter(c => c.aKiosque && c.latitude && c.longitude);

    const getPerformanceInfo = (clientId: string) => {
        const perf = performanceData[clientId];
        if (!perf) return { color: '#6b11cb', label: 'Données indisponibles', icon: icons.inconnu, taux: null };
        if (perf.taux >= 90) return { color: '#10b981', label: 'Excellent (>90%)', icon: icons.excellent, taux: perf.taux, montant: perf.montantVendu };
        if (perf.taux >= 70) return { color: '#f59e0b', label: 'Moyen (70-90%)', icon: icons.moyen, taux: perf.taux, montant: perf.montantVendu };
        return { color: '#ef4444', label: 'Critique (<70%)', icon: icons.faible, taux: perf.taux, montant: perf.montantVendu };
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-jakarta">
            {/* Header Intelligent */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm z-20">
                <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gray-900 rounded-2xl flex items-center justify-center shadow-xl">
                            <Icon icon="mdi:map-marker-path" className="text-2xl text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-gray-900 uppercase tracking-tight">Supervision Géo-Performance</h1>
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest text-emerald-600">Système Live</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                        {/* Toggle Zones */}
                        <button
                            onClick={() => setAfficherZones(!afficherZones)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${afficherZones
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                                    : 'bg-gray-100 text-gray-400 border border-gray-200'
                                }`}
                        >
                            <Icon icon={afficherZones ? "mdi:layers" : "mdi:layers-off"} className="text-lg" />
                            {afficherZones ? "Zones Activées" : "Zones Masquées"}
                        </button>

                        {/* Légende */}
                        <div className="flex items-center gap-4 bg-gray-50 p-2 rounded-2xl border border-gray-100">
                            <div className="flex items-center gap-1">
                                <div className="w-2.5 h-2.5 bg-[#10b981] rounded-full"></div>
                                <span className="text-[9px] font-black uppercase text-gray-500">Elite</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-2.5 h-2.5 bg-[#ef4444] rounded-full"></div>
                                <span className="text-[9px] font-black uppercase text-gray-500">Alerte</span>
                            </div>
                            <div className="mx-2 w-px h-6 bg-gray-200"></div>
                            <div className="flex items-center gap-3">
                                <div className="text-center">
                                    <div className="text-xs font-black text-gray-900">{counts.total}</div>
                                    <div className="text-[7px] font-bold text-gray-400 uppercase leading-none">Total</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-xs font-black text-blue-600">{counts.mapped}</div>
                                    <div className="text-[7px] font-bold text-gray-400 uppercase leading-none">Map</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Map Area */}
            <div className="flex-1 relative">
                {kiosquesMapped.length === 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 backdrop-blur-xl z-30">
                        <div className="w-32 h-32 bg-gray-100 rounded-[3rem] flex items-center justify-center mb-10 shadow-inner">
                            <Icon icon="mdi:google-maps" className="text-7xl text-gray-300" />
                        </div>
                        <h2 className="text-4xl font-black text-gray-900 mb-4">Cartographie Vide</h2>
                        <p className="text-gray-500 max-w-sm text-center mb-12 font-medium">
                            Vos kiosques ne sont pas encore géolocalisés. Utilisez le bouton "Ma position" sur le terrain pour les référencer.
                        </p>
                        <a href="/admin/clients" className="px-10 py-5 bg-gray-900 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-black transition-all shadow-2xl">
                            Paramétrer les Kiosques
                        </a>
                    </div>
                )}

                <div className="h-full w-full" style={{ minHeight: 'calc(100vh - 120px)' }}>
                    <MapContainer
                        center={center}
                        zoom={12}
                        style={{ height: '100%', width: '100%', zIndex: 10 }}
                    >
                        <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />

                        {/* Dessin des Zones de Livraison */}
                        {afficherZones && Object.entries(zonesLivraison).map(([id, zone]) => (
                            zone.points.length >= 3 && (
                                <Polygon
                                    key={id}
                                    positions={zone.points}
                                    pathOptions={{
                                        fillColor: zone.color,
                                        fillOpacity: 0.15,
                                        color: zone.color,
                                        weight: 2,
                                        dashArray: '5, 10'
                                    }}
                                >
                                    <Popup>
                                        <div className="p-2 text-center">
                                            <div className="text-[10px] font-black text-gray-400 uppercase mb-1">Zone de livraison</div>
                                            <div className="text-sm font-black text-gray-900">{zone.livreurNom}</div>
                                            <div className="mt-1 text-xs text-blue-600 font-bold">{zone.points.length} points de vente</div>
                                        </div>
                                    </Popup>
                                </Polygon>
                            )
                        ))}

                        {/* Marqueurs Kiosques */}
                        {kiosquesMapped.map((kiosque) => {
                            const perf = getPerformanceInfo(kiosque.id);
                            return (
                                <Marker
                                    key={kiosque.id}
                                    position={[kiosque.latitude!, kiosque.longitude!]}
                                    icon={perf.icon}
                                >
                                    <Popup className="custom-popup">
                                        <div className="p-3 min-w-[260px] font-jakarta">
                                            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-50">
                                                <div className="w-12 h-12 bg-gray-900 rounded-2xl flex items-center justify-center shadow-xl">
                                                    <Icon icon="mdi:store-check" className="text-white text-2xl" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-black text-gray-900 leading-tight mb-0.5 truncate uppercase text-sm">{kiosque.nom}</div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: perf.color }}></span>
                                                        <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: perf.color }}>
                                                            {perf.label}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {perf.taux !== null ? (
                                                <div className="space-y-4 mb-6">
                                                    <div className="flex justify-between items-end">
                                                        <div>
                                                            <div className="text-[10px] font-black text-gray-400 uppercase mb-1">Progression Ventes</div>
                                                            <div className="text-2xl font-black text-gray-900">{perf.taux.toFixed(1)}%</div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-[10px] font-black text-gray-400 uppercase mb-1 text-right">Revenue</div>
                                                            <div className="text-base font-black text-emerald-600">{formatCurrency(perf.montant!)}</div>
                                                        </div>
                                                    </div>
                                                    {/* Barre de progression visuelle */}
                                                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full transition-all duration-1000"
                                                            style={{ width: `${perf.taux}%`, backgroundColor: perf.color }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 mb-6">
                                                    <p className="text-[11px] text-orange-700 font-bold leading-relaxed">
                                                        <Icon icon="mdi:information" className="inline mr-2 text-lg" />
                                                        En attente de la saisie des retours pour analyser la performance.
                                                    </p>
                                                </div>
                                            )}

                                            <div className="space-y-3 mb-6">
                                                <div className="flex items-start gap-3 text-xs text-gray-600">
                                                    <Icon icon="mdi:map-marker" className="text-gray-400 text-lg shrink-0" />
                                                    <span className="font-medium leading-tight">{kiosque.adresse}</span>
                                                </div>
                                                {kiosque.telephone && (
                                                    <div className="flex items-center gap-3 text-xs text-gray-600">
                                                        <Icon icon="mdi:phone" className="text-gray-400 text-lg shrink-0" />
                                                        <span className="font-bold">{kiosque.telephone}</span>
                                                    </div>
                                                )}
                                            </div>

                                            <button
                                                onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${kiosque.latitude},${kiosque.longitude}`, '_blank')}
                                                className="w-full flex items-center justify-center gap-3 py-4 bg-gray-900 text-white text-[10px] font-black rounded-2xl hover:bg-black transition-all shadow-2xl uppercase tracking-[0.2em]"
                                            >
                                                <Icon icon="mdi:navigation" className="text-lg text-emerald-400" />
                                                Lancer le GPS
                                            </button>
                                        </div>
                                    </Popup>
                                </Marker>
                            );
                        })}
                    </MapContainer>
                </div>
            </div>
        </div>
    );
};
