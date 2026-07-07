import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polygon } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Icon } from '@iconify/react';
import { useReferentielStore } from '../../store/referentielStore';
import { useLivraisonStore } from '../../store/livraisonStore';
import { useLivreurStore } from '../../store/livreurStore';
import { TableLoader } from '../../components/ui/Loader';
import { Modal } from '../../components/ui/Modal';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { ClientForm } from '../../components/shared/ClientForm';
import { formatCurrency } from '../../utils/currency';
import { toast } from 'react-hot-toast';
import { doc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '../../firebase/config';

// Fonction Haversine pour le calcul de distance
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Rayon de la Terre en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance en km
};


// Plus besoin de corriger les icônes par défaut ici car nous utilisons des DivIcons personnalisés pour la performance.

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
    inconnu: createCustomIcon('#6b11cb'),   // Indigo 600 (par défaut)
    boulangerie: new L.DivIcon({
        className: 'bakery-marker',
        html: `
            <div style="
                background-color: #1e293b;
                width: 40px;
                height: 40px;
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 3px solid white;
                box-shadow: 0 4px 15px rgba(0,0,0,0.4);
            ">
                <div style="font-size: 20px;">🥖</div>
            </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -20]
    })
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
    const navigate = useNavigate();
    const {
        clients,
        chargerClients,
        isLoadingClients,
        modifierClient,
        clientEnEdition,
        setClientEnEdition
    } = useReferentielStore();
    const { invendusClients, chargerInvendusPeriode } = useLivraisonStore();
    const { livreurs, chargerLivreurs } = useLivreurStore();

    const [counts, setCounts] = useState({ total: 0, mapped: 0 });
    const JOURS_PERF = 30; // fenêtre d'analyse de la performance (écoulement moyen)
    const [afficherZones, setAfficherZones] = useState(true);
    const [showEditModal, setShowEditModal] = useState(false);
    const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; clientId: string; clientNom: string }>({
        isOpen: false,
        clientId: '',
        clientNom: ''
    });

    const localiserUtilisateur = () => {
        if (!navigator.geolocation) {
            toast.error("La géolocalisation n'est pas supportée par votre navigateur");
            return;
        }

        toast.loading("Localisation en cours...", { id: 'geoloc' });
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setUserPosition([position.coords.latitude, position.coords.longitude]);
                toast.success("Position récupérée", { id: 'geoloc' });
            },
            (error) => {
                console.error(error);
                toast.error("Impossible de récupérer votre position", { id: 'geoloc' });
            }
        );
    };


    useEffect(() => {
        chargerClients();
        chargerLivreurs();
        // Performance = écoulement moyen sur les 30 derniers jours (données plus stables)
        const fin = new Date();
        const debut = new Date();
        debut.setDate(debut.getDate() - JOURS_PERF);
        chargerInvendusPeriode(debut, fin);
    }, [chargerClients, chargerLivreurs, chargerInvendusPeriode]);

    useEffect(() => {
        const kiosques = clients.filter(c => c.aKiosque);
        const mapped = kiosques.filter(c => c.latitude && c.longitude);
        setCounts({
            total: kiosques.length,
            mapped: mapped.length
        });
    }, [clients]);

    // Calcul de la performance par client — cumulé sur toute la période chargée
    const performanceData = useMemo(() => {
        // On additionne d'abord livré/vendu par client (plusieurs retours possibles par client)
        const cumul: Record<string, { livre: number; vendu: number; valeur: number }> = {};
        invendusClients.forEach(inv => {
            if (!cumul[inv.clientId]) cumul[inv.clientId] = { livre: 0, vendu: 0, valeur: 0 };
            inv.produits.forEach(p => {
                cumul[inv.clientId].livre += p.quantiteLivree;
                cumul[inv.clientId].vendu += p.vendu;
                cumul[inv.clientId].valeur += p.vendu * (p.produit?.prixClient || 0);
            });
        });

        const stats: Record<string, { taux: number; montantVendu: number }> = {};
        Object.entries(cumul).forEach(([clientId, c]) => {
            if (c.livre > 0) {
                stats[clientId] = { taux: (c.vendu / c.livre) * 100, montantVendu: c.valeur };
            }
        });
        return stats;
    }, [invendusClients]);

    // Nombre de clients Élite (>90%) / Alerte (<70%) sur la période
    const perfCounts = useMemo(() => {
        let elite = 0, alerte = 0;
        Object.values(performanceData).forEach(p => {
            if (p.taux >= 90) elite++;
            else if (p.taux < 70) alerte++;
        });
        return { elite, alerte };
    }, [performanceData]);

    // Groupement des clients par livreur pour les zones
    const zonesLivraison = useMemo(() => {
        const zones: Record<string, { points: [number, number][]; color: string; livreurNom: string }> = {};

        clients.forEach((client) => {
            if (client.latitude && client.longitude) {
                // Collecter tous les livreurs uniques pour ce client
                const livreurIds = new Set<string>();
                if (client.livreurId) {
                    livreurIds.add(client.livreurId);
                }
                if (client.livreursParCar) {
                    Object.values(client.livreursParCar).forEach(id => {
                        if (id) livreurIds.add(id);
                    });
                }

                livreurIds.forEach(livreurId => {
                    if (!zones[livreurId]) {
                        const livreur = livreurs.find(l => l.id === livreurId);
                        const colorIndex = Object.keys(zones).length % ZONE_COLORS.length;
                        zones[livreurId] = {
                            points: [],
                            color: ZONE_COLORS[colorIndex],
                            livreurNom: livreur?.nom || 'Livreur Inconnu'
                        };
                    }
                    zones[livreurId].points.push([client.latitude!, client.longitude!]);
                });
            }
        });

        return zones;
    }, [clients, livreurs]);

    const kiosquesMapped = clients.filter(c => c.aKiosque && c.latitude && c.longitude);

    // Centre dynamique : sur le premier kiosque trouvé, sinon centre Dakar
    const mapCenter = useMemo(() => {
        if (kiosquesMapped.length > 0 && kiosquesMapped[0].latitude && kiosquesMapped[0].longitude) {
            return [kiosquesMapped[0].latitude, kiosquesMapped[0].longitude] as [number, number];
        }
        return [14.7167, -17.4677] as [number, number];
    }, [kiosquesMapped]);

    if (isLoadingClients) {
        return <TableLoader message="Initialisation des systèmes cartographiques..." />;
    }

    const getPerformanceInfo = (clientId: string) => {
        const perf = performanceData[clientId];
        if (!perf) return { color: '#6b11cb', label: 'Données indisponibles', icon: icons.inconnu, taux: null };
        if (perf.taux >= 90) return { color: '#10b981', label: 'Excellent (>90%)', icon: icons.excellent, taux: perf.taux, montant: perf.montantVendu };
        if (perf.taux >= 70) return { color: '#f59e0b', label: 'Moyen (70-90%)', icon: icons.moyen, taux: perf.taux, montant: perf.montantVendu };
        return { color: '#ef4444', label: 'Critique (<70%)', icon: icons.faible, taux: perf.taux, montant: perf.montantVendu };
    };

    const handleEditClient = (client: any) => {
        setClientEnEdition(client);
        setShowEditModal(true);
    };

    const handleSaveClient = async (clientData: any) => {
        if (clientEnEdition) {
            try {
                await modifierClient(clientEnEdition.id, clientData);
                toast.success('Kiosque mis à jour avec succès');
                setShowEditModal(false);
                setClientEnEdition(null);
                // Rafraîchir les données
                chargerClients();
            } catch (error) {
                toast.error('Erreur lors de la mise à jour');
            }
        }
    };

    const confirmSupprimer = async () => {
        try {
            const clientRef = doc(db, 'clients', deleteConfirm.clientId);
            await updateDoc(clientRef, {
                latitude: deleteField(),
                longitude: deleteField()
            });

            toast.success('Point retiré de la carte avec succès');
            setDeleteConfirm({ isOpen: false, clientId: '', clientNom: '' });
            chargerClients();
        } catch (error) {
            console.error('Erreur lors du retrait du point:', error);
            toast.error('Erreur lors du retrait du point');
        }
    };

    return (
        <div className="min-h-screen bg-sand-100 flex flex-col font-jakarta">
            {/* Header épuré */}
            <div className="bg-white border-b border-sand-200 px-3 sm:px-5 py-3 z-20">
                <div className="flex items-center justify-between gap-3">
                    {/* Gauche : retour + titre */}
                    <div className="flex items-center gap-2.5 min-w-0">
                        <button
                            onClick={() => navigate('/admin/clients')}
                            title="Retour aux clients"
                            className="w-9 h-9 rounded-lg text-sand-500 hover:bg-sand-100 hover:text-sand-900 flex items-center justify-center shrink-0 transition-colors"
                        >
                            <Icon icon="mdi:arrow-left" className="text-xl" />
                        </button>
                        <div className="min-w-0">
                            <h1 className="font-display text-base sm:text-lg font-semibold text-sand-900 truncate">Supervision Géo-Performance</h1>
                            <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 bg-success-500 rounded-full animate-pulse"></span>
                                <p className="text-[10px] font-medium text-success-600 uppercase tracking-wide">Système live</p>
                                <span className="text-sand-300">·</span>
                                <span className="text-[10px] text-sand-500 tabular-nums">{counts.mapped}/{counts.total} localisés · perf. 30 j</span>
                            </div>
                        </div>
                    </div>

                    {/* Droite : actions compactes */}
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={() => setAfficherZones(!afficherZones)}
                            title={afficherZones ? 'Masquer les zones' : 'Afficher les zones'}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${afficherZones
                                ? 'bg-terracotta-50 text-terracotta-700 border border-terracotta-100'
                                : 'bg-white text-sand-500 border border-sand-200 hover:bg-sand-50'
                                }`}
                        >
                            <Icon icon={afficherZones ? 'mdi:layers' : 'mdi:layers-off'} className="text-lg" />
                            <span className="hidden sm:inline">Zones</span>
                        </button>

                        <button
                            onClick={localiserUtilisateur}
                            title="Me localiser"
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${userPosition
                                ? 'bg-success-600 text-white'
                                : 'bg-sand-900 text-white hover:bg-sand-800'
                                }`}
                        >
                            <Icon icon="mdi:crosshairs-gps" className="text-lg" />
                            <span className="hidden sm:inline">{userPosition ? 'Position' : 'Me localiser'}</span>
                        </button>

                        {/* Légende compacte avec compteurs */}
                        <div className="hidden md:flex items-center gap-3 pl-3 ml-1 border-l border-sand-200">
                            <span className="inline-flex items-center gap-1.5 tabular-nums" title="Clients qui écoulent > 90% du livré (30 j)">
                                <span className="w-2 h-2 rounded-full bg-[#10b981]"></span>
                                <span className="text-[11px] text-sand-600">Élite</span>
                                <span className="text-[11px] font-semibold text-sand-900">{perfCounts.elite}</span>
                            </span>
                            <span className="inline-flex items-center gap-1.5 tabular-nums" title="Clients qui écoulent < 70% du livré (30 j)">
                                <span className="w-2 h-2 rounded-full bg-[#ef4444]"></span>
                                <span className="text-[11px] text-sand-600">Alerte</span>
                                <span className="text-[11px] font-semibold text-sand-900">{perfCounts.alerte}</span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Map Area */}
            <div className="flex-1 w-full bg-sand-100 p-4">
                <div className="w-full rounded-2xl overflow-hidden shadow-elevated border-4 border-white" style={{ height: 'calc(100vh - 160px)', position: 'relative' }}>
                    <MapContainer
                        center={mapCenter}
                        zoom={15}
                        style={{ height: '100%', width: '100%', zIndex: 10 }}
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />

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
                                            <div className="text-[10px] font-semibold text-sand-400 uppercase mb-1">Zone de livraison</div>
                                            <div className="text-sm font-semibold text-sand-900">{zone.livreurNom}</div>
                                            <div className="mt-1 text-xs text-info-600 font-semibold">{zone.points.length} points de vente</div>
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
                                            {/* Header Rapport */}
                                            <div className="flex items-center justify-between gap-3 mb-5 pb-4 border-b border-sand-50">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-12 h-12 bg-sand-900 rounded-2xl flex items-center justify-center shadow-elevated">
                                                        <Icon icon="mdi:store-check" className="text-white text-2xl" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-semibold text-sand-900 leading-tight mb-0.5 truncate uppercase text-sm">{kiosque.nom}</div>
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: perf.color }}></span>
                                                                <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: perf.color }}>
                                                                    {perf.label}
                                                                </span>
                                                            </div>
                                                            {userPosition && (
                                                                <div className="flex items-center gap-1 text-[10px] font-semibold text-terracotta-600 uppercase italic">
                                                                    <Icon icon="mdi:map-marker-distance" />
                                                                    À {calculateDistance(userPosition[0], userPosition[1], kiosque.latitude!, kiosque.longitude!).toFixed(2)} km
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => setDeleteConfirm({
                                                        isOpen: true,
                                                        clientId: kiosque.id,
                                                        clientNom: kiosque.nom
                                                    })}
                                                    className="w-8 h-8 bg-warning-50 text-warning-600 rounded-lg flex items-center justify-center hover:bg-warning-100 transition-colors"
                                                    title="Retirer ce point de la carte"
                                                >
                                                    <Icon icon="mdi:map-marker-remove-outline" className="text-lg" />
                                                </button>
                                            </div>

                                            {perf.taux !== null ? (
                                                <div className="space-y-4 mb-6">
                                                    <div className="flex justify-between items-end">
                                                        <div>
                                                            <div className="text-[10px] font-semibold text-sand-400 uppercase mb-1">Progression Ventes</div>
                                                            <div className="text-2xl font-semibold text-sand-900">{perf.taux.toFixed(1)}%</div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-[10px] font-semibold text-sand-400 uppercase mb-1 text-right">Revenue</div>
                                                            <div className="text-base font-semibold text-success-600">{formatCurrency(perf.montant!)}</div>
                                                        </div>
                                                    </div>
                                                    {/* Barre de progression visuelle */}
                                                    <div className="w-full h-2 bg-sand-100 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full transition-all duration-1000"
                                                            style={{ width: `${perf.taux}%`, backgroundColor: perf.color }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="bg-warning-50 p-4 rounded-2xl border border-warning-100 mb-6">
                                                    <p className="text-[11px] text-warning-600 font-semibold leading-relaxed">
                                                        <Icon icon="mdi:information" className="inline mr-2 text-lg" />
                                                        En attente de la saisie des retours pour analyser la performance.
                                                    </p>
                                                </div>
                                            )}

                                            <div className="space-y-3 mb-6">
                                                <div className="flex items-start gap-3 text-xs text-sand-600">
                                                    <Icon icon="mdi:map-marker" className="text-sand-400 text-lg shrink-0" />
                                                    <span className="font-medium leading-tight">{kiosque.adresse}</span>
                                                </div>
                                                {kiosque.telephone && (
                                                    <div className="flex items-center gap-3 text-[11px] text-sand-600">
                                                        <Icon icon="mdi:phone" className="text-sand-400 text-lg shrink-0" />
                                                        <span className="font-semibold">{kiosque.telephone}</span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleEditClient(kiosque)}
                                                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-white text-sand-900 text-[10px] font-semibold rounded-xl border-2 border-sand-900 hover:bg-sand-50 transition-all uppercase tracking-widest"
                                                >
                                                    <Icon icon="mdi:pencil" className="text-base" />
                                                    Corriger
                                                </button>
                                                <button
                                                    onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${kiosque.latitude},${kiosque.longitude}`, '_blank')}
                                                    className="flex-1 flex items-center justify-center gap-2 py-4 bg-sand-900 text-white text-[10px] font-semibold rounded-xl hover:bg-black transition-all shadow-elevated uppercase tracking-[0.2em]"
                                                >
                                                    <Icon icon="mdi:navigation" className="text-lg text-success-500" />
                                                    GPS
                                                </button>
                                            </div>
                                        </div>
                                    </Popup>
                                </Marker>
                            );
                        })}
                        {/* Marqueur Ma Position (Boulangerie) */}
                        {userPosition && (
                            <Marker position={userPosition} icon={icons.boulangerie}>
                                <Popup>
                                    <div className="p-3 text-center min-w-[150px]">
                                        <div className="w-12 h-12 bg-sand-900 rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-card">
                                            <span className="text-2xl">🥖</span>
                                        </div>
                                        <div className="font-semibold text-sand-900 uppercase text-xs tracking-widest">Ma Boulangerie</div>
                                        <div className="text-[9px] font-semibold text-sand-400 mt-1 uppercase">Point de référence distance</div>
                                        <div className="mt-3 text-[10px] text-sand-500 font-medium italic">
                                            {userPosition[0].toFixed(6)}, {userPosition[1].toFixed(6)}
                                        </div>
                                    </div>
                                </Popup>
                            </Marker>
                        )}
                    </MapContainer>
                </div>
            </div>

            {/* Modal de correction */}
            {showEditModal && (
                <Modal
                    isOpen={showEditModal}
                    onClose={() => {
                        setShowEditModal(false);
                        setClientEnEdition(null);
                    }}
                    title="Correction du Kiosque"
                    size="lg"
                >
                    <ClientForm
                        client={clientEnEdition}
                        onSave={handleSaveClient}
                        onCancel={() => {
                            setShowEditModal(false);
                            setClientEnEdition(null);
                        }}
                        isLoading={isLoadingClients}
                    />
                </Modal>
            )}

            <ConfirmModal
                isOpen={deleteConfirm.isOpen}
                onClose={() => setDeleteConfirm({ isOpen: false, clientId: '', clientNom: '' })}
                onConfirm={confirmSupprimer}
                title="Retirer de la carte"
                message={`Êtes-vous sûr de vouloir retirer le point GPS du client "${deleteConfirm.clientNom}" ?\n\nLe client ne sera pas supprimé, il ne figurera plus simplement sur cette carte.`}
                confirmText="Retirer"
                cancelText="Annuler"
                type="warning"
                position="center"
            />
        </div>
    );
};
