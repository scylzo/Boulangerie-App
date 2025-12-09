/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';

import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Modal } from '../../components/ui/Modal';
import { ConfirmButton } from '../../components/ui/ConfirmButton';
import { CommandeClientForm } from '../../components/shared/CommandeClientForm';
import { ModifierProduitForm } from '../../components/shared/ModifierProduitForm';
import { QuantiteBoutiqueForm } from '../../components/shared/QuantiteBoutiqueForm';
import { useProductionStore } from '../../store';
import { useConfirmModal } from '../../hooks/useConfirmModal';
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
    formulaireCommande,
    creerNouveauProgramme,
    chargerProgramme,
    sauvegarderProgramme,
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
    updateFormulaireCommande,
    resetFormulaireCommande,
    isLoading
  } = useProductionStore();

  const confirmModal = useConfirmModal();

  const [dateSelectionnee, setDateSelectionnee] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [modeFormulaire, setModeFormulaire] = useState<'create' | 'edit' | 'addProducts'>('create');
  const [indexProduitEnEdition, setIndexProduitEnEdition] = useState<number | null>(null);
  const [showModifierProduitForm, setShowModifierProduitForm] = useState(false);

  useEffect(() => {
    // Charger les données depuis Firebase
    const initialiser = async () => {
      try {
        // Charger les produits et clients depuis Firebase
        await chargerProduits();
        await chargerClients();

        // Charger ou créer le programme pour la date sélectionnée
        const dateSelectionneeObj = new Date(dateSelectionnee);
        await chargerProgramme(dateSelectionneeObj);
      } catch (error) {
        console.error('Erreur lors de l\'initialisation:', error);
        // En cas d'erreur, créer un programme vide
        const dateSelectionneeObj = new Date(dateSelectionnee);
        creerNouveauProgramme(dateSelectionneeObj);
      }
    };

    initialiser();
  }, [dateSelectionnee, chargerProduits, chargerClients, chargerProgramme, creerNouveauProgramme]);

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
  const handleDateChange = async (nouvelleDate: string) => {
    setDateSelectionnee(nouvelleDate);
    try {
      const dateObj = new Date(nouvelleDate);
      await chargerProgramme(dateObj);
    } catch (error) {
      console.error('Erreur lors du changement de date:', error);
    }
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
        // Pré-remplir le client dans le formulaire
        updateFormulaireCommande({ selectedClientId: clientId });
      }
    } else {
      // Mode création normale
      setCommandeEnEdition(null);
      setModeFormulaire('create');
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

  const handleSauvegarderProduitSpecifique = (produitModifie: any) => {
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
          // Produit existe déjà, additionner les quantités
          const produitExistant = produitsExistants[indexExistant];
          const repartitionExistante = produitExistant.repartitionCars;
          const nouvelleRepartition = nouveauProduit.repartitionCars;

          produitsExistants[indexExistant] = {
            ...produitExistant,
            quantiteCommandee: produitExistant.quantiteCommandee + nouveauProduit.quantiteCommandee,
            repartitionCars: {
              car1_matin: (repartitionExistante?.car1_matin || 0) + (nouvelleRepartition?.car1_matin || 0),
              car2_matin: (repartitionExistante?.car2_matin || 0) + (nouvelleRepartition?.car2_matin || 0),
              car_soir: (repartitionExistante?.car_soir || 0) + (nouvelleRepartition?.car_soir || 0)
            }
          };
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
            // Produit existe déjà, additionner les quantités
            const produitExistant = produitsExistants[indexExistant];
            const repartitionExistante = produitExistant.repartitionCars;
            const nouvelleRepartition = nouveauProduit.repartitionCars;

            produitsExistants[indexExistant] = {
              ...produitExistant,
              quantiteCommandee: produitExistant.quantiteCommandee + nouveauProduit.quantiteCommandee,
              repartitionCars: {
                car1_matin: (repartitionExistante?.car1_matin || 0) + (nouvelleRepartition?.car1_matin || 0),
                car2_matin: (repartitionExistante?.car2_matin || 0) + (nouvelleRepartition?.car2_matin || 0),
                car_soir: (repartitionExistante?.car_soir || 0) + (nouvelleRepartition?.car_soir || 0)
              }
            };
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

  const handleSauvegarderProgramme = async () => {
    try {
      await sauvegarderProgramme();
      toast.success('📋 Programme de production sauvegardé avec succès');
    } catch (error) {
      console.log(error)
      toast.error('❌ Erreur lors de la sauvegarde du programme');
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
        message: `📤 Êtes-vous sûr de vouloir envoyer ce programme au boulanger ?\n\n📋 ${commandesValides.length} commande(s) client(s)\n📦 ${programmeActuel.totauxParProduit.length} produit(s) différent(s)\n🏪 ${quantitesBoutique.length} produit(s) pour la boutique\n\n⚠️ Une fois envoyé, le programme ne pourra plus être modifié.`,
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header moderne type Odoo */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-linear-to-r from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
              <Icon icon="mdi:clipboard-text" className="text-2xl text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Programme de Production
              </h1>
              <p className="text-sm text-gray-500">
                Gestion des commandes clients et quantités boutique
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSauvegarderProgramme}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <Icon icon="mdi:content-save" className="text-lg" />
              <span className="font-medium">Sauvegarder</span>
            </button>

            {/* Conteneur relatif pour le bouton d'envoi et son modal */}
            <div className="relative">
              <button
                onClick={handleEnvoyerAuBoulanger}
                disabled={!programmeActuel || programmeActuel.statut === 'envoye' || isLoading}
                className="flex items-center gap-2 px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
              >
                <Icon icon="mdi:send" className="text-lg" />
                <span className="font-medium">
                  {programmeActuel?.statut === 'envoye' ? 'Déjà envoyé' : 'Envoyer au Boulanger'}
                </span>
              </button>

              {/* Modal de confirmation positionné près du bouton */}
              <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={confirmModal.handleCancel}
                onConfirm={confirmModal.handleConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmText={confirmModal.confirmText}
                cancelText={confirmModal.cancelText}
                type={confirmModal.type}
                position="relative"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto p-6 space-y-6">

        {/* Widget de sélection de date moderne */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Icon icon="mdi:calendar" className="text-lg text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Date de production</h2>
          </div>

          <div className="flex items-center gap-4">
            <input
              type="date"
              value={dateSelectionnee}
              onChange={(e) => handleDateChange(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 font-medium"
            />
            <div className="text-sm text-gray-500">
              Programme pour {new Date(dateSelectionnee).toLocaleDateString('fr-FR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
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
          </div>

          {/* Contenu de la section */}
          <div className="p-6">

            {commandesClients.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icon icon="mdi:clipboard-outline" className="text-3xl text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Aucune commande client
                </h3>
                <p className="text-gray-500 mb-6">
                  Commencez par ajouter une commande client pour ce jour de production
                </p>
                <button
                  onClick={() => handleAjouterCommande()}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-linear-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all shadow-md"
                >
                  <Icon icon="mdi:plus" className="text-lg" />
                  <span className="font-medium">Ajouter la première commande</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {commandesClients.map((commande) => {
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
                    className="bg-linear-to-br from-white to-gray-50 border border-gray-200 rounded-xl p-6 hover:border-green-300 hover:shadow-xl transition-all duration-300 group"
                  >
                    {/* En-tête de la commande */}
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-start gap-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-gray-600 to-gray-700 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                          <Icon icon="mdi:account" className="text-2xl text-white" />
                        </div>
                        <div>
                          <h3 className="font-bold text-xl text-gray-900 mb-1">
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
                        <div className="text-2xl font-bold text-gray-800">
                          {totalCommande.toLocaleString('fr-FR')}
                        </div>
                        <div className="text-xs text-gray-400 font-medium">FCFA</div>
                        <div className="flex items-center justify-end gap-1 text-sm text-gray-500 mt-1">
                          <Icon icon="mdi:package-variant-closed" className="text-gray-400" />
                          {commande.produits.length} article{commande.produits.length > 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    {/* Actions de la commande */}
                    {commande.statut !== 'annulee' && (
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                        {/* Bouton principal : Ajouter des produits */}
                        <button
                          onClick={() => handleAjouterCommande(commande.clientId)}
                          className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 hover:border-gray-400 rounded-lg transition-all shadow-sm hover:shadow-md"
                          title="Ajouter des produits à cette commande"
                        >
                          <Icon icon="mdi:plus-circle" className="text-lg" />
                          <span className="font-medium">Ajouter des produits</span>
                        </button>

                        {/* Actions secondaires - avec labels */}
                        <div className="flex gap-2">
                          <ConfirmButton
                            onConfirm={() => {
                              annulerCommandeClient(commande.id);
                              toast.success(`Commande de ${client?.nom || 'le client'} annulée`);
                            }}
                            title="Annuler la commande"
                            message={`Êtes-vous sûr de vouloir annuler la commande de "${client?.nom || 'Client inconnu'}" ?\n\nCette action supprimera la commande du programme.`}
                            confirmText="Annuler la commande"
                            cancelText="Conserver"
                            type="warning"
                            className="flex items-center gap-1.5 px-3 py-2 text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 hover:border-amber-300 rounded-lg transition-all shadow-sm hover:shadow-md text-sm"
                          >
                            <Icon icon="mdi:pause-circle" className="text-base" />
                            <span className="font-medium">Annuler</span>
                          </ConfirmButton>
                          <ConfirmButton
                            onConfirm={() => {
                              supprimerCommandeClient(commande.id);
                              toast.success(`Commande de ${client?.nom || 'le client'} supprimée`);
                            }}
                            message={`Êtes-vous sûr de vouloir supprimer définitivement la commande de "${client?.nom || 'Client inconnu'}" ?\n\nCette action est irréversible.`}
                            confirmText="Supprimer définitivement"
                            cancelText="Annuler"
                            type="danger"
                            className="flex items-center gap-1.5 px-3 py-2 text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 hover:border-red-300 rounded-lg transition-all shadow-sm hover:shadow-md text-sm"
                            title="Supprimer définitivement la commande"
                          >
                            <Icon icon="mdi:delete-outline" className="text-base" />
                            <span className="font-medium">Supprimer</span>
                          </ConfirmButton>
                        </div>
                      </div>
                    )}

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
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        {commande.produits.map((item, index) => {
                          const produit = produits.find(p => p.id === item.produitId);
                          return (
                            <div key={index} className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 hover:shadow-md transition-all group">
                              <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-gray-600 to-gray-700 rounded-lg flex items-center justify-center shadow-md">
                                  <Icon
                                    icon={getProductIcon(produit?.nom || '')}
                                    className="text-lg text-white"
                                  />
                                </div>
                                <div className="flex-1">
                                  <h5 className="font-semibold text-gray-900">
                                    {produit?.nom || 'Produit inconnu'}
                                  </h5>
                                  <div className="flex items-center justify-between mt-1">
                                    <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded-lg font-medium">
                                      x{item.quantiteCommandee}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <div className="text-lg font-bold text-gray-800">
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
                      <div className="text-2xl font-bold text-green-600">
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
        onClose={() => setShowQuantiteBoutiqueForm(false)}
        title="Ajouter un Produit pour la Boutique"
        size="lg"
        inline={true}
      >
        <QuantiteBoutiqueForm
          produits={produits}
          quantitesActuelles={quantitesBoutique}
          onSave={(quantite) => {
            ajouterQuantiteBoutique(quantite);
            setShowQuantiteBoutiqueForm(false);
          }}
          onCancel={() => setShowQuantiteBoutiqueForm(false)}
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
                      <div className="flex items-center justify-between">
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
                        <button
                          onClick={() => supprimerQuantiteBoutique(item.produitId)}
                          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Icon icon="mdi:delete-outline" className="text-lg" />
                        </button>
                      </div>
                    </div>
                  );
                  })}
                </div>

                <div className="bg-gray-50 rounded-lg p-4 mt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            <div className="p-6">
              {/* KPI Cards - Style Odoo moderne */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-linear-to-br from-gray-700 to-gray-800 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 group">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                      <Icon icon="mdi:truck-delivery" className="text-2xl text-white" />
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold">
                        {programmeActuel.totauxParProduit.reduce((sum, p) => sum + (p.repartitionCar1Matin || 0), 0)}
                      </div>
                      <div className="text-gray-300 text-xs">pièces</div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-lg font-semibold">Car 1 - Matin</div>
                    <div className="flex items-center gap-2 text-gray-300">
                      <Icon icon="mdi:clock-time-eight" className="text-sm" />
                      <span className="text-sm">06:00 - 10:00</span>
                    </div>
                  </div>
                </div>

                <div className="bg-linear-to-br from-gray-600 to-gray-700 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 group">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                      <Icon icon="mdi:truck-delivery-outline" className="text-2xl text-white" />
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold">
                        {programmeActuel.totauxParProduit.reduce((sum, p) => sum + (p.repartitionCar2Matin || 0), 0)}
                      </div>
                      <div className="text-gray-300 text-xs">pièces</div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-lg font-semibold">Car 2 - Matin</div>
                    <div className="flex items-center gap-2 text-gray-300">
                      <Icon icon="mdi:clock-time-nine" className="text-sm" />
                      <span className="text-sm">08:00 - 12:00</span>
                    </div>
                  </div>
                </div>

                <div className="bg-linear-to-br from-gray-700 to-gray-800 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 group">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                      <Icon icon="mdi:truck-fast" className="text-2xl text-white" />
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold">
                        {programmeActuel.totauxParProduit.reduce((sum, p) => sum + (p.repartitionCarSoir || 0), 0)}
                      </div>
                      <div className="text-gray-300 text-xs">pièces</div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-lg font-semibold">Car - Soir</div>
                    <div className="flex items-center gap-2 text-gray-300">
                      <Icon icon="mdi:clock-time-five" className="text-sm" />
                      <span className="text-sm">15:00 - 19:00</span>
                    </div>
                  </div>
                </div>

                <div className="bg-linear-to-br from-gray-600 to-gray-800 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 group">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                      <Icon icon="mdi:package-variant" className="text-2xl text-white" />
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold">
                        {programmeActuel.totauxParProduit.reduce((sum, p) => sum + p.totalGlobal, 0)}
                      </div>
                      <div className="text-gray-100 text-xs">pièces</div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-lg font-semibold">Total Général</div>
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

                <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
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
                        className="bg-linear-to-br from-white to-gray-50 border border-gray-200 rounded-2xl p-6 hover:border-purple-300 hover:shadow-2xl transition-all duration-300 group"
                      >
                        {/* En-tête du produit */}
                        <div className="flex items-center gap-4 mb-6">
                          <div className="w-16 h-16 bg-slate-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                            <Icon
                              icon={getProductIcon(total.produit?.nom || '')}
                              className="text-2xl text-white"
                            />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-bold text-xl text-gray-900 mb-1">
                              {total.produit?.nom || total.produitId}
                            </h4>
                            <div className="flex items-center gap-2">
                              <span className="text-2xl font-bold text-gray-800">{total.totalGlobal}</span>
                              <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">pièces</span>
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
    </div>
  );
};