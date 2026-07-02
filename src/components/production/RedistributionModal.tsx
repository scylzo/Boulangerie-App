import React, { useState, useMemo } from 'react';
import { Icon } from '@iconify/react';
import type { CommandeClient, Client, RedistributionData } from '../../types';

interface RedistributionModalProps {
    isOpen: boolean;
    onClose: () => void;
    commande: CommandeClient | null;
    clients: Client[];
    onConfirm: (redistribution: RedistributionData) => void;
    isLoading?: boolean;
}

export const RedistributionModal: React.FC<RedistributionModalProps> = ({
    isOpen,
    onClose,
    commande,
    clients,
    onConfirm,
    isLoading
}) => {

    const [typeRedistribution, setTypeRedistribution] = useState<'boutique' | 'client' | 'mixte'>('boutique');
    const [clientDestinataireId, setClientDestinataireId] = useState<string>('');
    const [motif, setMotif] = useState('');
    const [repartitionProduits, setRepartitionProduits] = useState<Map<string, { boutique: number; client: number; clientId?: string }>>(new Map());

    // Filtrer les clients actifs (sauf celui qui annule)
    const clientsDisponibles = useMemo(() => {
        if (!commande) return clients.filter(c => c.active);
        return clients.filter(c => c.active && c.id !== commande.clientId);
    }, [clients, commande]);

    const handleQuantiteChange = (produitId: string, destination: 'boutique' | 'client', value: number) => {
        if (!commande) return;
        const current = repartitionProduits.get(produitId) || { boutique: 0, client: 0 };
        const produit = commande.produits.find(p => p.produitId === produitId);
        const maxQuantite = produit?.quantiteCommandee || 0;

        if (destination === 'boutique') {
            const newBoutique = Math.max(0, Math.min(value, maxQuantite - current.client));
            setRepartitionProduits(new Map(repartitionProduits.set(produitId, { ...current, boutique: newBoutique })));
        } else {
            const newClient = Math.max(0, Math.min(value, maxQuantite - current.boutique));
            setRepartitionProduits(new Map(repartitionProduits.set(produitId, { ...current, client: newClient })));
        }
    };

    const handleClientDestinataire = (produitId: string, clientId: string) => {
        const current = repartitionProduits.get(produitId) || { boutique: 0, client: 0 };
        setRepartitionProduits(new Map(repartitionProduits.set(produitId, { ...current, clientId })));
    };

    const handleConfirm = () => {
        if (!commande) return;
        const redistribution: RedistributionData = {
            type: typeRedistribution,
            clientId: typeRedistribution === 'client' ? clientDestinataireId : undefined,
            repartition: commande.produits.map(p => {
                const repart = repartitionProduits.get(p.produitId) || { boutique: 0, client: 0 };
                return {
                    produitId: p.produitId,
                    quantiteVersBoutique: typeRedistribution === 'boutique' ? p.quantiteCommandee : repart.boutique,
                    quantiteVersClient: typeRedistribution === 'client' ? p.quantiteCommandee : repart.client,
                    clientDestinataireId: typeRedistribution === 'mixte' ? repart.clientId : clientDestinataireId
                };
            }),
            motif
        };

        onConfirm(redistribution);
    };

    const isValid = () => {
        if (!commande) return false;
        if (!motif.trim()) return false;
        if (typeRedistribution === 'client' && !clientDestinataireId) return false;

        if (typeRedistribution === 'mixte') {
            // Vérifier que toutes les quantités sont redistribuées
            return commande.produits.every(p => {
                const repart = repartitionProduits.get(p.produitId) || { boutique: 0, client: 0 };
                return (repart.boutique + repart.client) === p.quantiteCommandee;
            });
        }

        return true;
    };

    if (!isOpen || !commande) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-warning-500 to-danger-500 px-6 py-4 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Icon icon="mdi:alert-circle" className="text-3xl" />
                            <div>
                                <h2 className="font-display text-xl font-semibold">Annulation & Redistribution</h2>
                                <p className="text-sm text-white/90">Commande déjà produite - Que faire des produits ?</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="text-white/80 hover:text-white">
                            <Icon icon="mdi:close" className="text-2xl" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Info commande */}
                    <div className="bg-warning-50 border border-warning-100 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <Icon icon="mdi:information" className="text-warning-600 text-xl mt-0.5" />
                            <div className="flex-1">
                                <p className="font-semibold text-warning-600">Produits déjà fabriqués</p>
                                <p className="text-sm text-warning-600 mt-1">
                                    Ces produits ont été produits pour cette commande. Choisissez comment les redistribuer.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Type de redistribution */}
                    <div>
                        <label className="block text-sm font-medium text-sand-700 mb-3">
                            Type de redistribution
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                            <button
                                onClick={() => setTypeRedistribution('boutique')}
                                className={`p-4 rounded-lg border-2 transition-all ${typeRedistribution === 'boutique'
                                    ? 'border-success-500 bg-success-50'
                                    : 'border-sand-200 hover:border-sand-300'
                                    }`}
                            >
                                <Icon icon="mdi:store" className={`text-3xl mx-auto mb-2 ${typeRedistribution === 'boutique' ? 'text-success-600' : 'text-sand-400'
                                    }`} />
                                <div className="text-sm font-medium">Vers Boutique</div>
                                <div className="text-xs text-sand-500 mt-1">Tout en boutique</div>
                            </button>

                            <button
                                onClick={() => setTypeRedistribution('client')}
                                className={`p-4 rounded-lg border-2 transition-all ${typeRedistribution === 'client'
                                    ? 'border-info-500 bg-info-50'
                                    : 'border-sand-200 hover:border-sand-300'
                                    }`}
                            >
                                <Icon icon="mdi:account-arrow-right" className={`text-3xl mx-auto mb-2 ${typeRedistribution === 'client' ? 'text-info-600' : 'text-sand-400'
                                    }`} />
                                <div className="text-sm font-medium">Vers Client</div>
                                <div className="text-xs text-sand-500 mt-1">Autre client</div>
                            </button>

                            <button
                                onClick={() => setTypeRedistribution('mixte')}
                                className={`p-4 rounded-lg border-2 transition-all ${typeRedistribution === 'mixte'
                                    ? 'border-terracotta-500 bg-terracotta-50'
                                    : 'border-sand-200 hover:border-sand-300'
                                    }`}
                            >
                                <Icon icon="mdi:call-split" className={`text-3xl mx-auto mb-2 ${typeRedistribution === 'mixte' ? 'text-terracotta-600' : 'text-sand-400'
                                    }`} />
                                <div className="text-sm font-medium">Mixte</div>
                                <div className="text-xs text-sand-500 mt-1">Répartir</div>
                            </button>
                        </div>
                    </div>

                    {/* Sélection client destinataire (si type client) */}
                    {typeRedistribution === 'client' && (
                        <div>
                            <label className="block text-sm font-medium text-sand-700 mb-2">
                                Client destinataire
                            </label>
                            <select
                                value={clientDestinataireId}
                                onChange={(e) => setClientDestinataireId(e.target.value)}
                                className="w-full px-4 py-2 border border-sand-300 rounded-lg focus:ring-2 focus:ring-info-500"
                            >
                                <option value="">Sélectionner un client</option>
                                {clientsDisponibles.map(client => (
                                    <option key={client.id} value={client.id}>
                                        {client.nom}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Répartition détaillée (si type mixte) */}
                    {typeRedistribution === 'mixte' && (
                        <div>
                            <label className="block text-sm font-medium text-sand-700 mb-3">
                                Répartition par produit
                            </label>
                            <div className="space-y-3">
                                {commande.produits.map(produit => {
                                    const repart = repartitionProduits.get(produit.produitId) || { boutique: 0, client: 0 };
                                    const total = repart.boutique + repart.client;
                                    const restant = produit.quantiteCommandee - total;

                                    return (
                                        <div key={produit.produitId} className="border border-sand-200 rounded-lg p-4">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="font-medium">{produit.produit?.nom || produit.produitId}</div>
                                                <div className="text-sm">
                                                    <span className="font-semibold">{produit.quantiteCommandee}</span> unités
                                                    {restant > 0 && (
                                                        <span className="ml-2 text-warning-600">({restant} restant{restant > 1 ? 's' : ''})</span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs text-sand-600 mb-1">Vers Boutique</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max={produit.quantiteCommandee}
                                                        value={repart.boutique}
                                                        onChange={(e) => handleQuantiteChange(produit.produitId, 'boutique', parseInt(e.target.value) || 0)}
                                                        className="w-full px-3 py-2 border border-sand-300 rounded-lg"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-sand-600 mb-1">Vers Client</label>
                                                    <div className="space-y-2">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max={produit.quantiteCommandee}
                                                            value={repart.client}
                                                            onChange={(e) => handleQuantiteChange(produit.produitId, 'client', parseInt(e.target.value) || 0)}
                                                            className="w-full px-3 py-2 border border-sand-300 rounded-lg"
                                                        />
                                                        {repart.client > 0 && (
                                                            <select
                                                                value={repart.clientId || ''}
                                                                onChange={(e) => handleClientDestinataire(produit.produitId, e.target.value)}
                                                                className="w-full px-3 py-1.5 border border-sand-300 rounded text-xs"
                                                            >
                                                                <option value="">Client...</option>
                                                                {clientsDisponibles.map(client => (
                                                                    <option key={client.id} value={client.id}>
                                                                        {client.nom}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Motif */}
                    <div>
                        <label className="block text-sm font-medium text-sand-700 mb-2">
                            Motif d'annulation <span className="text-danger-500">*</span>
                        </label>
                        <textarea
                            value={motif}
                            onChange={(e) => setMotif(e.target.value)}
                            placeholder="Ex: Client a annulé au dernier moment, problème de livraison..."
                            className="w-full px-4 py-2 border border-sand-300 rounded-lg focus:ring-2 focus:ring-warning-500"
                            rows={3}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-sand-200 px-6 py-4 bg-sand-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sand-700 hover:bg-sand-200 rounded-lg transition-colors"
                    >
                        Annuler
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!isValid() || isLoading}
                        className="px-6 py-2 bg-warning-600 text-white rounded-lg hover:bg-warning-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <Icon icon="mdi:loading" className="animate-spin text-xl" />
                                Traitement...
                            </>
                        ) : (
                            "Confirmer l'annulation"
                        )}
                    </button>

                </div>
            </div>
        </div>
    );
};
