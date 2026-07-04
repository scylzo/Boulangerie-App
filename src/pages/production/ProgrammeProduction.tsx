/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';

import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Modal } from '../../components/ui/Modal';
import { CommandeClientForm } from '../../components/shared/CommandeClientForm';
import { ModifierProduitForm } from '../../components/shared/ModifierProduitForm';
import { QuantiteBoutiqueForm } from '../../components/shared/QuantiteBoutiqueForm';
import { useProductionStore } from '../../store';
import { useConfirmModal } from '../../hooks/useConfirmModal';
import { htmlPrintService } from '../../services/htmlPrintService';
import { downloadProductionProgramPDF } from '../../utils/pdfGenerator';
import { useLivreurStore } from '../../store/livreurStore'; // Ajout Import
import { ScrollToTopBottom } from '../../components/ui/ScrollToTopBottom';
import { RedistributionModal } from '../../components/production/RedistributionModal';
import type { CommandeClient, RedistributionData } from '../../types';



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
    annulerCommandeAvecRedistribution,
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
  const [showRedistributionModal, setShowRedistributionModal] = useState(false);
  const [commandeARedistribuer, setCommandeARedistribuer] = useState<CommandeClient | null>(null);

  // Filtrer les commandes selon la recherche
  const commandesFiltrees = commandesClients.filter(commande => {
    if (!rechercheClient.trim()) return true;
    const client = clients.find(c => c.id === commande.clientId);
    const nomClient = client?.nom?.toLowerCase() || '';
    const rechercheNormalisee = rechercheClient.toLowerCase().trim();
    return nomClient.includes(rechercheNormalisee);
  });

  // Calculer les clients réguliers manquants
  const clientsReguliers = clients.filter(c => c.estRegulier && c.active);
  const clientsAyantCommande = new Set(commandesClients.map(cmd => cmd.clientId));
  const clientsManquants = clientsReguliers.filter(c => !clientsAyantCommande.has(c.id));

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

  const handleAnnulerCommande = async (commandeId: string) => {
    const commande = commandesClients.find(c => c.id === commandeId);
    const client = clients.find(c => c.id === commande?.clientId);

    // Si le programme est déjà produit, envoyé ou modifié, on utilise la redistribution
    const programmeDejaProduit = programmeActuel?.statut === 'produit' ||
      programmeActuel?.statut === 'envoye' ||
      programmeActuel?.statut === 'modifie';

    if (programmeDejaProduit && commande && commande.statut !== 'annulee') {
      setCommandeARedistribuer(commande);
      setShowRedistributionModal(true);
      return;
    }

    const confirmation = await confirmModal.confirm({
      title: 'Annuler la commande',
      message: `Êtes-vous sûr de vouloir annuler la commande de "${client?.nom || 'Client inconnu'}" ?\n\nCette action supprimera la commande du programme.`,
      confirmText: 'Annuler la commande',
      cancelText: 'Conserver',
      type: 'warning'
    });

    if (confirmation) {
      annulerCommandeClient(commandeId);
      toast.success(`Commande de ${client?.nom || 'le client'} annulée`);
    }
  };

  const handleConfirmRedistribution = async (redistribution: RedistributionData) => {
    if (!commandeARedistribuer) return;

    try {
      await annulerCommandeAvecRedistribution(commandeARedistribuer.id, redistribution);
      setShowRedistributionModal(false);
      setCommandeARedistribuer(null);
      toast.success('✅ Commande annulée et produits redistribués avec succès !');
    } catch (error) {
      console.error('Erreur redistribution:', error);
      toast.error('❌ Erreur lors de la redistribution');
    }
  };


  const handleSupprimerCommande = async (commandeId: string) => {
    const commande = commandesClients.find(c => c.id === commandeId);
    const client = clients.find(c => c.id === commande?.clientId);

    const confirmation = await confirmModal.confirm({
      title: 'Supprimer définitivement',
      message: `Êtes-vous sûr de vouloir supprimer définitivement la commande de "${client?.nom || 'Client inconnu'}" ?\n\nCette action est irréversible.`,
      confirmText: 'Supprimer définitivement',
      cancelText: 'Annuler',
      type: 'danger'
    });

    if (confirmation) {
      supprimerCommandeClient(commandeId);
      toast.success(`Commande de ${client?.nom || 'le client'} supprimée`);
    }
  };

  const handleAnnulerFormulaire = () => {
    setShowCommandeForm(false);
    setCommandeEnEdition(null);
    setIndexProduitEnEdition(null);
    setModeFormulaire('create');
    resetFormulaireCommande(); // Réinitialiser le formulaire lors de l'annulation
  };

  const handleSupprimerProduitDeCommande = async (commandeId: string, produitIndex: number) => {
    const commande = commandesClients.find(c => c.id === commandeId);
    const produit = commande?.produits[produitIndex];
    const produitRef = produits.find(p => p.id === produit?.produitId);

    const confirmation = await confirmModal.confirm({
      title: 'Supprimer le produit',
      message: `Êtes-vous sûr de vouloir supprimer "${produitRef?.nom || 'ce produit'}" de cette commande ?\n\n${commande?.produits.length === 1 ? '⚠️ Cette action supprimera complètement la commande car c\'est le seul produit.' : 'Les autres produits de la commande seront conservés.'}`,
      confirmText: 'Supprimer le produit',
      cancelText: 'Annuler',
      type: 'warning'
    });

    if (confirmation) {
      supprimerProduitDeCommande(commandeId, produitIndex);
      toast.success(`Produit "${produitRef?.nom || 'Produit'}" supprimé de la commande`);
    }
  };



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
            <p className="text-sand-600">
              Êtes-vous sûr de vouloir envoyer ce programme au boulanger ?
            </p>

            <div className="bg-info-50/50 rounded-lg p-3 space-y-2 border border-info-100">
              <div className="flex items-center gap-2 text-sand-700">
                <Icon icon="mdi:script-text-outline" className="text-info-500" />
                <span className="font-medium text-sm">{commandesValides.length} commandes clients</span>
              </div>
              <div className="flex items-center gap-2 text-sand-700">
                <Icon icon="mdi:bread" className="text-warning-500" />
                <span className="font-medium text-sm">{programmeActuel.totauxParProduit.length} types de produits</span>
              </div>
              <div className="flex items-center gap-2 text-sand-700">
                <Icon icon="mdi:store" className="text-terracotta-500" />
                <span className="font-medium text-sm">{quantitesBoutique.length} produits boutique</span>
              </div>
            </div>

            <p className="text-xs text-sand-500 flex items-start gap-1.5 bg-sand-50 p-2 rounded">
              <Icon icon="mdi:information-outline" className="text-info-500 mt-0.5" />
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
      title: 'Clôturer la production',
      message: `🏭 Êtes-vous sûr de vouloir clôturer la production ?\n\nCela va :\n1. Changer le statut en "Terminé"\n2. Verrouiller le programme\n\n⚠️ N'oubliez pas de faire votre "Déclaration de Consommation" dans le menu Stocks pour mettre à jour vos inventaires.`,
      confirmText: 'Clôturer la production',
      cancelText: 'Annuler',
      type: 'info'
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

  const handleTelechargerRapport = async () => {
    if (!programmeActuel) return;
    try {
      await downloadProductionProgramPDF(programmeActuel);
      toast.success('📄 Rapport de production généré !');
    } catch (error) {
      toast.error('❌ Erreur lors de la génération du rapport');
    }
  };


  return (
    <div className="min-h-screen bg-sand-100 overflow-x-hidden">
      {/* Header */}
      <div className="bg-white border-b border-sand-200 px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-col gap-3 sm:gap-4">
          {/* Titre et statut */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-terracotta-50 rounded-xl flex items-center justify-center shrink-0">
                <Icon icon="mdi:bread-slice-outline" className="text-xl text-terracotta-600" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="font-display text-lg sm:text-2xl font-semibold text-sand-900 truncate">
                  Programme de production
                </h1>
                <p className="text-xs sm:text-sm text-sand-500 truncate">
                  Commandes clients & quantités boutique du jour
                </p>
              </div>
            </div>
            {programmeActuel && (() => {
              const st = programmeActuel.statut;
              const cfg = st === 'brouillon' ? { c: 'bg-warning-50 text-warning-600 ring-warning-100', i: 'mdi:file-document-edit-outline', t: 'Brouillon' }
                : st === 'modifie' ? { c: 'bg-warning-50 text-warning-600 ring-warning-100', i: 'mdi:file-document-alert', t: 'Modifié' }
                  : st === 'envoye' ? { c: 'bg-info-50 text-info-600 ring-info-100', i: 'mdi:send-check', t: 'Envoyé au four' }
                    : { c: 'bg-success-50 text-success-700 ring-success-100', i: 'mdi:check-decagram', t: 'Production validée' };
              return (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ring-1 ring-inset self-start shrink-0 ${cfg.c}`}>
                  <Icon icon={cfg.i} className="text-sm" />{cfg.t}
                </span>
              );
            })()}
          </div>

          {/* Stepper de statut + actions */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Stepper */}
            <div className="flex items-center gap-1 flex-wrap">
              {[
                { l: 'Brouillon', i: 'mdi:file-document-edit-outline' },
                { l: 'Envoyé au four', i: 'mdi:send-check-outline' },
                { l: 'Produit', i: 'mdi:check-decagram-outline' },
              ].map((s, i, arr) => {
                const order: Record<string, number> = { brouillon: 0, modifie: 1, envoye: 1, produit: 2 };
                const idx = order[programmeActuel?.statut ?? 'brouillon'] ?? 0;
                const active = i === idx, done = i < idx;
                const cls = active ? 'bg-terracotta-500 text-white' : done ? 'bg-success-50 text-success-600' : 'bg-sand-100 text-sand-500';
                return (
                  <div key={s.l} className="flex items-center gap-1.5">
                    <div className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full ${cls}`}>
                      <Icon icon={s.i} className="text-sm sm:text-base" />
                      <span className="text-[11px] sm:text-xs font-semibold whitespace-nowrap">{s.l}</span>
                    </div>
                    {i < arr.length - 1 && <span className="text-sand-300">→</span>}
                  </div>
                );
              })}
            </div>

            {/* Actions Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Bouton Envoyer/Renvoyer */}
              {programmeActuel && (
                <button
                  onClick={handleEnvoyerAuBoulanger}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-white text-sand-800 border border-sand-300 rounded-lg hover:bg-sand-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-soft text-xs sm:text-sm font-medium"
                >
                  <Icon icon="mdi:send-outline" className="text-base sm:text-lg text-terracotta-600" />
                  <span className="hidden sm:inline">
                    {programmeActuel.statut === 'brouillon' ? 'Envoyer le programme' : 'Renvoyer le programme'}
                  </span>
                  <span className="sm:hidden">Envoi</span>
                </button>
              )}

              {/* Bouton Rapport */}
              {programmeActuel && (
                <button
                  onClick={handleTelechargerRapport}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-white text-sand-800 border border-sand-300 rounded-lg hover:bg-sand-100 transition-all disabled:opacity-50 shadow-soft text-xs sm:text-sm font-medium"
                  title="Télécharger le rapport de production"
                >
                  <Icon icon="mdi:file-pdf-box" className="text-base sm:text-lg text-danger-500" />
                  <span className="hidden sm:inline">Rapport PDF</span>
                </button>
              )}

              {/* Bouton Valider Production */}
              {(programmeActuel?.statut === 'envoye' || programmeActuel?.statut === 'modifie') && (
                <button
                  onClick={handleValiderProduction}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-terracotta-500 text-white rounded-lg hover:bg-terracotta-600 transition-all disabled:opacity-50 shadow-soft text-xs sm:text-sm font-medium"
                >
                  <Icon icon="mdi:check-decagram" className="text-base sm:text-lg" />
                  <span className="hidden sm:inline">Valider la production</span>
                  <span className="sm:hidden">Valider</span>
                </button>
              )}
            </div>
          </div>
        </div>
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

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">

        {/* Widget de sélection de date moderne */}
        <div className="bg-white rounded-xl border border-sand-200 shadow-card p-4 sm:p-5 overflow-hidden">
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <div className="w-8 h-8 bg-sand-100 rounded-lg flex items-center justify-center shrink-0">
              <Icon icon="mdi:calendar" className="text-lg text-sand-600" />
            </div>
            <h2 className="text-base sm:text-lg font-semibold text-sand-900 truncate">Date de production</h2>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
            {/* Sélecteur de date */}
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={dateSelectionnee}
                onChange={(e) => handleDateChange(e.target.value)}
                className="px-3 sm:px-4 py-2 sm:py-3 border border-sand-300 rounded-lg focus:ring-2 focus:ring-terracotta-500 focus:border-transparent text-sand-900 font-medium shadow-sm hover:border-sand-400 transition-all text-sm sm:text-base w-full sm:w-auto"
              />
            </div>

            {/* Carte d'information de production */}
            <div className="bg-sand-50 border border-sand-200 rounded-lg p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-sand-900 rounded-lg flex items-center justify-center shrink-0">
                  <Icon icon="mdi:factory" className="text-lg sm:text-xl text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[10px] sm:text-xs font-medium text-sand-500 uppercase tracking-wide">Production programmée</span>
                    <Icon icon="mdi:calendar-check" className="text-sand-400 text-xs" />
                  </div>
                  <div className="text-xs sm:text-sm font-semibold text-sand-900 truncate" title={(() => {
                    const dateProduction = new Date(dateSelectionnee);
                    return dateProduction.toLocaleDateString('fr-FR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    });
                  })()}>
                    {(() => {
                      const dateProduction = new Date(dateSelectionnee);
                      return dateProduction.toLocaleDateString('fr-FR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      });
                    })()}
                  </div>
                  {programmeActuel && (
                    <div className="flex items-center gap-1 mt-0.5 text-[9px] sm:text-[10px] text-sand-500">
                      <Icon icon="mdi:clock-outline" className="text-sand-400" />
                      <span className="truncate">Créé le {programmeActuel.dateCreation.toLocaleDateString('fr-FR')} à {programmeActuel.dateCreation.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  )}
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

        <RedistributionModal
          isOpen={showRedistributionModal}
          onClose={() => {
            setShowRedistributionModal(false);
            setCommandeARedistribuer(null);
          }}
          onConfirm={handleConfirmRedistribution}
          commande={commandeARedistribuer}
          clients={clients}
          isLoading={isLoading}
        />



        {/* Section Commandes Clients avec design moderne */}
        <div className="bg-white rounded-xl border border-sand-200 shadow-card overflow-hidden">
          {/* Header de la section */}
          <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-sand-100 bg-sand-50/50">
            <div className="flex flex-col gap-3 sm:gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 bg-sand-100 rounded-lg flex items-center justify-center shrink-0">
                    <Icon icon="mdi:account-group" className="text-lg text-sand-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base sm:text-lg font-semibold text-sand-900 truncate">Commandes Clients</h2>
                    <p className="text-xs sm:text-sm text-sand-500 truncate">Ajoutez les commandes des clients pour le jour sélectionné</p>
                  </div>
                </div>

                <button
                  onClick={() => handleAjouterCommande()}
                  disabled={showCommandeForm}
                  className="flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 bg-terracotta-500 text-white rounded-lg hover:bg-terracotta-600 transition-all disabled:opacity-50 shadow-sm text-xs sm:text-sm font-medium w-full sm:w-auto shrink-0"
                >
                  <Icon icon="mdi:plus" className="text-base sm:text-lg" />
                  <span>Nouvelle commande</span>
                </button>
              </div>

              {/* Barre de recherche */}
              {commandesClients.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  <div className="relative flex-1 max-w-full sm:max-w-md">
                    <Icon icon="mdi:magnify" className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sand-400" />
                    <input
                      type="text"
                      placeholder="Rechercher un client..."
                      value={rechercheClient}
                      onChange={(e) => setRechercheClient(e.target.value)}
                      className="w-full pl-10 pr-10 py-2 border border-sand-300 rounded-lg focus:ring-2 focus:ring-terracotta-500 focus:border-transparent text-xs sm:text-sm"
                    />
                    {rechercheClient && (
                      <button
                        onClick={() => setRechercheClient('')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sand-400 hover:text-sand-600"
                      >
                        <Icon icon="mdi:close" />
                      </button>
                    )}
                  </div>
                  <div className="text-xs sm:text-sm text-sand-500 shrink-0">
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
          <div className="p-4 sm:p-6">

            {/* Alerte Clients Réguliers Manquants */}
            {clientsManquants.length > 0 && (
              <div className="bg-warning-50 border border-warning-100 rounded-xl p-3 sm:p-4 mb-4 sm:mb-6">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-warning-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                    <Icon icon="mdi:alert" className="text-warning-600 text-lg" />
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-warning-600">
                        {clientsManquants.length} Client{clientsManquants.length > 1 ? 's' : ''} Régulier{clientsManquants.length > 1 ? 's' : ''} Manquant{clientsManquants.length > 1 ? 's' : ''}
                      </h3>
                    </div>
                    <p className="text-xs sm:text-sm text-warning-600 mb-3">
                      Ces clients commandent habituellement mais ne sont pas dans le programme du jour. Cliquez pour les ajouter rapidement.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {clientsManquants.map(client => (
                        <button
                          key={client.id}
                          onClick={() => handleAjouterCommande(client.id)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-warning-100 rounded-lg text-xs font-medium text-warning-600 hover:bg-warning-50 hover:border-warning-500 transition-colors shadow-sm"
                        >
                          <Icon icon="mdi:plus" className="text-warning-600" />
                          <span>{client.nom}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {commandesFiltrees.length === 0 ? (
              <div className="text-center py-12 sm:py-16">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-sand-100 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
                  <Icon icon={rechercheClient ? "mdi:magnify" : "mdi:clipboard-outline"} className="text-3xl sm:text-4xl text-sand-400" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-sand-900 mb-2">
                  {rechercheClient
                    ? `Aucun client trouvé pour "${rechercheClient}"`
                    : "Aucune commande client"
                  }
                </h3>
                <p className="text-sm sm:text-base text-sand-500 mb-6 sm:mb-8 max-w-md mx-auto px-4">
                  {rechercheClient
                    ? "Essayez avec d'autres termes de recherche ou ajoutez une nouvelle commande"
                    : "Commencez par ajouter une commande client pour ce jour de production"
                  }
                </p>
                {rechercheClient ? (
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center">
                    <button
                      onClick={() => setRechercheClient('')}
                      className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 text-sand-700 bg-white border border-sand-300 rounded-lg hover:bg-sand-50 transition-all text-xs sm:text-sm font-medium"
                    >
                      <Icon icon="mdi:close" className="text-base sm:text-lg" />
                      <span>Effacer la recherche</span>
                    </button>
                    <button
                      onClick={() => handleAjouterCommande()}
                      className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 bg-terracotta-500 text-white rounded-lg hover:bg-terracotta-600 transition-all shadow-sm text-xs sm:text-sm font-medium"
                    >
                      <Icon icon="mdi:plus" className="text-base sm:text-lg" />
                      <span>Nouvelle commande</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleAjouterCommande()}
                    className="inline-flex items-center justify-center gap-1.5 px-4 sm:px-6 py-2 sm:py-3 bg-terracotta-500 text-white rounded-lg hover:bg-terracotta-600 transition-all shadow-sm text-xs sm:text-sm font-medium"
                  >
                    <Icon icon="mdi:plus" className="text-base sm:text-lg" />
                    <span>Ajouter la première commande</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {commandesFiltrees.map((commande) => {
                  const client = clients.find(c => c.id === commande.clientId);
                  const isSunday = new Date(dateSelectionnee).getDay() === 0;
                  const alertSunday = isSunday && client?.neTravaillePasDimanche;

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
                      className={`relative bg-white border ${alertSunday ? 'border-warning-500 ring-2 ring-warning-100' : 'border-sand-200'} rounded-2xl p-4 sm:p-5 hover:border-sand-300 hover:shadow-elevated transition-all duration-200 overflow-hidden ${commande.statut === 'annulee' ? 'opacity-60' : ''}`}
                    >
                      {/* En-tête de la commande */}
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
                        <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
                          <div className="w-11 h-11 sm:w-12 sm:h-12 bg-sand-900 rounded-full flex items-center justify-center shrink-0 text-white font-semibold text-sm sm:text-base">
                            {(client?.nom || '?').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-base sm:text-lg text-sand-900 mb-1 truncate" title={client?.nom || 'Client inconnu'}>
                              {client?.nom || 'Client inconnu'}
                            </h3>
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="flex items-center gap-1 text-xs sm:text-sm text-sand-600 bg-sand-100 px-2 py-1 rounded-lg">
                                <Icon icon="mdi:calendar-clock" className="text-sand-500" />
                                <span className="truncate">{new Date(commande.dateLivraison).toLocaleDateString('fr-FR')}</span>
                              </div>
                              {alertSunday && (
                                <span className="flex items-center gap-1 px-2 py-1 bg-warning-50 text-warning-600 text-[10px] sm:text-xs font-semibold rounded-full border border-warning-100 animate-pulse">
                                  <Icon icon="mdi:alert" className="text-warning-600" />
                                  Repos Dimanche !
                                </span>
                              )}
                              {commande.statut === 'annulee' && (
                                <span className="flex items-center gap-1 px-2 py-1 bg-danger-50 text-danger-700 text-[10px] sm:text-xs font-medium rounded-full">
                                  <Icon icon="mdi:cancel" className="text-danger-600" />
                                  ANNULÉE
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-left sm:text-right shrink-0">
                          <div className="font-display text-lg sm:text-xl font-semibold text-sand-800">
                            {totalCommande.toLocaleString('fr-FR')}
                          </div>
                          <div className="text-[10px] sm:text-xs text-sand-400 font-medium">FCFA</div>
                          <div className="flex items-center sm:justify-end gap-1 text-xs sm:text-sm text-sand-500 mt-1">
                            <Icon icon="mdi:package-variant-closed" className="text-sand-400" />
                            {commande.produits.length} article{commande.produits.length > 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>

                      {/* Liste des produits commandés */}
                      <div className="space-y-3 sm:space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 pb-2 border-b border-sand-200">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <Icon icon="mdi:view-list" className="text-sand-500 shrink-0" />
                            <h4 className="text-sm sm:text-base font-semibold text-sand-800 truncate">
                              Produits commandés
                            </h4>
                            <span className="text-xs sm:text-sm font-medium text-sand-500 bg-sand-100 px-2 py-1 rounded-lg shrink-0">
                              {commande.produits.length} item{commande.produits.length > 1 ? 's' : ''}
                            </span>
                          </div>

                          {/* Boutons d'action avec icônes Lucide */}
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => {
                                // Résoudre les livreurs affectés par voiture
                                let livreursStr = 'Non assigné';
                                if (client) {
                                  const activeCars = new Set<'car1_matin' | 'car2_matin' | 'car_soir'>();
                                  commande.produits.forEach(item => {
                                    if (item.repartitionCars) {
                                      Object.entries(item.repartitionCars).forEach(([car, qty]) => {
                                        if (qty && qty > 0) {
                                          activeCars.add(car as any);
                                        }
                                      });
                                    }
                                  });

                                  if (activeCars.size === 0) {
                                    const l = client.livreurId ? livreurs.find(drv => drv.id === client.livreurId) : null;
                                    livreursStr = l ? l.nom : client.livreurId ? `Livreur (ID: ${client.livreurId.substring(0, 6)}...)` : 'Non assigné';
                                  } else {
                                    const assignments: string[] = [];
                                    const labels: Record<string, string> = {
                                      car1_matin: 'Car 1',
                                      car2_matin: 'Car 2',
                                      car_soir: 'Soir'
                                    };

                                    activeCars.forEach(car => {
                                      const lId = client.livreursParCar?.[car] || client.livreurId;
                                      if (lId) {
                                        const l = livreurs.find(drv => drv.id === lId);
                                        const lNom = l ? l.nom : `Livreur (ID: ${lId.substring(0, 6)}...)`;
                                        assignments.push(`${lNom} (${labels[car] || car})`);
                                      }
                                    });

                                    if (assignments.length > 0) {
                                      const uniqueDrivers = new Set(assignments.map(a => a.split(' (')[0]));
                                      if (uniqueDrivers.size === 1) {
                                        livreursStr = Array.from(uniqueDrivers)[0];
                                      } else {
                                        livreursStr = assignments.join(', ');
                                      }
                                    }
                                  }
                                }

                                const clientAvecLivreur = {
                                  ...client,
                                  livreur: livreursStr
                                };
                                htmlPrintService.generateDeliveryReceiptHTML(commande, clientAvecLivreur, produits);
                              }}
                              className="p-2 text-info-600 hover:text-info-600 hover:bg-info-50 rounded-lg transition-colors"
                              title="Bon de livraison"
                            >
                              <Icon icon="mdi:file-document-outline" className="text-lg" />
                            </button>
                            <button
                              onClick={() => handleAjouterCommande(commande.clientId)}
                              className="p-2 text-success-600 hover:text-success-700 hover:bg-success-50 rounded-lg transition-colors"
                              title="Ajouter des produits"
                            >
                              <Icon icon="mdi:plus" className="text-lg" />
                            </button>
                            <button
                              onClick={() => handleAnnulerCommande(commande.id)}
                              className="p-2 text-warning-600 hover:text-warning-600 hover:bg-warning-50 rounded-lg transition-colors"
                              title="Annuler la commande"
                            >
                              <Icon icon="mdi:ban" className="text-lg" />
                            </button>
                            <button
                              onClick={() => handleSupprimerCommande(commande.id)}
                              className="p-2 text-danger-600 hover:text-danger-700 hover:bg-danger-50 rounded-lg transition-colors"
                              title="Supprimer définitivement"
                            >
                              <Icon icon="mdi:delete-outline" className="text-lg" />
                            </button>
                          </div>
                        </div>
                        <div className="grid gap-3 sm:gap-4 grid-cols-1 lg:grid-cols-2">
                          {commande.produits.map((item, index) => {
                            const produit = produits.find(p => p.id === item.produitId);
                            return (
                              <div key={index} className="bg-sand-50 border border-sand-200 rounded-xl p-3 sm:p-4 hover:border-sand-300 hover:bg-white hover:shadow-soft transition-all overflow-hidden">
                                <div className="flex items-start gap-2 sm:gap-3 mb-2">
                                  <div className="w-9 h-9 sm:w-10 sm:h-10 bg-sand-100 text-sand-700 rounded-lg flex items-center justify-center shrink-0">
                                    <Icon
                                      icon={getProductIcon(produit?.nom || '')}
                                      className="text-base sm:text-lg"
                                    />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <h5 className="font-semibold text-sm sm:text-base text-sand-900 truncate mb-1" title={produit?.nom || 'Produit inconnu'}>
                                      {produit?.nom || 'Produit inconnu'}
                                    </h5>
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                      <span className="text-xs sm:text-sm text-sand-600 bg-sand-100 px-2 py-1 rounded-lg font-medium shrink-0 w-fit">
                                        x{item.quantiteCommandee}
                                      </span>
                                      <div className="flex items-center justify-between sm:justify-end gap-2 flex-1">
                                        <div className="text-sm sm:text-base font-semibold text-sand-800">
                                          {((item.prixUnitaire || 0) * item.quantiteCommandee).toLocaleString('fr-FR')} F
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleModifierProduitSpecifique(commande.id, index);
                                            }}
                                            className="p-1 text-sand-600 hover:text-sand-800 hover:bg-sand-100 rounded"
                                            title="Modifier ce produit"
                                          >
                                            <Icon icon="mdi:pencil" className="text-base sm:text-lg" />
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleSupprimerProduitDeCommande(commande.id, index);
                                            }}
                                            className="p-1 text-danger-500 hover:text-danger-700 hover:bg-danger-50 rounded"
                                            title="Supprimer ce produit de la commande"
                                          >
                                            <Icon icon="mdi:close" className="text-base sm:text-lg" />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Répartition par cars */}
                                {item.repartitionCars && (
                                  <div className="pt-2 sm:pt-3 border-t border-sand-200">
                                    <div className="text-[10px] sm:text-xs font-medium text-sand-600 mb-2 flex items-center gap-1">
                                      <Icon icon="mdi:truck-delivery" className="text-sand-500" />
                                      Livraisons programmées
                                    </div>
                                    <div className="flex gap-1.5 sm:gap-2 flex-wrap">
                                      {item.repartitionCars.car1_matin && Number(item.repartitionCars.car1_matin) > 0 && (
                                        <div className="flex items-center gap-1 px-2 py-1 bg-warning-50 text-warning-600 text-[10px] sm:text-xs font-medium rounded-full border border-warning-100">
                                          <Icon icon="mdi:truck" className="text-xs" />
                                          <span>Car 1M: {item.repartitionCars.car1_matin}</span>
                                        </div>
                                      )}
                                      {item.repartitionCars.car2_matin && Number(item.repartitionCars.car2_matin) > 0 && (
                                        <div className="flex items-center gap-1 px-2 py-1 bg-info-50 text-info-600 text-[10px] sm:text-xs font-medium rounded-full border border-info-100">
                                          <Icon icon="mdi:truck-outline" className="text-xs" />
                                          <span>Car 2M: {item.repartitionCars.car2_matin}</span>
                                        </div>
                                      )}
                                      {item.repartitionCars.car_soir && Number(item.repartitionCars.car_soir) > 0 && (
                                        <div className="flex items-center gap-1 px-2 py-1 bg-terracotta-50 text-terracotta-700 text-[10px] sm:text-xs font-medium rounded-full border border-terracotta-100">
                                          <Icon icon="mdi:truck-fast" className="text-xs" />
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
                <div className="bg-sand-50 rounded-lg p-4 mt-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="font-display text-2xl font-semibold text-sand-900">
                        {commandesClients.length}
                      </div>
                      <div className="text-sm text-sand-500">Commandes</div>
                    </div>
                    <div className="text-center">
                      <div className="font-display text-2xl font-semibold text-info-600">
                        {commandesClients.reduce((total, cmd) => total + cmd.produits.length, 0)}
                      </div>
                      <div className="text-sm text-sand-500">Articles</div>
                    </div>
                    <div className="text-center">
                      <div className="font-display text-xl font-semibold text-success-600">
                        {commandesClients.reduce((total, cmd) =>
                          total + cmd.produits.reduce((subtotal, item) =>
                            subtotal + (item.prixUnitaire || 0) * item.quantiteCommandee, 0
                          ), 0
                        ).toLocaleString('fr-FR')} FCFA
                      </div>
                      <div className="text-sm text-sand-500">Total</div>
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
        <div className="bg-white rounded-xl border border-sand-200 shadow-card">
          <div className="px-6 py-4 border-b border-sand-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-warning-100 rounded-lg flex items-center justify-center">
                  <Icon icon="mdi:storefront" className="text-lg text-warning-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-sand-900">Quantités Boutique</h2>
                  <p className="text-sm text-sand-500">Définissez les quantités à envoyer en boutique</p>
                </div>
              </div>

              <button
                onClick={() => setShowQuantiteBoutiqueForm(true)}
                disabled={showQuantiteBoutiqueForm}
                className="flex items-center gap-2 px-4 py-2 text-sand-700 bg-white border border-sand-300 hover:bg-sand-50 hover:border-sand-400 rounded-lg transition-all disabled:opacity-50 shadow-sm hover:shadow-elevated"
              >
                <Icon icon="mdi:plus" className="text-lg" />
                <span className="font-medium">Ajouter produit</span>
              </button>
            </div>
          </div>

          <div className="p-6">

            {quantitesBoutique.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-sand-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icon icon="mdi:storefront-outline" className="text-3xl text-sand-400" />
                </div>
                <h3 className="text-lg font-medium text-sand-900 mb-2">
                  Aucune quantité boutique
                </h3>
                <p className="text-sand-500 mb-6">
                  Définissez les produits à envoyer directement en boutique
                </p>
                <button
                  onClick={() => setShowQuantiteBoutiqueForm(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 text-sand-700 bg-white border border-sand-300 hover:bg-sand-50 hover:border-sand-400 rounded-lg transition-all shadow-sm hover:shadow-elevated"
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
                        className="bg-white border border-sand-200 rounded-xl p-4 hover:border-sand-300 hover:shadow-elevated transition-all group"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-sand-900 rounded-lg flex items-center justify-center shadow-md">
                              <Icon icon="mdi:storefront" className="text-lg text-white" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-sand-900">
                                {produit?.nom || 'Produit inconnu'}
                              </h4>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-sm text-sand-700 bg-sand-100 px-2 py-1 rounded-lg font-medium">
                                  {item.quantite} pièce{item.quantite > 1 ? 's' : ''}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => {
                                setQuantiteBoutiqueEnEdition(item);
                                setShowQuantiteBoutiqueForm(true);
                              }}
                              className="p-2 text-warning-500 hover:text-warning-600 hover:bg-warning-100 rounded-lg transition-colors"
                              title="Modifier"
                            >
                              <Icon icon="mdi:pencil-outline" className="text-lg" />
                            </button>
                            <button
                              onClick={() => supprimerQuantiteBoutique(item.produitId)}
                              className="p-2 text-danger-500 hover:text-danger-700 hover:bg-danger-100 rounded-lg transition-colors"
                              title="Supprimer"
                            >
                              <Icon icon="mdi:delete-outline" className="text-lg" />
                            </button>
                          </div>
                        </div>

                        {/* Répartition par cars pour la boutique */}
                        {item.repartitionCars && (
                          <div className="border-t border-sand-200 pt-3">
                            <div className="text-xs font-medium text-sand-600 mb-2 flex items-center gap-1">
                              <Icon icon="mdi:truck-delivery" className="text-sand-500" />
                              Répartition par cars
                            </div>
                            <div className="space-y-2">
                              {item.repartitionCars.car1_matin > 0 && (
                                <div className="flex items-center justify-between p-2 bg-warning-50 border border-warning-100 rounded-lg">
                                  <div className="flex items-center gap-2">
                                    <Icon icon="mdi:truck" className="text-warning-600 text-sm" />
                                    <span className="text-xs font-medium text-warning-600">Car 1M</span>
                                  </div>
                                  <span className="text-xs font-semibold text-warning-600">
                                    {item.repartitionCars.car1_matin}
                                  </span>
                                </div>
                              )}
                              {item.repartitionCars.car2_matin > 0 && (
                                <div className="flex items-center justify-between p-2 bg-info-50 border border-info-100 rounded-lg">
                                  <div className="flex items-center gap-2">
                                    <Icon icon="mdi:truck-outline" className="text-info-600 text-sm" />
                                    <span className="text-xs font-medium text-info-600">Car 2M</span>
                                  </div>
                                  <span className="text-xs font-semibold text-info-600">
                                    {item.repartitionCars.car2_matin}
                                  </span>
                                </div>
                              )}
                              {item.repartitionCars.car_soir > 0 && (
                                <div className="flex items-center justify-between p-2 bg-terracotta-50 border border-terracotta-100 rounded-lg">
                                  <div className="flex items-center gap-2">
                                    <Icon icon="mdi:truck-fast" className="text-terracotta-600 text-sm" />
                                    <span className="text-xs font-medium text-terracotta-700">Car S</span>
                                  </div>
                                  <span className="text-xs font-semibold text-terracotta-700">
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

                <div className="bg-sand-50 rounded-lg p-4 mt-6">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="text-center">
                      <div className="font-display text-2xl font-semibold text-sand-900">
                        {quantitesBoutique.length}
                      </div>
                      <div className="text-sm text-sand-500">Produits boutique</div>
                    </div>
                    <div className="text-center">
                      <div className="font-display text-2xl font-semibold text-warning-600">
                        {quantitesBoutique.reduce((total, item) => total + item.quantite, 0)}
                      </div>
                      <div className="text-sm text-sand-500">Total pièces</div>
                    </div>
                    <div className="text-center">
                      <div className="font-display text-xl font-semibold text-warning-600">
                        {quantitesBoutique.reduce((total, item) => total + (item.repartitionCars?.car1_matin || 0), 0)}
                      </div>
                      <div className="text-xs text-sand-500">Car 1M</div>
                    </div>
                    <div className="text-center">
                      <div className="font-display text-xl font-semibold text-info-600">
                        {quantitesBoutique.reduce((total, item) => total + (item.repartitionCars?.car2_matin || 0), 0)}
                      </div>
                      <div className="text-xs text-sand-500">Car 2M</div>
                    </div>
                    <div className="text-center">
                      <div className="font-display text-xl font-semibold text-terracotta-600">
                        {quantitesBoutique.reduce((total, item) => total + (item.repartitionCars?.car_soir || 0), 0)}
                      </div>
                      <div className="text-xs text-sand-500">Car S</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section Programme de Production */}
        {programmeActuel?.totauxParProduit && programmeActuel.totauxParProduit.length > 0 && (
          <div className="bg-white rounded-xl border border-sand-200 shadow-card">
            <div className="px-6 py-4 border-b border-sand-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-terracotta-100 rounded-lg flex items-center justify-center">
                  <Icon icon="mdi:chart-pie" className="text-lg text-terracotta-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-sand-900">Programme de Production</h2>
                  <p className="text-sm text-sand-500">Répartition des quantités par produit et par car de livraison</p>
                </div>
              </div>
            </div>

            <div className="p-4">
              {/* KPI Cards - Style Odoo moderne */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-sand-900 rounded-2xl p-4 text-white shadow-card hover:shadow-elevated transition-all group">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                      <Icon icon="mdi:truck-delivery" className="text-xl text-white" />
                    </div>
                    <div className="text-right">
                      <div className="font-display text-2xl font-semibold">
                        {programmeActuel.totauxParProduit.reduce((sum, p) => sum + (p.repartitionCar1Matin || 0), 0)}
                      </div>
                      <div className="text-sand-300 text-xs">pièces</div>
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-base font-semibold">Car 1 - Matin</div>
                    <div className="flex items-center gap-2 text-sand-300">
                      <Icon icon="mdi:clock-time-eight" className="text-sm" />
                      <span className="text-sm">06:00 - 10:00</span>
                    </div>
                  </div>
                </div>

                <div className="bg-sand-900 rounded-2xl p-4 text-white shadow-card hover:shadow-elevated transition-all group">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                      <Icon icon="mdi:truck-delivery-outline" className="text-xl text-white" />
                    </div>
                    <div className="text-right">
                      <div className="font-display text-2xl font-semibold">
                        {programmeActuel.totauxParProduit.reduce((sum, p) => sum + (p.repartitionCar2Matin || 0), 0)}
                      </div>
                      <div className="text-sand-300 text-xs">pièces</div>
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-base font-semibold">Car 2 - Matin</div>
                    <div className="flex items-center gap-2 text-sand-300">
                      <Icon icon="mdi:clock-time-nine" className="text-sm" />
                      <span className="text-sm">08:00 - 12:00</span>
                    </div>
                  </div>
                </div>

                <div className="bg-sand-900 rounded-2xl p-4 text-white shadow-card hover:shadow-elevated transition-all group">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                      <Icon icon="mdi:truck-fast" className="text-xl text-white" />
                    </div>
                    <div className="text-right">
                      <div className="font-display text-2xl font-semibold">
                        {programmeActuel.totauxParProduit.reduce((sum, p) => sum + (p.repartitionCarSoir || 0), 0)}
                      </div>
                      <div className="text-sand-300 text-xs">pièces</div>
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-base font-semibold">Car - Soir</div>
                    <div className="flex items-center gap-2 text-sand-300">
                      <Icon icon="mdi:clock-time-five" className="text-sm" />
                      <span className="text-sm">15:00 - 19:00</span>
                    </div>
                  </div>
                </div>

                <div className="bg-sand-900 rounded-2xl p-4 text-white shadow-card hover:shadow-elevated transition-all group">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                      <Icon icon="mdi:package-variant" className="text-xl text-white" />
                    </div>
                    <div className="text-right">
                      <div className="font-display text-2xl font-semibold">
                        {programmeActuel.totauxParProduit.reduce((sum, p) => sum + p.totalGlobal, 0)}
                      </div>
                      <div className="text-sand-100 text-xs">pièces</div>
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-base font-semibold">Total Général</div>
                    <div className="flex items-center gap-2 text-sand-200">
                      <Icon icon="mdi:sigma" className="text-sm" />
                      <span className="text-sm">Toutes livraisons</span>
                    </div>
                  </div>
                </div>
              </div>
              {/* Liste des produits - Style Odoo moderne */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-sand-200">
                  <Icon icon="mdi:view-grid" className="text-sand-500" />
                  <h3 className="font-display text-xl font-semibold text-sand-900">
                    Détail par produit
                  </h3>
                  <span className="ml-auto text-sm font-medium text-sand-500 bg-sand-100 px-3 py-1 rounded-full">
                    {programmeActuel.totauxParProduit.length} produit{programmeActuel.totauxParProduit.length > 1 ? 's' : ''}
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-sand-200">
                  <table className="w-full text-sm min-w-[720px]">
                    <thead>
                      <tr className="bg-sand-50 border-b border-sand-200 text-left text-[11px] uppercase tracking-wide text-sand-500">
                        <th className="font-semibold px-4 py-3">Produit</th>
                        <th className="font-semibold px-4 py-3 text-right">Clients</th>
                        <th className="font-semibold px-4 py-3 text-right">Boutique</th>
                        <th className="font-semibold px-4 py-3 text-right">Car 1M</th>
                        <th className="font-semibold px-4 py-3 text-right">Car 2M</th>
                        <th className="font-semibold px-4 py-3 text-right">Soir</th>
                        <th className="font-semibold px-4 py-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="tabular-nums">
                      {programmeActuel.totauxParProduit.map((total) => {
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
                          <tr key={total.produitId} className="border-b border-sand-100 last:border-0 hover:bg-sand-50 transition-colors">
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 bg-sand-100 text-sand-700 rounded-lg flex items-center justify-center shrink-0">
                                  <Icon icon={getProductIcon(total.produit?.nom || '')} className="text-lg" />
                                </div>
                                <span className="font-medium text-sand-900 truncate">{total.produit?.nom || total.produitId}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-right text-sand-600">{total.totalClient}</td>
                            <td className="px-4 py-2.5 text-right text-sand-600">{total.totalBoutique}</td>
                            <td className="px-4 py-2.5 text-right text-sand-600">{total.repartitionCar1Matin || 0}</td>
                            <td className="px-4 py-2.5 text-right text-sand-600">{total.repartitionCar2Matin || 0}</td>
                            <td className="px-4 py-2.5 text-right text-sand-600">{total.repartitionCarSoir || 0}</td>
                            <td className="px-4 py-2.5 text-right font-display font-semibold text-sand-900">{total.totalGlobal}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-sand-50 border-t-2 border-sand-200 text-sand-900 font-semibold tabular-nums">
                        <td className="px-4 py-3">Total général</td>
                        <td className="px-4 py-3 text-right">{programmeActuel.totauxParProduit.reduce((s, t) => s + (t.totalClient || 0), 0)}</td>
                        <td className="px-4 py-3 text-right">{programmeActuel.totauxParProduit.reduce((s, t) => s + (t.totalBoutique || 0), 0)}</td>
                        <td className="px-4 py-3 text-right">{programmeActuel.totauxParProduit.reduce((s, t) => s + (t.repartitionCar1Matin || 0), 0)}</td>
                        <td className="px-4 py-3 text-right">{programmeActuel.totauxParProduit.reduce((s, t) => s + (t.repartitionCar2Matin || 0), 0)}</td>
                        <td className="px-4 py-3 text-right">{programmeActuel.totauxParProduit.reduce((s, t) => s + (t.repartitionCarSoir || 0), 0)}</td>
                        <td className="px-4 py-3 text-right font-display">{programmeActuel.totauxParProduit.reduce((s, t) => s + (t.totalGlobal || 0), 0)}</td>
                      </tr>
                    </tfoot>
                  </table>
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
        className="fixed bottom-6 right-6 w-16 h-16 bg-info-600 hover:bg-info-600 text-white rounded-full shadow-card hover:shadow-elevated transition-all duration-300 hover:scale-110 disabled:opacity-50 z-50 flex items-center justify-center group"
        title="Ajouter un produit boutique"
      >
        <div className="relative">
          <Icon icon="mdi:storefront-plus" className="text-2xl transition-transform group-hover:scale-110" />
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-success-500 rounded-full animate-pulse"></div>
        </div>
      </button>

      {/* Bouton pour descendre/monter */}
      {programmeActuel?.totauxParProduit && programmeActuel.totauxParProduit.length > 0 && (
        <ScrollToTopBottom />
      )}
    </div>
  );
};