/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';

import { useProductionStore } from '../../store/productionStore';
import { useLivreurStore } from '../../store/livreurStore';
import { useReferentielStore } from '../../store/referentielStore';
import { useLivraisonStore } from '../../store/livraisonStore';
import { CARS_LIVRAISON } from '../../types/production';
import { htmlPrintService } from '../../services/htmlPrintService';
import type { CarLivraison } from '../../types';
import toast from 'react-hot-toast';
import { ConfirmButton } from '../../components/ui/ConfirmButton';
import { ModalDeficitProduction } from '../../components/production/ModalDeficitProduction';
import { ModalQuotaGlobal } from '../../components/livraison/ModalQuotaGlobal';
import { estWeekend } from '../../utils/dateUtils';

export const PageLivraison: React.FC = () => {
  const { commandesClients, chargerProgramme, supprimerCommandesLivreur, modifierCommandeClient, clients: prodClients, produits: prodProduits } = useProductionStore();
  const { livreurs, chargerLivreurs } = useLivreurStore();
  const { clients, produits: produitsRef, chargerProduits, chargerClients } = useReferentielStore();
  const { parametresLivraison, chargerParametresLivraison } = useLivraisonStore();

  const [dateSelectionnee, setDateSelectionnee] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [carSelectionne, setCarSelectionne] = useState<CarLivraison | 'tous'>('tous');
  const [livreurSelectionne, setLivreurSelectionne] = useState<string>('tous');
  const [searchTerm, setSearchTerm] = useState('');
  const [vueCompacte, setVueCompacte] = useState<boolean>(true);
  const [livreursDeplies, setLivreursDeplies] = useState<Record<string, boolean>>({});
  const [carsDeplies, setCarsDeplies] = useState<Record<string, boolean>>({});
  const [isModalDeficitOpen, setIsModalDeficitOpen] = useState(false);
  const [isModalQuotaOpen, setIsModalQuotaOpen] = useState(false);
  const [selectedDeficitLivreurId, setSelectedDeficitLivreurId] = useState<string | null>(null);

  const handleApplyRedistribution = async (
    updates: Array<{
      commandeId: string;
      produitId: string;
      carLivraison?: string;
      nouvelleQuantite: number;
    }>
  ) => {
    // Regrouper les mises à jour par commandeId
    const updatesByCommande = new Map<string, Array<{ produitId: string; carLivraison?: string; nouvelleQuantite: number }>>();

    updates.forEach(upd => {
      if (!updatesByCommande.has(upd.commandeId)) {
        updatesByCommande.set(upd.commandeId, []);
      }
      updatesByCommande.get(upd.commandeId)!.push(upd);
    });

    // Mettre à jour chaque commande concernée
    updatesByCommande.forEach((updList, commandeId) => {
      const commande = commandesClients.find(c => c.id === commandeId);
      if (!commande) return;

      const nouveauxProduits = commande.produits.map(p => {
        const matches = updList.filter(u => u.produitId === p.produitId);
        if (matches.length === 0) return p;

        const pCopy = { ...p };
        if (pCopy.repartitionCars) {
          const newRep = { ...pCopy.repartitionCars };
          matches.forEach(m => {
            if (m.carLivraison && m.carLivraison in newRep) {
              (newRep as any)[m.carLivraison] = m.nouvelleQuantite;
            }
          });
          pCopy.repartitionCars = newRep;
          pCopy.quantiteCommandee = (Number(newRep.car1_matin) || 0) + (Number(newRep.car2_matin) || 0) + (Number(newRep.car_soir) || 0);
        } else {
          pCopy.quantiteCommandee = matches[0].nouvelleQuantite;
        }

        return pCopy;
      });

      modifierCommandeClient(commandeId, { produits: nouveauxProduits });
    });
  };

  const handleResetLivreurToInitial = (livreurId: string) => {
    let count = 0;
    commandesClients.forEach(cmd => {
      const client = clients.find(c => c.id === cmd.clientId);
      if (!client) return;

      const hasDriver = client.livreurId === livreurId || Object.values(client.livreursParCar || {}).includes(livreurId);
      if (!hasDriver) return;

      const isWE = estWeekend(cmd.dateLivraison || dateSelectionnee);
      const ctSource = (isWE && client.commandeTypeWeekend?.length) ? client.commandeTypeWeekend : client.commandeType;
      if (!ctSource || ctSource.length === 0) return;

      const nouveauxProduits = cmd.produits.map(p => {
        const ctItem = ctSource.find(ct => ct.produitId === p.produitId);
        if (!ctItem) return p;

        const pCopy = { ...p };
        if (ctItem.repartitionCars) {
          pCopy.repartitionCars = {
            car1_matin: Number(ctItem.repartitionCars.car1_matin) || 0,
            car2_matin: Number(ctItem.repartitionCars.car2_matin) || 0,
            car_soir: Number(ctItem.repartitionCars.car_soir) || 0,
          };
          pCopy.quantiteCommandee = pCopy.repartitionCars.car1_matin + pCopy.repartitionCars.car2_matin + pCopy.repartitionCars.car_soir;
        } else if (ctItem.quantiteCommandee) {
          pCopy.quantiteCommandee = Number(ctItem.quantiteCommandee) || p.quantiteCommandee;
        }
        return pCopy;
      });

      modifierCommandeClient(cmd.id, { produits: nouveauxProduits });
      count++;
    });

    if (count > 0) {
      toast.success(`✅ Commandes réinitialisées aux quantités d'origine pour ce livreur !`);
    } else {
      toast.error('Aucune commande initiale type trouvée pour ce livreur.');
    }
  };

  useEffect(() => {
    const initialiser = async () => {
      try {
        await Promise.all([
          chargerProduits(),
          chargerClients(),
          chargerLivreurs(),
          chargerParametresLivraison()
        ]);
        await chargerProgramme(new Date(dateSelectionnee));
      } catch (error) {
        console.error('Erreur lors de l\'initialisation:', error);
      }
    };
    initialiser();
  }, [dateSelectionnee, chargerProgramme, chargerProduits, chargerClients, chargerLivreurs, chargerParametresLivraison]);

  // Fonction pour organiser les commandes par livreur et par car
  const organiserCommandesParLivreur = () => {
    const commandesParLivreur = new Map();
    const clientsDisponibles = clients && clients.length > 0 ? clients : prodClients || [];
    const produitsDisponibles = produitsRef && produitsRef.length > 0 ? produitsRef : prodProduits || [];

    commandesClients.forEach(commande => {
      const client = clientsDisponibles.find(c => c.id === commande.clientId);

      if (!client) {
        console.warn(`⚠️ Client non trouvé pour commande:`, {
          commandeClientId: commande.clientId,
          clientsDisponibles: clientsDisponibles.map(c => ({ id: c.id, nom: c.nom }))
        });
      }

      commande.produits.forEach(produit => {
        const repartition = produit.repartitionCars;
        const repartitionValide = repartition && (
          (Number(repartition.car1_matin) || 0) > 0 ||
          (Number(repartition.car2_matin) || 0) > 0 ||
          (Number(repartition.car_soir) || 0) > 0
        );

        const ajouterAuCar = (carKey: CarLivraison, quantite: number) => {
          if (!quantite || quantite <= 0) return;
          const livreurId = client?.livreursParCar?.[carKey] || client?.livreurId || 'non-assigne';

          if (!commandesParLivreur.has(livreurId)) {
            let livreurTrouve = livreurs.find(l => l.id === livreurId);

            if (!livreurTrouve && livreurId !== 'non-assigne') {
              console.warn(`⚠️ Livreur ID ${livreurId} non trouvé dans la liste pour client ${client?.nom}`);
              livreurTrouve = {
                id: livreurId,
                nom: `Livreur (ID: ${livreurId.substring(0, 6)}...)`,
                active: true,
                createdAt: new Date(),
                updatedAt: new Date()
              } as any;
            }

            commandesParLivreur.set(livreurId, {
              livreur: livreurTrouve || null,
              commandesParCar: new Map<CarLivraison, any[]>()
            });
          }

          const livreurData = commandesParLivreur.get(livreurId);

          // Trouver ou créer la liste pour ce car
          if (!livreurData.commandesParCar.has(carKey)) {
            livreurData.commandesParCar.set(carKey, []);
          }

          // Ajouter la commande
          livreurData.commandesParCar.get(carKey).push({
            commande,
            client,
            produit: produitsDisponibles.find(p => p.id === produit.produitId),
            quantite: quantite
          });
        };

        if (repartitionValide) {
          Object.entries(repartition).forEach(([car, quantite]) => {
            ajouterAuCar(car as CarLivraison, Number(quantite) || 0);
          });
        } else {
          // Fallback : si la commande n'a pas de répartition explicite par car,
          // on utilise le car configuré pour le client ou car1_matin
          const carDefaut: CarLivraison =
            (client?.livreursParCar?.car2_matin && !client?.livreursParCar?.car1_matin) ? 'car2_matin' :
            (client?.livreursParCar?.car_soir && !client?.livreursParCar?.car1_matin) ? 'car_soir' : 'car1_matin';
          ajouterAuCar(carDefaut, Number(produit.quantiteCommandee) || 0);
        }
      });
    });

    return Array.from(commandesParLivreur.entries());
  };

  const commandesOrganisees = organiserCommandesParLivreur();


  // Fonctions pour générer les rapports imprimables
  const genererRapportLivreur = (dataLivreur: any) => {
    try {
      htmlPrintService.generateDeliveryReportHTML(
        dataLivreur,
        dateSelectionnee,
        parametresLivraison?.pourcentageRetourGlobalMax,
        parametresLivraison?.produitsSoumisAuQuotaIds
      );
      toast.success('Rapport ouvert dans une nouvelle fenêtre !');
    } catch (error) {
      console.error('Erreur lors de la génération du rapport:', error);
      toast.error('Erreur lors de la génération du rapport');
    }
  };

  const genererRapportGlobal = () => {
    try {
      htmlPrintService.generateGlobalReportHTML(
        commandesOrganisees,
        dateSelectionnee,
        parametresLivraison?.pourcentageRetourGlobalMax,
        parametresLivraison?.produitsSoumisAuQuotaIds
      );
      toast.success('Rapport global ouvert dans une nouvelle fenêtre !');
    } catch (error) {
      console.error('Erreur lors de la génération du rapport:', error);
      toast.error('Erreur lors de la génération du rapport');
    }
  };

  const handleShareWhatsAppLivreur = (data: any) => {
    if (!data.livreur && data.commandesParCar.size === 0) return;

    const dateStr = new Date(dateSelectionnee).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const livreurNom = data.livreur ? data.livreur.nom : 'Clients non assignés';
    let message = `*LIVRAISON - ${livreurNom.toUpperCase()}*\n`;
    message += `*Date : ${dateStr.toUpperCase()}*\n`;
    message += `--------------------------------\n`;

    // Parcourir les cars dans l'ordre
    const codesCars: CarLivraison[] = ['car1_matin', 'car2_matin', 'car_soir'];

    codesCars.forEach(carKey => {
      const livraisons = data.commandesParCar.get(carKey);
      if (livraisons && livraisons.length > 0) {
        message += `\n*TOURNEE : ${CARS_LIVRAISON[carKey].toUpperCase()}*\n`;

        // Calculer les totaux par produit pour ce car
        const totauxProduits = new Map<string, number>();
        livraisons.forEach((liv: any) => {
          const nom = liv.produit?.nom || 'Inconnu';
          totauxProduits.set(nom, (totauxProduits.get(nom) || 0) + liv.quantite);
        });

        Array.from(totauxProduits.entries()).forEach(([nom, total]) => {
          message += `- ${nom} : *${total}*\n`;
        });

        const totalCar = Array.from(totauxProduits.values()).reduce((a, b) => a + b, 0);
        message += `_Total car : ${totalCar} pc_\n`;
      }
    });

    message += `\n--------------------------------\n`;
    message += `_Boulangerie Chez Mina_`;

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
  };

  const handleShareWhatsAppGlobal = () => {
    const dateStr = new Date(dateSelectionnee).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    let message = `*RECAPITULATIF GLOBAL LIVRAISONS*\n`;
    message += `*Date : ${dateStr.toUpperCase()}*\n`;
    message += `--------------------------------\n\n`;

    commandesOrganisees.forEach(([_, data]: [string, any]) => {
      const livreurNom = data.livreur ? data.livreur.nom : 'NON ASSIGNÉS';
      message += `*LIVREUR : ${livreurNom.toUpperCase()}*\n`;

      // Totaux par produit pour ce livreur (tous cars confondus)
      const totauxLivreur = new Map<string, number>();
      data.commandesParCar.forEach((livraisons: any[]) => {
        livraisons.forEach((liv: any) => {
          const nom = liv.produit?.nom || 'Inconnu';
          totauxLivreur.set(nom, (totauxLivreur.get(nom) || 0) + liv.quantite);
        });
      });

      if (totauxLivreur.size > 0) {
        Array.from(totauxLivreur.entries()).forEach(([nom, total]) => {
          message += `• ${nom} : *${total}*\n`;
        });
        const totalLivreur = Array.from(totauxLivreur.values()).reduce((a, b) => a + b, 0);
        message += `_Total : ${totalLivreur} pc_\n`;
      }
      message += `--------------------------------\n`;
    });

    message += `\n_Boulangerie Chez Mina_`;

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
  };

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

  // Changement de date (+/- jours)
  const handleDecalerDate = (deltaJours: number) => {
    const d = new Date(dateSelectionnee + 'T12:00:00');
    d.setDate(d.getDate() + deltaJours);
    setDateSelectionnee(d.toISOString().split('T')[0]);
  };

  const handleDateAujourdhui = () => {
    setDateSelectionnee(new Date().toISOString().split('T')[0]);
  };

  const handleChangerLivreur = (id: string) => {
    setLivreurSelectionne(id);
    if (id !== 'tous') {
      setLivreursDeplies(prev => ({ ...prev, [id]: true }));
    }
  };

  const toggleLivreur = (id: string) => {
    setLivreursDeplies(prev => ({ ...prev, [id]: !(prev[id] ?? true) }));
  };

  const toggleCar = (carKey: string) => {
    setCarsDeplies(prev => ({ ...prev, [carKey]: !(prev[carKey] ?? true) }));
  };

  const toutDeplier = () => {
    const depliesLivreurs: Record<string, boolean> = {};
    const depliesCars: Record<string, boolean> = {};
    commandesOrganisees.forEach(([livreurId, data]) => {
      depliesLivreurs[livreurId] = true;
      data.commandesParCar.forEach((_: any, car: string) => {
        depliesCars[`${livreurId}_${car}`] = true;
      });
    });
    setLivreursDeplies(depliesLivreurs);
    setCarsDeplies(depliesCars);
  };

  const toutReplier = () => {
    const repliesLivreurs: Record<string, boolean> = {};
    const repliesCars: Record<string, boolean> = {};
    commandesOrganisees.forEach(([livreurId, data]) => {
      repliesLivreurs[livreurId] = false;
      data.commandesParCar.forEach((_: any, car: string) => {
        repliesCars[`${livreurId}_${car}`] = false;
      });
    });
    setLivreursDeplies(repliesLivreurs);
    setCarsDeplies(repliesCars);
  };

  const listeLivreursDisponibles = React.useMemo(() => {
    return commandesOrganisees.map(([livreurId, data]) => {
      let totalPieces = 0;
      const clientsUniques = new Set<string>();

      data.commandesParCar.forEach((livs: any[]) => {
        livs.forEach((l: any) => {
          totalPieces += Number(l.quantite) || 0;
          if (l.client?.id) clientsUniques.add(l.client.id);
        });
      });

      return {
        id: livreurId,
        nom: data.livreur ? data.livreur.nom : 'Clients non assignés',
        vehicule: data.livreur?.vehicule,
        telephone: data.livreur?.telephone,
        totalPieces,
        totalStops: clientsUniques.size,
        nbTournees: data.commandesParCar.size
      };
    });
  }, [commandesOrganisees]);

  const commandesOrganiseesFiltrees = React.useMemo(() => {
    return commandesOrganisees.filter(([livreurId, data]) => {
      // 1. Filtre par livreur
      if (livreurSelectionne !== 'tous' && livreurId !== livreurSelectionne) {
        return false;
      }

      // 2. Filtre par car
      if (carSelectionne !== 'tous' && !data.commandesParCar.has(carSelectionne)) {
        return false;
      }

      // 3. Recherche client
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        let matchTrouve = false;
        data.commandesParCar.forEach((livraisons: any[]) => {
          if (livraisons.some((liv: any) => (liv.client?.nom || '').toLowerCase().includes(term))) {
            matchTrouve = true;
          }
        });
        if (!matchTrouve) return false;
      }

      return true;
    });
  }, [commandesOrganisees, livreurSelectionne, carSelectionne, searchTerm]);

  const statsGlobales = React.useMemo(() => {
    const source = livreurSelectionne === 'tous' ? commandesOrganisees : commandesOrganiseesFiltrees;
    let totalTournees = 0;
    let totalPieces = 0;
    const clientsUniques = new Set<string>();

    source.forEach(([, data]) => {
      totalTournees += data.commandesParCar.size;
      data.commandesParCar.forEach((livraisons: any[]) => {
        livraisons.forEach((liv: any) => {
          totalPieces += Number(liv.quantite) || 0;
          if (liv.client?.id) clientsUniques.add(liv.client.id);
        });
      });
    });

    return {
      nbLivreurs: source.length,
      nbTournees: totalTournees,
      nbAdresses: clientsUniques.size,
      totalPieces
    };
  }, [commandesOrganisees, commandesOrganiseesFiltrees, livreurSelectionne]);

  const estAujourdhui = dateSelectionnee === new Date().toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-sand-100 overflow-x-hidden pb-10">
      {/* Header moderne & compact */}
      <div className="bg-white border-b border-sand-200 px-3 sm:px-6 py-2.5 sm:py-3.5 sticky top-0 z-20 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3">
          {/* Titre & Icone */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 bg-terracotta-50 text-terracotta-600 rounded-lg flex items-center justify-center shrink-0">
              <Icon icon="mdi:truck-delivery-outline" className="text-xl" />
            </div>
            <div>
              <h1 className="font-display text-base sm:text-xl font-bold text-sand-900 leading-tight">
                Livraisons
              </h1>
              <p className="text-[11px] sm:text-xs text-sand-500 truncate">
                Gestion des tournées par livreur et par car
              </p>
            </div>
          </div>

          {/* Actions globales */}
          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
            <button
              onClick={() => setIsModalQuotaOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg shadow-2xs transition-colors text-xs font-semibold shrink-0"
              title="Configurer le pourcentage de retour maximum global par défaut"
            >
              <Icon icon="mdi:keyboard-return" className="text-base text-amber-700" />
              <span>Quota : {parametresLivraison?.pourcentageRetourGlobalMax !== undefined ? `${parametresLivraison.pourcentageRetourGlobalMax}%` : '10%'}</span>
            </button>

            <button
              onClick={() => {
                setSelectedDeficitLivreurId(null);
                setIsModalDeficitOpen(true);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-terracotta-600 hover:bg-terracotta-700 text-white rounded-lg shadow-2xs transition-colors text-xs font-semibold shrink-0"
              disabled={commandesOrganisees.length === 0}
              title="Ajuster les livraisons en cas de déficit de production"
            >
              <Icon icon="mdi:lightning-bolt" className="text-base" />
              <span>Déficit Prod</span>
            </button>

            <button
              onClick={genererRapportGlobal}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-sand-900 hover:bg-sand-800 text-white rounded-lg shadow-2xs transition-colors text-xs font-medium shrink-0"
              disabled={commandesOrganisees.length === 0}
              title="Imprimer le rapport global de toutes les tournées"
            >
              <Icon icon="mdi:printer" className="text-base" />
              <span>Rapport Global</span>
            </button>

            <button
              onClick={handleShareWhatsAppGlobal}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-2xs transition-colors text-xs font-medium shrink-0"
              disabled={commandesOrganisees.length === 0}
              title="Partager le récapitulatif global sur WhatsApp"
            >
              <Icon icon="mdi:whatsapp" className="text-base" />
              <span>Partager Tout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6 space-y-3.5 sm:space-y-4">
        {/* Barre de filtres & recherche compacte */}
        <div className="bg-white rounded-xl border border-sand-200 shadow-xs p-3 space-y-3">
          {/* Ligne 1 : Navigation Date + Sélecteur Livreur + Sélecteur Car + Recherche */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {/* 1. Date avec navigation rapide */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-sand-600 mb-1">
                Date
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleDecalerDate(-1)}
                  className="p-1.5 text-sand-600 hover:text-sand-900 hover:bg-sand-100 rounded border border-sand-300 transition-colors"
                  title="Jour précédent"
                >
                  <Icon icon="mdi:chevron-left" className="text-base" />
                </button>
                <input
                  type="date"
                  value={dateSelectionnee}
                  onChange={(e) => setDateSelectionnee(e.target.value)}
                  className="flex-1 min-w-0 px-2 py-1.5 border border-sand-300 rounded-lg text-xs font-semibold text-sand-900 focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => handleDecalerDate(1)}
                  className="p-1.5 text-sand-600 hover:text-sand-900 hover:bg-sand-100 rounded border border-sand-300 transition-colors"
                  title="Jour suivant"
                >
                  <Icon icon="mdi:chevron-right" className="text-base" />
                </button>
                {!estAujourdhui && (
                  <button
                    type="button"
                    onClick={handleDateAujourdhui}
                    className="px-2 py-1.5 bg-sand-100 hover:bg-sand-200 text-sand-800 rounded text-[11px] font-semibold border border-sand-300 shrink-0 transition-colors"
                    title="Revenir à aujourd'hui"
                  >
                    Auj.
                  </button>
                )}
              </div>
            </div>

            {/* 2. Filtre par Livreur */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-sand-600 mb-1">
                Filtre Livreur
              </label>
              <div className="relative">
                <Icon icon="mdi:moped" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sand-400 text-base" />
                <select
                  value={livreurSelectionne}
                  onChange={(e) => handleChangerLivreur(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-sand-50 border border-sand-300 rounded-lg text-xs font-semibold text-sand-900 focus:ring-2 focus:ring-terracotta-500 focus:bg-white focus:border-transparent transition-all truncate"
                >
                  <option value="tous">Tous les livreurs ({listeLivreursDisponibles.length})</option>
                  {listeLivreursDisponibles.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.nom} ({l.totalStops} client{l.totalStops > 1 ? 's' : ''} · {l.totalPieces} pc)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 3. Filtre par Car / Tournée */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-sand-600 mb-1">
                Tournée / Car
              </label>
              <div className="relative">
                <Icon icon="mdi:truck" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sand-400 text-base" />
                <select
                  value={carSelectionne}
                  onChange={(e) => setCarSelectionne(e.target.value as CarLivraison | 'tous')}
                  className="w-full pl-8 pr-3 py-1.5 bg-sand-50 border border-sand-300 rounded-lg text-xs font-semibold text-sand-900 focus:ring-2 focus:ring-terracotta-500 focus:bg-white focus:border-transparent transition-all truncate"
                >
                  <option value="tous">Toutes les tournées</option>
                  <option value="car1_matin">Car 1 Matin (06h - 10h)</option>
                  <option value="car2_matin">Car 2 Matin (08h - 12h)</option>
                  <option value="car_soir">Car Soir (15h - 19h)</option>
                </select>
              </div>
            </div>

            {/* 4. Recherche Client */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-sand-600 mb-1">
                Recherche Client
              </label>
              <div className="relative">
                <Icon icon="mdi:magnify" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sand-400 text-base" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filtrer par nom..."
                  className="w-full pl-8 pr-7 py-1.5 bg-sand-50 border border-sand-300 rounded-lg text-xs text-sand-900 focus:ring-2 focus:ring-terracotta-500 focus:bg-white focus:border-transparent transition-all"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-sand-400 hover:text-sand-700"
                    title="Effacer la recherche"
                  >
                    <Icon icon="mdi:close" className="text-xs" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Ligne 2 : Chips horizontaux de livreurs + Outils d'affichage */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-sand-100">
            {/* Chips de sélection rapide de livreur (0 scroll nécessaire) */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <button
                type="button"
                onClick={() => handleChangerLivreur('tous')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors shrink-0 ${
                  livreurSelectionne === 'tous'
                    ? 'bg-sand-900 text-white shadow-2xs'
                    : 'bg-sand-100 hover:bg-sand-200 text-sand-700'
                }`}
              >
                Tous ({listeLivreursDisponibles.length})
              </button>

              {listeLivreursDisponibles.map(l => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => handleChangerLivreur(l.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 shrink-0 ${
                    livreurSelectionne === l.id
                      ? 'bg-terracotta-600 text-white shadow-2xs'
                      : 'bg-sand-100 hover:bg-sand-200 text-sand-700'
                  }`}
                >
                  <span className="truncate max-w-[130px]">{l.nom}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    livreurSelectionne === l.id ? 'bg-terracotta-700 text-white' : 'bg-sand-200 text-sand-800'
                  }`}>
                    {l.totalStops}
                  </span>
                </button>
              ))}
            </div>

            {/* Outils d'affichage à droite : Vue compacte/détaillée + Tout déplier/replier */}
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 text-xs">
              {/* Toggle vue compacte / vue détaillée */}
              <div className="inline-flex rounded-lg border border-sand-200 bg-sand-50 p-0.5">
                <button
                  type="button"
                  onClick={() => setVueCompacte(true)}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
                    vueCompacte ? 'bg-white text-sand-900 shadow-2xs font-semibold' : 'text-sand-600 hover:text-sand-900'
                  }`}
                  title="Vue compacte (anti-scroll)"
                >
                  <Icon icon="mdi:view-headline" className="text-sm" />
                  <span className="hidden sm:inline">Compact</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVueCompacte(false)}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
                    !vueCompacte ? 'bg-white text-sand-900 shadow-2xs font-semibold' : 'text-sand-600 hover:text-sand-900'
                  }`}
                  title="Vue détaillée"
                >
                  <Icon icon="mdi:view-grid-outline" className="text-sm" />
                  <span className="hidden sm:inline">Détaillé</span>
                </button>
              </div>

              <span className="text-sand-300">|</span>

              {/* Tout déplier / tout replier */}
              <div className="flex items-center gap-1 text-sand-500">
                <button
                  type="button"
                  onClick={toutDeplier}
                  className="px-1.5 py-1 hover:bg-sand-100 text-sand-600 rounded font-medium transition-colors"
                >
                  Tout déplier
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={toutReplier}
                  className="px-1.5 py-1 hover:bg-sand-100 text-sand-600 rounded font-medium transition-colors"
                >
                  Tout replier
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* KPI Cards Sobres & Compactes */}
        {commandesOrganisees.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            <div className="bg-white border border-sand-200 rounded-xl p-3 sm:p-3.5 shadow-2xs">
              <div className="flex items-center justify-between text-sand-500 mb-1">
                <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide truncate">
                  {livreurSelectionne === 'tous' ? 'Livreurs Mobilisés' : 'Livreur Sélectionné'}
                </span>
                <Icon icon="mdi:account-group" className="text-sand-600 text-base sm:text-lg shrink-0" />
              </div>
              <div className="text-lg sm:text-2xl font-bold text-sand-900 tabular-nums">
                {livreurSelectionne === 'tous' ? statsGlobales.nbLivreurs : 1}
              </div>
              <div className="text-[10px] text-sand-400 mt-0.5 truncate">
                {livreurSelectionne === 'tous' ? `${statsGlobales.nbLivreurs} livreur(s) actif(s)` : listeLivreursDisponibles.find(l => l.id === livreurSelectionne)?.nom || '1 livreur'}
              </div>
            </div>

            <div className="bg-white border border-sand-200 rounded-xl p-3 sm:p-3.5 shadow-2xs">
              <div className="flex items-center justify-between text-sand-500 mb-1">
                <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide truncate">
                  Tournées Prévues
                </span>
                <Icon icon="mdi:truck-delivery" className="text-warning-600 text-base sm:text-lg shrink-0" />
              </div>
              <div className="text-lg sm:text-2xl font-bold text-sand-900 tabular-nums">
                {statsGlobales.nbTournees}
              </div>
              <div className="text-[10px] text-sand-400 mt-0.5 truncate">
                Cars assignés aujourd'hui
              </div>
            </div>

            <div className="bg-white border border-sand-200 rounded-xl p-3 sm:p-3.5 shadow-2xs">
              <div className="flex items-center justify-between text-sand-500 mb-1">
                <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide truncate">
                  Points de Livraison
                </span>
                <Icon icon="mdi:map-marker" className="text-info-600 text-base sm:text-lg shrink-0" />
              </div>
              <div className="text-lg sm:text-2xl font-bold text-sand-900 tabular-nums">
                {statsGlobales.nbAdresses}
              </div>
              <div className="text-[10px] text-sand-400 mt-0.5 truncate">
                Clients à livrer
              </div>
            </div>

            <div className="bg-sand-900 text-white rounded-xl p-3 sm:p-3.5 shadow-xs">
              <div className="flex items-center justify-between text-sand-300 mb-1">
                <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide truncate">
                  Total Pièces
                </span>
                <Icon icon="mdi:bread-slice" className="text-amber-400 text-base sm:text-lg shrink-0" />
              </div>
              <div className="text-lg sm:text-2xl font-bold text-white tabular-nums">
                {statsGlobales.totalPieces}
              </div>
              <div className="text-[10px] text-sand-400 mt-0.5 truncate">
                Pièces à distribuer
              </div>
            </div>
          </div>
        )}

        {/* Vue des livreurs et tournées */}
        {commandesOrganisees.length === 0 ? (
          <div className="bg-white rounded-xl border border-sand-200 p-8 sm:p-12 text-center">
            <div className="w-16 h-16 bg-sand-100 rounded-full flex items-center justify-center mx-auto mb-3 text-sand-400">
              <Icon icon="mdi:package-variant-closed" className="text-3xl" />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-sand-900 mb-1">
              Aucune livraison prévue pour cette date
            </h3>
            <p className="text-xs text-sand-500 max-w-sm mx-auto">
              Aucune commande client n'a été saisie pour le {dateSelectionnee}.
            </p>
          </div>
        ) : commandesOrganiseesFiltrees.length === 0 ? (
          <div className="bg-white rounded-xl border border-sand-200 p-8 text-center">
            <div className="w-12 h-12 bg-sand-100 rounded-full flex items-center justify-center mx-auto mb-3 text-sand-400">
              <Icon icon="mdi:filter-off-outline" className="text-2xl" />
            </div>
            <h3 className="text-sm font-bold text-sand-900 mb-1">
              Aucun résultat pour les filtres sélectionnés
            </h3>
            <p className="text-xs text-sand-500 mb-3 max-w-sm mx-auto">
              Essayez de réinitialiser le filtre de livreur, de tournée ou la recherche client.
            </p>
            <button
              type="button"
              onClick={() => {
                setLivreurSelectionne('tous');
                setCarSelectionne('tous');
                setSearchTerm('');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sand-900 text-white rounded-lg text-xs font-semibold"
            >
              <Icon icon="mdi:refresh" className="text-sm" />
              <span>Réinitialiser les filtres</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {commandesOrganiseesFiltrees.map(([livreurId, data]: [string, any]) => {
              const isDeplie = livreursDeplies[livreurId] ?? true;
              const isNonAssigne = !data.livreur;

              // Calculs de ce livreur
              let livreurTotalPieces = 0;
              const clientsLivreur = new Set<string>();
              data.commandesParCar.forEach((livs: any[]) => {
                livs.forEach((l: any) => {
                  livreurTotalPieces += Number(l.quantite) || 0;
                  if (l.client?.id) clientsLivreur.add(l.client.id);
                });
              });

              return (
                <div
                  key={livreurId}
                  className={`bg-white rounded-xl border transition-all overflow-hidden ${
                    isNonAssigne
                      ? 'border-amber-300 ring-1 ring-amber-300/40 shadow-xs'
                      : isDeplie
                        ? 'border-sand-300 shadow-sm'
                        : 'border-sand-200 shadow-2xs hover:border-sand-300'
                  }`}
                >
                  {/* En-tête Livreur Accordéon (cliquable pour déplier/replier) */}
                  <div
                    onClick={() => toggleLivreur(livreurId)}
                    className={`p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 cursor-pointer select-none transition-colors ${
                      isDeplie ? 'bg-sand-100/60 border-b border-sand-200/90' : 'hover:bg-sand-50/80'
                    }`}
                  >
                    {/* Identité livreur + stats résumé */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        type="button"
                        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all ${
                          isDeplie
                            ? 'bg-terracotta-500 text-white shadow-2xs rotate-90'
                            : 'bg-sand-100 text-sand-500 hover:bg-sand-200'
                        }`}
                        title={isDeplie ? 'Replier ce livreur' : 'Déplier ce livreur'}
                      >
                        <Icon icon="mdi:chevron-right" className="text-base" />
                      </button>

                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                        isNonAssigne ? 'bg-amber-100 text-amber-800' : 'bg-sand-800 text-white'
                      }`}>
                        <Icon icon={isNonAssigne ? "mdi:account-alert" : "mdi:moped"} className="text-lg" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-sm text-sand-950 truncate">
                            {data.livreur ? data.livreur.nom : 'Clients non assignés'}
                          </h3>
                          {data.livreur?.vehicule && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-sand-200/80 text-sand-700">
                              {data.livreur.vehicule}
                            </span>
                          )}
                          {data.livreur?.telephone && (
                            <a
                              href={`tel:${data.livreur.telephone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-[11px] text-sand-500 hover:text-sand-800 flex items-center gap-1"
                              title="Appeler le livreur"
                            >
                              <Icon icon="mdi:phone" className="text-xs text-sand-400" />
                              <span>{data.livreur.telephone}</span>
                            </a>
                          )}
                        </div>

                        {/* Badges de synthèse du livreur */}
                        <div className="flex items-center gap-2 text-xs text-sand-500 mt-0.5">
                          <span><strong>{clientsLivreur.size}</strong> client{clientsLivreur.size > 1 ? 's' : ''}</span>
                          <span>·</span>
                          <span><strong>{livreurTotalPieces}</strong> pièce{livreurTotalPieces > 1 ? 's' : ''}</span>
                          <span>·</span>
                          <span><strong>{data.commandesParCar.size}</strong> tournée{data.commandesParCar.size > 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions rapides sur ce livreur */}
                    <div
                      className="flex items-center gap-1.5 self-end sm:self-auto shrink-0 flex-wrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {data.livreur && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedDeficitLivreurId(livreurId);
                              setIsModalDeficitOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-terracotta-600 hover:bg-terracotta-700 text-white rounded-lg shadow-2xs transition-colors text-xs font-semibold shrink-0"
                            title="Gérer un déficit de production pour ce livreur"
                          >
                            <Icon icon="mdi:lightning-bolt" className="text-sm" />
                            <span className="hidden sm:inline">Déficit</span>
                          </button>

                          <button
                            onClick={() => handleResetLivreurToInitial(livreurId)}
                            className="inline-flex items-center gap-1 px-2 py-1.5 bg-white hover:bg-sand-100 text-sand-700 border border-sand-300 rounded-lg transition-colors text-xs font-medium shrink-0"
                            title="Rétablir les commandes d'origine (100%)"
                          >
                            <Icon icon="mdi:undo-variant" className="text-sm" />
                            <span className="hidden sm:inline">Rétablir</span>
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => genererRapportLivreur(data)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-sand-900 hover:bg-sand-800 text-white rounded-lg shadow-2xs transition-colors text-xs font-medium shrink-0"
                        title="Générer le rapport imprimable pour ce livreur"
                      >
                        <Icon icon="mdi:printer" className="text-sm" />
                        <span>Imprimer</span>
                      </button>

                      <button
                        onClick={() => handleShareWhatsAppLivreur(data)}
                        className="inline-flex items-center justify-center p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg transition-colors text-xs font-medium shrink-0"
                        title="Partager le récapitulatif via WhatsApp"
                      >
                        <Icon icon="mdi:whatsapp" className="text-base" />
                      </button>

                      {data.livreur && (
                        <ConfirmButton
                          onConfirm={() => {
                            supprimerCommandesLivreur(livreurId);
                            toast.success(`✅ Toutes les commandes de "${data.livreur?.nom}" ont été supprimées définitivement.`);
                          }}
                          title="Supprimer le programme de livraison"
                          message={`Supprimer définitivement toutes les commandes de "${data.livreur?.nom}" pour le ${dateSelectionnee} ?`}
                          confirmText="Supprimer définitivement"
                          cancelText="Annuler"
                          type="danger"
                          className="inline-flex items-center justify-center p-1.5 bg-danger-50 hover:bg-danger-100 text-danger-600 border border-danger-200 rounded-lg transition-colors text-xs font-medium shrink-0"
                        >
                          <Icon icon="mdi:delete-outline" className="text-base" />
                        </ConfirmButton>
                      )}
                    </div>
                  </div>

                  {/* Détail Déplié : Tournées du Livreur */}
                  {isDeplie && (
                    <div className="p-2.5 sm:p-3.5 space-y-3 bg-sand-50/50">
                      {(Array.from(data.commandesParCar.entries()) as [CarLivraison, any][])
                        .sort(([carA], [carB]) => {
                          const ordre: CarLivraison[] = ['car1_matin', 'car2_matin', 'car_soir'];
                          return ordre.indexOf(carA) - ordre.indexOf(carB);
                        })
                        .filter(([car]) => carSelectionne === 'tous' || carSelectionne === car)
                        .map(([car, livraisons]) => {
                          const carKey = `${livreurId}_${car}`;
                          const isCarDeplie = carsDeplies[carKey] ?? true;

                          // Total pièces pour ce car
                          const totalPiecesCar = livraisons.reduce((s: number, l: any) => s + (Number(l.quantite) || 0), 0);

                          // Grouper les livraisons par client et agréger les mêmes produits
                          const livraisonsParClient = new Map<string, { client: any; produits: Array<{ produit: any; quantite: number }> }>();
                          livraisons.forEach((livraison: any) => {
                            const clientId = livraison.client?.id || 'inconnu';
                            if (!livraisonsParClient.has(clientId)) {
                              livraisonsParClient.set(clientId, {
                                client: livraison.client,
                                produits: []
                              });
                            }
                            const clientEntry = livraisonsParClient.get(clientId)!;
                            const prodId = livraison.produit?.id || livraison.produit?.nom || 'inconnu';
                            const existProd = clientEntry.produits.find(p => (p.produit?.id || p.produit?.nom) === prodId);
                            if (existProd) {
                              existProd.quantite += Number(livraison.quantite) || 0;
                            } else {
                              clientEntry.produits.push({
                                produit: livraison.produit,
                                quantite: Number(livraison.quantite) || 0
                              });
                            }
                          });

                          const clientsFiltres = Array.from(livraisonsParClient.values()).filter(clientData =>
                            searchTerm.trim() === '' ||
                            (clientData.client?.nom?.toLowerCase() || '').includes(searchTerm.toLowerCase())
                          );

                          // Résumé des produits du car
                          const resumeProduits = livraisons.reduce((acc: Record<string, number>, liv: any) => {
                            const nom = liv.produit?.nom || 'Inconnu';
                            acc[nom] = (acc[nom] || 0) + (Number(liv.quantite) || 0);
                            return acc;
                          }, {} as Record<string, number>);

                          return (
                            <div key={car} className="bg-white rounded-xl border border-sand-200 shadow-2xs overflow-hidden">
                              {/* En-tête Car cliquable (Accordéon tournée) */}
                              <div
                                onClick={() => toggleCar(carKey)}
                                className="px-3 py-2 bg-sand-100/70 border-b border-sand-200 flex items-center justify-between gap-2 cursor-pointer select-none hover:bg-sand-100 transition-colors"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <button
                                    type="button"
                                    className={`w-5 h-5 rounded flex items-center justify-center text-sand-500 transition-transform ${
                                      isCarDeplie ? 'rotate-90' : ''
                                    }`}
                                  >
                                    <Icon icon="mdi:chevron-right" className="text-sm" />
                                  </button>

                                  <div className="w-6 h-6 rounded bg-sand-200 text-sand-700 flex items-center justify-center shrink-0">
                                    <Icon icon={car === 'car_soir' ? "mdi:truck-fast" : "mdi:truck"} className="text-xs" />
                                  </div>

                                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                                    <span className="font-bold text-xs sm:text-sm text-sand-900 truncate">
                                      {CARS_LIVRAISON[car]}
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded bg-sand-200/80 text-sand-700 text-[10px] font-semibold">
                                      {clientsFiltres.length} client{clientsFiltres.length > 1 ? 's' : ''} · {totalPiecesCar} pc
                                    </span>
                                  </div>
                                </div>

                                {/* Aperçu inline des totaux produits */}
                                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                  {(Object.entries(resumeProduits) as [string, number][]).slice(0, 3).map(([nom, qte]) => (
                                    <span key={nom} className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white border border-sand-200 text-[10px] text-sand-700 font-medium truncate max-w-[120px]">
                                      <span className="truncate">{nom}</span>: <strong>{qte}</strong>
                                    </span>
                                  ))}
                                  {Object.keys(resumeProduits).length > 3 && (
                                    <span className="hidden sm:inline text-[10px] text-sand-500">
                                      +{Object.keys(resumeProduits).length - 3}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Contenu de la tournée (Clients) */}
                              {isCarDeplie && (
                                <div className="p-2.5 sm:p-3 space-y-2.5">
                                  {clientsFiltres.length === 0 ? (
                                    <div className="text-center py-4 text-xs text-sand-500">
                                      Aucun client ne correspond au filtre de recherche.
                                    </div>
                                  ) : vueCompacte ? (
                                    /* VUE COMPACTE : Réduit considérablement la hauteur de page */
                                    <div className="divide-y divide-sand-100 border border-sand-200 rounded-lg overflow-hidden bg-sand-50/20">
                                      {clientsFiltres.map((clientData, idx) => {
                                        const totalClient = clientData.produits.reduce((acc, p) => acc + p.quantite, 0);
                                        return (
                                          <div
                                            key={idx}
                                            className="px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 hover:bg-sand-50 transition-colors"
                                          >
                                            <div className="font-semibold text-xs sm:text-sm text-sand-900 truncate min-w-[140px]">
                                              {clientData.client?.nom || 'Client inconnu'}
                                            </div>

                                            <div className="flex items-center gap-1.5 flex-wrap justify-between sm:justify-end flex-1">
                                              <div className="flex items-center gap-1 flex-wrap">
                                                {clientData.produits.map((item, pIdx) => (
                                                  <span
                                                    key={pIdx}
                                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white border border-sand-200 text-[11px] text-sand-700 font-medium"
                                                  >
                                                    <span className="uppercase truncate max-w-[110px]">{item.produit?.nom}</span>
                                                    <strong className="text-sand-950 font-bold">{item.quantite}</strong>
                                                  </span>
                                                ))}
                                              </div>

                                              <span className="px-2 py-0.5 rounded-full bg-sand-200 text-sand-800 text-xs font-bold shrink-0">
                                                {totalClient} pc
                                              </span>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    /* VUE DÉTAILLÉE : Boîtes détaillées */
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                      {clientsFiltres.map((clientData, idx) => {
                                        const totalClient = clientData.produits.reduce((acc, p) => acc + p.quantite, 0);
                                        return (
                                          <div key={idx} className="bg-sand-50 rounded-lg p-2.5 border border-sand-200">
                                            <div className="flex items-start justify-between mb-2">
                                              <div className="font-semibold text-sand-800 text-xs truncate pr-1" title={clientData.client?.nom}>
                                                {clientData.client?.nom || 'Client Inconnu'}
                                              </div>
                                              <div className="bg-white px-2 py-0.5 rounded text-[11px] font-bold text-sand-700 border border-sand-200 shrink-0">
                                                {totalClient} pc
                                              </div>
                                            </div>

                                            <div className="space-y-1">
                                              {clientData.produits.map((item, pIdx) => (
                                                <div key={pIdx} className="flex justify-between items-center text-xs">
                                                  <div className="flex items-center gap-1.5 overflow-hidden">
                                                    <Icon icon={getProductIcon(item.produit?.nom || '')} className="text-sand-400 text-xs shrink-0" />
                                                    <span className="text-sand-600 truncate uppercase text-[11px]">{item.produit?.nom}</span>
                                                  </div>
                                                  <span className="font-semibold text-sand-900 bg-white px-1.5 rounded ml-1 text-xs">
                                                    {item.quantite}
                                                  </span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {/* Résumé sobre du car au bas */}
                                  <div className="bg-sand-100/70 border border-sand-200 rounded-lg p-2.5 flex items-center justify-between gap-2 flex-wrap">
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-sand-800 uppercase tracking-wide">
                                      <Icon icon="mdi:chart-box-outline" className="text-terracotta-600 text-base" />
                                      <span>Total {CARS_LIVRAISON[car]}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {(Object.entries(resumeProduits) as [string, number][]).map(([nom, qte]) => (
                                        <span key={nom} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-sand-200 text-xs font-medium text-sand-800">
                                          <span>{nom}</span> : <strong className="font-bold text-sand-950">{qte}</strong>
                                        </span>
                                      ))}
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-sand-900 text-white text-xs font-bold">
                                        Total : {totalPiecesCar} pc
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Déficit de Production */}
      <ModalDeficitProduction
        isOpen={isModalDeficitOpen}
        onClose={() => setIsModalDeficitOpen(false)}
        initialLivreurId={selectedDeficitLivreurId}
        initialCar={carSelectionne}
        dateLivraison={dateSelectionnee}
        commandesClients={commandesClients}
        livreurs={livreurs}
        produits={produitsRef}
        clients={clients}
        onApplyRedistribution={handleApplyRedistribution}
      />

      {/* Modal Quota Global de Retours */}
      <ModalQuotaGlobal
        isOpen={isModalQuotaOpen}
        onClose={() => setIsModalQuotaOpen(false)}
      />
    </div>
  );
};