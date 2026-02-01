// ============================================================================
// EXEMPLE D'INTÉGRATION DANS UNE PAGE DE GESTION DES COMMANDES
// ============================================================================

import React, { useState } from 'react';
import { useProductionStore } from '../store/productionStore';
import { RedistributionModal, RedistributionData } from '../components/production/RedistributionModal';
import type { CommandeClient } from '../types';

export const ExempleIntegrationRedistribution = () => {
    // Store
    const {
        commandesClients,
        clients,
        programmeActuel,
        annulerCommandeClient,
        annulerCommandeAvecRedistribution
    } = useProductionStore();

    // État local pour le modal
    const [showRedistributionModal, setShowRedistributionModal] = useState(false);
    const [commandeARedistribuer, setCommandeARedistribuer] = useState<CommandeClient | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    /**
     * Handler pour l'annulation d'une commande
     * Décide s'il faut afficher le modal de redistribution ou faire une annulation simple
     */
    const handleAnnulerCommande = (commande: CommandeClient) => {
        // Vérifier si le programme est déjà produit ou envoyé
        const programmeEstProduit = programmeActuel?.statut === 'produit' ||
            programmeActuel?.statut === 'envoye' ||
            programmeActuel?.statut === 'modifie';

        if (programmeEstProduit) {
            // Afficher le modal de redistribution
            console.log('⚠️ Programme déjà produit - Redistribution nécessaire');
            setCommandeARedistribuer(commande);
            setShowRedistributionModal(true);
        } else {
            // Annulation simple (programme en brouillon)
            console.log('✅ Annulation simple (programme en brouillon)');
            if (window.confirm(`Êtes-vous sûr de vouloir annuler la commande de ${commande.client?.nom || 'ce client'} ?`)) {
                annulerCommandeClient(commande.id);
            }
        }
    };

    /**
     * Handler pour confirmer la redistribution
     */
    const handleConfirmRedistribution = async (redistribution: RedistributionData) => {
        if (!commandeARedistribuer) return;

        setIsProcessing(true);
        try {
            await annulerCommandeAvecRedistribution(commandeARedistribuer.id, redistribution);

            // Fermer le modal
            setShowRedistributionModal(false);
            setCommandeARedistribuer(null);

            // Afficher un message de succès
            alert('✅ Commande annulée et produits redistribués avec succès !');

            console.log('✅ Redistribution réussie:', redistribution);
        } catch (error) {
            console.error('❌ Erreur lors de la redistribution:', error);
            alert('❌ Erreur lors de la redistribution. Veuillez réessayer.');
        } finally {
            setIsProcessing(false);
        }
    };

    /**
     * Handler pour annuler le modal
     */
    const handleCloseModal = () => {
        if (isProcessing) return; // Empêcher la fermeture pendant le traitement
        setShowRedistributionModal(false);
        setCommandeARedistribuer(null);
    };

    return (
        <div>
            {/* Liste des commandes */}
            <div className="space-y-4">
                {commandesClients.map(commande => (
                    <div key={commande.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="font-semibold">
                                    {commande.client?.nom || 'Client inconnu'}
                                </h3>
                                <p className="text-sm text-gray-600">
                                    {commande.produits.length} produit(s)
                                </p>
                            </div>

                            {/* Bouton d'annulation */}
                            {commande.statut !== 'annulee' && (
                                <button
                                    onClick={() => handleAnnulerCommande(commande)}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                                >
                                    Annuler
                                </button>
                            )}

                            {/* Badge si annulée */}
                            {commande.statut === 'annulee' && (
                                <span className="px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-sm">
                                    Annulée
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal de redistribution */}
            {commandeARedistribuer && (
                <RedistributionModal
                    isOpen={showRedistributionModal}
                    onClose={handleCloseModal}
                    commande={commandeARedistribuer}
                    clients={clients}
                    onConfirm={handleConfirmRedistribution}
                />
            )}

            {/* Overlay de chargement pendant le traitement */}
            {isProcessing && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 flex items-center gap-3">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-600"></div>
                        <span className="text-gray-700">Redistribution en cours...</span>
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================================================
// VARIANTE : Bouton avec icône et tooltip
// ============================================================================

export const BoutonAnnulationAvecTooltip = ({ commande, onAnnuler }: {
    commande: CommandeClient;
    onAnnuler: (commande: CommandeClient) => void;
}) => {
    const { programmeActuel } = useProductionStore();
    const programmeEstProduit = programmeActuel?.statut === 'produit' ||
        programmeActuel?.statut === 'envoye' ||
        programmeActuel?.statut === 'modifie';

    return (
        <div className="relative group">
            <button
                onClick={() => onAnnuler(commande)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title={programmeEstProduit ? "Annuler avec redistribution" : "Annuler la commande"}
            >
                <Icon icon="mdi:cancel" className="text-xl" />
            </button>

            {/* Tooltip */}
            {programmeEstProduit && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    ⚠️ Redistribution nécessaire
                </div>
            )}
        </div>
    );
};

// ============================================================================
// VARIANTE : Intégration dans un menu contextuel
// ============================================================================

export const MenuContextuelCommande = ({ commande }: { commande: CommandeClient }) => {
    const [showMenu, setShowMenu] = useState(false);
    const { programmeActuel } = useProductionStore();

    const programmeEstProduit = programmeActuel?.statut === 'produit' ||
        programmeActuel?.statut === 'envoye' ||
        programmeActuel?.statut === 'modifie';

    return (
        <div className="relative">
            <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 hover:bg-gray-100 rounded-lg"
            >
                <Icon icon="mdi:dots-vertical" className="text-xl" />
            </button>

            {showMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                    <button
                        onClick={() => {
                            // Logique d'édition
                            setShowMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
                    >
                        <Icon icon="mdi:pencil" />
                        <span>Modifier</span>
                    </button>

                    <button
                        onClick={() => {
                            // Logique de duplication
                            setShowMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
                    >
                        <Icon icon="mdi:content-copy" />
                        <span>Dupliquer</span>
                    </button>

                    <div className="border-t border-gray-200 my-1"></div>

                    <button
                        onClick={() => {
                            handleAnnulerCommande(commande);
                            setShowMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-red-50 text-red-600 flex items-center gap-2"
                    >
                        <Icon icon="mdi:cancel" />
                        <span>
                            {programmeEstProduit ? 'Annuler & Redistribuer' : 'Annuler'}
                        </span>
                    </button>
                </div>
            )}
        </div>
    );
};
