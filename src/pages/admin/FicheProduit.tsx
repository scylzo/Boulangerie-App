import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { useReferentielStore } from '../../store/referentielStore';
import { formatCurrencyCompact } from '../../utils/currency';
import { downloadFicheProduitPDF } from '../../utils/pdfGenerator';
import type { LigneFicheProduit } from '../../utils/pdfGenerator';
import { toast } from 'react-hot-toast';

export const FicheProduit: React.FC = () => {
    const { produits, chargerProduits, isLoadingProduits } = useReferentielStore();
    const [clientNom, setClientNom] = useState('');
    const [selectedItems, setSelectedItems] = useState<Record<string, { marge: number | string; prixBoutique: number | string; active: boolean }>>({});

    useEffect(() => {
        chargerProduits();
    }, [chargerProduits]);

    // Initialiser les items quand les produits sont chargés
    useEffect(() => {
        if (produits.length > 0 && Object.keys(selectedItems).length === 0) {
            const initial: Record<string, { marge: number | string; prixBoutique: number | string; active: boolean }> = {};
            produits.forEach(p => {
                initial[p.id] = {
                    marge: '',
                    prixBoutique: '',
                    active: false
                };
            });
            setSelectedItems(initial);
        }
    }, [produits, selectedItems]);

    const handleToggleProduct = (id: string) => {
        setSelectedItems(prev => ({
            ...prev,
            [id]: { ...prev[id], active: !prev[id].active }
        }));
    };

    const handleFieldChange = (id: string, field: 'prixBoutique' | 'marge', value: string) => {
        if (value !== '' && Number(value) < 0) return;

        const produit = produits.find(p => p.id === id);
        const prixRevendeur = produit?.prixClient || produit?.prixBoutique || 0;
        
        setSelectedItems(prev => {
            const current = prev[id] || { marge: '', prixBoutique: '', active: false };
            let newMarge: number | string = current.marge;
            let newPrixBoutique: number | string = current.prixBoutique;

            if (field === 'prixBoutique') {
                newPrixBoutique = value;
                newMarge = value === '' ? '' : Number(value) - prixRevendeur;
            } else if (field === 'marge') {
                newMarge = value;
                newPrixBoutique = value === '' ? '' : prixRevendeur + Number(value);
            }

            return {
                ...prev,
                [id]: { ...current, marge: newMarge, prixBoutique: newPrixBoutique }
            };
        });
    };

    const handleToggleAll = () => {
        const allSelected = Object.values(selectedItems).every(item => item.active);
        const newState = { ...selectedItems };
        produits.forEach(p => {
            newState[p.id] = { ...newState[p.id], active: !allSelected };
        });
        setSelectedItems(newState);
    };

    const handleGeneratePDF = async () => {
        const activeLines = Object.entries(selectedItems)
            .filter(([_, data]) => data.active) // Changement : on ne filtre plus par quantité > 0
            .map(([id, data]) => {
                const produit = produits.find(p => p.id === id);
                return {
                    produitNom: produit?.nom || 'Produit inconnu',
                    prixBase: produit?.prixClient || produit?.prixBoutique || 0,
                    prixBoutique: data.prixBoutique,
                    marge: data.marge
                } as LigneFicheProduit;
            });

        if (activeLines.length === 0) {
            toast.error('Veuillez sélectionner au moins un produit (cocher la case)');
            return;
        }

        try {
            await downloadFicheProduitPDF(clientNom, activeLines);
            toast.success('Fiche produit générée avec succès');
        } catch (error) {
            toast.error('Erreur lors de la génération du PDF');
        }
    };

    return (
        <div className="min-h-screen bg-sand-100">
            {/* Header */}
            <div className="bg-white border-b border-sand-200 px-6 py-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-warning-600 rounded-xl flex items-center justify-center shadow-lg shadow-warning-100">
                            <Icon icon="mdi:file-certificate" className="text-2xl text-white" />
                        </div>
                        <div>
                            <h1 className="font-display text-2xl font-semibold text-sand-900">Générateur de Fiche Produit</h1>
                            <p className="text-sm text-sand-500 font-medium">Préparez une fiche avec des champs vides pour vos propositions commerciales</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <button
                            onClick={handleToggleAll}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 bg-sand-100 hover:bg-sand-200 text-sand-700 rounded-xl font-bold transition-all"
                        >
                            <Icon icon={Object.values(selectedItems).every(item => item.active) ? "mdi:checkbox-multiple-marked" : "mdi:checkbox-multiple-blank-outline"} className="text-xl" />
                            {Object.values(selectedItems).every(item => item.active) ? "Tout désélectionner" : "Tout sélectionner"}
                        </button>
                        <button
                            onClick={handleGeneratePDF}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-warning-600 hover:bg-warning-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-warning-100 hover:scale-105 active:scale-95"
                        >
                            <Icon icon="mdi:pdf-box" className="text-xl" />
                            Générer la Fiche (PDF)
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-6 space-y-6">
                {/* Informations Client */}
                <div className="bg-white rounded-2xl border border-sand-200 p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-8 h-8 bg-info-100 rounded-lg flex items-center justify-center">
                            <Icon icon="mdi:account" className="text-info-600" />
                        </div>
                        <h2 className="text-lg font-bold text-sand-900">Informations Client</h2>
                    </div>
                    <div className="max-w-md">
                        <label className="block text-sm font-semibold text-sand-700 mb-2">Nom du Client / Prospect</label>
                        <input
                            type="text"
                            value={clientNom}
                            onChange={(e) => setClientNom(e.target.value)}
                            placeholder="Ex: Client de passage ou M. Diop"
                            className="w-full px-4 py-3 bg-sand-50 border border-sand-200 rounded-xl focus:ring-2 focus:ring-warning-500 focus:border-warning-500 transition-all outline-none font-medium"
                        />
                    </div>
                </div>

                {/* Sélection des Produits */}
                <div className="bg-white rounded-2xl border border-sand-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-sand-100 flex items-center justify-between bg-sand-50/50">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-warning-100 rounded-lg flex items-center justify-center">
                                <Icon icon="mdi:bread-slice" className="text-warning-600" />
                            </div>
                            <h2 className="text-lg font-bold text-sand-900">Sélection des Produits</h2>
                        </div>
                        <div className="text-sm font-medium text-sand-500">
                            {Object.values(selectedItems).filter(item => item.active).length} produit(s) sélectionné(s)
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-sand-50/50">
                                    <th className="px-6 py-4 text-xs font-bold text-sand-500 uppercase tracking-wider">
                                        <div className="flex items-center gap-2 cursor-pointer" onClick={handleToggleAll}>
                                            <button
                                                className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                                                    Object.keys(selectedItems).length > 0 && Object.values(selectedItems).every(item => item.active)
                                                        ? 'bg-warning-600 border-warning-600 text-white'
                                                        : 'bg-white border-sand-300'
                                                }`}
                                            >
                                                {Object.keys(selectedItems).length > 0 && Object.values(selectedItems).every(item => item.active) && <Icon icon="mdi:check" className="text-sm" />}
                                            </button>
                                            <span className="hover:text-warning-600 transition-colors">Tout</span>
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 text-xs font-bold text-sand-500 uppercase tracking-wider">Produit & Prix Revendeur</th>
                                    <th className="px-6 py-4 text-xs font-bold text-sand-500 uppercase tracking-wider">Prix Boutique</th>
                                    <th className="px-6 py-4 text-xs font-bold text-sand-500 uppercase tracking-wider">Marge</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-sand-100">
                                {isLoadingProduits ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center text-sand-500 font-medium">
                                            Chargement des produits...
                                        </td>
                                    </tr>
                                ) : [...produits].sort((a, b) => {
                                    const aActive = selectedItems[a.id]?.active ? 1 : 0;
                                    const bActive = selectedItems[b.id]?.active ? 1 : 0;
                                    return bActive - aActive; // Sort active (1) before inactive (0)
                                }).map(produit => {
                                    const item = selectedItems[produit.id] || { marge: '', prixBoutique: '', active: false };
                                    return (
                                        <tr key={produit.id} className={`hover:bg-sand-50 transition-colors ${item.active ? 'bg-warning-50/30' : ''}`}>
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => handleToggleProduct(produit.id)}
                                                    className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${item.active ? 'bg-warning-600 text-white shadow-md shadow-warning-100' : 'bg-sand-200'}`}
                                                >
                                                    {item.active && <Icon icon="mdi:check" />}
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 text-sm">
                                                <div className="font-bold text-sand-900">{produit.nom}</div>
                                                <div className="text-xs text-sand-500 font-medium">Revendeur: {formatCurrencyCompact(produit.prixClient || produit.prixBoutique || 0)}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={item.prixBoutique}
                                                    onChange={(e) => handleFieldChange(produit.id, 'prixBoutique', e.target.value)}
                                                    className="h-10 w-full px-3 py-2 border border-sand-200 rounded-lg bg-white focus:ring-2 focus:ring-warning-500 focus:border-warning-500 outline-none transition-all text-sm font-medium"
                                                />
                                            </td>
                                            <td className="px-6 py-4">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={item.marge}
                                                    onChange={(e) => handleFieldChange(produit.id, 'marge', e.target.value)}
                                                    className="h-10 w-full px-3 py-2 border border-sand-200 rounded-lg bg-white focus:ring-2 focus:ring-warning-500 focus:border-warning-500 outline-none transition-all text-sm font-medium"
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>


            </div>
        </div>
    );
};
