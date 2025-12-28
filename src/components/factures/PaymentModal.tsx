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
    onConfirm: (amount: number) => Promise<void>;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
    facture,
    isOpen,
    onClose,
    onConfirm
}) => {
    const [amount, setAmount] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (facture && isOpen) {
            // Default to net to pay, or total TTC if undefined
            const toPay = facture.netAPayer ?? facture.totalTTC;
            setAmount(toPay.toString());
        }
    }, [facture, isOpen]);

    if (!facture) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const val = parseFloat(amount);
        if (isNaN(val) || val < 0) return;

        setIsLoading(true);
        try {
            await onConfirm(val);
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
