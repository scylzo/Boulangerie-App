import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import type { Produit } from '../../types';

interface RepartitionInvendusModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (repartition: Array<{ produitId: string; restants: number; pertes: number }>) => void;
    produits: Array<{
        produitId: string;
        produit?: Produit;
        reste: number;
    }>;
}

export const RepartitionInvendusModal: React.FC<RepartitionInvendusModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    produits
}) => {
    const [repartition, setRepartition] = useState<Array<{ produitId: string; restants: number; pertes: number }>>([]);

    useEffect(() => {
        if (isOpen && produits.length > 0) {
            // Initialiser la répartition selon la configuration du produit
            const initialRepartition = produits.map(p => ({
                produitId: p.produitId,
                restants: p.produit?.reconduisible ? p.reste : 0,
                pertes: p.produit?.reconduisible ? 0 : p.reste
            }));
            setRepartition(initialRepartition);
        }
    }, [isOpen, produits]);

    const handleRestantsChange = (produitId: string, value: number) => {
        setRepartition(prev => prev.map(r => {
            if (r.produitId === produitId) {
                const produit = produits.find(p => p.produitId === produitId);
                const reste = produit?.reste || 0;
                const newRestants = Math.max(0, Math.min(value, reste));
                return {
                    ...r,
                    restants: newRestants,
                    pertes: reste - newRestants
                };
            }
            return r;
        }));
    };

    const handlePertesChange = (produitId: string, value: number) => {
        setRepartition(prev => prev.map(r => {
            if (r.produitId === produitId) {
                const produit = produits.find(p => p.produitId === produitId);
                const reste = produit?.reste || 0;
                const newPertes = Math.max(0, Math.min(value, reste));
                return {
                    ...r,
                    pertes: newPertes,
                    restants: reste - newPertes
                };
            }
            return r;
        }));
    };

    const totalRestants = repartition.reduce((sum, r) => sum + r.restants, 0);
    const totalPertes = repartition.reduce((sum, r) => sum + r.pertes, 0);
    const totalInvendus = produits.reduce((sum, p) => sum + p.reste, 0);

    const handleConfirm = () => {
        onConfirm(repartition);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center p-4">
                {/* Backdrop transparent */}
                <div className="fixed inset-0 bg-transparent" onClick={onClose} />

                {/* Modal */}
                <div className="relative bg-sand-100 rounded-xl shadow-elevated max-w-3xl w-full max-h-[90vh] overflow-hidden border border-sand-200 animate-in zoom-in-95 fade-in duration-300">
                    {/* Header moderne */}
                    <div className="bg-sand-50 px-6 py-4 border-b border-sand-200">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-terracotta-100 rounded-lg flex items-center justify-center">
                                    <Icon icon="mdi:moon-waning-crescent" className="text-2xl text-terracotta-600" />
                                </div>
                                <div>
                                    <h2 className="font-display text-xl font-semibold text-sand-900 flex items-center gap-2">
                                        <div className="w-2 h-2 bg-terracotta-600 rounded-full"></div>
                                        Clôture de Journée
                                    </h2>
                                    <p className="text-sm text-sand-500">Répartition des invendus</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="rounded-lg p-2 hover:bg-sand-100 transition-all duration-200 group"
                                title="Fermer"
                            >
                                <Icon icon="mdi:close" className="text-sand-500 group-hover:text-sand-700 text-xl transition-colors" />
                            </button>
                        </div>
                    </div>

                    {/* Summary */}
                    <div className="bg-sand-50 px-6 py-4 border-b border-sand-200">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-white rounded-lg p-3 border border-sand-200">
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon icon="mdi:package-variant" className="text-sand-500" />
                                    <span className="text-xs text-sand-600 font-medium">Total invendus</span>
                                </div>
                                <p className="font-display text-2xl font-semibold text-sand-900">{totalInvendus}</p>
                            </div>
                            <div className="bg-white rounded-lg p-3 border border-success-100">
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon icon="mdi:recycle" className="text-success-600" />
                                    <span className="text-xs text-success-700 font-medium">À reconduire</span>
                                </div>
                                <p className="font-display text-2xl font-semibold text-success-600">{totalRestants}</p>
                            </div>
                            <div className="bg-white rounded-lg p-3 border border-danger-100">
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon icon="mdi:delete-outline" className="text-danger-600" />
                                    <span className="text-xs text-danger-700 font-medium">Invendus</span>
                                </div>
                                <p className="font-display text-2xl font-semibold text-danger-600">{totalPertes}</p>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="px-6 py-4 overflow-y-auto max-h-[50vh]">
                        <div className="space-y-4">
                            {produits.map(produit => {
                                const rep = repartition.find(r => r.produitId === produit.produitId);
                                if (!rep) return null;

                                return (
                                    <div
                                        key={produit.produitId}
                                        className="bg-white border border-sand-200 rounded-xl p-4 hover:border-terracotta-300 transition-all"
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-sand-900 mb-1">
                                                    {produit.produit?.nom || produit.produitId}
                                                </h3>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm text-sand-600">
                                                        {produit.reste} restants
                                                    </span>
                                                    {produit.produit?.reconduisible && (
                                                        <span className="text-xs bg-success-100 text-success-700 px-2 py-0.5 rounded-full font-medium">
                                                            Reconduisible
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-medium text-sand-700 mb-1">
                                                    À reconduire (J+1)
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max={produit.reste}
                                                        value={rep.restants === 0 ? '' : rep.restants}
                                                        onChange={(e) => handleRestantsChange(produit.produitId, parseInt(e.target.value) || 0)}
                                                        placeholder="0"
                                                        className="w-full px-3 py-2 border border-sand-300 rounded-lg focus:ring-2 focus:ring-success-500 focus:border-transparent"
                                                    />
                                                    <Icon icon="mdi:pencil" className="absolute right-3 top-1/2 -translate-y-1/2 text-sand-400 text-sm" />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-sand-700 mb-1">
                                                    Invendus
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max={produit.reste}
                                                        value={rep.pertes === 0 ? '' : rep.pertes}
                                                        onChange={(e) => handlePertesChange(produit.produitId, parseInt(e.target.value) || 0)}
                                                        placeholder="0"
                                                        className="w-full px-3 py-2 border border-sand-300 rounded-lg focus:ring-2 focus:ring-danger-500 focus:border-transparent"
                                                    />
                                                    <Icon icon="mdi:pencil" className="absolute right-3 top-1/2 -translate-y-1/2 text-sand-400 text-sm" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Info */}
                    <div className="px-6 py-3 bg-warning-50 border-t border-warning-100">
                        <div className="flex items-start gap-2">
                            <Icon icon="mdi:information" className="text-warning-600 text-lg mt-0.5 shrink-0" />
                            <p className="text-sm text-warning-600">
                                Les produits marqués comme "restants" seront automatiquement ajoutés au stock boutique de demain.
                            </p>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 bg-sand-50 border-t border-sand-200 flex justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sand-700 bg-white border border-sand-300 rounded-lg hover:bg-sand-50 transition-colors font-medium"
                        >
                            Annuler
                        </button>
                        <button
                            onClick={handleConfirm}
                            className="px-6 py-2 bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 transition-colors font-medium flex items-center gap-2"
                        >
                            <Icon icon="mdi:check-circle" className="text-lg" />
                            Valider la clôture
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
