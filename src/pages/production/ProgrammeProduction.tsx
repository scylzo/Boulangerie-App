/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useState, useMemo } from 'react';
import { Icon } from '@iconify/react';
import { PageLoader } from '../../components/ui/PageLoader';
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
import { useLivreurStore } from '../../store/livreurStore';
import { RedistributionModal } from '../../components/production/RedistributionModal';
import { ModalValidationProduction } from '../../components/production/ModalValidationProduction';
import { estWeekend, estDimanche } from '../../utils/dateUtils';
import type { CommandeClient, RedistributionData, Client } from '../../types';

// Helper d'icônes produits
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
    ajouterCommandesClientsMultiples,
    modifierCommandeClient,
    supprimerCommandeClient,
    annulerCommandeClient,
    annulerCommandeAvecRedistribution,
    supprimerProduitDeCommande,
    ajouterQuantiteBoutique,
    ajouterQuantitesBoutiqueMultiples,
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
    sauvegarderCommandeTypeWeekend,
    isLoading,
    isSaving
  } = useProductionStore();

  const { livreurs, chargerLivreurs } = useLivreurStore();
  const confirmModal = useConfirmModal();

  // Date sélectionnée
  const [dateSelectionnee, setDateSelectionnee] = useState(
    new Date().toISOString().split('T')[0]
  );

  // Onglet actif : clients | boutique | synthese
  const [ongletActif, setOngletActif] = useState<'clients' | 'boutique' | 'synthese'>('clients');

  // Accordéons de commandes dépliés
  const [commandesDepliees, setCommandesDepliees] = useState<Record<string, boolean>>({});

  // Recherche client
  const [rechercheClient, setRechercheClient] = useState('');

  // États pour modals d'édition
  const [modeFormulaire, setModeFormulaire] = useState<'create' | 'edit' | 'addProducts'>('create');
  const [indexProduitEnEdition, setIndexProduitEnEdition] = useState<number | null>(null);
  const [showModifierProduitForm, setShowModifierProduitForm] = useState(false);
  const [showRedistributionModal, setShowRedistributionModal] = useState(false);
  const [commandeARedistribuer, setCommandeARedistribuer] = useState<CommandeClient | null>(null);
  const [alerteManquantsOuverte, setAlerteManquantsOuverte] = useState(true);

  // Filtrer les commandes selon la recherche
  const commandesFiltrees = useMemo(() => {
    return commandesClients.filter(commande => {
      if (!rechercheClient.trim()) return true;
      const client = clients.find(c => c.id === commande.clientId);
      const nomClient = client?.nom?.toLowerCase() || '';
      return nomClient.includes(rechercheClient.toLowerCase().trim());
    });
  }, [commandesClients, clients, rechercheClient]);

  // Détection week-end / dimanche
  const isWE = estWeekend(dateSelectionnee);
  const isSunday = estDimanche(dateSelectionnee);

  // Calculer les clients attendus et manquants pour la date sélectionnée
  const clientsEligibles = useMemo(() => {
    return clients.filter(c => {
      if (!c.active) return false;
      if (isSunday && c.neTravaillePasDimanche) return false;
      if (isWE) {
        return c.estRegulier || (c.commandeTypeWeekend && c.commandeTypeWeekend.length > 0);
      }
      return c.estRegulier;
    });
  }, [clients, isSunday, isWE]);

  const clientsAyantCommande = useMemo(() => {
    return new Set(commandesClients.map(cmd => cmd.clientId));
  }, [commandesClients]);

  const clientsManquants = useMemo(() => {
    return clientsEligibles.filter(c => !clientsAyantCommande.has(c.id));
  }, [clientsEligibles, clientsAyantCommande]);

  // Produits « quotidiens » pas encore présents dans les quantités boutique
  const quotidiensManquants = useMemo(() => {
    return produits.filter(
      (p) => p.active && p.productionQuotidienne && !quantitesBoutique.some((q) => q.produitId === p.id)
    );
  }, [produits, quantitesBoutique]);

  // Initialisation et listeners
  useEffect(() => {
    // 1. Lancer immédiatement le listener de production pour cette date (ultra-rapide)
    const dateSelectionneeObj = new Date(dateSelectionnee);
    chargerProgrammeAvecListener(dateSelectionneeObj);

    // 2. Charger les référentiels (produits, clients, livreurs) en parallèle sans bloquer
    Promise.all([
      chargerProduits(),
      chargerClients(),
      chargerLivreurs()
    ]).catch(err => {
      console.warn('Chargement référentiels en arrière-plan:', err);
    });

    return () => {
      nettoyerListeners();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateSelectionnee]);

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

  // Loader au premier chargement avec sécurité anti-blocage (timeout court 350ms max)
  const [chargementInitial, setChargementInitial] = useState(true);

  useEffect(() => {
    if (programmeActuel) {
      setChargementInitial(false);
    }
  }, [programmeActuel]);

  useEffect(() => {
    // Sécurité : affichage rapide en 350ms max
    const timer = setTimeout(() => {
      setChargementInitial(false);
      // Si aucun programme après 350ms, s'assurer qu'un programme existe
      const { programmeActuel: cur } = useProductionStore.getState();
      if (!cur) {
        creerNouveauProgramme(new Date(dateSelectionnee));
      }
    }, 350);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateSelectionnee]);

  // Changement de date (+/- jours)
  const handleDecalerDate = (deltaJours: number) => {
    const d = new Date(dateSelectionnee + 'T12:00:00');
    d.setDate(d.getDate() + deltaJours);
    setDateSelectionnee(d.toISOString().split('T')[0]);
  };

  const handleDateAujourdhui = () => {
    setDateSelectionnee(new Date().toISOString().split('T')[0]);
  };

  // Gestion accordéon
  const toggleCommande = (id: string) => {
    setCommandesDepliees(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toutDeplier = () => {
    const next: Record<string, boolean> = {};
    commandesFiltrees.forEach(c => { next[c.id] = true; });
    setCommandesDepliees(next);
  };

  const toutReplier = () => {
    setCommandesDepliees({});
  };

  // Fonctions de gestion des commandes
  const handleAjouterCommande = (clientId?: string) => {
    if (clientId) {
      const commandeExistante = commandesClients.find(cmd =>
        cmd.clientId === clientId &&
        new Date(cmd.dateLivraison).toDateString() === new Date(dateSelectionnee).toDateString()
      );

      if (commandeExistante) {
        setCommandeEnEdition(commandeExistante);
        setModeFormulaire('addProducts');
      } else {
        setCommandeEnEdition(null);
        setModeFormulaire('create');
        updateFormulaireCommande({
          selectedClientId: clientId,
          dateLivraison: dateSelectionnee
        });
      }
    } else {
      setCommandeEnEdition(null);
      setModeFormulaire('create');
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
      toast.success('Produit modifié avec succès');
    }
  };

  const handleAnnulerModificationProduit = () => {
    setShowModifierProduitForm(false);
    setCommandeEnEdition(null);
    setIndexProduitEnEdition(null);
  };

  const handleSauvegarderCommande = (commandeData: Omit<CommandeClient, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (modeFormulaire === 'addProducts' && commandeEnEdition) {
      const produitsExistants = [...commandeEnEdition.produits];
      commandeData.produits.forEach(nouveauProduit => {
        const indexExistant = produitsExistants.findIndex(p => p.produitId === nouveauProduit.produitId);
        if (indexExistant >= 0) {
          produitsExistants[indexExistant] = nouveauProduit;
        } else {
          produitsExistants.push(nouveauProduit);
        }
      });
      modifierCommandeClient(commandeEnEdition.id, {
        ...commandeEnEdition,
        produits: produitsExistants
      });
    } else if (modeFormulaire === 'edit' && commandeEnEdition) {
      modifierCommandeClient(commandeEnEdition.id, commandeData);
    } else {
      const commandeExistante = commandesClients.find(cmd =>
        cmd.clientId === commandeData.clientId &&
        new Date(cmd.dateLivraison).toDateString() === new Date(commandeData.dateLivraison).toDateString()
      );

      if (commandeExistante) {
        const produitsExistants = [...commandeExistante.produits];
        commandeData.produits.forEach(nouveauProduit => {
          const indexExistant = produitsExistants.findIndex(p => p.produitId === nouveauProduit.produitId);
          if (indexExistant >= 0) {
            produitsExistants[indexExistant] = nouveauProduit;
          } else {
            produitsExistants.push(nouveauProduit);
          }
        });
        modifierCommandeClient(commandeExistante.id, {
          ...commandeExistante,
          produits: produitsExistants
        });
      } else {
        ajouterCommandeClient(commandeData);
      }
    }

    setShowCommandeForm(false);
    setCommandeEnEdition(null);
    setIndexProduitEnEdition(null);
    setModeFormulaire('create');
    resetFormulaireCommande();

    if (modeFormulaire === 'addProducts') {
      toast.success('Produits ajoutés à la commande');
    } else if (modeFormulaire === 'edit') {
      toast.success('Commande modifiée');
    } else {
      toast.success('Nouvelle commande créée');
    }
  };

  // Commande rapide client
  const handleAjouterCommandeRapide = (client: Client) => {
    const isWENow = estWeekend(dateSelectionnee);
    const hasWE = Boolean(client.commandeTypeWeekend && client.commandeTypeWeekend.length > 0);
    const source = (isWENow && hasWE) ? client.commandeTypeWeekend : client.commandeType;

    if (!source || source.length === 0) {
      handleAjouterCommande(client.id);
      return;
    }

    const produitsClean = source.map(p => {
      let prix = p.prixUnitaire;
      if (!prix) {
        const prod = produits.find(pr => pr.id === p.produitId);
        prix = client.typeClient === 'boutique' ? prod?.prixBoutique : prod?.prixClient;
      }
      const repartition = p.repartitionCars || {
        car1_matin: p.quantiteCommandee || 0,
        car2_matin: 0,
        car_soir: 0
      };
      return {
        produitId: p.produitId,
        quantiteCommandee: Number(p.quantiteCommandee) || 0,
        prixUnitaire: prix || 0,
        repartitionCars: {
          car1_matin: Number(repartition.car1_matin) || 0,
          car2_matin: Number(repartition.car2_matin) || 0,
          car_soir: Number(repartition.car_soir) || 0
        }
      };
    });

    const dateLiv = new Date(dateSelectionnee + 'T12:00:00');

    ajouterCommandeClient({
      clientId: client.id,
      dateCommande: new Date(),
      dateLivraison: dateLiv,
      statut: 'prevue',
      produits: produitsClean
    });

    toast.success(`Commande ${isWENow && hasWE ? 'Week-end ' : ''}de ${client.nom} ajoutée`);
  };

  // Ajouter toutes les commandes types d'un clic
  const handleAjouterToutesCommandesTypes = () => {
    const isWENow = estWeekend(dateSelectionnee);
    const dateLiv = new Date(dateSelectionnee + 'T12:00:00');
    const commandesAAjouter: Array<Omit<CommandeClient, 'id' | 'createdAt' | 'updatedAt'>> = [];

    clientsManquants.forEach(client => {
      const hasWE = Boolean(client.commandeTypeWeekend && client.commandeTypeWeekend.length > 0);
      const source = (isWENow && hasWE) ? client.commandeTypeWeekend : client.commandeType;
      if (!source || source.length === 0) return;

      const produitsClean = source.map(p => {
        let prix = p.prixUnitaire;
        if (!prix) {
          const prod = produits.find(pr => pr.id === p.produitId);
          prix = client.typeClient === 'boutique' ? prod?.prixBoutique : prod?.prixClient;
        }
        const repartition = p.repartitionCars || {
          car1_matin: p.quantiteCommandee || 0,
          car2_matin: 0,
          car_soir: 0
        };
        return {
          produitId: p.produitId,
          quantiteCommandee: Number(p.quantiteCommandee) || 0,
          prixUnitaire: prix || 0,
          repartitionCars: {
            car1_matin: Number(repartition.car1_matin) || 0,
            car2_matin: Number(repartition.car2_matin) || 0,
            car_soir: Number(repartition.car_soir) || 0
          }
        };
      });

      commandesAAjouter.push({
        clientId: client.id,
        dateCommande: new Date(),
        dateLivraison: dateLiv,
        statut: 'prevue',
        produits: produitsClean
      });
    });

    if (commandesAAjouter.length > 0) {
      ajouterCommandesClientsMultiples(commandesAAjouter);
      toast.success(`${commandesAAjouter.length} commande(s) type(s) ajoutée(s)`);
    } else {
      toast.error('Aucune commande type disponible');
    }
  };

  // Appliquer le modèle WE
  const handleAppliquerCommandeWE = (commande: CommandeClient) => {
    const client = clients.find(c => c.id === commande.clientId);
    if (!client?.commandeTypeWeekend || client.commandeTypeWeekend.length === 0) {
      toast.error("Ce client n'a pas de modèle Week-end enregistré");
      return;
    }

    const produitsClean = client.commandeTypeWeekend.map(p => {
      let prix = p.prixUnitaire;
      if (!prix) {
        const prod = produits.find(pr => pr.id === p.produitId);
        prix = client.typeClient === 'boutique' ? prod?.prixBoutique : prod?.prixClient;
      }
      const repartition = p.repartitionCars || {
        car1_matin: p.quantiteCommandee || 0,
        car2_matin: 0,
        car_soir: 0
      };
      return {
        produitId: p.produitId,
        quantiteCommandee: Number(p.quantiteCommandee) || 0,
        prixUnitaire: prix || 0,
        repartitionCars: {
          car1_matin: Number(repartition.car1_matin) || 0,
          car2_matin: Number(repartition.car2_matin) || 0,
          car_soir: Number(repartition.car_soir) || 0
        }
      };
    });

    modifierCommandeClient(commande.id, {
      ...commande,
      produits: produitsClean
    });

    toast.success(`Modèle Week-end appliqué pour ${client.nom}`);
  };

  // Enregistrer comme modèle WE
  const handleEnregistrerCommeTypeWE = async (commande: CommandeClient) => {
    const client = clients.find(c => c.id === commande.clientId);
    if (!client) return;

    try {
      const produitsClean = commande.produits.map(p => ({
        produitId: p.produitId,
        quantiteCommandee: p.quantiteCommandee,
        repartitionCars: {
          car1_matin: Number(p.repartitionCars?.car1_matin) || 0,
          car2_matin: Number(p.repartitionCars?.car2_matin) || 0,
          car_soir: Number(p.repartitionCars?.car_soir) || 0
        }
      }));

      await sauvegarderCommandeTypeWeekend(client.id, produitsClean);
      toast.success(`Modèle Week-end enregistré pour ${client.nom}`);
    } catch (e) {
      toast.error("Erreur lors de l'enregistrement du modèle");
    }
  };

  // Annuler commande
  const handleAnnulerCommande = async (commandeId: string) => {
    const commande = commandesClients.find(c => c.id === commandeId);
    const client = clients.find(c => c.id === commande?.clientId);

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
      message: `Êtes-vous sûr de vouloir annuler la commande de "${client?.nom || 'Client inconnu'}" ?`,
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
      toast.success('Commande annulée et produits redistribués');
    } catch (error) {
      console.error('Erreur redistribution:', error);
      toast.error('Erreur lors de la redistribution');
    }
  };

  const handleSupprimerCommande = async (commandeId: string) => {
    const commande = commandesClients.find(c => c.id === commandeId);
    const client = clients.find(c => c.id === commande?.clientId);

    const confirmation = await confirmModal.confirm({
      title: 'Supprimer définitivement',
      message: `Êtes-vous sûr de vouloir supprimer définitivement la commande de "${client?.nom || 'Client inconnu'}" ?`,
      confirmText: 'Supprimer',
      cancelText: 'Conserver',
      type: 'danger'
    });

    if (confirmation) {
      supprimerCommandeClient(commandeId);
      toast.success('Commande supprimée');
    }
  };

  const handleAnnulerFormulaire = () => {
    setShowCommandeForm(false);
    setCommandeEnEdition(null);
    setIndexProduitEnEdition(null);
    setModeFormulaire('create');
    resetFormulaireCommande();
  };

  const handleSupprimerProduitDeCommande = async (commandeId: string, produitIndex: number) => {
    const commande = commandesClients.find(c => c.id === commandeId);
    const produit = commande?.produits[produitIndex];
    const produitRef = produits.find(p => p.id === produit?.produitId);

    const confirmation = await confirmModal.confirm({
      title: 'Supprimer le produit',
      message: `Supprimer "${produitRef?.nom || 'ce produit'}" de cette commande ?`,
      confirmText: 'Supprimer',
      cancelText: 'Conserver',
      type: 'warning'
    });

    if (confirmation) {
      supprimerProduitDeCommande(commandeId, produitIndex);
      toast.success('Produit supprimé de la commande');
    }
  };

  // Impression Bon de Livraison
  const handleImprimerBonLivraison = (commande: CommandeClient) => {
    const client = clients.find(c => c.id === commande.clientId);
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
  };

  // Envoi au boulanger
  const handleEnvoyerAuBoulanger = async () => {
    if (!programmeActuel) {
      toast.error('Aucun programme à envoyer');
      return;
    }

    const errors: string[] = [];
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

    if (errors.length > 0) {
      const confirmation = await confirmModal.confirm({
        title: 'Validation du programme',
        message: `Des anomalies ont été détectées :\n\n${errors.join('\n')}\n\nVoulez-vous tout de même envoyer le programme ?`,
        confirmText: 'Envoyer malgré tout',
        cancelText: 'Annuler',
        type: 'warning'
      });
      if (!confirmation) return;
    } else {
      const confirmation = await confirmModal.confirm({
        title: 'Confirmer l\'envoi au four',
        message: `Envoyer le programme au boulanger ? (${commandesValides.length} commandes clients, ${programmeActuel.totauxParProduit.length} produits, ${quantitesBoutique.length} articles boutique)`,
        confirmText: 'Envoyer au four',
        cancelText: 'Annuler',
        type: 'info'
      });
      if (!confirmation) return;
    }

    try {
      await envoyerAuBoulanger();
      toast.success('Programme envoyé au boulanger');
    } catch (error) {
      toast.error('Erreur lors de l\'envoi du programme');
    }
  };

  const [showValidationModal, setShowValidationModal] = useState(false);

  const handleValiderProduction = () => {
    setShowValidationModal(true);
  };

  const handleConfirmValidation = async (sacsFarine: number) => {
    try {
      await validerProduction(sacsFarine);
      toast.success(`Production validée : ${sacsFarine} sac(s) de farine déduit(s) du stock`);
    } catch (error) {
      toast.error('Erreur lors de la validation de la production');
    }
  };

  const handleTelechargerRapport = async () => {
    if (!programmeActuel) return;
    try {
      await downloadProductionProgramPDF(programmeActuel, livreurs, clients);
      toast.success('Rapport de production généré');
    } catch (error) {
      toast.error('Erreur lors de la génération du rapport');
    }
  };

  const ajouterQuotidiensManquants = () => {
    const aAjouter: any[] = [];

    quotidiensManquants.forEach((p) => {
      let c1 = Number(p.quantiteBoutiqueDefautCars?.car1_matin) || 0;
      let c2 = Number(p.quantiteBoutiqueDefautCars?.car2_matin) || 0;
      let cs = Number(p.quantiteBoutiqueDefautCars?.car_soir) || 0;
      let total = c1 + c2 + cs;

      // Si la répartition par car donne 0 mais qu'une quantité boutique par défaut existe
      if (total === 0 && (Number(p.quantiteBoutiqueDefaut) || 0) > 0) {
        total = Number(p.quantiteBoutiqueDefaut) || 0;
        c1 = total;
      }

      aAjouter.push({
        produitId: p.id,
        produit: p,
        quantite: total,
        repartitionCars: {
          car1_matin: c1,
          car2_matin: c2,
          car_soir: cs,
        },
      });
    });

    if (aAjouter.length > 0) {
      ajouterQuantitesBoutiqueMultiples(aAjouter);
      toast.success(`${aAjouter.length} produit(s) quotidien(s) ajouté(s)`);
    }
  };

  // Statistiques résumées
  const totalArticlesClients = useMemo(() => {
    return commandesClients.reduce((total, cmd) =>
      total + cmd.produits.reduce((sub, p) => sub + (Number(p.quantiteCommandee) || 0), 0), 0
    );
  }, [commandesClients]);

  const totalMontantClients = useMemo(() => {
    return commandesClients.reduce((total, cmd) =>
      total + cmd.produits.reduce((sub, p) => sub + (p.prixUnitaire || 0) * (Number(p.quantiteCommandee) || 0), 0), 0
    );
  }, [commandesClients]);

  const totalPiecesBoutique = useMemo(() => {
    return quantitesBoutique.reduce((t, q) => t + (Number(q.quantite) || 0), 0);
  }, [quantitesBoutique]);

  if (chargementInitial && !programmeActuel) {
    return <PageLoader message="Chargement du programme de production…" />;
  }

  // Formatage de date
  const dateFormatee = new Date(dateSelectionnee + 'T12:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const estAujourdhui = dateSelectionnee === new Date().toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-sand-100/60 pb-12">
      {/* =========================================================================
          TOP BAR & HEADER UNIFIÉ
      ========================================================================== */}
      <header className="bg-white border-b border-sand-200 sticky top-0 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 py-2.5 sm:py-3">
            
            {/* Titre & Sélecteur de date */}
            <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-terracotta-50 text-terracotta-600 flex items-center justify-center shrink-0">
                <Icon icon="mdi:bread-slice-outline" className="text-lg sm:text-xl" />
              </div>
              
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-base sm:text-lg font-bold text-sand-900 leading-tight truncate">
                    Programme de production
                  </h1>
                  {programmeActuel && (() => {
                    const st = programmeActuel.statut;
                    const cfg = st === 'brouillon' ? { bg: 'bg-sand-100 text-sand-700 border-sand-300', icon: 'mdi:file-document-edit-outline', label: 'Brouillon' }
                      : st === 'modifie' ? { bg: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'mdi:file-document-alert', label: 'Modifié' }
                      : st === 'envoye' ? { bg: 'bg-sky-50 text-sky-700 border-sky-200', icon: 'mdi:send-check', label: 'Envoyé au four' }
                      : { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'mdi:check-decagram', label: 'Validé' };
                    return (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold border ${cfg.bg}`}>
                        <Icon icon={cfg.icon} className="text-xs" />
                        {cfg.label}
                      </span>
                    );
                  })()}

                  {/* Indicateur d'enregistrement */}
                  {isSaving && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs animate-pulse">
                      <Icon icon="mdi:loading" className="animate-spin text-xs text-amber-600" />
                      <span>Enregistrement…</span>
                    </span>
                  )}

                  {/* Indicateur d'actualisation */}
                  {isLoading && !isSaving && programmeActuel && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-medium bg-sand-100 text-sand-600 border border-sand-200 animate-pulse">
                      <Icon icon="mdi:loading" className="animate-spin text-xs text-terracotta-500" />
                      <span>Actualisation…</span>
                    </span>
                  )}
                </div>

                {/* Contrôle de Date inline & compact */}
                <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs text-sand-600">
                  <div className="inline-flex items-center bg-sand-50 rounded-md border border-sand-200 p-0.5">
                    <button
                      onClick={() => handleDecalerDate(-1)}
                      className="p-1 text-sand-500 hover:text-sand-900 hover:bg-sand-200/60 rounded transition-colors"
                      title="Jour précédent"
                    >
                      <Icon icon="mdi:chevron-left" className="text-base" />
                    </button>
                    <input
                      type="date"
                      value={dateSelectionnee}
                      onChange={(e) => setDateSelectionnee(e.target.value)}
                      className="bg-transparent border-0 text-xs font-semibold text-sand-900 focus:ring-0 px-1 py-0.5 cursor-pointer max-w-[125px]"
                    />
                    <button
                      onClick={() => handleDecalerDate(1)}
                      className="p-1 text-sand-500 hover:text-sand-900 hover:bg-sand-200/60 rounded transition-colors"
                      title="Jour suivant"
                    >
                      <Icon icon="mdi:chevron-right" className="text-base" />
                    </button>
                  </div>

                  {!estAujourdhui && (
                    <button
                      onClick={handleDateAujourdhui}
                      className="px-2 py-1 text-[11px] font-medium text-terracotta-600 hover:bg-terracotta-50 rounded transition-colors"
                    >
                      Aujourd'hui
                    </button>
                  )}

                  <span className="text-sand-400">·</span>
                  <span className="capitalize font-medium text-sand-800 text-xs">{dateFormatee}</span>

                  {isWE && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100/70 text-amber-900 font-bold text-[10px] rounded">
                      <Icon icon="mdi:calendar-weekend" className="text-xs text-amber-700" />
                      Week-end
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Actions du haut */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap w-full md:w-auto justify-start md:justify-end">
              {programmeActuel && (
                <button
                  onClick={handleTelechargerRapport}
                  disabled={isLoading}
                  className="inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-white border border-sand-300 hover:bg-sand-50 text-sand-700 rounded-lg text-xs font-medium transition-colors shadow-2xs flex-1 sm:flex-initial"
                  title="Télécharger le rapport de production"
                >
                  <Icon icon="mdi:file-pdf-box" className="text-base text-danger-500" />
                  <span>Rapport PDF</span>
                </button>
              )}

              {programmeActuel && (
                <button
                  onClick={handleEnvoyerAuBoulanger}
                  disabled={isLoading}
                  className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-1.5 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs flex-1 sm:flex-initial text-center"
                >
                  <Icon icon="mdi:send-outline" className="text-sm" />
                  <span>{programmeActuel.statut === 'brouillon' ? 'Envoyer au four' : 'Renvoyer au four'}</span>
                </button>
              )}

              {(programmeActuel?.statut === 'envoye' || programmeActuel?.statut === 'modifie') && (
                <button
                  onClick={handleValiderProduction}
                  disabled={isLoading}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs flex-1 sm:flex-initial"
                >
                  <Icon icon="mdi:check-decagram" className="text-sm" />
                  <span>Clôturer</span>
                </button>
              )}

              {programmeActuel?.statut === 'produit' && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold">
                  <Icon icon="mdi:check-circle" className="text-sm text-emerald-600" />
                  <span>Clôturé {programmeActuel.sacsFarinePetris ? `• ${programmeActuel.sacsFarinePetris} sacs de farine` : ''}</span>
                  {programmeActuel.sacsFarinePetris && programmeActuel.totauxParProduit && (
                    <span className="text-[10px] text-emerald-600 font-normal">
                      ({Math.round(programmeActuel.totauxParProduit.reduce((s, p) => s + p.totalGlobal, 0) / programmeActuel.sacsFarinePetris)} pcs/sac)
                    </span>
                  )}
                </div>
              )}
            </div>

          </div>

          {/* =========================================================================
              BARRE D'ONGLETS SOBRES & PROFESSIONNELS AVEC SCROLL SUR MOBILE
          ========================================================================== */}
          <div className="flex border-t border-sand-200 gap-1 pt-1 -mb-px overflow-x-auto no-scrollbar scroll-smooth">
            <button
              onClick={() => setOngletActif('clients')}
              className={`inline-flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap shrink-0 ${
                ongletActif === 'clients'
                  ? 'border-terracotta-500 text-terracotta-600 bg-terracotta-50/40'
                  : 'border-transparent text-sand-600 hover:text-sand-900 hover:border-sand-300'
              }`}
            >
              <Icon icon="mdi:account-group-outline" className="text-base" />
              <span>Commandes Clients</span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                ongletActif === 'clients' ? 'bg-terracotta-100 text-terracotta-700' : 'bg-sand-100 text-sand-600'
              }`}>
                {commandesClients.length}
              </span>
            </button>

            <button
              onClick={() => setOngletActif('boutique')}
              className={`inline-flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap shrink-0 ${
                ongletActif === 'boutique'
                  ? 'border-terracotta-500 text-terracotta-600 bg-terracotta-50/40'
                  : 'border-transparent text-sand-600 hover:text-sand-900 hover:border-sand-300'
              }`}
            >
              <Icon icon="mdi:storefront-outline" className="text-base" />
              <span>Boutique</span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                ongletActif === 'boutique' ? 'bg-terracotta-100 text-terracotta-700' : 'bg-sand-100 text-sand-600'
              }`}>
                {quantitesBoutique.length}
              </span>
            </button>

            <button
              onClick={() => setOngletActif('synthese')}
              className={`inline-flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap shrink-0 ${
                ongletActif === 'synthese'
                  ? 'border-terracotta-500 text-terracotta-600 bg-terracotta-50/40'
                  : 'border-transparent text-sand-600 hover:text-sand-900 hover:border-sand-300'
              }`}
            >
              <Icon icon="mdi:chart-box-outline" className="text-base" />
              <span>Synthèse globale</span>
              {programmeActuel?.totauxParProduit && (
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  ongletActif === 'synthese' ? 'bg-terracotta-100 text-terracotta-700' : 'bg-sand-100 text-sand-600'
                }`}>
                  {programmeActuel.totauxParProduit.reduce((sum, p) => sum + p.totalGlobal, 0)} <span className="hidden sm:inline">produits</span>
                </span>
              )}
            </button>
          </div>

        </div>
      </header>

      {/* =========================================================================
          CONTENU DE L'ONGLET ACTIF
      ========================================================================== */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 pt-3 sm:pt-5">

        {/* -------------------------------------------------------------------------
            ONGLET 1 : COMMANDES CLIENTS
        -------------------------------------------------------------------------- */}
        {ongletActif === 'clients' && (
          <div className="space-y-4">
            
            {/* Alerte discrète pour clients réguliers / WE manquants */}
            {clientsManquants.length > 0 && (
              <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-3 sm:p-3.5 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <Icon icon={isWE ? "mdi:calendar-weekend" : "mdi:alert-circle-outline"} className="text-amber-600 text-lg shrink-0" />
                    <div>
                      <span className="text-xs sm:text-sm font-bold text-amber-900">
                        {clientsManquants.length} client{clientsManquants.length > 1 ? 's' : ''} attendu{clientsManquants.length > 1 ? 's' : ''} non encore commandé{clientsManquants.length > 1 ? 's' : ''}
                      </span>
                      <span className="text-xs text-amber-700 ml-1.5 hidden md:inline">
                        (cliquez sur un nom pour ajouter directement sa commande)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                    {clientsManquants.some(c => (isWE && c.commandeTypeWeekend?.length) || c.commandeType?.length) && (
                      <button
                        type="button"
                        onClick={handleAjouterToutesCommandesTypes}
                        className="inline-flex items-center px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-xs font-semibold transition-colors"
                      >
                        <span>Tout ajouter ({clientsManquants.length})</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setAlerteManquantsOuverte(!alerteManquantsOuverte)}
                      className="p-1 text-amber-700 hover:text-amber-900 rounded"
                      aria-label="Afficher ou masquer la liste"
                    >
                      <Icon icon={alerteManquantsOuverte ? "mdi:chevron-up" : "mdi:chevron-down"} className="text-base" />
                    </button>
                  </div>
                </div>

                {alerteManquantsOuverte && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-amber-200/60 max-h-56 overflow-y-auto">
                    {clientsManquants.map(client => {
                      const hasWE = isWE && Boolean(client.commandeTypeWeekend && client.commandeTypeWeekend.length > 0);
                      const qteWE = client.commandeTypeWeekend?.reduce((s, p) => s + (Number(p.quantiteCommandee) || 0), 0);
                      const qteSem = client.commandeType?.reduce((s, p) => s + (Number(p.quantiteCommandee) || 0), 0);

                      return (
                        <div
                          key={client.id}
                          className="inline-flex items-center max-w-full rounded-lg border border-amber-300 bg-white shadow-2xs overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() => handleAjouterCommandeRapide(client)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-sand-800 hover:bg-amber-50 transition-colors truncate"
                            title={hasWE ? `Ajouter modèle WE (${qteWE}p)` : `Ajouter modèle semaine (${qteSem}p)`}
                          >
                            <span className="truncate">{client.nom}</span>
                            {hasWE && (
                              <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 font-bold text-[10px] rounded shrink-0">
                                WE: {qteWE}p
                              </span>
                            )}
                            {!hasWE && qteSem !== undefined && qteSem > 0 && (
                              <span className="px-1.5 py-0.2 bg-sand-100 text-sand-700 text-[10px] rounded shrink-0">
                                {qteSem}p
                              </span>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAjouterCommande(client.id)}
                            className="px-1.5 py-1 text-sand-400 hover:text-sand-700 hover:bg-sand-100 border-l border-amber-200 shrink-0"
                            title="Personnaliser avant d'ajouter"
                          >
                            <Icon icon="mdi:pencil-outline" className="text-xs" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Barre d'outils et recherche */}
            <div className="bg-white rounded-xl border border-sand-200 p-2.5 sm:p-3 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
              <div className="relative w-full sm:w-72 md:w-80">
                <Icon icon="mdi:magnify" className="absolute left-3 top-1/2 -translate-y-1/2 text-sand-400 text-base" />
                <input
                  type="text"
                  placeholder="Filtrer un client..."
                  value={rechercheClient}
                  onChange={(e) => setRechercheClient(e.target.value)}
                  className="w-full pl-9 pr-8 py-1.5 bg-sand-50 border border-sand-300 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-terracotta-500 focus:bg-white focus:border-transparent transition-all"
                />
                {rechercheClient && (
                  <button
                    onClick={() => setRechercheClient('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sand-400 hover:text-sand-700"
                  >
                    <Icon icon="mdi:close" className="text-sm" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                {commandesClients.length > 0 && (
                  <div className="flex items-center gap-1 text-xs text-sand-500">
                    <button
                      onClick={toutDeplier}
                      className="px-2 py-1 hover:bg-sand-100 text-sand-600 rounded font-medium transition-colors"
                    >
                      Tout déplier
                    </button>
                    <span>·</span>
                    <button
                      onClick={toutReplier}
                      className="px-2 py-1 hover:bg-sand-100 text-sand-600 rounded font-medium transition-colors"
                    >
                      Tout replier
                    </button>
                  </div>
                )}

                <button
                  onClick={() => handleAjouterCommande()}
                  disabled={showCommandeForm}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-lg text-xs sm:text-sm font-semibold transition-colors shadow-2xs shrink-0"
                >
                  <Icon icon="mdi:plus" className="text-base" />
                  <span>Nouvelle commande</span>
                </button>
              </div>
            </div>

            {/* Liste compacte sous forme d'accordéons */}
            {commandesFiltrees.length === 0 ? (
              <div className="bg-white rounded-xl border border-sand-200 p-8 sm:p-10 text-center">
                <div className="w-12 h-12 bg-sand-100 text-sand-400 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Icon icon="mdi:clipboard-text-outline" className="text-2xl" />
                </div>
                <h3 className="text-sm font-bold text-sand-900 mb-1">
                  {rechercheClient ? `Aucun résultat pour "${rechercheClient}"` : 'Aucune commande client pour ce jour'}
                </h3>
                <p className="text-xs text-sand-500 mb-4 max-w-sm mx-auto">
                  {rechercheClient ? 'Vérifiez l’orthographe ou effacez la recherche.' : 'Commencez par ajouter la première commande pour cette date.'}
                </p>
                <button
                  onClick={() => handleAjouterCommande()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-lg text-xs font-semibold shadow-xs"
                >
                  <Icon icon="mdi:plus" className="text-base" />
                  <span>Ajouter une commande</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {commandesFiltrees.map(commande => {
                  const client = clients.find(c => c.id === commande.clientId);
                  const isDepliee = Boolean(commandesDepliees[commande.id]);
                  const alertSunday = isSunday && client?.neTravaillePasDimanche;

                  const totalArticlesCommande = commande.produits.reduce((sum, p) => sum + (Number(p.quantiteCommandee) || 0), 0);
                  const totalMontantCommande = commande.produits.reduce((sum, p) => sum + (p.prixUnitaire || 0) * (Number(p.quantiteCommandee) || 0), 0);

                  // Cars cumulés pour cette commande
                  const car1Total = commande.produits.reduce((sum, p) => sum + (Number(p.repartitionCars?.car1_matin) || 0), 0);
                  const car2Total = commande.produits.reduce((sum, p) => sum + (Number(p.repartitionCars?.car2_matin) || 0), 0);
                  const carSTotal = commande.produits.reduce((sum, p) => sum + (Number(p.repartitionCars?.car_soir) || 0), 0);

                  // Modèle WE infos
                  const hasWE = Boolean(client?.commandeTypeWeekend && client.commandeTypeWeekend.length > 0);
                  const totalWE = client?.commandeTypeWeekend?.reduce((sum, p) => sum + (Number(p.quantiteCommandee) || 0), 0);
                  const correspondWE = hasWE && totalArticlesCommande === totalWE;

                  return (
                    <div
                      key={commande.id}
                      className={`rounded-xl transition-all overflow-hidden ${
                        isDepliee
                          ? `bg-white border border-sand-300 border-l-4 ${alertSunday ? 'border-l-amber-500 ring-2 ring-amber-500/20' : 'border-l-terracotta-500 ring-2 ring-terracotta-500/20'} shadow-md`
                          : `bg-white border ${alertSunday ? 'border-amber-400' : 'border-sand-200 hover:border-sand-300'} shadow-2xs hover:shadow-xs`
                      } ${commande.statut === 'annulee' ? 'opacity-60 bg-sand-50/50' : ''}`}
                    >
                      {/* Ligne En-tête Compacte (Cliquable pour déplier) */}
                      <div
                        onClick={() => toggleCommande(commande.id)}
                        className={`px-3 sm:px-4 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-2.5 cursor-pointer select-none transition-colors ${
                          isDepliee
                            ? 'bg-sand-100/60 border-b border-sand-200/90'
                            : 'hover:bg-sand-50/70'
                        }`}
                      >
                        {/* Identité Client + Badges */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          <button
                            type="button"
                            className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all ${
                              isDepliee
                                ? 'bg-terracotta-500 text-white shadow-xs rotate-90'
                                : 'bg-sand-100 text-sand-500 hover:bg-sand-200 hover:text-sand-800'
                            }`}
                            title={isDepliee ? 'Replier' : 'Déplier'}
                          >
                            <Icon
                              icon="mdi:chevron-right"
                              className="text-base"
                            />
                          </button>

                          <div className={`w-7 h-7 rounded-md font-bold text-xs flex items-center justify-center shrink-0 transition-colors ${
                            isDepliee ? 'bg-terracotta-600 text-white' : 'bg-sand-800 text-white'
                          }`}>
                            {(client?.nom || '?').substring(0, 2).toUpperCase()}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-sm truncate ${isDepliee ? 'font-bold text-sand-950' : 'font-semibold text-sand-900'}`}>
                                {client?.nom || 'Client inconnu'}
                              </span>

                              {isWE && hasWE && (
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  correspondWE ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}>
                                  <Icon icon={correspondWE ? "mdi:check-decagram" : "mdi:alert-circle-outline"} className="text-xs" />
                                  {correspondWE ? `Modèle WE (${totalWE} prod.)` : `Diffère WE (${totalArticlesCommande}/${totalWE} prod.)`}
                                </span>
                              )}

                              {alertSunday && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                  <Icon icon="mdi:alert" className="text-xs" />
                                  Repos Dimanche
                                </span>
                              )}

                              {commande.statut === 'annulee' && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-danger-100 text-danger-700">
                                  ANNULÉE
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Voitures, Quantité & Actions */}
                        <div className="flex flex-wrap items-center justify-between md:justify-end gap-2.5 sm:gap-4 shrink-0 pl-8 sm:pl-9 md:pl-0 pt-1 md:pt-0 border-t border-sand-200/50 md:border-t-0">
                          {/* Badges de répartition voitures */}
                          <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                            {car1Total > 0 && (
                              <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold rounded">
                                <Icon icon="mdi:truck" className="text-xs text-amber-600" />
                                <span>Car 1: {car1Total}</span>
                              </span>
                            )}
                            {car2Total > 0 && (
                              <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 bg-sky-50 text-sky-800 border border-sky-200 text-[10px] font-bold rounded">
                                <Icon icon="mdi:truck-outline" className="text-xs text-sky-600" />
                                <span>Car 2: {car2Total}</span>
                              </span>
                            )}
                            {carSTotal > 0 && (
                              <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 bg-terracotta-50 text-terracotta-800 border border-terracotta-200 text-[10px] font-bold rounded">
                                <Icon icon="mdi:truck-fast" className="text-xs text-terracotta-600" />
                                <span>Soir: {carSTotal}</span>
                              </span>
                            )}
                          </div>

                          {/* Quantité & Montant */}
                          <div className="text-left sm:text-right tabular-nums">
                            <span className="font-bold text-xs sm:text-sm text-sand-900">
                              {totalArticlesCommande} {totalArticlesCommande > 1 ? 'produits' : 'produit'}
                            </span>
                            <span className="text-[11px] sm:text-xs text-sand-500 ml-1.5">
                              ({totalMontantCommande.toLocaleString('fr-FR')} F)
                            </span>
                          </div>

                          {/* Actions rapides sur la commande */}
                          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleImprimerBonLivraison(commande)}
                              className="p-1 sm:p-1.5 text-sand-500 hover:text-sky-600 hover:bg-sky-50 rounded transition-colors"
                              title="Imprimer bon de livraison"
                              aria-label="Imprimer bon de livraison"
                            >
                              <Icon icon="mdi:file-document-outline" className="text-base" />
                            </button>
                            <button
                              onClick={() => handleAjouterCommande(commande.clientId)}
                              className="p-1 sm:p-1.5 text-sand-500 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                              title="Ajouter des produits à cette commande"
                              aria-label="Ajouter des produits"
                            >
                              <Icon icon="mdi:plus" className="text-base" />
                            </button>
                            <button
                              onClick={() => handleAnnulerCommande(commande.id)}
                              className="p-1 sm:p-1.5 text-sand-500 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                              title="Annuler la commande"
                              aria-label="Annuler la commande"
                            >
                              <Icon icon="mdi:ban" className="text-base" />
                            </button>
                            <button
                              onClick={() => handleSupprimerCommande(commande.id)}
                              className="p-1 sm:p-1.5 text-sand-500 hover:text-danger-600 hover:bg-danger-50 rounded transition-colors"
                              title="Supprimer la commande"
                              aria-label="Supprimer la commande"
                            >
                              <Icon icon="mdi:delete-outline" className="text-base" />
                            </button>
                          </div>

                        </div>
                      </div>

                      {/* Détail Déplié (Accordéon Ouvert - Zone Distincte & Visuelle) */}
                      {isDepliee && (
                        <div className="bg-sand-50/80 p-2.5 sm:p-4 md:p-5 space-y-3 sm:space-y-3.5">
                          {/* Alertes et actions rapides WE */}
                          {isWE && hasWE && !correspondWE && commande.statut !== 'annulee' && (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-xs shadow-2xs">
                              <span className="text-amber-900 font-medium">
                                Ce client prend habituellement <strong>{totalWE} produit{(totalWE ?? 0) > 1 ? 's' : ''} le week-end</strong> (actuellement {totalArticlesCommande} {totalArticlesCommande > 1 ? 'produits' : 'produit'}).
                              </span>
                              <button
                                type="button"
                                onClick={() => handleAppliquerCommandeWE(commande)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded shadow-2xs self-end sm:self-auto transition-colors"
                              >
                                <Icon icon="mdi:lightning-bolt" className="text-xs" />
                                <span>Appliquer modèle WE ({totalWE} prod.)</span>
                              </button>
                            </div>
                          )}

                          {isWE && !hasWE && commande.statut !== 'annulee' && (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-white border border-sand-300 rounded-lg text-xs text-sand-700 shadow-2xs">
                              <span>Aucun modèle week-end enregistré pour ce client. Enregistrer ces quantités pour les prochains week-ends ?</span>
                              <button
                                type="button"
                                onClick={() => handleEnregistrerCommeTypeWE(commande)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-sand-100 hover:bg-sand-200 text-sand-800 border border-sand-300 font-semibold rounded shadow-2xs self-end sm:self-auto transition-colors"
                              >
                                <Icon icon="mdi:content-save-outline" className="text-xs" />
                                <span>Enregistrer comme modèle WE</span>
                              </button>
                            </div>
                          )}

                          {/* En-tête de section des produits commandés */}
                          <div className="flex items-center justify-between px-1">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-sand-800 uppercase tracking-wide">
                              <Icon icon="mdi:package-variant-closed" className="text-terracotta-600 text-base" />
                              <span>Détail des articles commandés</span>
                            </div>
                            <span className="text-xs text-sand-500 font-medium">
                              {commande.produits.length} produit{commande.produits.length > 1 ? 's' : ''}
                            </span>
                          </div>

                          {/* Tableau valorisé des produits - AVEC OVERFLOW HORIZONTAL SÉCURISÉ */}
                          <div className="bg-white rounded-xl border border-sand-200 shadow-2xs overflow-hidden">
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs min-w-[520px]">
                                <thead>
                                  <tr className="bg-sand-100/70 border-b border-sand-200 text-left text-sand-600 font-bold uppercase text-[10px] tracking-wider">
                                    <th className="px-3 sm:px-3.5 py-2.5">Produit</th>
                                    <th className="px-3 sm:px-3.5 py-2.5 text-center">Quantité</th>
                                    <th className="px-3 sm:px-3.5 py-2.5 text-right">Prix unit.</th>
                                    <th className="px-3 sm:px-3.5 py-2.5 text-right">Sous-total</th>
                                    <th className="px-3 sm:px-3.5 py-2.5">Livraison</th>
                                    <th className="px-3 sm:px-3.5 py-2.5 text-right w-16">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-sand-100 tabular-nums">
                                  {commande.produits.map((item, index) => {
                                    const produit = produits.find(p => p.id === item.produitId);
                                    const c1 = Number(item.repartitionCars?.car1_matin) || 0;
                                    const c2 = Number(item.repartitionCars?.car2_matin) || 0;
                                    const cs = Number(item.repartitionCars?.car_soir) || 0;

                                    return (
                                      <tr key={index} className="hover:bg-sand-50/70 transition-colors">
                                        <td className="px-3 sm:px-3.5 py-2.5 font-semibold text-sand-900">
                                          <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded bg-sand-100 flex items-center justify-center shrink-0">
                                              <Icon icon={getProductIcon(produit?.nom || '')} className="text-sm text-sand-600" />
                                            </div>
                                            <span className="uppercase">{produit?.nom || 'Produit inconnu'}</span>
                                          </div>
                                        </td>
                                        <td className="px-3 sm:px-3.5 py-2.5 text-center font-bold text-sand-950">
                                          <span className="inline-block px-2 py-0.5 rounded bg-sand-100 text-sand-800">
                                            {item.quantiteCommandee}
                                          </span>
                                        </td>
                                        <td className="px-3 sm:px-3.5 py-2.5 text-right text-sand-600">
                                          {(item.prixUnitaire || 0).toLocaleString('fr-FR')} F
                                        </td>
                                        <td className="px-3 sm:px-3.5 py-2.5 text-right font-bold text-sand-900">
                                          {((item.prixUnitaire || 0) * item.quantiteCommandee).toLocaleString('fr-FR')} F
                                        </td>
                                        <td className="px-3 sm:px-3.5 py-2.5">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            {c1 > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-50 text-amber-800 rounded border border-amber-200">Car 1: {c1}</span>}
                                            {c2 > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-sky-50 text-sky-800 rounded border border-sky-200">Car 2: {c2}</span>}
                                            {cs > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-terracotta-50 text-terracotta-800 rounded border border-terracotta-200">Soir: {cs}</span>}
                                          </div>
                                        </td>
                                        <td className="px-3 sm:px-3.5 py-2.5 text-right">
                                          <div className="flex items-center justify-end gap-1">
                                            <button
                                              type="button"
                                              onClick={() => handleModifierProduitSpecifique(commande.id, index)}
                                              className="p-1 text-sand-400 hover:text-sand-800 hover:bg-sand-100 rounded transition-colors"
                                              title="Modifier ce produit"
                                            >
                                              <Icon icon="mdi:pencil-outline" className="text-base" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleSupprimerProduitDeCommande(commande.id, index)}
                                              className="p-1 text-sand-400 hover:text-danger-600 hover:bg-danger-50 rounded transition-colors"
                                              title="Supprimer ce produit"
                                            >
                                              <Icon icon="mdi:close" className="text-base" />
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Barre de synthèse compacte du bas */}
                <div className="bg-sand-100 border border-sand-200 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-2.5 text-xs text-sand-700">
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <span><strong>{commandesClients.length}</strong> commande(s)</span>
                    <span>·</span>
                    <span><strong>{totalArticlesClients}</strong> {totalArticlesClients > 1 ? 'produits' : 'produit'} au total</span>
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-sand-900">
                    Montant total : {totalMontantClients.toLocaleString('fr-FR')} FCFA
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* -------------------------------------------------------------------------
            ONGLET 2 : BOUTIQUE
        -------------------------------------------------------------------------- */}
        {ongletActif === 'boutique' && (
          <div className="space-y-4">
            
            {/* Alerte produits quotidiens manquants */}
            {quotidiensManquants.length > 0 && (
              <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                <div>
                  <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-amber-900">
                    <Icon icon="mdi:bell-ring-outline" className="text-amber-600 text-base" />
                    <span>{quotidiensManquants.length} produit{quotidiensManquants.length > 1 ? 's' : ''} quotidien{quotidiensManquants.length > 1 ? 's' : ''} manquant{quotidiensManquants.length > 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {quotidiensManquants.map(p => (
                      <span key={p.id} className="px-2 py-0.5 rounded bg-white border border-amber-200 text-amber-900 text-[11px] font-medium uppercase">
                        {p.nom} {p.quantiteBoutiqueDefaut ? `(${p.quantiteBoutiqueDefaut})` : ''}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={ajouterQuotidiensManquants}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-2xs shrink-0 self-start sm:self-auto transition-colors"
                >
                  <Icon icon="mdi:plus" className="text-base" />
                  <span>Tout ajouter ({quotidiensManquants.length})</span>
                </button>
              </div>
            )}

            {/* En-tête de la section boutique */}
            <div className="bg-white rounded-xl border border-sand-200 p-2.5 sm:p-3 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-sand-900">
                  Produits envoyés en boutique
                </h3>
                <p className="text-xs text-sand-500">
                  {quantitesBoutique.length} produit(s) · {totalPiecesBoutique} pièce(s)
                </p>
              </div>

              <button
                onClick={() => setShowQuantiteBoutiqueForm(true)}
                disabled={showQuantiteBoutiqueForm}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-lg text-xs sm:text-sm font-semibold transition-colors shadow-2xs shrink-0"
              >
                <Icon icon="mdi:plus" className="text-base" />
                <span>Ajouter un produit</span>
              </button>
            </div>

            {/* Grille des produits boutique */}
            {quantitesBoutique.length === 0 ? (
              <div className="bg-white rounded-xl border border-sand-200 p-8 sm:p-10 text-center">
                <div className="w-12 h-12 bg-sand-100 text-sand-400 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Icon icon="mdi:storefront-outline" className="text-2xl" />
                </div>
                <h3 className="text-sm font-bold text-sand-900 mb-1">
                  Aucun produit pour la boutique
                </h3>
                <p className="text-xs text-sand-500 mb-4 max-w-sm mx-auto">
                  Définissez les quantités destinées à la vente directe en boutique pour cette date.
                </p>
                <button
                  onClick={() => setShowQuantiteBoutiqueForm(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-lg text-xs font-semibold shadow-xs"
                >
                  <Icon icon="mdi:plus" className="text-base" />
                  <span>Ajouter le premier produit</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {quantitesBoutique.map(item => {
                  const produit = produits.find(p => p.id === item.produitId);
                  const c1 = Number(item.repartitionCars?.car1_matin) || 0;
                  const c2 = Number(item.repartitionCars?.car2_matin) || 0;
                  const cs = Number(item.repartitionCars?.car_soir) || 0;

                  return (
                    <div
                      key={item.produitId}
                      className="bg-white border border-sand-200 rounded-xl p-3 sm:p-3.5 hover:border-sand-300 shadow-2xs transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-sand-100 text-sand-600 flex items-center justify-center shrink-0">
                              <Icon icon={getProductIcon(produit?.nom || '')} className="text-lg" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-bold text-xs sm:text-sm text-sand-900 uppercase truncate" title={produit?.nom}>
                                {produit?.nom || 'Produit inconnu'}
                              </h4>
                              <span className="text-xs text-sand-500 font-semibold tabular-nums">
                                {item.quantite} pièce{item.quantite > 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => {
                                setQuantiteBoutiqueEnEdition(item);
                                setShowQuantiteBoutiqueForm(true);
                              }}
                              className="p-1 text-sand-400 hover:text-sand-800 hover:bg-sand-100 rounded"
                              title="Modifier"
                            >
                              <Icon icon="mdi:pencil-outline" className="text-base" />
                            </button>
                            <button
                              onClick={() => supprimerQuantiteBoutique(item.produitId)}
                              className="p-1 text-sand-400 hover:text-danger-600 hover:bg-danger-50 rounded"
                              title="Supprimer"
                            >
                              <Icon icon="mdi:delete-outline" className="text-base" />
                            </button>
                          </div>
                        </div>

                        {/* Répartition sur les voitures */}
                        <div className="pt-2 border-t border-sand-100 flex items-center gap-1.5 flex-wrap">
                          {c1 > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold rounded">
                              <Icon icon="mdi:truck" className="text-xs text-amber-600" />
                              Car 1: {c1}
                            </span>
                          )}
                          {c2 > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-sky-50 text-sky-800 border border-sky-200 text-[10px] font-bold rounded">
                              <Icon icon="mdi:truck-outline" className="text-xs text-sky-600" />
                              Car 2: {c2}
                            </span>
                          )}
                          {cs > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-terracotta-50 text-terracotta-800 border border-terracotta-200 text-[10px] font-bold rounded">
                              <Icon icon="mdi:truck-fast" className="text-xs text-terracotta-600" />
                              Soir: {cs}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* -------------------------------------------------------------------------
            ONGLET 3 : SYNTHÈSE GLOBALE & LIVRAISONS
        -------------------------------------------------------------------------- */}
        {ongletActif === 'synthese' && (
          <div className="space-y-4">
            
            {/* KPI Cards Sobres (Linear / Odoo style) */}
            {programmeActuel?.totauxParProduit && programmeActuel.totauxParProduit.length > 0 ? (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
                  <div className="bg-white border border-sand-200 rounded-xl p-3 sm:p-3.5 shadow-2xs">
                    <div className="flex items-center justify-between text-sand-500 mb-1">
                      <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide truncate">Car 1 Matin</span>
                      <Icon icon="mdi:truck" className="text-amber-600 text-base sm:text-lg shrink-0" />
                    </div>
                    <div className="text-lg sm:text-2xl font-bold text-sand-900 tabular-nums">
                      {programmeActuel.totauxParProduit.reduce((sum, p) => sum + (p.repartitionCar1Matin || 0), 0)}
                    </div>
                    <div className="text-[10px] text-sand-400 mt-0.5 truncate">06:00 - 10:00</div>
                  </div>

                  <div className="bg-white border border-sand-200 rounded-xl p-3 sm:p-3.5 shadow-2xs">
                    <div className="flex items-center justify-between text-sand-500 mb-1">
                      <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide truncate">Car 2 Matin</span>
                      <Icon icon="mdi:truck-outline" className="text-sky-600 text-base sm:text-lg shrink-0" />
                    </div>
                    <div className="text-lg sm:text-2xl font-bold text-sand-900 tabular-nums">
                      {programmeActuel.totauxParProduit.reduce((sum, p) => sum + (p.repartitionCar2Matin || 0), 0)}
                    </div>
                    <div className="text-[10px] text-sand-400 mt-0.5 truncate">08:00 - 12:00</div>
                  </div>

                  <div className="bg-white border border-sand-200 rounded-xl p-3 sm:p-3.5 shadow-2xs">
                    <div className="flex items-center justify-between text-sand-500 mb-1">
                      <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide truncate">Car Soir</span>
                      <Icon icon="mdi:truck-fast" className="text-terracotta-600 text-base sm:text-lg shrink-0" />
                    </div>
                    <div className="text-lg sm:text-2xl font-bold text-sand-900 tabular-nums">
                      {programmeActuel.totauxParProduit.reduce((sum, p) => sum + (p.repartitionCarSoir || 0), 0)}
                    </div>
                    <div className="text-[10px] text-sand-400 mt-0.5 truncate">15:00 - 19:00</div>
                  </div>

                  <div className="bg-sand-900 text-white rounded-xl p-3 sm:p-3.5 shadow-xs">
                    <div className="flex items-center justify-between text-sand-300 mb-1">
                      <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide truncate">Total Général</span>
                      <Icon icon="mdi:bread-slice" className="text-amber-400 text-base sm:text-lg shrink-0" />
                    </div>
                    <div className="text-lg sm:text-2xl font-bold text-white tabular-nums">
                      {programmeActuel.totauxParProduit.reduce((sum, p) => sum + p.totalGlobal, 0)}
                    </div>
                    <div className="text-[10px] text-sand-400 mt-0.5 truncate">Toutes tournées</div>
                  </div>
                </div>

                {/* Tableau complet de synthèse par produit */}
                <div className="bg-white rounded-xl border border-sand-200 shadow-xs overflow-hidden">
                  <div className="px-4 py-3 border-b border-sand-200 bg-sand-50/60 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon icon="mdi:table" className="text-sand-500 text-base" />
                      <h3 className="text-xs sm:text-sm font-bold text-sand-900">
                        Matrice de production du jour
                      </h3>
                    </div>
                    <span className="text-xs text-sand-500">
                      {programmeActuel.totauxParProduit.length} produit(s)
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs min-w-[640px]">
                      <thead>
                        <tr className="bg-sand-100/50 border-b border-sand-200 text-left text-sand-600 text-[10px] uppercase font-semibold tracking-wider">
                          <th className="px-3.5 py-2.5">Produit</th>
                          <th className="px-3.5 py-2.5 text-right">Clients</th>
                          <th className="px-3.5 py-2.5 text-right">Boutique</th>
                          <th className="px-3.5 py-2.5 text-right">Car 1M</th>
                          <th className="px-3.5 py-2.5 text-right">Car 2M</th>
                          <th className="px-3.5 py-2.5 text-right">Soir</th>
                          <th className="px-3.5 py-2.5 text-right font-bold text-sand-900">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-sand-100 tabular-nums">
                        {programmeActuel.totauxParProduit.map((total) => (
                          <tr key={total.produitId} className="hover:bg-sand-50/60 transition-colors">
                            <td className="px-3.5 py-2.5">
                              <div className="flex items-center gap-2">
                                <Icon icon={getProductIcon(total.produit?.nom || '')} className="text-base text-sand-400" />
                                <span className="font-semibold text-sand-900 uppercase">
                                  {total.produit?.nom || total.produitId}
                                </span>
                              </div>
                            </td>
                            <td className="px-3.5 py-2.5 text-right text-sand-700">{total.totalClient}</td>
                            <td className="px-3.5 py-2.5 text-right text-sand-700">{total.totalBoutique}</td>
                            <td className="px-3.5 py-2.5 text-right text-sand-700">{total.repartitionCar1Matin || 0}</td>
                            <td className="px-3.5 py-2.5 text-right text-sand-700">{total.repartitionCar2Matin || 0}</td>
                            <td className="px-3.5 py-2.5 text-right text-sand-700">{total.repartitionCarSoir || 0}</td>
                            <td className="px-3.5 py-2.5 text-right font-bold text-sand-900 bg-sand-50/50">
                              {total.totalGlobal}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-sand-100 border-t-2 border-sand-300 font-bold text-sand-900 tabular-nums">
                          <td className="px-3.5 py-3">Total général</td>
                          <td className="px-3.5 py-3 text-right">{programmeActuel.totauxParProduit.reduce((s, t) => s + (t.totalClient || 0), 0)}</td>
                          <td className="px-3.5 py-3 text-right">{programmeActuel.totauxParProduit.reduce((s, t) => s + (t.totalBoutique || 0), 0)}</td>
                          <td className="px-3.5 py-3 text-right">{programmeActuel.totauxParProduit.reduce((s, t) => s + (t.repartitionCar1Matin || 0), 0)}</td>
                          <td className="px-3.5 py-3 text-right">{programmeActuel.totauxParProduit.reduce((s, t) => s + (t.repartitionCar2Matin || 0), 0)}</td>
                          <td className="px-3.5 py-3 text-right">{programmeActuel.totauxParProduit.reduce((s, t) => s + (t.repartitionCarSoir || 0), 0)}</td>
                          <td className="px-3.5 py-3 text-right text-sm bg-sand-200/50">
                            {programmeActuel.totauxParProduit.reduce((s, t) => s + (t.totalGlobal || 0), 0)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-xl border border-sand-200 p-10 text-center">
                <div className="w-12 h-12 bg-sand-100 text-sand-400 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Icon icon="mdi:chart-pie" className="text-2xl" />
                </div>
                <h3 className="text-sm font-bold text-sand-900 mb-1">
                  Aucun produit dans le programme
                </h3>
                <p className="text-xs text-sand-500 max-w-sm mx-auto">
                  Ajoutez des commandes clients ou des quantités boutique pour visualiser la synthèse de production.
                </p>
              </div>
            )}
          </div>
        )}

      </main>

      {/* =========================================================================
          MODALS DE GESTION
      ========================================================================== */}
      {/* Modal Commande Client */}
      <Modal
        isOpen={showCommandeForm}
        onClose={handleAnnulerFormulaire}
        title={
          modeFormulaire === 'addProducts' && commandeEnEdition
            ? `Ajouter des Produits - ${clients.find(c => c.id === commandeEnEdition.clientId)?.nom || 'Client'}`
            : modeFormulaire === 'edit' && commandeEnEdition
              ? `Modifier la Commande - ${clients.find(c => c.id === commandeEnEdition.clientId)?.nom || 'Client'}`
              : 'Nouvelle Commande Client'
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
          isLoading={isLoading || isSaving}
          formulaireState={formulaireCommande}
          onUpdateFormulaire={updateFormulaireCommande}
        />
      </Modal>

      {/* Modal Modifier Produit */}
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
            isLoading={isLoading || isSaving}
          />
        </Modal>
      )}

      {/* Modal Quantité Boutique */}
      <Modal
        isOpen={showQuantiteBoutiqueForm}
        onClose={() => {
          setShowQuantiteBoutiqueForm(false);
          setQuantiteBoutiqueEnEdition(null);
        }}
        title={quantiteBoutiqueEnEdition ? "Modifier Produit Boutique" : "Ajouter un Produit Boutique"}
        size="xl"
      >
        <QuantiteBoutiqueForm
          produits={produits}
          quantitesActuelles={quantitesBoutique}
          quantiteEnEdition={quantiteBoutiqueEnEdition}
          onSave={(quantite) => {
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

      {/* Modal Redistribution */}
      <RedistributionModal
        isOpen={showRedistributionModal}
        onClose={() => {
          setShowRedistributionModal(false);
          setCommandeARedistribuer(null);
        }}
        onConfirm={handleConfirmRedistribution}
        commande={commandeARedistribuer}
        clients={clients}
        isLoading={isLoading || isSaving}
      />

      {/* Modal Validation & Clôture Production (Sacs de farine) */}
      {programmeActuel && (
        <ModalValidationProduction
          isOpen={showValidationModal}
          onClose={() => setShowValidationModal(false)}
          onConfirm={handleConfirmValidation}
          totalPains={programmeActuel.totauxParProduit?.reduce((sum, p) => sum + p.totalGlobal, 0) || 0}
          dateProduction={new Date(programmeActuel.dateProduction)}
          sacsInitiaux={programmeActuel.sacsFarinePetris}
        />
      )}

      {/* Modal de Confirmation */}
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

      {/* Indicateur flottant lors de l'enregistrement */}
      {isSaving && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 bg-sand-900/90 text-white text-xs font-semibold rounded-full shadow-elevated backdrop-blur-md border border-white/10 pointer-events-none transition-all duration-300">
          <Icon icon="mdi:loading" className="animate-spin text-base text-amber-400" />
          <span>Enregistrement des modifications…</span>
        </div>
      )}
    </div>
  );
};