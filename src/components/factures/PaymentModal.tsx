import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { formatCurrency } from '../../utils/currency';
import type { Facture, Reglement, ModePaiement } from '../../types';
import { Icon } from '@iconify/react';

import omLogo from '../../assets/om.svg';
import waveLogo from '../../assets/wave.svg';

interface PaymentModalProps {
    facture: Facture | null;
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reglements: Reglement[]) => Promise<void>;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
    facture,
    isOpen,
    onClose,
    onConfirm
}) => {
    const [reglements, setReglements] = useState<Array<{ id: string, montant: string, mode: ModePaiement }>>([
        { id: Date.now().toString(), montant: '', mode: 'espece' }
    ]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (facture && isOpen) {
            // Calculer le montant réellement restant à payer
            const dejaPaye = facture.montantRegle || 0;
            const resteARegler = (facture.netAPayer ?? facture.totalTTC) - dejaPaye;
            
            setReglements([{ id: Date.now().toString(), montant: Math.max(0, resteARegler).toString(), mode: 'espece' }]);
        }
    }, [facture, isOpen]);

    if (!facture) return null;

    const dejaPaye = facture.montantRegle || 0;
    const netAPayerInitial = facture.netAPayer ?? facture.totalTTC;
    const netARester = netAPayerInitial - dejaPaye;
    
    const totalSaisi = reglements.reduce((sum, r) => sum + (parseFloat(r.montant) || 0), 0);
    const resteAPayer = Math.max(0, netARester - totalSaisi);
    const isOverpayment = totalSaisi > netARester;

    const handleAddReglement = () => {
        setReglements([...reglements, { id: Date.now().toString(), montant: resteAPayer.toString() || '0', mode: 'espece' }]);
    };

    const handleRemoveReglement = (id: string) => {
        if (reglements.length > 1) {
            setReglements(reglements.filter(r => r.id !== id));
        }
    };

    const handleUpdateReglement = (id: string, field: 'montant' | 'mode', value: any) => {
        setReglements(reglements.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const validReglements: Reglement[] = reglements
            .filter(r => parseFloat(r.montant) > 0)
            .map(r => ({
                id: r.id,
                montant: parseFloat(r.montant),
                mode: r.mode,
                date: new Date()
            }));

        if (validReglements.length === 0) return;

        setIsLoading(true);
        try {
            await onConfirm(validReglements);
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Paiement Multi-modes - ${facture.numeroFacture}`} size="lg">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-terracotta-50 p-5 rounded-2xl border border-terracotta-100 shadow-sm space-y-3">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-terracotta-600 font-medium">Récapitulatif Facture :</span>
                        <span className="text-sand-400 font-mono text-xs">{facture.numeroFacture}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-sand-600">Montant Total TTC :</span>
                        <span className="font-semibold text-sand-900">{formatCurrency(facture.totalTTC)}</span>
                    </div>
                    {facture.soldeUtilise ? (
                        <div className="flex justify-between items-center text-success-600 bg-success-50 px-3 py-1.5 rounded-lg text-sm border border-success-100">
                            <span className="flex items-center gap-2">
                                <Icon icon="mdi:wallet-outline" />
                                Avoir utilisé :
                            </span>
                            <span className="font-semibold">- {formatCurrency(facture.soldeUtilise)}</span>
                        </div>
                    ) : null}
                    {dejaPaye > 0 ? (
                        <div className="flex justify-between items-center text-info-600 bg-info-50 px-3 py-1.5 rounded-lg text-sm border border-info-100">
                            <span className="flex items-center gap-2">
                                <Icon icon="mdi:history" />
                                Déjà réglé :
                            </span>
                            <span className="font-semibold">{formatCurrency(dejaPaye)}</span>
                        </div>
                    ) : null}
                    <div className="flex justify-between items-center border-t border-terracotta-100 pt-3">
                        <span className="font-semibold text-sand-900">Reste à encaisser :</span>
                        <span className="text-2xl font-semibold text-terracotta-700">{formatCurrency(netARester)}</span>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-sand-700 uppercase tracking-widest flex items-center gap-2">
                            <Icon icon="mdi:cash-multiple" className="text-terracotta-500 text-lg" />
                            Détail des versements
                        </h4>
                        <button
                            type="button"
                            onClick={handleAddReglement}
                            className="flex items-center gap-2 text-xs font-semibold text-white bg-terracotta-600 hover:bg-terracotta-700 px-4 py-2 rounded-full transition-all shadow-md hover:shadow-terracotta-200 active:scale-95"
                        >
                            <Icon icon="mdi:plus-circle" className="text-sm" />
                            Ajouter un mode
                        </button>
                    </div>

                    <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                        {reglements.map((reg, index) => (
                            <div key={reg.id} className="relative bg-white p-4 rounded-2xl border border-sand-200 shadow-sm hover:border-terracotta-200 transition-all group animate-in slide-in-from-bottom-4 duration-300">
                                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
                                    <div className="sm:col-span-5">
                                        <label className="block text-[10px] font-semibold text-sand-400 uppercase mb-1.5 ml-1">Montant du versement</label>
                                        <div className="relative group/input">
                                            <input
                                                type="number"
                                                value={reg.montant}
                                                onChange={(e) => handleUpdateReglement(reg.id, 'montant', e.target.value)}
                                                className="w-full pl-4 pr-12 py-3 bg-sand-50 border border-sand-200 rounded-xl focus:ring-4 focus:ring-terracotta-500/10 focus:border-terracotta-500 outline-none font-semibold text-sand-900 text-lg transition-all"
                                                placeholder="0"
                                                min="0"
                                                required
                                                autoFocus={index === reglements.length - 1}
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-sand-400 group-focus-within/input:text-terracotta-500">FCFA</span>
                                        </div>
                                    </div>

                                    <div className="sm:col-span-6">
                                        <label className="block text-[10px] font-semibold text-sand-400 uppercase mb-1.5 ml-1">Moyen de paiement</label>
                                        <div className="grid grid-cols-3 gap-2 p-1 bg-sand-100 rounded-xl">
                                            {(['espece', 'om', 'wave'] as const).map(m => (
                                                <button
                                                    key={m}
                                                    type="button"
                                                    onClick={() => handleUpdateReglement(reg.id, 'mode', m)}
                                                    className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-all border-2 h-14 ${reg.mode === m
                                                        ? 'bg-white border-terracotta-500 text-terracotta-700 shadow-sm scale-[1.02]'
                                                        : 'border-transparent text-sand-500 hover:bg-sand-50 hover:text-sand-700'
                                                        }`}
                                                >
                                                    {m === 'espece' ? (
                                                        <Icon icon="mdi:cash-fast" className="text-xl mb-0.5" />
                                                    ) : (
                                                        <img 
                                                            src={m === 'om' ? omLogo : waveLogo} 
                                                            alt={m} 
                                                            className="w-6 h-6 object-contain mb-0.5"
                                                        />
                                                    )}
                                                    <span className="text-[9px] font-semibold uppercase tracking-tighter">
                                                        {m === 'espece' ? 'Espèce' : m === 'om' ? 'Orange' : 'Wave'}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="sm:col-span-1 flex justify-center">
                                        {reglements.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveReglement(reg.id)}
                                                className="p-3 text-danger-500 hover:text-danger-600 hover:bg-danger-50 rounded-xl transition-all"
                                                title="Supprimer ce mode"
                                            >
                                                <Icon icon="mdi:close-circle-outline" className="text-2xl" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                
                                {index < reglements.length - 1 && (
                                    <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 bg-sand-200 text-sand-500 rounded-full p-0.5 z-10 border-4 border-white">
                                        <Icon icon="mdi:plus" className="text-xs" />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white border-2 border-dashed border-sand-200 p-5 rounded-2xl space-y-4">
                    <div className="flex justify-between items-center text-sand-500">
                        <span className="text-sm flex items-center gap-2">
                            <Icon icon="mdi:calculator-variant" />
                            Total encaissé :
                        </span>
                        <span className="font-semibold">{formatCurrency(totalSaisi)}</span>
                    </div>
                    
                    <div className="h-px bg-transparent"></div>

                    <div className="flex justify-between items-center">
                        <div className="space-y-0.5">
                            <span className="text-xs font-semibold text-sand-400 uppercase tracking-widest">Reste à percevoir</span>
                            <p className={`text-2xl font-semibold transition-colors ${resteAPayer === 0 ? 'text-success-600' : 'text-sand-900'}`}>
                                {formatCurrency(resteAPayer)}
                            </p>
                        </div>
                        {resteAPayer === 0 && (
                            <div className="bg-success-100 text-success-700 p-2 rounded-full animate-bounce">
                                <Icon icon="mdi:check-bold" className="text-xl" />
                            </div>
                        )}
                    </div>
                </div>

                {isOverpayment && (
                    <div className="bg-warning-50 border border-warning-100 text-warning-600 p-5 rounded-2xl flex gap-4 shadow-sm animate-in zoom-in duration-300">
                        <div className="bg-warning-100 p-3 rounded-full h-fit">
                            <Icon icon="mdi:alert-decagram" className="text-2xl text-warning-600" />
                        </div>
                        <div className="text-sm">
                            <p className="font-semibold text-warning-600 uppercase tracking-tight mb-1">Montant supérieur au net !</p>
                            <p className="text-warning-600 leading-relaxed">
                                Le montant total saisi est de <span className="font-semibold">{formatCurrency(totalSaisi)}</span>. 
                                Un avoir de <span className="bg-white px-2 py-0.5 rounded-lg font-semibold text-warning-600 shadow-sm">{formatCurrency(totalSaisi - netARester)}</span> sera automatiquement ajouté au solde du client.
                            </p>
                        </div>
                    </div>
                )}

                <div className="flex flex-col sm:flex-row justify-end gap-4 pt-4 border-t border-sand-100">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-6 py-3 text-sm font-semibold text-sand-400 hover:text-sand-600 transition-all"
                    >
                        Annuler
                    </button>
                    <Button
                        type="submit"
                        isLoading={isLoading}
                        disabled={totalSaisi <= 0}
                        className="bg-sand-900 hover:bg-black text-white py-4 px-10 rounded-2xl shadow-elevated shadow-sand-200 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                    >
                        <Icon icon="mdi:check-circle" className="text-xl" />
                        <span>Enregistrer le paiement</span>
                    </Button>
                </div>
            </form>
        </Modal>
    );
};
