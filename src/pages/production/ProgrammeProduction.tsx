/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { FileText, Plus, Ban, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Modal } from '../../components/ui/Modal';
import { ConfirmButton } from '../../components/ui/ConfirmButton';
import { CommandeClientForm } from '../../components/shared/CommandeClientForm';
import { ModifierProduitForm } from '../../components/shared/ModifierProduitForm';
import { QuantiteBoutiqueForm } from '../../components/shared/QuantiteBoutiqueForm';
import { useProductionStore } from '../../store';
import { useConfirmModal } from '../../hooks/useConfirmModal';
import { htmlPrintService } from '../../services/htmlPrintService';
import { useLivreurStore } from '../../store/livreurStore'; // Ajout Import
import { ScrollToTopBottom } from '../../components/ui/ScrollToTopBottom';
import type { CommandeClient } from '../../types';


export const ProgrammeProduction: React.FC = () => {
  const {
    programmeActuel,
    commandesClients,
    quantitesBoutique,
    produits,
    clients,
    showCommandeForm,
    showQuantiteBoutiqueForm,
    commandeEnEdition,
    quantiteBoutiqueEnEdition,
    formulaireCommande,
    creerNouveauProgramme,
    chargerProgrammeAvecListener,
    nettoyerListeners,
    envoyerAuBoulanger,
    ajouterCommandeClient,
    modifierCommandeClient,
    supprimerCommandeClient,
    annulerCommandeClient,
    supprimerProduitDeCommande,
    ajouterQuantiteBoutique,
    supprimerQuantiteBoutique,
    chargerProduits,
    chargerClients,
    rafraichirDonnees,
    setShowCommandeForm,
    setShowQuantiteBoutiqueForm,
    setCommandeEnEdition,
    setQuantiteBoutiqueEnEdition,
    updateFormulaireCommande,
    resetFormulaireCommande,
    validerProduction,
    isLoading
  } = useProductionStore();

  const { livreurs, chargerLivreurs } = useLivreurStore(); // Utilisation store Livreur

  const confirmModal = useConfirmModal();

  const [dateSelectionnee, setDateSelectionnee] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [modeFormulaire, setModeFormulaire] = useState<'create' | 'edit' | 'addProducts'>('create');
  const [indexProduitEnEdition, setIndexProduitEnEdition] = useState<number | null>(null);
  const [showModifierProduitForm, setShowModifierProduitForm] = useState(false);
  const [rechercheClient, setRechercheClient] = useState('');

  // Filtrer les commandes selon la recherche
  const commandesFiltrees = commandesClients.filter(commande => {
    if (!rechercheClient.trim()) return true;
    const client = clients.find(c => c.id === commande.clientId);
    const nomClient = client?.nom?.toLowerCase() || '';
    const rechercheNormalisee = rechercheClient.toLowerCase().trim();
    return nomClient.includes(rechercheNormalisee);
  });

  useEffect(() => {
    // Charger les données depuis Firebase
    const initialiser = async () => {
      try {
        // Charger les produits et clients depuis Firebase
        await chargerProduits();
        await chargerClients();
        await chargerLivreurs(); // Charger les livreurs

        // Configurer listener temps réel pour la date sélectionnée
        const dateSelectionneeObj = new Date(dateSelectionnee);
        chargerProgrammeAvecListener(dateSelectionneeObj);
      } catch (error) {
        console.error('Erreur lors de l\'initialisation:', error);
        // En cas d'erreur, créer un programme vide
        const dateSelectionneeObj = new Date(dateSelectionnee);
        creerNouveauProgramme(dateSelectionneeObj);
      }
    };

    initialiser();

    // Nettoyer les listeners quand le composant se démonte ou la date change
    return () => {
      nettoyerListeners();
    };
  }, [dateSelectionnee, chargerProduits, chargerClients, chargerLivreurs, chargerProgrammeAvecListener, creerNouveauProgramme, nettoyerListeners]);

  // Rafraîchir les données quand le composant redevient visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        rafraichirDonnees().catch(console.error);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [rafraichirDonnees]);

  // Fonction pour changer de date
  const handleDateChange = (nouvelleDate: string) => {
    setDateSelectionnee(nouvelleDate);
    // Le listener sera automatiquement mis à jour par le useEffect
  };

  // Fonctions de gestion des commandes
  const handleAjouterCommande = (clientId?: string) => {
    if (clientId) {
      // Chercher une commande existante pour ce client à cette date
      const commandeExistante = commandesClients.find(cmd =>
        cmd.clientId === clientId &&
        new Date(cmd.dateLivraison).toDateString() === new Date(dateSelectionnee).toDateString()
      );

      if (commandeExistante) {
        // Ajouter des produits à la commande existante
        setCommandeEnEdition(commandeExistante);
        setModeFormulaire('addProducts');
      } else {
        // Créer une nouvelle commande pour ce client
        setCommandeEnEdition(null);
        setModeFormulaire('create');
        // Pré-remplir le client et la date dans le formulaire
        updateFormulaireCommande({
          selectedClientId: clientId,
          dateLivraison: dateSelectionnee
        });
      }
    } else {
      // Mode création normale
      setCommandeEnEdition(null);
      setModeFormulaire('create');
      // Pré-remplir la date
      updateFormulaireCommande({
        dateLivraison: dateSelectionnee
      });
    }
    setShowCommandeForm(true);
  };



  const handleModifierProduitSpecifique = (commandeId: string, produitIndex: number) => {
    const commande = commandesClients.find(c => c.id === commandeId);
    if (commande) {
      setCommandeEnEdition(commande);
      setIndexProduitEnEdition(produitIndex);
      setShowModifierProduitForm(true);
    }
  };

  const handleSauvegarderProduitSpecifique = (produitModifie: CommandeClient['produits'][0]) => {
    if (commandeEnEdition && indexProduitEnEdition !== null) {
      const nouveauxProduits = [...commandeEnEdition.produits];
      nouveauxProduits[indexProduitEnEdition] = produitModifie;

      modifierCommandeClient(commandeEnEdition.id, {
        ...commandeEnEdition,
        produits: nouveauxProduits
      });

      setShowModifierProduitForm(false);
      setCommandeEnEdition(null);
      setIndexProduitEnEdition(null);
      toast.success('✅ Produit modifié avec succès !');
    }
  };

  const handleAnnulerModificationProduit = () => {
    setShowModifierProduitForm(false);
    setCommandeEnEdition(null);
    setIndexProduitEnEdition(null);
  };

  const handleSauvegarderCommande = (commandeData: Omit<CommandeClient, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (modeFormulaire === 'addProducts' && commandeEnEdition) {
      // Mode ajout de produits : fusionner avec la commande existante
      const produitsExistants = [...commandeEnEdition.produits];

      commandeData.produits.forEach(nouveauProduit => {
        const indexExistant = produitsExistants.findIndex(p => p.produitId === nouveauProduit.produitId);

        if (indexExistant >= 0) {
          // Produit existe déjà, remplacer par la nouvelle version (comportement d'édition)
           produitsExistants[indexExistant] = nouveauProduit;
        } else {
          // Nouveau produit, l'ajouter
          produitsExistants.push(nouveauProduit);
        }
      });

      // Modifier la commande avec les produits fusionnés
      modifierCommandeClient(commandeEnEdition.id, {
        ...commandeEnEdition,
        produits: produitsExistants
      });
    } else if (modeFormulaire === 'edit' && commandeEnEdition) {
      // Mode édition complète : remplacer tous les produits
      modifierCommandeClient(commandeEnEdition.id, commandeData);
    } else {
      // Mode création : vérifier qu'il n'existe pas déjà une commande pour ce client à cette date
      const commandeExistante = commandesClients.find(cmd =>
        cmd.clientId === commandeData.clientId &&
        new Date(cmd.dateLivraison).toDateString() === new Date(commandeData.dateLivraison).toDateString()
      );

      if (commandeExistante) {
        // Une commande existe déjà, fusionner les produits
        const produitsExistants = [...commandeExistante.produits];

        commandeData.produits.forEach(nouveauProduit => {
          const indexExistant = produitsExistants.findIndex(p => p.produitId === nouveauProduit.produitId);

          if (indexExistant >= 0) {
            // Produit existe déjà, remplacer par la nouvelle version
            produitsExistants[indexExistant] = nouveauProduit;
          } else {
            // Nouveau produit, l'ajouter
            produitsExistants.push(nouveauProduit);
          }
        });

        // Modifier la commande existante
        modifierCommandeClient(commandeExistante.id, {
          ...commandeExistante,
          produits: produitsExistants
        });
      } else {
        // Nouvelle commande
        ajouterCommandeClient(commandeData);
      }
    }

    setShowCommandeForm(false);
    setCommandeEnEdition(null);
    setIndexProduitEnEdition(null);
    setModeFormulaire('create');
    resetFormulaireCommande();

    // Message de confirmation selon le mode
    if (modeFormulaire === 'addProducts') {
      toast.success('🎉 Produits ajoutés à la commande avec succès !');
    } else if (modeFormulaire === 'edit') {
      toast.success('✅ Commande modifiée avec succès !');
    } else {
      toast.success('🆕 Nouvelle commande créée avec succès !');
    }
  };

  // const handleAnnulerCommande = async (commandeId: string) => {
  //   const commande = commandesClients.find(c => c.id === commandeId);
  //   const client = clients.find(c => c.id === commande?.clientId);

  //   const confirmation = await confirmModal.confirm({
  //     title: 'Annuler la commande',
  //     message: `Êtes-vous sûr de vouloir annuler la commande de "${client?.nom || 'Client inconnu'}" ?\n\nCette action supprimera la commande du programme.`,
  //     confirmText: 'Annuler la commande',
  //     cancelText: 'Conserver',
  //     type: 'warning'
  //   });

  //   if (confirmation) {
  //     annulerCommandeClient(commandeId);
  //     toast.success(`Commande de ${client?.nom || 'le client'} annulée`);
  //   }
  // };

  // const handleSupprimerCommande = async (commandeId: string) => {
  //   const commande = commandesClients.find(c => c.id === commandeId);
  //   const client = clients.find(c => c.id === commande?.clientId);

  //   const confirmation = await confirmModal.confirm({
  //     title: 'Supprimer définitivement',
  //     message: `Êtes-vous sûr de vouloir supprimer définitivement la commande de "${client?.nom || 'Client inconnu'}" ?\n\nCette action est irréversible.`,
  //     confirmText: 'Supprimer définitivement',
  //     cancelText: 'Annuler',
  //     type: 'danger'
  //   });

  //   if (confirmation) {
  //     supprimerCommandeClient(commandeId);
  //     toast.success(`Commande de ${client?.nom || 'le client'} supprimée`);
  //   }
  // };

  const handleAnnulerFormulaire = () => {
    setShowCommandeForm(false);
    setCommandeEnEdition(null);
    setIndexProduitEnEdition(null);
    setModeFormulaire('create');
    resetFormulaireCommande(); // Réinitialiser le formulaire lors de l'annulation
  };

  // const handleSupprimerProduitDeCommande = async (commandeId: string, produitIndex: number) => {
  //   const commande = commandesClients.find(c => c.id === commandeId);
  //   const produit = commande?.produits[produitIndex];
  //   const produitRef = produits.find(p => p.id === produit?.produitId);

  //   const confirmation = await confirmModal.confirm({
  //     title: 'Supprimer le produit',
  //     message: `Êtes-vous sûr de vouloir supprimer "${produitRef?.nom || 'ce produit'}" de cette commande ?\n\n${commande?.produits.length === 1 ? '⚠️ Cette action supprimera complètement la commande car c\'est le seul produit.' : 'Les autres produits de la commande seront conservés.'}`,
  //     confirmText: 'Supprimer le produit',
  //     cancelText: 'Annuler',
  //     type: 'warning'
  //   });

  //   if (confirmation) {
  //     supprimerProduitDeCommande(commandeId, produitIndex);
  //     toast.success(`Produit "${produitRef?.nom || 'Produit'}" supprimé de la commande`);
  //   }
  // };



  const handleEnvoyerAuBoulanger = async () => {
    if (!programmeActuel) {
      toast.error('❌ Aucun programme à envoyer');
      return;
    }

    // Vérifications avant envoi
    const errors = [];

    if (commandesClients.length === 0) {
      errors.push('• Aucune commande client définie');
    }

    if (programmeActuel.totauxParProduit.length === 0) {
      errors.push('• Aucun produit dans le programme');
    }

    const commandesValides = commandesClients.filter(cmd => cmd.statut !== 'annulee');
    if (commandesValides.length === 0) {
      errors.push('• Toutes les commandes sont annulées');
    }

    // Vérifier que les produits ont des quantités cohérentes
    for (const total of programmeActuel.totauxParProduit) {
      if (total.totalGlobal <= 0) {
        errors.push(`• Le produit "${total.produit?.nom}" a une quantité totale de 0`);
      }
    }

    if (errors.length > 0) {
      const confirmation = await confirmModal.confirm({
        title: 'Validation du programme',
        message: `⚠️ Des problèmes ont été détectés :\n\n${errors.join('\n')}\n\nVoulez-vous tout de même envoyer le programme ?`,
        confirmText: 'Envoyer malgré tout',
        cancelText: 'Annuler',
        type: 'warning'
      });

      if (!confirmation) return;
    } else {
      const confirmation = await confirmModal.confirm({
        title: 'Confirmer l\'envoi',
        message: (
          <div className="space-y-4">
            <p className="text-gray-600">
              Êtes-vous sûr de vouloir envoyer ce programme au boulanger ?
            </p>
            
            <div className="bg-blue-50/50 rounded-lg p-3 space-y-2 border border-blue-100">
              <div className="flex items-center gap-2 text-gray-700">
                <Icon icon="mdi:script-text-outline" className="text-blue-500" />
                <span className="font-medium text-sm">{commandesValides.length} commandes clients</span>
              </div>
              <div className="flex items-center gap-2 text-gray-700">
                <Icon icon="mdi:bread" className="text-orange-500" />
                <span className="font-medium text-sm">{programmeActuel.totauxParProduit.length} types de produits</span>
              </div>
              <div className="flex items-center gap-2 text-gray-700">
                <Icon icon="mdi:store" className="text-purple-500" />
                <span className="font-medium text-sm">{quantitesBoutique.length} produits boutique</span>
              </div>
            </div>

            <p className="text-xs text-gray-500 flex items-start gap-1.5 bg-gray-50 p-2 rounded">
              <Icon icon="mdi:information-outline" className="text-blue-500 mt-0.5" />
              <span>Vous pourrez toujours modifier le programme et le renvoyer si nécessaire.</span>
            </p>
          </div>
        ),
        confirmText: 'Envoyer au Boulanger',
        cancelText: 'Annuler',
        type: 'info'
      });

      if (!confirmation) return;
    }

    try {
      await envoyerAuBoulanger();
      toast.success('📤 Programme envoyé au boulanger avec succès !');
    } catch (error) {
      toast.error('❌ Erreur lors de l\'envoi du programme');
    }
  };

  const handleValiderProduction = async () => {
    const confirmation = await confirmModal.confirm({
        title: 'Valider la production',
        message: `🏭 Êtes-vous sûr de vouloir valider la production ?\n\nCela va :\n1. Changer le statut en "Produit"\n2. 📉 Déduire AUTOMATIQUEMENT les matières premières du stock selon les recettes.\n\nAssurez-vous que les quantités produites sont correctes.`,
        confirmText: 'Valider et Déduire Stock',
        cancelText: 'Annuler',
        type: 'warning'
    });

    if (confirmation) {
        try {
            await validerProduction();
            toast.success('✅ Production validée et stocks mis à jour !');
        } catch (error) {
            toast.error('❌ Erreur lors de la validation');
        }
    }
  };

  const handleRegulariserStock = async () => {
    const confirmation = await confirmModal.confirm({
        title: 'Régulariser les stocks',
        message: `⚠️ ATTENTION : Vous allez relancer la déduction des stocks pour cette production déjà terminée.\n\nCela est utile UNIQUEMENT si :\n- Vous avez mis à jour les recettes après la production\n- Les stocks n'avaient pas été déduits correctement\n\nSi les stocks ont déjà été déduits, cela risque de créer des DOUBLONS.\n\nVoulez-vous continuer ?`,
        confirmText: 'Oui, régulariser',
        cancelText: 'Annuler',
        type: 'warning'
    });

    if (confirmation) {
        try {
            await validerProduction();
            toast.success('✅ Régularisation effectuée : Stocks mis à jour !');
        } catch (error) {
            toast.error('❌ Erreur lors de la régularisation');
        }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header moderne type Odoo */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-linear-to-r from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
              <Icon icon="mdi:clipboard-text" className="text-xl text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                Programme de Production
              </h1>
              <p className="text-xs text-gray-500">
                Gestion des commandes clients et quantités boutique
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Indicateur de statut visible */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium ${
              programmeActuel?.statut === 'brouillon' ? 'bg-gray-100 text-gray-600 border-gray-200' :
              programmeActuel?.statut === 'modifie' ? 'bg-orange-50 text-orange-700 border-orange-200' :
              programmeActuel?.statut === 'envoye' ? 'bg-blue-50 text-blue-700 border-blue-200' :
              'bg-green-50 text-green-700 border-green-200'
            }`}>
              <Icon
                icon={
                  programmeActuel?.statut === 'brouillon' ? "mdi:file-document-edit" :
                  programmeActuel?.statut === 'modifie' ? "mdi:file-document-alert" :
                  programmeActuel?.statut === 'envoye' ? "mdi:send-check" :
                  "mdi:factory"
                }
                className="text-lg"
              />
              <span>
                {programmeActuel?.statut === 'brouillon' && 'Brouillon'}
                {programmeActuel?.statut === 'modifie' && 'Modifié'}
                {programmeActuel?.statut === 'envoye' && 'Envoyé'}
                {programmeActuel?.statut === 'produit' && 'Terminé'}
              </span>
            </div>

            <div className="h-8 w-px bg-gray-200 mx-2 hidden sm:block"></div>

            {/* Actions Toolbar */}
            <div className="flex items-center gap-2">
              {/* Bouton Envoyer/Renvoyer - Toujours visible pour permettre le renvoi */}
              {programmeActuel && (
                <button
                  onClick={handleEnvoyerAuBoulanger}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                >
                  <Icon icon="mdi:send" className="text-lg" />
                  <span className="font-medium">
                    {programmeActuel.statut === 'brouillon' ? 'Envoyer' : 'Renvoyer'}
                  </span>
                </button>
              )}

              {/* Bouton Valider Production */}
              {(programmeActuel?.statut === 'envoye' || programmeActuel?.statut === 'modifie') && (
                <button
                  onClick={handleValiderProduction}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all disabled:opacity-50 shadow-md hover:shadow-lg"
                >
                  <Icon icon="mdi:factory" className="text-lg" />
                  <span className="font-medium">Valider</span>
                </button>
              )}

              {/* Bouton Régulariser Stock */}
              {programmeActuel?.statut === 'produit' && (
                <button
                  onClick={handleRegulariserStock}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-700 border border-orange-200 rounded-lg hover:bg-orange-200 transition-all disabled:opacity-50 shadow-sm"
                  title="Recalculer et déduire les stocks si nécessaire"
                >
                  <Icon icon="mdi:refresh-alert" className="text-lg" />
                  <span className="font-medium">Régulariser Stocks</span>
                </button>
              )}
            </div>

            <ConfirmModal
              isOpen={confirmModal.isOpen}
              onClose={confirmModal.handleCancel}
              onConfirm={confirmModal.handleConfirm}
              title={confirmModal.title}
              message={confirmModal.message}
              confirmText={confirmModal.confirmText}
              cancelText={confirmModal.cancelText}
              type={confirmModal.type}
            />
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto p-4 space-y-4">

        {/* Widget de sélection de date moderne */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Icon icon="mdi:calendar" className="text-lg text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Date de production</h2>
          </div>

          <div className="flex items-center justify-between">
            {/* Sélecteur de date à gauche */}
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={dateSelectionnee}
                onChange={(e) => handleDateChange(e.target.value)}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 font-medium shadow-sm hover:border-gray-400 transition-all"
              />
            </div>

            {/* Carte d'information de production à droite */}
            <div className="bg-gradient-to-l from-green-50 to-emerald-50 border border-green-200 rounded-xl p-3 shadow-sm min-w-[300px]">
              <div className="flex items-center gap-3">
                <div className="flex-1 text-right">
                  <div className="flex items-center justify-end gap-2 mb-1">
                    <span className="text-xs font-medium text-green-700">Production programmée</span>
                    <Icon icon="mdi:calendar-check" className="text-green-600 text-sm" />
                  </div>
                  <div className="text-base font-bold text-gray-900">
                    {(() => {
                      const dateProduction = new Date(dateSelectionnee);
                      // La date de production EST la date sélectionnée
                      return dateProduction.toLocaleDateString('fr-FR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      });
                    })()}
                  </div>
                  {programmeActuel && (
                    <div className="flex items-center justify-end gap-1 mt-1 text-xs text-gray-600">
                      <span>Créé le {programmeActuel.dateCreation.toLocaleDateString('fr-FR')} à {programmeActuel.dateCreation.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                      <Icon icon="mdi:clock-outline" className="text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="w-10 h-10 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                  <Icon icon="mdi:factory" className="text-xl text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>

      {/* Formulaire commande modal centré */}
      <Modal
        isOpen={showCommandeForm}
        onClose={handleAnnulerFormulaire}
        title={
          modeFormulaire === 'addProducts' && commandeEnEdition ?
            `Ajouter des Produits - ${clients.find(c => c.id === commandeEnEdition.clientId)?.nom || 'Client'}` :
          modeFormulaire === 'edit' && commandeEnEdition ?
            `Modifier la Commande - ${clients.find(c => c.id === commandeEnEdition.clientId)?.nom || 'Client'}` :
          'Nouvelle Commande Client'
        }
        size="xl"
        position="center"
      >
        <CommandeClientForm
          produits={produits}
          clients={clients}
          commande={commandeEnEdition}
          mode={modeFormulaire}
          onSave={handleSauvegarderCommande}
          onCancel={handleAnnulerFormulaire}
          isLoading={isLoading}
          formulaireState={formulaireCommande}
          onUpdateFormulaire={updateFormulaireCommande}
        />
      </Modal>

      {/* Modal pour modifier un produit spécifique */}
      {showModifierProduitForm && commandeEnEdition && indexProduitEnEdition !== null && (
        <Modal
          isOpen={showModifierProduitForm}
          onClose={handleAnnulerModificationProduit}
          title={`Modifier le Produit - ${clients.find(c => c.id === commandeEnEdition.clientId)?.nom || 'Client'}`}
          size="xl"
          position="center"
        >
          <ModifierProduitForm
            produits={produits}
            commande={commandeEnEdition}
            produitIndex={indexProduitEnEdition}
            client={clients.find(c => c.id === commandeEnEdition.clientId)!}
            onSave={handleSauvegarderProduitSpecifique}
            onCancel={handleAnnulerModificationProduit}
            isLoading={isLoading}
          />
        </Modal>
      )}

        {/* Section Commandes Clients avec design moderne */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          {/* Header de la section */}
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <Icon icon="mdi:account-group" className="text-lg text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Commandes Clients</h2>
                    <p className="text-sm text-gray-500">Ajoutez les commandes des clients pour le jour sélectionné</p>
                  </div>
                </div>

                <button
                  onClick={() => handleAjouterCommande()}
                  disabled={showCommandeForm}
                  className="flex items-center gap-2 px-4 py-2 bg-linear-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-50 shadow-md"
                >
                  <Icon icon="mdi:plus" className="text-lg" />
                  <span className="font-medium">Nouvelle commande</span>
                </button>
              </div>

              {/* Barre de recherche */}
              {commandesClients.length > 0 && (
                <div className="flex items-center gap-4">
                  <div className="relative flex-1 max-w-md">
                    <Icon icon="mdi:magnify" className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Rechercher un client..."
                      value={rechercheClient}
                      onChange={(e) => setRechercheClient(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                    />
                    {rechercheClient && (
                      <button
                        onClick={() => setRechercheClient('')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <Icon icon="mdi:close" />
                      </button>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">
                    {commandesFiltrees.length === commandesClients.length
                      ? `${commandesClients.length} commande(s)`
                      : `${commandesFiltrees.length} sur ${commandesClients.length} commande(s)`
                    }
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Contenu de la section */}
          <div className="p-6">

            {commandesFiltrees.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icon icon={rechercheClient ? "mdi:magnify" : "mdi:clipboard-outline"} className="text-3xl text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {rechercheClient
                    ? `Aucun client trouvé pour "${rechercheClient}"`
                    : "Aucune commande client"
                  }
                </h3>
                <p className="text-gray-500 mb-6">
                  {rechercheClient
                    ? "Essayez avec d'autres termes de recherche ou ajoutez une nouvelle commande"
                    : "Commencez par ajouter une commande client pour ce jour de production"
                  }
                </p>
                {rechercheClient ? (
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => setRechercheClient('')}
                      className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all"
                    >
                      <Icon icon="mdi:close" className="text-lg" />
                      <span className="font-medium">Effacer la recherche</span>
                    </button>
                    <button
                      onClick={() => handleAjouterCommande()}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-linear-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all shadow-md"
                    >
                      <Icon icon="mdi:plus" className="text-lg" />
                      <span className="font-medium">Nouvelle commande</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleAjouterCommande()}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-linear-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all shadow-md"
                  >
                    <Icon icon="mdi:plus" className="text-lg" />
                    <span className="font-medium">Ajouter la première commande</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {commandesFiltrees.map((commande) => {
                const client = clients.find(c => c.id === commande.clientId);
                const totalCommande = commande.produits.reduce((total, item) =>
                  total + (item.prixUnitaire || 0) * item.quantiteCommandee, 0
                );

                // Fonction pour obtenir l'icône du produit
                const getProductIcon = (productName: string): string => {
                  const name = productName?.toLowerCase() || '';
                  if (name.includes('baguette')) return 'mdi:baguette';
                  if (name.includes('pain')) return 'mdi:bread-slice';
                  if (name.includes('croissant')) return 'mdi:croissant';
                  if (name.includes('brioche')) return 'mdi:muffin';
                  if (name.includes('tarte')) return 'mdi:pie';
                  if (name.includes('gateau') || name.includes('gâteau')) return 'mdi:cake';
                  if (name.includes('sandwich')) return 'mdi:food';
                  if (name.includes('viennoiserie')) return 'mdi:pretzel';
                  return 'mdi:food-variant';
                };

                return (
                  <div
                    key={commande.id}
                    className="relative bg-linear-to-br from-white to-gray-50 border border-gray-200 rounded-xl p-4 hover:border-green-300 hover:shadow-xl transition-all duration-300 group"
                  >
                    {/* En-tête de la commande */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-gray-600 to-gray-700 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                          <Icon icon="mdi:account" className="text-xl text-white" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg text-gray-900 mb-0.5">
                            {client?.nom || 'Client inconnu'}
                          </h3>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1 text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded-lg">
                              <Icon icon="mdi:calendar-clock" className="text-gray-500" />
                              <span>{new Date(commande.dateLivraison).toLocaleDateString('fr-FR')}</span>
                            </div>
                            {commande.statut === 'annulee' && (
                              <span className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
                                <Icon icon="mdi:cancel" className="text-red-600" />
                                ANNULÉE
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-gray-800">
                          {totalCommande.toLocaleString('fr-FR')}
                        </div>
                        <div className="text-xs text-gray-400 font-medium">FCFA</div>
                        <div className="flex items-center justify-end gap-1 text-sm text-gray-500 mt-1">
                          <Icon icon="mdi:package-variant-closed" className="text-gray-400" />
                          {commande.produits.length} article{commande.produits.length > 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>

                    {/* Liste des produits commandés */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                        <Icon icon="mdi:view-list" className="text-gray-500" />
                        <h4 className="text-lg font-semibold text-gray-800">
                          Produits commandés
                        </h4>
                        <span className="ml-auto text-sm font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
                          {commande.produits.length} item{commande.produits.length > 1 ? 's' : ''}
                        </span>

                        {/* Boutons d'action avec icônes Lucide */}
                        <div className="flex gap-1 ml-2">
                          <button
                            onClick={() => {
                              // Résoudre le nom du livreur
                              const livreurAssigne = livreurs.find(l => l.id === client?.livreurId);
                              const clientAvecLivreur = {
                                ...client,
                                livreur: livreurAssigne ? livreurAssigne.nom : client?.livreurId ? `Livreur (ID: ${client.livreurId.substring(0, 6)}...)` : 'Non assigné'
                              };
                              htmlPrintService.generateDeliveryReceiptHTML(commande, clientAvecLivreur, produits);
                            }}
                            className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-100 rounded-md transition-colors"
                            title="Bon de livraison"
                          >
                            <FileText size={16} />
                          </button>
                          <button
                            onClick={() => handleAjouterCommande(commande.clientId)}
                            className="p-1.5 text-green-600 hover:text-green-700 hover:bg-green-100 rounded-md transition-colors"
                            title="Ajouter des produits"
                          >
                            <Plus size={16} />
                          </button>
                          <button
                            onClick={() => {
                              annulerCommandeClient(commande.id);
                              toast.success(`Commande de ${client?.nom || 'le client'} annulée`);
                            }}
                            className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-100 rounded-md transition-colors"
                            title="Annuler la commande"
                          >
                            <Ban size={16} />
                          </button>
                          <ConfirmButton
                            onConfirm={() => {
                              supprimerCommandeClient(commande.id);
                              toast.success(`Commande de ${client?.nom || 'le client'} supprimée`);
                            }}
                            message={`Êtes-vous sûr de vouloir supprimer définitivement la commande de "${client?.nom || 'Client inconnu'}" ?\n\nCette action est irréversible.`}
                            confirmText="Supprimer définitivement"
                            cancelText="Annuler"
                            type="danger"
                            className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-100 rounded-md transition-colors"
                            title="Supprimer définitivement"
                          >
                            <Trash2 size={16} />
                          </ConfirmButton>
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        {commande.produits.map((item, index) => {
                          const produit = produits.find(p => p.id === item.produitId);
                          return (
                            <div key={index} className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-3 hover:border-gray-300 hover:shadow-md transition-all group">
                              <div className="flex items-center gap-3 mb-2">
                                <div className="w-9 h-9 bg-gradient-to-br from-gray-600 to-gray-700 rounded-lg flex items-center justify-center shadow-md">
                                  <Icon
                                    icon={getProductIcon(produit?.nom || '')}
                                    className="text-base text-white"
                                  />
                                </div>
                                <div className="flex-1">
                                  <h5 className="font-semibold text-sm text-gray-900">
                                    {produit?.nom || 'Produit inconnu'}
                                  </h5>
                                  <div className="flex items-center justify-between mt-1">
                                    <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded-lg font-medium">
                                      x{item.quantiteCommandee}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <div className="text-base font-bold text-gray-800">
                                        {((item.prixUnitaire || 0) * item.quantiteCommandee).toLocaleString('fr-FR')} F
                                      </div>
                                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleModifierProduitSpecifique(commande.id, index);
                                          }}
                                          className="p-1 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
                                          title="Modifier ce produit"
                                        >
                                          <Icon icon="mdi:pencil" className="text-lg" />
                                        </button>
                                        <ConfirmButton
                                          onConfirm={() => {
                                            supprimerProduitDeCommande(commande.id, index);
                                            toast.success(`Produit "${produit?.nom || 'Produit'}" supprimé de la commande`);
                                          }}
                                          message={`Êtes-vous sûr de vouloir supprimer "${produit?.nom || 'ce produit'}" de cette commande ?\n\n${commande?.produits.length === 1 ? '⚠️ Cette action supprimera complètement la commande car c\'est le seul produit.' : 'Les autres produits de la commande seront conservés.'}`}
                                          confirmText="Supprimer le produit"
                                          cancelText="Annuler"
                                          type="warning"
                                          className="p-1 text-red-500 hover:text-red-700 hover:bg-red-100 rounded"
                                          onClick={(e: React.MouseEvent<HTMLButtonElement>) => e.stopPropagation()}
                                          title="Supprimer ce produit de la commande"
                                        >
                                          <Icon icon="mdi:close" className="text-lg" />
                                        </ConfirmButton>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Répartition par cars */}
                              {item.repartitionCars && (
                                <div className="pt-3 border-t border-gray-200">
                                  <div className="text-xs font-medium text-gray-600 mb-2 flex items-center gap-1">
                                    <Icon icon="mdi:truck-delivery" className="text-gray-500" />
                                    Livraisons programmées
                                  </div>
                                  <div className="flex gap-2 flex-wrap">
                                    {item.repartitionCars.car1_matin && Number(item.repartitionCars.car1_matin) > 0 && (
                                      <div className="flex items-center gap-1 px-3 py-1 bg-linear-to-r from-orange-100 to-orange-200 text-orange-800 text-xs font-semibold rounded-full shadow-sm">
                                        <Icon icon="mdi:truck" className="text-sm" />
                                        <span>Car 1M: {item.repartitionCars.car1_matin}</span>
                                      </div>
                                    )}
                                    {item.repartitionCars.car2_matin && Number(item.repartitionCars.car2_matin) > 0 && (
                                      <div className="flex items-center gap-1 px-3 py-1 bg-linear-to-r from-blue-100 to-blue-200 text-blue-800 text-xs font-semibold rounded-full shadow-sm">
                                        <Icon icon="mdi:truck-outline" className="text-sm" />
                                        <span>Car 2M: {item.repartitionCars.car2_matin}</span>
                                      </div>
                                    )}
                                    {item.repartitionCars.car_soir && Number(item.repartitionCars.car_soir) > 0 && (
                                      <div className="flex items-center gap-1 px-3 py-1 bg-linear-to-r from-purple-100 to-purple-200 text-purple-800 text-xs font-semibold rounded-full shadow-sm">
                                        <Icon icon="mdi:truck-fast" className="text-sm" />
                                        <span>Car S: {item.repartitionCars.car_soir}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
                })}

                {/* Stats résumé */}
                <div className="bg-gray-50 rounded-lg p-4 mt-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">
                        {commandesClients.length}
                      </div>
                      <div className="text-sm text-gray-500">Commandes</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {commandesClients.reduce((total, cmd) => total + cmd.produits.length, 0)}
                      </div>
                      <div className="text-sm text-gray-500">Articles</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-green-600">
                        {commandesClients.reduce((total, cmd) =>
                          total + cmd.produits.reduce((subtotal, item) =>
                            subtotal + (item.prixUnitaire || 0) * item.quantiteCommandee, 0
                          ), 0
                        ).toLocaleString('fr-FR')} FCFA
                      </div>
                      <div className="text-sm text-gray-500">Total</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      {/* Formulaire quantités boutique inline */}
      <Modal
        isOpen={showQuantiteBoutiqueForm}
        onClose={() => {
          setShowQuantiteBoutiqueForm(false);
          setQuantiteBoutiqueEnEdition(null);
        }}
        title={quantiteBoutiqueEnEdition ? "Modifier Produit Boutique" : "Ajouter un Produit pour la Boutique"}
        size="xl"
      >
        <QuantiteBoutiqueForm
          produits={produits}
          quantitesActuelles={quantitesBoutique}
          quantiteEnEdition={quantiteBoutiqueEnEdition}
          onSave={(quantite) => {
            // Dans tous les cas, utiliser ajouterQuantiteBoutique qui gère à la fois création et modification
            // Cette fonction remplace automatiquement si le produit existe déjà
            console.log('🔄 Sauvegarde quantité boutique avec répartition:', quantite);
            ajouterQuantiteBoutique(quantite);
            setShowQuantiteBoutiqueForm(false);
            setQuantiteBoutiqueEnEdition(null);
          }}
          onCancel={() => {
            setShowQuantiteBoutiqueForm(false);
            setQuantiteBoutiqueEnEdition(null);
          }}
        />
      </Modal>

        {/* Section Quantités Boutique */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                  <Icon icon="mdi:storefront" className="text-lg text-amber-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Quantités Boutique</h2>
                  <p className="text-sm text-gray-500">Définissez les quantités à envoyer en boutique</p>
                </div>
              </div>

              <button
                onClick={() => setShowQuantiteBoutiqueForm(true)}
                disabled={showQuantiteBoutiqueForm}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 hover:border-gray-400 rounded-lg transition-all disabled:opacity-50 shadow-sm hover:shadow-md"
              >
                <Icon icon="mdi:plus" className="text-lg" />
                <span className="font-medium">Ajouter produit</span>
              </button>
            </div>
          </div>

          <div className="p-6">

            {quantitesBoutique.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icon icon="mdi:storefront-outline" className="text-3xl text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Aucune quantité boutique
                </h3>
                <p className="text-gray-500 mb-6">
                  Définissez les produits à envoyer directement en boutique
                </p>
                <button
                  onClick={() => setShowQuantiteBoutiqueForm(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 hover:border-gray-400 rounded-lg transition-all shadow-sm hover:shadow-md"
                >
                  <Icon icon="mdi:plus" className="text-lg" />
                  <span className="font-medium">Ajouter le premier produit</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {quantitesBoutique.map((item) => {
                  const produit = produits.find(p => p.id === item.produitId);
                  return (
                    <div
                      key={item.produitId}
                      className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 hover:shadow-md transition-all group"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-gray-600 to-gray-700 rounded-lg flex items-center justify-center shadow-md">
                            <Icon icon="mdi:storefront" className="text-lg text-white" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900">
                              {produit?.nom || 'Produit inconnu'}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-sm text-gray-700 bg-gray-100 px-2 py-1 rounded-lg font-medium">
                                {item.quantite} pièce{item.quantite > 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setQuantiteBoutiqueEnEdition(item);
                              setShowQuantiteBoutiqueForm(true);
                            }}
                            className="p-2 text-orange-500 hover:text-orange-700 hover:bg-orange-100 rounded-lg transition-colors"
                            title="Modifier"
                          >
                            <Icon icon="mdi:pencil-outline" className="text-lg" />
                          </button>
                          <button
                            onClick={() => supprimerQuantiteBoutique(item.produitId)}
                            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-lg transition-colors"
                            title="Supprimer"
                          >
                            <Icon icon="mdi:delete-outline" className="text-lg" />
                          </button>
                        </div>
                      </div>

                      {/* Répartition par cars pour la boutique */}
                      {item.repartitionCars && (
                        <div className="border-t border-gray-200 pt-3">
                          <div className="text-xs font-medium text-gray-600 mb-2 flex items-center gap-1">
                            <Icon icon="mdi:truck-delivery" className="text-gray-500" />
                            Répartition par cars
                          </div>
                          <div className="space-y-2">
                            {item.repartitionCars.car1_matin > 0 && (
                              <div className="flex items-center justify-between p-2 bg-orange-50 border border-orange-200 rounded-lg">
                                <div className="flex items-center gap-2">
                                  <Icon icon="mdi:truck" className="text-orange-600 text-sm" />
                                  <span className="text-xs font-medium text-orange-800">Car 1M</span>
                                </div>
                                <span className="text-xs font-bold text-orange-800">
                                  {item.repartitionCars.car1_matin}
                                </span>
                              </div>
                            )}
                            {item.repartitionCars.car2_matin > 0 && (
                              <div className="flex items-center justify-between p-2 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="flex items-center gap-2">
                                  <Icon icon="mdi:truck-outline" className="text-blue-600 text-sm" />
                                  <span className="text-xs font-medium text-blue-800">Car 2M</span>
                                </div>
                                <span className="text-xs font-bold text-blue-800">
                                  {item.repartitionCars.car2_matin}
                                </span>
                              </div>
                            )}
                            {item.repartitionCars.car_soir > 0 && (
                              <div className="flex items-center justify-between p-2 bg-purple-50 border border-purple-200 rounded-lg">
                                <div className="flex items-center gap-2">
                                  <Icon icon="mdi:truck-fast" className="text-purple-600 text-sm" />
                                  <span className="text-xs font-medium text-purple-800">Car S</span>
                                </div>
                                <span className="text-xs font-bold text-purple-800">
                                  {item.repartitionCars.car_soir}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                  })}
                </div>

                <div className="bg-gray-50 rounded-lg p-4 mt-6">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">
                        {quantitesBoutique.length}
                      </div>
                      <div className="text-sm text-gray-500">Produits boutique</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-amber-600">
                        {quantitesBoutique.reduce((total, item) => total + item.quantite, 0)}
                      </div>
                      <div className="text-sm text-gray-500">Total pièces</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-orange-600">
                        {quantitesBoutique.reduce((total, item) => total + (item.repartitionCars?.car1_matin || 0), 0)}
                      </div>
                      <div className="text-xs text-gray-500">Car 1M</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-blue-600">
                        {quantitesBoutique.reduce((total, item) => total + (item.repartitionCars?.car2_matin || 0), 0)}
                      </div>
                      <div className="text-xs text-gray-500">Car 2M</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-purple-600">
                        {quantitesBoutique.reduce((total, item) => total + (item.repartitionCars?.car_soir || 0), 0)}
                      </div>
                      <div className="text-xs text-gray-500">Car S</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section Programme de Production */}
        {programmeActuel?.totauxParProduit && programmeActuel.totauxParProduit.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Icon icon="mdi:chart-pie" className="text-lg text-purple-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Programme de Production</h2>
                  <p className="text-sm text-gray-500">Répartition des quantités par produit et par car de livraison</p>
                </div>
              </div>
            </div>

            <div className="p-4">
              {/* KPI Cards - Style Odoo moderne */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-linear-to-br from-gray-700 to-gray-800 rounded-2xl p-4 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 group">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                      <Icon icon="mdi:truck-delivery" className="text-xl text-white" />
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">
                        {programmeActuel.totauxParProduit.reduce((sum, p) => sum + (p.repartitionCar1Matin || 0), 0)}
                      </div>
                      <div className="text-gray-300 text-xs">pièces</div>
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-base font-semibold">Car 1 - Matin</div>
                    <div className="flex items-center gap-2 text-gray-300">
                      <Icon icon="mdi:clock-time-eight" className="text-sm" />
                      <span className="text-sm">06:00 - 10:00</span>
                    </div>
                  </div>
                </div>

                <div className="bg-linear-to-br from-gray-600 to-gray-700 rounded-2xl p-4 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 group">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                      <Icon icon="mdi:truck-delivery-outline" className="text-xl text-white" />
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">
                        {programmeActuel.totauxParProduit.reduce((sum, p) => sum + (p.repartitionCar2Matin || 0), 0)}
                      </div>
                      <div className="text-gray-300 text-xs">pièces</div>
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-base font-semibold">Car 2 - Matin</div>
                    <div className="flex items-center gap-2 text-gray-300">
                      <Icon icon="mdi:clock-time-nine" className="text-sm" />
                      <span className="text-sm">08:00 - 12:00</span>
                    </div>
                  </div>
                </div>

                <div className="bg-linear-to-br from-gray-700 to-gray-800 rounded-2xl p-4 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 group">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                      <Icon icon="mdi:truck-fast" className="text-xl text-white" />
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">
                        {programmeActuel.totauxParProduit.reduce((sum, p) => sum + (p.repartitionCarSoir || 0), 0)}
                      </div>
                      <div className="text-gray-300 text-xs">pièces</div>
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-base font-semibold">Car - Soir</div>
                    <div className="flex items-center gap-2 text-gray-300">
                      <Icon icon="mdi:clock-time-five" className="text-sm" />
                      <span className="text-sm">15:00 - 19:00</span>
                    </div>
                  </div>
                </div>

                <div className="bg-linear-to-br from-gray-600 to-gray-800 rounded-2xl p-4 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 group">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                      <Icon icon="mdi:package-variant" className="text-xl text-white" />
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">
                        {programmeActuel.totauxParProduit.reduce((sum, p) => sum + p.totalGlobal, 0)}
                      </div>
                      <div className="text-gray-100 text-xs">pièces</div>
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-base font-semibold">Total Général</div>
                    <div className="flex items-center gap-2 text-gray-200">
                      <Icon icon="mdi:sigma" className="text-sm" />
                      <span className="text-sm">Toutes livraisons</span>
                    </div>
                  </div>
                </div>
              </div>
              {/* Liste des produits - Style Odoo moderne */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                  <Icon icon="mdi:view-grid" className="text-gray-500" />
                  <h3 className="text-xl font-bold text-gray-900">
                    Détail par produit
                  </h3>
                  <span className="ml-auto text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                    {programmeActuel.totauxParProduit.length} produit{programmeActuel.totauxParProduit.length > 1 ? 's' : ''}
                  </span>
                </div>

                <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                  {programmeActuel.totauxParProduit.map((total) => {
                    // Fonction pour obtenir l'icône du produit basé sur son nom
                    const getProductIcon = (productName: string): string => {
                      const name = productName?.toLowerCase() || '';
                      if (name.includes('baguette')) return 'mdi:baguette';
                      if (name.includes('pain')) return 'mdi:bread-slice';
                      if (name.includes('croissant')) return 'mdi:croissant';
                      if (name.includes('brioche')) return 'mdi:muffin';
                      if (name.includes('tarte')) return 'mdi:pie';
                      if (name.includes('gateau') || name.includes('gâteau')) return 'mdi:cake';
                      if (name.includes('sandwich')) return 'mdi:food';
                      if (name.includes('viennoiserie')) return 'mdi:pretzel';
                      return 'mdi:food-variant';
                    };

                    return (
                      <div
                        key={total.produitId}
                        className="bg-linear-to-br from-white to-gray-50 border border-gray-200 rounded-2xl p-4 hover:border-purple-300 hover:shadow-2xl transition-all duration-300 group"
                      >
                        {/* En-tête du produit */}
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-12 h-12 bg-slate-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                            <Icon
                              icon={getProductIcon(total.produit?.nom || '')}
                              className="text-xl text-white"
                            />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-bold text-lg text-gray-900 mb-0.5">
                              {total.produit?.nom || total.produitId}
                            </h4>
                            <div className="flex items-center gap-2">
                              <span className="text-xl font-bold text-gray-800">{total.totalGlobal}</span>
                              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-lg">pièces</span>
                            </div>
                          </div>
                        </div>

                        {/* Répartition Client vs Boutique */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                          <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-200 group-hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-center gap-2 mb-2">
                              <div className="w-8 h-8 bg-slate-600 rounded-lg flex items-center justify-center">
                                <Icon icon="mdi:account-group" className="text-white text-sm" />
                              </div>
                              <span className="text-sm font-semibold text-gray-700">Clients</span>
                            </div>
                            <div className="text-2xl font-bold text-gray-800">{total.totalClient}</div>
                          </div>
                          <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-200 group-hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-center gap-2 mb-2">
                              <div className="w-8 h-8 bg-slate-600 rounded-lg flex items-center justify-center">
                                <Icon icon="mdi:storefront" className="text-white text-sm" />
                              </div>
                              <span className="text-sm font-semibold text-gray-700">Boutique</span>
                            </div>
                            <div className="text-2xl font-bold text-gray-800">{total.totalBoutique}</div>
                          </div>
                        </div>

                        {/* Répartition par cars de livraison */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                            <Icon icon="mdi:truck-delivery" className="text-gray-500" />
                            <h5 className="text-sm font-semibold text-gray-700">
                              Planning de livraison
                            </h5>
                          </div>

                          <div className="space-y-2">
                            {/* Car 1 Matin */}
                            {(total.repartitionCar1Matin || 0) > 0 && (
                              <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-xl">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-slate-600 rounded-lg flex items-center justify-center">
                                    <Icon icon="mdi:truck" className="text-white" />
                                  </div>
                                  <div>
                                    <div className="font-semibold text-gray-800">Car 1 - Matin</div>
                                    <div className="text-xs text-gray-600 flex items-center gap-1">
                                      <Icon icon="mdi:clock-time-eight" className="text-xs" />
                                      06:00 - 10:00
                                    </div>
                                  </div>
                                </div>
                                <div className="text-xl font-bold text-gray-800">
                                  {total.repartitionCar1Matin}
                                </div>
                              </div>
                            )}

                            {/* Car 2 Matin */}
                            {(total.repartitionCar2Matin || 0) > 0 && (
                              <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-xl">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-slate-600 rounded-lg flex items-center justify-center">
                                    <Icon icon="mdi:truck-outline" className="text-white" />
                                  </div>
                                  <div>
                                    <div className="font-semibold text-gray-800">Car 2 - Matin</div>
                                    <div className="text-xs text-gray-600 flex items-center gap-1">
                                      <Icon icon="mdi:clock-time-nine" className="text-xs" />
                                      08:00 - 12:00
                                    </div>
                                  </div>
                                </div>
                                <div className="text-xl font-bold text-gray-800">
                                  {total.repartitionCar2Matin}
                                </div>
                              </div>
                            )}

                            {/* Car Soir */}
                            {(total.repartitionCarSoir || 0) > 0 && (
                              <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-xl">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-slate-600 rounded-lg flex items-center justify-center">
                                    <Icon icon="mdi:truck-fast" className="text-white" />
                                  </div>
                                  <div>
                                    <div className="font-semibold text-gray-800">Car - Soir</div>
                                    <div className="text-xs text-gray-600 flex items-center gap-1">
                                      <Icon icon="mdi:clock-time-five" className="text-xs" />
                                      15:00 - 19:00
                                    </div>
                                  </div>
                                </div>
                                <div className="text-xl font-bold text-gray-800">
                                  {total.repartitionCarSoir}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        )}

      </div>

      {/* Bouton d'action flottant pour Boutique */}
      <button
        onClick={() => setShowQuantiteBoutiqueForm(true)}
        disabled={showQuantiteBoutiqueForm}
        className="fixed bottom-6 right-6 w-16 h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 disabled:opacity-50 z-50 flex items-center justify-center group"
        title="Ajouter un produit boutique"
      >
        <div className="relative">
          <Icon icon="mdi:storefront-plus" className="text-2xl transition-transform group-hover:scale-110" />
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
        </div>
      </button>

      {/* Bouton pour descendre/monter */}
      {programmeActuel?.totauxParProduit && programmeActuel.totauxParProduit.length > 0 && (
        <ScrollToTopBottom />
      )}
    </div>
  );
};