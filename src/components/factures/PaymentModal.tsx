import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { formatCurrency } from '../../utils/currency';
import type { Facture } from '../../types';

interface PaymentModalProps {
    facture: Facture | null;
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (amount: number, mode: string) => Promise<void>;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
    facture,
    isOpen,
    onClose,
    onConfirm
}) => {
    const [amount, setAmount] = useState<string>('');
    const [modePaiement, setModePaiement] = useState<'espece' | 'om' | 'wave'>('espece');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (facture && isOpen) {
            // Default to net to pay, or total TTC if undefined
            const toPay = facture.netAPayer ?? facture.totalTTC;
            setAmount(toPay.toString());
            setModePaiement('espece');
        }
    }, [facture, isOpen]);

    if (!facture) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const val = parseFloat(amount);
        if (isNaN(val) || val < 0) return;

        setIsLoading(true);
        try {
            await onConfirm(val, modePaiement);
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const netAPayer = facture.netAPayer ?? facture.totalTTC;
    const isOverpayment = parseFloat(amount || '0') > netAPayer;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Paiement Facture ${facture.numeroFacture}`}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                    <div className="flex justify-between">
                        <span className="text-gray-600">Total TTC :</span>
                        <span className="font-medium">{formatCurrency(facture.totalTTC)}</span>
                    </div>
                    {facture.soldeUtilise ? (
                        <div className="flex justify-between text-green-600">
                            <span>Solde utilisé :</span>
                            <span>- {formatCurrency(facture.soldeUtilise)}</span>
                        </div>
                    ) : null}
                    <div className="flex justify-between border-t border-gray-200 pt-2 font-bold text-lg">
                        <span>Net à payer :</span>
                        <span>{formatCurrency(netAPayer)}</span>
                    </div>
                </div>

                <Input
                    type="number"
                    label="Montant reçu (FCFA)"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min={0}
                    required
                    autoFocus
                />

                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Mode de paiement</label>
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button
                            type="button"
                            onClick={() => setModePaiement('espece')}
                            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${modePaiement === 'espece'
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Espèce
                        </button>
                        <button
                            type="button"
                            onClick={() => setModePaiement('om')}
                            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${modePaiement === 'om'
                                ? 'bg-white text-orange-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Orange Money
                        </button>
                        <button
                            type="button"
                            onClick={() => setModePaiement('wave')}
                            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${modePaiement === 'wave'
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Wave
                        </button>
                    </div>
                </div>

                {isOverpayment && (
                    <div className="bg-blue-50 text-blue-700 p-3 rounded-md text-sm">
                        💡 Le montant est supérieur au net à payer.
                        Un avoir de <strong>{formatCurrency(parseFloat(amount) - netAPayer)}</strong> sera ajouté au solde du client.
                    </div>
                )}

                <div className="flex justify-end gap-3 mt-6">
                    <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                        Annuler
                    </Button>
                    <Button type="submit" isLoading={isLoading}>
                        Confirmer le paiement
                    </Button>
                </div>
            </form>
        </Modal>
    );
};
