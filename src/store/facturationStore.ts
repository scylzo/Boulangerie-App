import { create } from 'zustand';
import { collection, updateDoc, doc, setDoc, deleteDoc, getDoc, getDocs, query, where, orderBy } from 'firebase/firestore';
import { realTimeListeners } from '../firebase/collections';
import { db } from '../firebase/config';
import type { Facture, LigneFacture, ParametresFacturation, CommandeClient, InvendusClient } from '../types';


interface FacturationStore {
  // État
  factures: Facture[];
  factureActive: Facture | null;
  parametres: ParametresFacturation | null;
  isLoading: boolean;

  // Listener unsubscribe functions
  facturesListener: (() => void) | null;

  // Actions Factures
  genererFacturesDepuisLivraisons: (date: Date, commandesClients: CommandeClient[], retoursClients: InvendusClient[]) => Promise<void>;
  chargerFactures: (dateDebut?: Date, dateFin?: Date) => Promise<void>;
  chargerFacturesAvecListener: (dateDebut?: Date, dateFin?: Date) => void;
  chargerFacture: (factureId: string) => Promise<void>;
  validerFacture: (factureId: string) => Promise<void>;
  envoyerFacture: (factureId: string) => Promise<void>;
  marquerPayee: (factureId: string, datePaiement?: Date) => Promise<void>;
  annulerFacture: (factureId: string, motif?: string) => Promise<void>;
  actualiserStatutsFactures: () => Promise<void>;
  modifierTauxTVA: (factureId: string, nouveauTaux: number) => Promise<void>;
  supprimerFacture: (factureId: string) => Promise<void>;

  // Actions Paramètres
  chargerParametres: () => Promise<void>;
  sauvegarderParametres: (parametres: Partial<ParametresFacturation>) => Promise<void>;

  // Actions utilitaires
  calculerTotauxFacture: (lignes: LigneFacture[], tauxTVA: number) => { totalHT: number; montantTVA: number; totalTTC: number };
  genererNumeroFacture: (date: Date) => string;
  verifierRetoursCompletes: (clientId: string, date: Date, retoursClients: InvendusClient[]) => boolean;
  nettoyerListeners: () => void;

  // Setters
  setLoading: (loading: boolean) => void;
  setFactureActive: (facture: Facture | null) => void;
}

