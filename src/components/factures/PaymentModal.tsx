import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { formatCurrency } from '../../utils/currency';
import type { Facture, Reglement, ModePaiement } from '../../types';
import { Icon } from '@iconify/react';

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
            // Default to net to pay, or total TTC if undefined
            const toPay = facture.netAPayer ?? facture.totalTTC;
            setReglements([{ id: Date.now().toString(), montant: toPay.toString(), mode: 'espece' }]);
        }
    }, [facture, isOpen]);

    if (!facture) return null;

    const netAPayer = facture.netAPayer ?? facture.totalTTC;
    const totalSaisi = reglements.reduce((sum, r) => sum + (parseFloat(r.montant) || 0), 0);
    const resteAPayer = Math.max(0, netAPayer - totalSaisi);
    const isOverpayment = totalSaisi > netAPayer;

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
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-gray-600 text-sm">Total TTC :</span>
                        <span className="font-semibold text-gray-900">{formatCurrency(facture.totalTTC)}</span>
                    </div>
                    {facture.soldeUtilise ? (
                        <div className="flex justify-between items-center text-green-600 text-sm">
                            <span>Solde utilisé :</span>
                            <span>- {formatCurrency(facture.soldeUtilise)}</span>
                        </div>
                    ) : null}
                    <div className="flex justify-between items-center border-t border-gray-200 pt-2">
                        <span className="font-bold text-gray-900">Net à payer :</span>
                        <span className="text-xl font-black text-gray-900">{formatCurrency(netAPayer)}</span>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">Répartition du paiement</label>
                        <button
                            type="button"
                            onClick={handleAddReglement}
                            className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md transition-colors"
                        >
                            <Icon icon="mdi:plus" />
                            <span>Ajouter un mode</span>
                        </button>
                    </div>

                    <div className="space-y-3">
                        {reglements.map((reg, index) => (
                            <div key={reg.id} className="flex flex-col sm:flex-row gap-3 bg-white p-3 rounded-xl border border-gray-200 shadow-sm relative group animate-in slide-in-from-right-2 duration-200">
                                <div className="flex-1">
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Montant</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={reg.montant}
                                            onChange={(e) => handleUpdateReglement(reg.id, 'montant', e.target.value)}
                                            className="w-full pl-3 pr-10 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none font-bold text-gray-900"
                                            placeholder="0"
                                            min="0"
                                            required
                                            autoFocus={index === reglements.length - 1}
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">FCFA</span>
                                    </div>
                                </div>

                                <div className="flex-1">
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Mode</label>
                                    <div className="grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-lg">
                                        {(['espece', 'om', 'wave'] as const).map(m => (
                                            <button
                                                key={m}
                                                type="button"
                                                onClick={() => handleUpdateReglement(reg.id, 'mode', m)}
                                                className={`py-1.5 text-[10px] font-bold rounded-md transition-all uppercase ${reg.mode === m
                                                    ? 'bg-white text-gray-900 shadow-sm'
                                                    : 'text-gray-500 hover:text-gray-700'
                                                    }`}
                                            >
                                                {m === 'espece' ? 'Espèce' : m === 'om' ? 'OM' : 'Wave'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {reglements.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveReglement(reg.id)}
                                        className="sm:self-end p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Icon icon="mdi:delete-outline" className="text-xl" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-gray-50 border border-gray-200 text-gray-900 p-4 rounded-xl space-y-3">
                    <div className="flex justify-between text-sm text-gray-600">
                        <span>Somme totale saisie :</span>
                        <span>{formatCurrency(totalSaisi)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-sm font-bold">Reste à payer :</span>
                        <span className={`text-xl font-black ${resteAPayer === 0 ? 'text-emerald-600' : 'text-gray-900'}`}>
                            {formatCurrency(resteAPayer)}
                        </span>
                    </div>
                </div>

                {isOverpayment && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl flex gap-3">
                        <Icon icon="mdi:information-outline" className="text-xl shrink-0 mt-0.5" />
                        <div className="text-sm">
                            <p className="font-bold mb-1">Surplus détecté !</p>
                            Le montant total ({formatCurrency(totalSaisi)}) est supérieur au net à payer.
                            Un avoir de <strong>{formatCurrency(totalSaisi - netAPayer)}</strong> sera généré pour le client.
                        </div>
                    </div>
                )}

                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        disabled={isLoading}
                        className="text-gray-500"
                    >
                        Annuler
                    </Button>
                    <Button
                        type="submit"
                        isLoading={isLoading}
                        disabled={totalSaisi <= 0}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-8 rounded-xl shadow-lg shadow-indigo-200"
                    >
                        Valider le paiement
                    </Button>
                </div>
            </form>
        </Modal>
    );
};