export const useFacturationStore = create<FacturationStore>((set, get) => ({
  // État initial
  factures: [],
  factureActive: null,
  parametres: null,
  isLoading: false,

  // Listeners
  facturesListener: null,

  // Actions Factures
  genererFacturesDepuisLivraisons: async (date: Date, commandesClients: CommandeClient[], retoursClients: InvendusClient[]) => {
    set({ isLoading: true });

    try {

      const { parametres } = get();
      if (!parametres) {
        throw new Error('Paramètres de facturation non configurés');
      }

      if (!commandesClients || commandesClients.length === 0) {
        set({ isLoading: false });
        // S'il n'y a pas de commandes, on ne fait rien
        return;
      }


      // Récupérer les factures existantes pour cette date
      const { factures } = get();
      const dateStr = date.toISOString().split('T')[0];
      const facturesExistantes = factures.filter(facture =>
        facture.dateLivraison.toISOString().split('T')[0] === dateStr
      );

      // Grouper les commandes par client
      const commandesParClient = new Map<string, CommandeClient[]>();
      commandesClients.forEach(commande => {
        const clientId = commande.clientId;
        if (!commandesParClient.has(clientId)) {
          commandesParClient.set(clientId, []);
        }
        commandesParClient.get(clientId)!.push(commande);
      });

      const nouvelles: Facture[] = [];
      const misesAJour: Facture[] = [];

      // Traiter chaque client ayant une commande
      for (const [clientId, commandesClient] of commandesParClient) {

        // Vérifier si une facture existe déjà pour ce client
        const factureExistante = facturesExistantes.find(f => f.clientId === clientId);

        // Si la facture existe et est bloquée (payée, envoyée, annulée), on ne la touche pas
        if (factureExistante && ['payee', 'envoyee', 'annulee'].includes(factureExistante.statut)) {
          continue;
        }

        // Récupérer les informations du client
        let clientInfo = commandesClient[0]?.client;
        if (!clientInfo) {
          try {
            const clientDoc = await getDoc(doc(db, 'clients', clientId));
            if (clientDoc.exists()) {
              clientInfo = { id: clientDoc.id, ...clientDoc.data() } as any;
            }
          } catch (error) {
            console.warn('⚠️ Impossible de récupérer les infos client:', error);
          }
        }

        const retoursClient = retoursClients.find(r => r.clientId === clientId);
        const retoursCompletes = get().verifierRetoursCompletes(clientId, date, retoursClients);

        // Calculer les lignes de facture
        const lignes: LigneFacture[] = [];

        for (const commande of commandesClient) {
          for (const produitCmd of commande.produits) {
            // Récupérer les informations complètes du produit
            if (!produitCmd.produit && produitCmd.produitId) {
              try {
                // Récupérer depuis Firestore si manquant
                const produitDoc = await getDoc(doc(db, 'produits', produitCmd.produitId));
                if (produitDoc.exists()) {
                  const data = produitDoc.data();
                  produitCmd.produit = {
                    id: produitDoc.id,
                    ...data,
                    prixClient: data.prixClient || 0,
                    prixBoutique: data.prixBoutique || 0,
                    prixUnitaire: data.prixUnitaire || 0,
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
                    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date()
                  } as any;
                }
              } catch (e) {
                console.warn('Erreur récupération produit:', e);
              }
            }

            // Fallback produit
            const produitFull: any = produitCmd.produit || { id: produitCmd.produitId, nom: 'Produit Inconnu', prixUnitaire: 0, prixClient: 0, prixBoutique: 0 };


            // Quantité totale livrée
            const quantiteLivree = Object.values(produitCmd.repartitionCars || {})
              .reduce((sum, qte) => sum + (Number(qte) || 0), 0);


            if (quantiteLivree > 0) {
              // Quantité retournée
              const produitRetour = retoursClient?.produits.find(p => p.produitId === produitCmd.produitId);
              const quantiteRetournee = produitRetour?.invendus || 0;
              const quantiteFacturee = Math.max(0, quantiteLivree - quantiteRetournee);

              // Prix
              const prixUnitaire = (clientInfo?.typeClient === 'client' || commande.client?.typeClient === 'client')
                ? (produitFull.prixClient || produitFull.prixUnitaire || 0)
                : (produitFull.prixBoutique || produitFull.prixUnitaire || 0);

              const montantLigne = quantiteFacturee * prixUnitaire;

              lignes.push({
                produitId: produitCmd.produitId,
                produit: produitFull,
                quantiteLivree,
                quantiteRetournee,
                quantiteFacturee,
                prixUnitaire,
                montantLigne
              });
            }
          }
        }

        if (lignes.length > 0) {
          // Calculer les totaux
          const totaux = get().calculerTotauxFacture(lignes, parametres.tauxTVADefaut);

          // Préparer l'objet facture pour Firestore (nettoyage)
          const lignesClean = lignes.map(ligne => {
            // ... nettoyage similaire à l'original ...
            const p = ligne.produit as any;
            return {
              produitId: ligne.produitId,
              quantiteLivree: ligne.quantiteLivree,
              quantiteRetournee: ligne.quantiteRetournee,
              quantiteFacturee: ligne.quantiteFacturee,
              prixUnitaire: ligne.prixUnitaire,
              montantLigne: ligne.montantLigne,
              produit: p ? {
                id: p.id, nom: p.nom, prixUnitaire: p.prixUnitaire || 0, prixClient: p.prixClient || 0, prixBoutique: p.prixBoutique || 0
              } : null
            };
          });

          const clientClean = clientInfo ? {
            id: clientInfo.id,
            nom: clientInfo.nom,
            adresse: clientInfo.adresse || '',
            telephone: clientInfo.telephone || '',
            email: clientInfo.email || '',
            typeClient: clientInfo.typeClient,
          } : null;


          if (factureExistante) {
            // MISE À JOUR FACTURE EXISTANTE
            const updates = {
              lignes: lignesClean,
              ...totaux,
              statut: retoursCompletes ? 'validee' : 'en_attente_retours', // Mise à jour du statut basée sur les retours actuels
              retoursCompletes,
              updatedAt: new Date()
            } as any;

            // Si elle passe à validée, on met la date
            if (retoursCompletes && factureExistante.statut !== 'validee') {
              updates.validatedAt = new Date();
            }

            await updateDoc(doc(db, 'factures', factureExistante.id), updates);

            // Mise à jour state local
            misesAJour.push({
              ...factureExistante,
              lignes, // Avec les objets complets pour l'UI
              ...totaux,
              statut: updates.statut,
              retoursCompletes,
              updatedAt: updates.updatedAt,
              validatedAt: updates.validatedAt || factureExistante.validatedAt
            });

          } else {
            // CRÉATION NOUVELLE FACTURE
            const nouvelleFacture: Facture = {
              id: `facture_${clientId}_${Date.now()}`,
              numeroFacture: get().genererNumeroFacture(date),
              clientId,
              client: clientInfo,
              dateLivraison: date,
              dateFacture: new Date(),
              lignes,
              ...totaux,
              tauxTVA: parametres.tauxTVADefaut,
              statut: retoursCompletes ? 'validee' : 'en_attente_retours',
              retoursCompletes,
              conditionsPaiement: clientInfo?.conditionsPaiement || parametres.conditionsPaiementDefaut,
              createdAt: new Date(),
              updatedAt: new Date()
            };

            // Sauvegarde Firestore
            const factureFirebase = {
              ...nouvelleFacture,
              lignes: lignesClean,
              client: clientClean
              // ... autres champs
            };
            await setDoc(doc(db, 'factures', nouvelleFacture.id), factureFirebase, { merge: true });
            nouvelles.push(nouvelleFacture);
          }
        }
      }

      set(state => ({
        factures: [
          ...state.factures.map(f => {
            const updated = misesAJour.find(u => u.id === f.id);
            return updated || f;
          }),
          ...nouvelles
        ],
        isLoading: false
      }));


    } catch (error) {
      set({ isLoading: false });
      console.error('❌ Erreur lors de la génération/mise à jour des factures:', error);
      throw error;
    }
  },

  chargerFactures: async (dateDebut?: Date, dateFin?: Date) => {
    set({ isLoading: true });

    try {
      let facturesQuery = collection(db, 'factures');

      if (dateDebut && dateFin) {
        facturesQuery = query(
          collection(db, 'factures'),
          where('dateLivraison', '>=', dateDebut),
          where('dateLivraison', '<=', dateFin),
          orderBy('dateFacture', 'desc')
        ) as any;
      } else {
        facturesQuery = query(
          collection(db, 'factures'),
          orderBy('dateFacture', 'desc')
        ) as any;
      }

      const facturesSnapshot = await getDocs(facturesQuery);

      if (!facturesSnapshot.empty) {
        const facturesData = facturesSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            dateLivraison: data.dateLivraison.toDate(),
            dateFacture: data.dateFacture.toDate(),
            createdAt: data.createdAt.toDate(),
            updatedAt: data.updatedAt.toDate(),
            validatedAt: data.validatedAt ? data.validatedAt.toDate() : undefined,
            paidAt: data.paidAt ? data.paidAt.toDate() : undefined,
          } as Facture;
        });

        set({ factures: facturesData });
      } else {
        set({ factures: [] });
      }

      set({ isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      console.error('❌ Erreur lors du chargement des factures:', error);
      throw error;
    }
  },

  chargerFacturesAvecListener: (dateDebut?: Date, dateFin?: Date) => {
    console.log('📡 Configuration listener temps réel pour factures');

    // Nettoyer le listener précédent s'il existe
    const { facturesListener } = get();
    if (facturesListener) {
      facturesListener();
    }

    set({ isLoading: true });

    // Configurer le nouveau listener
    const unsubscribe = realTimeListeners.subscribeToFactures((factures) => {
      console.log('🔄 Mise à jour temps réel - factures reçues:', factures.length);
      set({
        factures,
        isLoading: false
      });
    }, dateDebut, dateFin);

    // Stocker la fonction de nettoyage
    set({ facturesListener: unsubscribe });
  },

  chargerFacture: async (factureId: string) => {
    set({ isLoading: true });

    try {
      const docRef = doc(db, 'factures', factureId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const facture: Facture = {
          ...data,
          dateLivraison: data.dateLivraison.toDate(),
          dateFacture: data.dateFacture.toDate(),
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
          validatedAt: data.validatedAt ? data.validatedAt.toDate() : undefined,
          paidAt: data.paidAt ? data.paidAt.toDate() : undefined,
        } as Facture;

        set({ factureActive: facture });
      } else {
        throw new Error('Facture non trouvée');
      }

      set({ isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      console.error('❌ Erreur lors du chargement de la facture:', error);
      throw error;
    }
  },

  validerFacture: async (factureId: string) => {
    try {
      const factureRef = doc(db, 'factures', factureId);
      const updateData = {
        statut: 'validee' as const,
        validatedAt: new Date(),
        updatedAt: new Date()
      };

      await updateDoc(factureRef, updateData);

      // Mettre à jour localement
      set(state => ({
        factures: state.factures.map(f =>
          f.id === factureId
            ? { ...f, ...updateData }
            : f
        ),
        factureActive: state.factureActive?.id === factureId
          ? { ...state.factureActive, ...updateData }
          : state.factureActive
      }));

    } catch (error) {
      console.error('❌ Erreur lors de la validation:', error);
      throw error;
    }
  },

  envoyerFacture: async (factureId: string) => {
    try {
      const updateData = {
        statut: 'envoyee' as const,
        updatedAt: new Date()
      };

      await updateDoc(doc(db, 'factures', factureId), updateData);

      set(state => ({
        factures: state.factures.map(f =>
          f.id === factureId ? { ...f, ...updateData } : f
        ),
        factureActive: state.factureActive?.id === factureId
          ? { ...state.factureActive, ...updateData }
          : state.factureActive
      }));

    } catch (error) {
      console.error('❌ Erreur lors de l\'envoi:', error);
      throw error;
    }
  },

  marquerPayee: async (factureId: string, datePaiement = new Date()) => {
    try {
      const updateData = {
        statut: 'payee' as const,
        paidAt: datePaiement,
        updatedAt: new Date()
      };

      await updateDoc(doc(db, 'factures', factureId), updateData);

      set(state => ({
        factures: state.factures.map(f =>
          f.id === factureId ? { ...f, ...updateData } : f
        ),
        factureActive: state.factureActive?.id === factureId
          ? { ...state.factureActive, ...updateData }
          : state.factureActive
      }));

    } catch (error) {
      console.error('❌ Erreur lors du marquage du paiement:', error);
      throw error;
    }
  },

  annulerFacture: async (factureId: string, motif?: string) => {
    try {
      const updateData = {
        statut: 'annulee' as const,
        notes: motif || 'Facture annulée',
        updatedAt: new Date()
      };

      await updateDoc(doc(db, 'factures', factureId), updateData);

      set(state => ({
        factures: state.factures.map(f =>
          f.id === factureId ? { ...f, ...updateData } : f
        )
      }));

    } catch (error) {
      console.error('❌ Erreur lors de l\'annulation:', error);
      throw error;
    }
  },

  supprimerFacture: async (factureId: string) => {
    try {
      await deleteDoc(doc(db, 'factures', factureId));

      set(state => ({
        factures: state.factures.filter(f => f.id !== factureId),
        factureActive: state.factureActive?.id === factureId ? null : state.factureActive
      }));

    } catch (error) {
      console.error('❌ Erreur lors de la suppression:', error);
      throw error;
    }
  },

  // Actions Paramètres
  chargerParametres: async () => {
    try {

      const docRef = doc(db, 'parametres', 'facturation');
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const parametresExistants = docSnap.data() as ParametresFacturation;
        // Forcer la mise à jour du taux TVA à 0 si il est encore à 18
        if (parametresExistants.tauxTVADefaut === 18) {
          parametresExistants.tauxTVADefaut = 0;
          await setDoc(docRef, parametresExistants);
        }
        set({ parametres: parametresExistants });
      } else {
        // Créer des paramètres par défaut
        const parametresDefaut: ParametresFacturation = {
          id: 'facturation',
          tauxTVADefaut: 0, // TVA désactivée par défaut
          conditionsPaiementDefaut: 'Payable à 30 jours',
          mentionsLegales: 'Boulangerie Chez MINA - Dakar, Sénégal - RC: XXXXX - NINEA: XXXXX',
          numeroFactureProchain: 1,
          prefixeFacture: 'FACT'
        };

        await setDoc(docRef, parametresDefaut);
        set({ parametres: parametresDefaut });
      }
    } catch (error) {
      console.error('❌ Erreur lors du chargement des paramètres:', error);
      throw error;
    }
  },

  sauvegarderParametres: async (nouveauxParametres: Partial<ParametresFacturation>) => {
    try {
      const { parametres } = get();
      if (!parametres) return;

      const parametresMisAJour = { ...parametres, ...nouveauxParametres };

      const docRef = doc(db, 'parametres', 'facturation');
      await setDoc(docRef, parametresMisAJour, { merge: true });

      set({ parametres: parametresMisAJour });
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde des paramètres:', error);
      throw error;
    }
  },

  // Actions utilitaires
  calculerTotauxFacture: (lignes: LigneFacture[], tauxTVA: number) => {
    const totalHT = lignes.reduce((sum, ligne) => sum + ligne.montantLigne, 0);
    const montantTVA = Math.round(totalHT * (tauxTVA / 100) * 100) / 100;
    const totalTTC = Math.round((totalHT + montantTVA) * 100) / 100;

    return {
      totalHT: Math.round(totalHT * 100) / 100,
      montantTVA,
      totalTTC
    };
  },

  genererNumeroFacture: (date: Date) => {
    const { parametres } = get();
    if (!parametres) return 'FACT-001';

    const annee = date.getFullYear();
    const mois = (date.getMonth() + 1).toString().padStart(2, '0');
    const jour = date.getDate().toString().padStart(2, '0');
    const numero = parametres.numeroFactureProchain.toString().padStart(3, '0');

    return `${parametres.prefixeFacture}-${annee}${mois}${jour}-${numero}`;
  },

  verifierRetoursCompletes: (clientId: string, date: Date, retoursClients: InvendusClient[]) => {
    // Vérifier si ce client a des retours enregistrés ET marqués comme complétés pour cette date
    return retoursClients.some(retour =>
      retour.clientId === clientId &&
      retour.dateLivraison.toDateString() === date.toDateString() &&
      retour.retoursCompletes === true
    );
  },

  // Setters
  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },

  setFactureActive: (facture: Facture | null) => {
    set({ factureActive: facture });
  },

  actualiserStatutsFactures: async () => {
    try {
      const { factures } = get();
      const facturesEnAttente = factures.filter(f => f.statut === 'en_attente_retours');

      if (facturesEnAttente.length === 0) {
        return;
      }

      for (const facture of facturesEnAttente) {
        // Charger les retours pour ce client et cette date spécifique
        const dateDebut = new Date(facture.dateLivraison);
        dateDebut.setHours(0, 0, 0, 0);
        const dateFin = new Date(facture.dateLivraison);
        dateFin.setHours(23, 59, 59, 999);

        const retours = await getDocs(query(
          collection(db, 'clientReturns'),
          where('clientId', '==', facture.clientId),
          where('dateLivraison', '>=', dateDebut),
          where('dateLivraison', '<=', dateFin)
        ));

        const retoursData = retours.docs.map(doc => ({
          id: doc.id,
          ...doc.data() as any,
          dateLivraison: doc.data().dateLivraison.toDate(),
          createdAt: doc.data().createdAt.toDate(),
          updatedAt: doc.data().updatedAt.toDate()
        }));

        // Les retours sont déjà filtrés par Firebase pour la bonne date
        const retoursCompletes = retoursData.some(r => r.retoursCompletes === true);

        if (retoursCompletes) {
          // Mettre à jour dans Firebase
          await updateDoc(doc(db, 'factures', facture.id), {
            statut: 'validee',
            retoursCompletes: true,
            validatedAt: new Date(),
            updatedAt: new Date()
          });

          // Mettre à jour dans le state local
          set(state => ({
            factures: state.factures.map(f =>
              f.id === facture.id
                ? { ...f, statut: 'validee' as const, retoursCompletes: true, validatedAt: new Date(), updatedAt: new Date() }
                : f
            )
          }));
        }
      }

    } catch (error) {
      console.error('❌ Erreur lors de l\'actualisation des statuts:', error);
    }
  },

  modifierTauxTVA: async (factureId: string, nouveauTaux: number) => {
    try {
      const facture = get().factures.find(f => f.id === factureId);
      if (!facture) {
        throw new Error('Facture non trouvée');
      }

      // Recalculer les totaux avec le nouveau taux
      const nouveauxTotaux = get().calculerTotauxFacture(facture.lignes, nouveauTaux);

      const updateData = {
        tauxTVA: nouveauTaux,
        montantTVA: nouveauxTotaux.montantTVA,
        totalTTC: nouveauxTotaux.totalTTC,
        updatedAt: new Date()
      };

      // Mettre à jour dans Firebase
      await updateDoc(doc(db, 'factures', factureId), updateData);

      // Mettre à jour dans le state local
      set(state => ({
        factures: state.factures.map(f =>
          f.id === factureId ? { ...f, ...updateData } : f
        ),
        factureActive: state.factureActive?.id === factureId
          ? { ...state.factureActive, ...updateData }
          : state.factureActive
      }));

    } catch (error) {
      console.error('❌ Erreur lors de la modification du taux TVA:', error);
      throw error;
    }
  },

  nettoyerListeners: () => {
    const { facturesListener } = get();
    if (facturesListener) {
      facturesListener();
      set({ facturesListener: null });
      console.log('🧹 Listeners factures nettoyés');
    }
  },
}));