import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { collection, updateDoc, doc, setDoc, deleteDoc, getDoc, getDocs, query, where, orderBy } from 'firebase/firestore';
import { realTimeListeners } from '../firebase/collections';
import { db } from '../firebase/config';
import type { Facture, LigneFacture, ParametresFacturation, CommandeClient, InvendusClient, Client, Reglement, ModePaiement } from '../types';


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
  genererFacturesPourClient: (clientId: string, dateReference?: Date) => Promise<void>;
  chargerFactures: (dateDebut?: Date, dateFin?: Date, background?: boolean) => Promise<void>;
  chargerFacturesAvecListener: (dateDebut?: Date, dateFin?: Date) => void;
  chargerFacture: (factureId: string) => Promise<void>;
  validerFacture: (factureId: string) => Promise<void>;
  envoyerFacture: (factureId: string) => Promise<void>;
  marquerPayee: (factureId: string, reglements: Reglement[] | { montant: number, mode: ModePaiement, date?: Date }) => Promise<void>;
  /** Journal des règlements sur une période (par date de règlement, cross-période). */
  getReglementsPeriode: (debut: Date, fin: Date) => Promise<{ mode: ModePaiement; montant: number; date: Date; factureId: string; clientId: string }[]>;
  /** Alimente le journal 'reglements' à partir des règlements existants sur les factures (idempotent). */
  backfillReglementsJournal: () => Promise<number>;
  /** Toutes les créances ouvertes (factures non payées/annulées avec reste à payer > 0). */
  getCreances: () => Promise<Facture[]>;
  annulerFacture: (factureId: string, motif?: string) => Promise<void>;
  actualiserStatutsFactures: (clientId?: string, date?: Date) => Promise<void>;
  modifierTauxTVA: (factureId: string, nouveauTaux: number) => Promise<void>;
  supprimerFacture: (factureId: string) => Promise<void>;
  ajouterAvoirClient: (clientId: string, montant: number) => Promise<void>;

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

// Cache mémoire (session) des créances ouvertes — invalidé à chaque règlement/annulation
let _creancesCache: { at: number; data: Facture[] } | null = null;

export const useFacturationStore = create<FacturationStore>()(
  persist(
    (set, get) => ({
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


          // Récupérer les factures existantes pour cette date (DEPUIS FIRESTORE pour sécurité)


          // Bornes pour la query
          const debutJour = new Date(date); debutJour.setHours(0, 0, 0, 0);
          const finJour = new Date(date); finJour.setHours(23, 59, 59, 999);

          const qFactures = query(
            collection(db, 'factures'),
            where('dateLivraison', '>=', debutJour),
            where('dateLivraison', '<=', finJour)
          );

          const snapFactures = await getDocs(qFactures);
          const facturesExistantes = snapFactures.docs.map(doc => {
            const data = doc.data();
            return {
              ...data,
              id: doc.id,
              dateLivraison: data.dateLivraison?.toDate ? data.dateLivraison.toDate() : new Date(data.dateLivraison)
            } as Facture;
          });

          // Grouper les commandes par client (en ignorant les annulées)
          const commandesParClient = new Map<string, CommandeClient[]>();
          commandesClients.filter(c => c.statut !== 'annulee').forEach(commande => {
            const clientId = commande.clientId;
            if (!commandesParClient.has(clientId)) {
              commandesParClient.set(clientId, []);
            }
            commandesParClient.get(clientId)!.push(commande);
          });

          // a. Pré-chargement des Clients et Produits pour éviter les appels Firestore en boucle
          const allClientIds = Array.from(commandesParClient.keys());
          const allProduitIds = new Set<string>();
          commandesClients.forEach(c => c.produits.forEach(p => allProduitIds.add(p.produitId)));

          const [clientsCache, produitsCache] = await Promise.all([
            // Charger tous les clients concernés
            Promise.all(allClientIds.map(async (id) => {
              try {
                const d = await getDoc(doc(db, 'clients', id));
                return d.exists() ? { id: d.id, ...d.data() } as Client : null;
              } catch (e) { return null; }
            })).then(res => new Map<string, Client>(res.filter(c => c !== null).map(c => [c!.id, c as Client]))),

            // Charger tous les produits concernés
            Promise.all(Array.from(allProduitIds).map(async (id) => {
              try {
                const d = await getDoc(doc(db, 'produits', id));
                return d.exists() ? { id: d.id, ...d.data() } as any : null;
              } catch (e) { return null; }
            })).then(res => new Map<string, any>(res.filter(p => p !== null).map(p => [p!.id, {
              ...p,
              prixClient: p!.prixClient || 0,
              prixBoutique: p!.prixBoutique || 0,
              prixUnitaire: p!.prixUnitaire || 0
            }])))
          ]);

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

            // Récupérer les informations du client depuis le cache
            let clientInfo = clientsCache.get(clientId) as Client | undefined;

            const retoursClient = retoursClients.find(r => r.clientId === clientId);
            const retoursCompletes = get().verifierRetoursCompletes(clientId, date, retoursClients);

            // Calculer les lignes de facture avec agrégation par produit
            const lignesMap = new Map<string, LigneFacture>();

            for (const commande of commandesClient) {
              for (const produitCmd of commande.produits) {
                // Récupérer les informations complètes du produit depuis le cache
                const produitFull: any = produitsCache.get(produitCmd.produitId) || produitCmd.produit || { 
                  id: produitCmd.produitId, nom: 'Produit Inconnu', prixUnitaire: 0, prixClient: 0, prixBoutique: 0 
                };


                // Quantité totale livrée pour cette commande spécifique
                const quantiteLivree = Object.values(produitCmd.repartitionCars || {})
                  .reduce((sum, qte) => sum + (Number(qte) || 0), 0);


                if (quantiteLivree > 0) {
                  // Quantité retournée (Globale pour le client/jour, donc on doit faire attention à ne pas la compter en double)
                  // La logique actuelle des retours est stockée par "produitId" pour le client et la date.
                  // Donc si on a 2 commandes de baguette, le "retour" est global pour les baguettes de la journée.
                  // On l'ajoute une seule fois ou on le recalcule à la fin.

                  const prixUnitaire = (clientInfo?.typeClient === 'client' || commande.client?.typeClient === 'client')
                    ? (produitFull.prixClient || produitFull.prixUnitaire || 0)
                    : (produitFull.prixBoutique || produitFull.prixUnitaire || 0);

                  if (lignesMap.has(produitCmd.produitId)) {
                    // Mise à jour de la ligne existante
                    const ligneExistante = lignesMap.get(produitCmd.produitId)!;
                    ligneExistante.quantiteLivree += quantiteLivree;
                    // On ne touche pas aux retours ici, on les appliquera globalement à la fin pour éviter les doublons
                    ligneExistante.quantiteFacturee = Math.max(0, ligneExistante.quantiteLivree - ligneExistante.quantiteRetournee);
                    ligneExistante.montantLigne = ligneExistante.quantiteFacturee * prixUnitaire;
                  } else {
                    // Nouvelle ligne
                    const produitRetour = retoursClient?.produits.find(p => p.produitId === produitCmd.produitId);
                    const quantiteRetournee = produitRetour?.invendus || 0;
                    const quantiteFacturee = Math.max(0, quantiteLivree - quantiteRetournee);
                    const montantLigne = quantiteFacturee * prixUnitaire;

                    lignesMap.set(produitCmd.produitId, {
                      produitId: produitCmd.produitId,
                      produit: produitFull,
                      quantiteLivree,
                      quantiteRetournee, // On l'initialise ici, c'est correct car c'est la valeur globale jour
                      quantiteFacturee,
                      prixUnitaire,
                      montantLigne
                    });
                  }
                }
              }
            }

            const lignes = Array.from(lignesMap.values());

            if (lignes.length > 0) {
              // Calculer les totaux
              const totaux = get().calculerTotauxFacture(lignes, parametres.tauxTVADefaut);

              // Calculer l'utilisation du solde / avoir
              let soldeUtilise = 0;
              let netAPayer = totaux.totalTTC;

              // Pour le calcul du solde, on doit prendre en compte ce qui a déjà été "réservé" par cette facture
              // si on est en train de la mettre à jour.
              let soldeDisponible = clientInfo?.solde || 0;

              if (factureExistante && factureExistante.soldeUtilise) {
                // On "remet" virtuellement le solde utilisé dans le pot pour recalculer
                soldeDisponible += factureExistante.soldeUtilise;
              }

              if (soldeDisponible > 0) {
                soldeUtilise = Math.min(soldeDisponible, totaux.totalTTC);
                netAPayer = Math.max(0, totaux.totalTTC - soldeUtilise);
              }

              // Calcul de la différence à impacter sur le solde client réel
              const ancienSoldeUtilise = factureExistante?.soldeUtilise || 0;
              const differenceSolde = soldeUtilise - ancienSoldeUtilise;

              // Mise à jour du solde client si changement
              if (differenceSolde !== 0) {
                try {
                  const clientRef = doc(db, 'clients', clientId);
                  // On doit relire le solde pour être sûr (concurrence)
                  const clientsnap = await getDoc(clientRef);
                  if (clientsnap.exists()) {
                    const currentSolde = clientsnap.data().solde || 0;
                    await updateDoc(clientRef, { solde: currentSolde - differenceSolde });
                    console.log(`📉 Ajustement solde client ${clientId}: -${differenceSolde} (Facture gen)`);
                  }
                } catch (e) {
                  console.error('Erreur mise à jour solde client (gen):', e);
                }
              }

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
                // Le calcul des soldes a été fait au dessus et la déduction appliquée.


                const updates = {
                  lignes: lignesClean,
                  ...totaux,
                  soldeUtilise,
                  netAPayer,
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
                const dateKeyId = date.toISOString().split('T')[0];
                const deterministicId = `facture_${clientId}_${dateKeyId}`;

                const nouvelleFacture: Facture = {
                  id: deterministicId,
                  numeroFacture: get().genererNumeroFacture(date),
                  clientId,
                  client: clientInfo,
                  dateLivraison: date,
                  dateFacture: new Date(),
                  lignes,
                  ...totaux,
                  soldeUtilise,
                  netAPayer,
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

          set(state => {
            const facturesMisesAJour = state.factures.map(f => {
              const updated = misesAJour.find(u => u.id === f.id);
              return updated || f;
            });

            // Ajouter les nouvelles et dédupliquer par ID
            const toutesLesFactures = [...facturesMisesAJour, ...nouvelles];
            const facturesUniques = Array.from(new Map(toutesLesFactures.map(f => [f.id, f])).values());

            return {
              factures: facturesUniques,
              isLoading: false
            };
          });


        } catch (error) {
          set({ isLoading: false });
          console.error('❌ Erreur lors de la génération/mise à jour des factures:', error);
          throw error;
        }
      },

      genererFacturesPourClient: async (clientId: string, dateReference?: Date) => {
        set({ isLoading: true });
        try {
          const { parametres } = get();
          if (!parametres) {
            // Tenter de charger les paramètres si manquants
            await get().chargerParametres();
            if (!get().parametres) throw new Error('Impossible de charger les paramètres de facturation');
          }
          const params = get().parametres!;

          let dateDebut: Date;
          let dateFin: Date | null = null; // null means no upper limit if defaulting to "recent"

          if (dateReference) {
            // 1er du mois
            dateDebut = new Date(dateReference.getFullYear(), dateReference.getMonth(), 1);
            dateDebut.setHours(0, 0, 0, 0);

            // Dernier jour du mois
            dateFin = new Date(dateReference.getFullYear(), dateReference.getMonth() + 1, 0);
            dateFin.setHours(23, 59, 59, 999);
          } else {
            // Default: 60 days ago
            dateDebut = new Date();
            dateDebut.setDate(dateDebut.getDate() - 60);
          }

          // 1. Récupérer les commandes

          let commandesQuery = query(
            collection(db, 'clientOrders'),
            where('clientId', '==', clientId),
            where('dateLivraison', '>=', dateDebut),
            orderBy('dateLivraison', 'asc')
          );

          if (dateFin) {
            // Add upper bound if filtering by month
            commandesQuery = query(
              collection(db, 'clientOrders'),
              where('clientId', '==', clientId),
              where('dateLivraison', '>=', dateDebut),
              where('dateLivraison', '<=', dateFin),
              orderBy('dateLivraison', 'asc')
            );
          }

          const commandesSnap = await getDocs(commandesQuery);
          const commandes = commandesSnap.docs
            .map(d => ({ ...d.data(), id: d.id, dateLivraison: d.data().dateLivraison.toDate() })) as CommandeClient[];
          
          // Filtrer les commandes annulées
          const commandesValides = commandes.filter(c => c.statut !== 'annulee');

          if (commandesValides.length === 0) {
            console.log("Aucune commande valide trouvée pour cette période");
            set({ isLoading: false });
            return;
          }

          // 2. Récupérer les retours (invendus)
          let retoursQuery = query(
            collection(db, 'clientReturns'),
            where('clientId', '==', clientId),
            where('dateLivraison', '>=', dateDebut)
          );

          if (dateFin) {
            retoursQuery = query(
              collection(db, 'clientReturns'),
              where('clientId', '==', clientId),
              where('dateLivraison', '>=', dateDebut),
              where('dateLivraison', '<=', dateFin)
            );
          }

          const retoursSnap = await getDocs(retoursQuery);
          const retours = retoursSnap.docs.map(d => ({ ...d.data(), id: d.id, dateLivraison: d.data().dateLivraison.toDate() })) as InvendusClient[];

          // 3. Récupérer les factures existantes
          let facturesQuery = query(
            collection(db, 'factures'),
            where('clientId', '==', clientId),
            where('dateLivraison', '>=', dateDebut)
          );

          if (dateFin) {
            facturesQuery = query(
              collection(db, 'factures'),
              where('clientId', '==', clientId),
              where('dateLivraison', '>=', dateDebut),
              where('dateLivraison', '<=', dateFin)
            );
          }

          const facturesSnap = await getDocs(facturesQuery);
          const facturesExistantes = facturesSnap.docs.map(d => ({ ...d.data(), id: d.id, dateLivraison: d.data().dateLivraison.toDate() } as Facture));

          // 4. Grouper par date
          const commandesParDate = new Map<string, CommandeClient[]>();
          commandesValides.forEach(c => {
            const dateStr = c.dateLivraison.toISOString().split('T')[0];
            if (!commandesParDate.has(dateStr)) commandesParDate.set(dateStr, []);
            commandesParDate.get(dateStr)!.push(c);
          });

          // 5. Pré-chargement des données nécessaires pour optimiser la vitesse
          // a. Infos Client (Une seule fois)
          let clientInfo: Client | undefined = commandes[0]?.client;
          if (!clientInfo || !clientInfo.typeClient) {
            try {
              const d = await getDoc(doc(db, 'clients', clientId));
              if (d.exists()) {
                clientInfo = { id: d.id, ...d.data() } as Client;
              }
            } catch (e) {
              console.warn('Erreur fetch client info:', e);
            }
          }

          // b. Tous les produits impliqués (Pour éviter getDoc en boucle)
          const allProduitIds = new Set<string>();
          commandes.forEach(c => c.produits.forEach(p => allProduitIds.add(p.produitId)));
          
          const produitsCache = new Map<string, any>();
          if (allProduitIds.size > 0) {
            // Firestore ne permet pas de query IN avec plus de 10-30 éléments selon les cas,
            // mais ici on peut charger les plus fréquents ou tout simplement paralléliser les getDocs
            // car ils sont plus rapides en parallèle qu'en série dans une boucle.
            const ids = Array.from(allProduitIds);
            await Promise.all(ids.map(async (id) => {
              try {
                const pDoc = await getDoc(doc(db, 'produits', id));
                if (pDoc.exists()) {
                  const d = pDoc.data();
                  produitsCache.set(id, {
                    id: pDoc.id,
                    ...d,
                    prixClient: d.prixClient || 0,
                    prixBoutique: d.prixBoutique || 0,
                    prixUnitaire: d.prixUnitaire || 0
                  } as any);
                }
              } catch (e) { console.error(`Erreur cache produit ${id}:`, e); }
            }));
          }

          const misesAJour: Facture[] = [];
          const nouvelles: Facture[] = [];

          // 6. Itérer sur chaque date
          for (const [dateStr, commandesJour] of commandesParDate) {
            const dateObj = new Date(dateStr);
            const factureExistante = facturesExistantes.find(f => f.dateLivraison.toISOString().split('T')[0] === dateStr);

            // Si facture bloquée, skip
            if (factureExistante && ['payee', 'envoyee', 'annulee'].includes(factureExistante.statut)) {
              continue;
            }

            const retoursJour = retours.filter(r => r.dateLivraison.toISOString().split('T')[0] === dateStr);
            const retoursCompletes = get().verifierRetoursCompletes(clientId, dateObj, retoursJour);

            // Calcul lignes
            const lignesMap = new Map<string, LigneFacture>();

            for (const cmd of commandesJour) {
              for (const pCmd of cmd.produits) {
                const qte = Object.values(pCmd.repartitionCars || {}).reduce((s, q) => s + (Number(q) || 0), 0);
                if (qte <= 0) continue;

                // Utiliser le cache
                const produitRef: any = produitsCache.get(pCmd.produitId) || pCmd.produit || { id: pCmd.produitId, nom: 'Produit Inconnu', prixUnitaire: 0 };
                
                // Prix selon type client
                const prixUnitaire = (clientInfo?.typeClient === 'client')
                  ? (produitRef.prixClient || produitRef.prixUnitaire || 0)
                  : (produitRef.prixBoutique || produitRef.prixUnitaire || 0);

                if (lignesMap.has(pCmd.produitId)) {
                  const l = lignesMap.get(pCmd.produitId)!;
                  l.quantiteLivree += qte;
                } else {
                  // Chercher retour pour ce produit
                  const retourProd = retoursJour.find(r => r.produits.some(rp => rp.produitId === pCmd.produitId));
                  const retourItem = retourProd?.produits.find(rp => rp.produitId === pCmd.produitId);
                  const qteRetour = retourItem?.invendus || 0;

                  lignesMap.set(pCmd.produitId, {
                    produitId: pCmd.produitId,
                    produit: produitRef,
                    quantiteLivree: qte,
                    quantiteRetournee: qteRetour,
                    quantiteFacturee: 0,
                    prixUnitaire,
                    montantLigne: 0
                  });
                }
              }
            }

            // Finaliser lignes
            const lignes = Array.from(lignesMap.values()).map(l => {
              const retourGlob = retoursJour.flatMap(r => r.produits).find(rp => rp.produitId === l.produitId);
              if (retourGlob) l.quantiteRetournee = retourGlob.invendus || 0;

              l.quantiteFacturee = Math.max(0, l.quantiteLivree - l.quantiteRetournee);
              l.montantLigne = l.quantiteFacturee * l.prixUnitaire;
              return l;
            });

            if (lignes.length === 0) continue;

            // Préparer les données pour Firestore (nettoyage des undefined)
            const lignesClean = lignes.map(l => ({
              produitId: l.produitId,
              quantiteLivree: l.quantiteLivree,
              quantiteRetournee: l.quantiteRetournee,
              quantiteFacturee: l.quantiteFacturee,
              prixUnitaire: l.prixUnitaire,
              montantLigne: l.montantLigne,
              produit: l.produit ? {
                id: (l.produit as any).id,
                nom: (l.produit as any).nom,
                prixUnitaire: (l.produit as any).prixUnitaire || 0,
                prixClient: (l.produit as any).prixClient || 0,
                prixBoutique: (l.produit as any).prixBoutique || 0
              } : null
            }));

            const clientClean = clientInfo ? {
              id: clientInfo.id,
              nom: clientInfo.nom,
              adresse: clientInfo.adresse || '',
              telephone: clientInfo.telephone || '',
              email: clientInfo.email || '',
              typeClient: clientInfo.typeClient,
            } : null;

            const totaux = get().calculerTotauxFacture(lignes, params.tauxTVADefaut);

            let soldeUtilise = 0;
            if (factureExistante) soldeUtilise = factureExistante.soldeUtilise || 0;

            const netAPayer = Math.max(0, totaux.totalTTC - soldeUtilise);

            // Données de mise à jour pour Firestore
            const updatesFirestore = {
              lignes: lignesClean,
              ...totaux,
              soldeUtilise,
              netAPayer,
              statut: retoursCompletes ? 'validee' : 'en_attente_retours',
              retoursCompletes,
              updatedAt: new Date()
            } as any;

            if (factureExistante) {
              if (retoursCompletes && factureExistante.statut !== 'validee') updatesFirestore.validatedAt = new Date();
              await updateDoc(doc(db, 'factures', factureExistante.id), updatesFirestore);

              // Mettre à jour dans le state local avec les objets complets
              misesAJour.push({
                ...factureExistante,
                ...updatesFirestore,
                lignes,
                client: clientInfo
              });
            } else {
              const dateKey = dateObj.toISOString().split('T')[0];
              const newId = `facture_${clientId}_${dateKey}`;

              const newFactureForUI = {
                id: newId,
                numeroFacture: get().genererNumeroFacture(dateObj),
                clientId,
                client: clientInfo,
                dateLivraison: dateObj,
                dateFacture: new Date(),
                lignes,
                ...totaux,
                soldeUtilise,
                netAPayer,
                statut: retoursCompletes ? 'validee' : 'en_attente_retours',
                retoursCompletes,
                createdAt: new Date(),
                updatedAt: new Date(),
                conditionsPaiement: clientInfo?.conditionsPaiement || params.conditionsPaiementDefaut,
                tauxTVA: params.tauxTVADefaut
              };

              const newFactureForFirestore = {
                ...newFactureForUI,
                lignes: lignesClean,
                client: clientClean
              };

              await setDoc(doc(db, 'factures', newId), newFactureForFirestore, { merge: true });
              nouvelles.push(newFactureForUI as Facture);
            }
          }

          set(state => {

            const facturesMisesAJour = state.factures.map(f => {
              const updated = misesAJour.find(u => u.id === f.id);
              return updated || f;
            });

            // Ajouter les nouvelles et dédupliquer par ID
            const toutesLesFactures = [...facturesMisesAJour, ...nouvelles];
            const facturesUniques = Array.from(new Map(toutesLesFactures.map(f => [f.id, f])).values());

            return {
              factures: facturesUniques,
              isLoading: false
            };
          });


        } catch (error) {
          console.error(error);
          set({ isLoading: false });
          throw error;
        }
      },

      chargerFactures: async (dateDebut?: Date, dateFin?: Date, background: boolean = false) => {
        if (!background) set({ isLoading: true });

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
                reglements: data.reglements ? data.reglements.map((r: any) => ({
                  ...r,
                  date: r.date && typeof r.date.toDate === 'function' ? r.date.toDate() : (r.date ? new Date(r.date) : new Date())
                })) : undefined,
              } as Facture;
            });

            // Déduplication par ID pour éviter les doublons
            const facturesUniques = Array.from(
              new Map(facturesData.map(f => [f.id, f])).values()
            );

            set({ factures: facturesUniques });
          } else {
            set({ factures: [] });
          }

          if (!background) set({ isLoading: false });
        } catch (error) {
          if (!background) set({ isLoading: false });
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
              reglements: data.reglements ? data.reglements.map((r: any) => ({
                ...r,
                date: r.date && typeof r.date.toDate === 'function' ? r.date.toDate() : (r.date ? new Date(r.date) : new Date())
              })) : undefined,
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

          // LOGIQUE DE DÉDUCTION DU SOLDE EST MAINTENANT DANS LA GÉNÉRATION DE FACTURE
          // On ne déduit pas ici pour éviter les doublons si l'utilisateur régénère ou valide manuellement.
          // La déduction se fait au moment de la création/mise à jour de la facture (réservation du solde).

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

      marquerPayee: async (factureId: string, input: Reglement[] | { montant: number, mode: ModePaiement, date?: Date }) => {
        try {
          const facture = get().factures.find(f => f.id === factureId);
          if (!facture) throw new Error("Facture introuvable");

          const nouveauxReglements: Reglement[] = (Array.isArray(input) ? input : [{
            id: `reg_${Date.now()}`,
            montant: input.montant,
            mode: input.mode,
            date: input.date || new Date()
          }]).map((r: any) => ({
            ...r,
            date: r.date && typeof r.date.toDate === 'function' ? r.date.toDate() : (r.date ? new Date(r.date) : new Date())
          }));

          // Récupérer et nettoyer les anciens règlements
          const anciensReglements = (facture.reglements || []).map((r: any) => ({
            ...r,
            date: r.date && typeof r.date.toDate === 'function' ? r.date.toDate() : (r.date ? new Date(r.date) : new Date())
          }));

          // Fusionner les règlements
          const reglements = [...anciensReglements, ...nouveauxReglements];

          const totalVerse = reglements.reduce((sum, r) => sum + r.montant, 0);
          const montantAttendu = facture.netAPayer ?? facture.totalTTC;

          const isTotalPaye = totalVerse >= montantAttendu;

          const updateData: any = {
            statut: isTotalPaye ? 'payee' : 'partiellement_payee',
            paidAt: isTotalPaye ? reglements[reglements.length - 1].date : null,
            montantRegle: totalVerse,
            reglements: reglements,
            modePaiement: reglements[0]?.mode || 'espece', // Principal mode (le premier saisi)
            updatedAt: new Date()
          };

          // Gestion du surplus (Avoir/Solde) sur la transaction courante uniquement
          const nouveauVersement = nouveauxReglements.reduce((sum, r) => sum + r.montant, 0);
          const resteAEncasser = Math.max(0, montantAttendu - (facture.montantRegle || 0));
          const surplus = Math.max(0, nouveauVersement - resteAEncasser);

          if (surplus > 0) {
            const clientRef = doc(db, 'clients', facture.clientId);
            const clientDoc = await getDoc(clientRef);
            if (clientDoc.exists()) {
              const soldeActuel = clientDoc.data().solde || 0;
              const nouveauSolde = soldeActuel + surplus;
              await updateDoc(clientRef, { solde: nouveauSolde });
              console.log(`💰 Avoir généré: +${surplus} FCFA (Nouveau solde: ${nouveauSolde})`);
            }
          }

          await updateDoc(doc(db, 'factures', factureId), updateData);

          // Journal des règlements (collection interrogeable par date de règlement).
          // Id déterministe -> écriture idempotente (pas de doublon si rejoué).
          try {
            await Promise.all(nouveauxReglements.map(r =>
              setDoc(doc(db, 'reglements', `${factureId}_${r.id}`), {
                factureId,
                clientId: facture.clientId,
                mode: r.mode,
                montant: r.montant,
                date: r.date,
                reference: (r as any).reference || null,
              })
            ));
          } catch (e) {
            console.error('Erreur journal règlements:', e);
          }

          _creancesCache = null; // un paiement change les créances

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

      getReglementsPeriode: async (debut: Date, fin: Date) => {
        try {
          const q = query(collection(db, 'reglements'), where('date', '>=', debut), where('date', '<=', fin));
          const snap = await getDocs(q);
          return snap.docs.map(d => {
            const x = d.data() as any;
            return {
              mode: x.mode as ModePaiement,
              montant: x.montant || 0,
              date: x.date?.toDate ? x.date.toDate() : new Date(x.date),
              factureId: x.factureId,
              clientId: x.clientId,
            };
          });
        } catch (e) {
          console.error('Erreur getReglementsPeriode:', e);
          return [];
        }
      },

      backfillReglementsJournal: async () => {
        try {
          const snap = await getDocs(collection(db, 'factures'));
          const ops: Promise<any>[] = [];
          let n = 0;
          snap.docs.forEach(d => {
            const f = d.data() as any;
            (f.reglements || []).forEach((r: any) => {
              if (!r?.id) return;
              const date = r.date?.toDate ? r.date.toDate() : (r.date ? new Date(r.date) : null);
              if (!date) return;
              ops.push(setDoc(doc(db, 'reglements', `${d.id}_${r.id}`), {
                factureId: d.id,
                clientId: f.clientId,
                mode: r.mode,
                montant: r.montant,
                date,
                reference: r.reference || null,
              }));
              n++;
            });
          });
          await Promise.all(ops);
          console.log(`✅ Journal règlements alimenté : ${n} règlement(s)`);
          return n;
        } catch (e) {
          console.error('Erreur backfill règlements:', e);
          return 0;
        }
      },

      getCreances: async () => {
        // Cache court (10 min) — évite de relire à chaque ouverture de l'écran Créances
        if (_creancesCache && Date.now() - _creancesCache.at < 10 * 60 * 1000) {
          return _creancesCache.data;
        }
        try {
          // Requête ciblée : seulement les statuts ouverts (champ unique -> pas d'index composite)
          const q = query(
            collection(db, 'factures'),
            where('statut', 'in', ['validee', 'envoyee', 'partiellement_payee', 'en_attente_retours'])
          );
          const snap = await getDocs(q);
          const creances = snap.docs.map(d => {
            const data = d.data() as any;
            return {
              ...data,
              dateLivraison: data.dateLivraison?.toDate ? data.dateLivraison.toDate() : new Date(data.dateLivraison),
              dateFacture: data.dateFacture?.toDate ? data.dateFacture.toDate() : (data.dateFacture ? new Date(data.dateFacture) : undefined),
              echeance: data.echeance?.toDate ? data.echeance.toDate() : (data.echeance ? new Date(data.echeance) : undefined),
              reglements: data.reglements ? data.reglements.map((r: any) => ({
                ...r,
                date: r.date?.toDate ? r.date.toDate() : (r.date ? new Date(r.date) : new Date())
              })) : undefined,
            } as Facture;
          })
            // Reste réellement dû > 0
            .filter(f => (f.netAPayer ?? (f.totalTTC - (f.montantRegle || 0))) > 0);

          _creancesCache = { at: Date.now(), data: creances };
          return creances;
        } catch (e) {
          console.error('Erreur getCreances:', e);
          return [];
        }
      },

      annulerFacture: async (factureId: string, motif?: string) => {
        _creancesCache = null; // une annulation change les créances
        try {
          const updateData = {
            statut: 'annulee' as const,
            notes: motif || 'Facture annulée',
            updatedAt: new Date()
          };

          // REMBOURSEMENT DU SOLDE SI UTILISÉ
          const facture = get().factures.find(f => f.id === factureId);
          if (facture && facture.soldeUtilise && facture.soldeUtilise > 0) {
            try {
              const clientRef = doc(db, 'clients', facture.clientId);
              const snap = await getDoc(clientRef);
              if (snap.exists()) {
                const s = snap.data().solde || 0;
                await updateDoc(clientRef, { solde: s + facture.soldeUtilise });
                console.log(`💰 Remboursement solde suite annulation: +${facture.soldeUtilise}`);
              }
            } catch (e) {
              console.error("Erreur remboursement solde:", e);
            }
          }

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
          // REMBOURSEMENT DU SOLDE SI UTILISÉ (Même logique que annulation)
          const facture = get().factures.find(f => f.id === factureId);
          if (facture && facture.soldeUtilise && facture.soldeUtilise > 0) {
            try {
              const clientRef = doc(db, 'clients', facture.clientId);
              const snap = await getDoc(clientRef);
              if (snap.exists()) {
                const s = snap.data().solde || 0;
                await updateDoc(clientRef, { solde: s + facture.soldeUtilise });
                console.log(`💰 Remboursement solde suite suppression: +${facture.soldeUtilise}`);
              }
            } catch (e) {
              console.error("Erreur remboursement solde:", e);
            }
          }

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

      ajouterAvoirClient: async (clientId: string, montant: number) => {
        try {
          const clientRef = doc(db, 'clients', clientId);
          const snap = await getDoc(clientRef);

          if (snap.exists()) {
            const soldeActuel = snap.data().solde || 0;
            const nouveauSolde = soldeActuel + montant;

            await updateDoc(clientRef, {
              solde: nouveauSolde,
              updatedAt: new Date()
            });
            console.log(`💰 Avoir ajouté pour client ${clientId}: +${montant} (Nouveau solde: ${nouveauSolde})`);
          }
        } catch (error) {
          console.error('❌ Erreur ajout avoir:', error);
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

      actualiserStatutsFactures: async (clientId?: string, date?: Date) => {
        try {
          const { factures, verifierRetoursCompletes } = get();
          
          // Si on a un client et une date, on cible uniquement cette facture
          if (clientId && date) {
            const dateStr = date.toISOString().split('T')[0];
            const facture = factures.find(f => 
              f.clientId === clientId && 
              f.dateLivraison.toISOString().split('T')[0] === dateStr &&
              f.statut === 'en_attente_retours'
            );

            if (facture) {
              const dateDebut = new Date(date); dateDebut.setHours(0, 0, 0, 0);
              const dateFin = new Date(date); dateFin.setHours(23, 59, 59, 999);

              const retoursSnap = await getDocs(query(
                collection(db, 'clientReturns'),
                where('clientId', '==', clientId),
                where('dateLivraison', '>=', dateDebut),
                where('dateLivraison', '<=', dateFin)
              ));

              const retoursData = retoursSnap.docs.map(doc => ({
                ...doc.data(),
                dateLivraison: doc.data().dateLivraison.toDate()
              })) as InvendusClient[];

              const isComplete = verifierRetoursCompletes(clientId, date, retoursData);

              if (isComplete) {
                const updateData = {
                  statut: 'validee' as const,
                  retoursCompletes: true,
                  validatedAt: new Date(),
                  updatedAt: new Date()
                };

                await updateDoc(doc(db, 'factures', facture.id), updateData);

                set(state => ({
                  factures: state.factures.map(f => f.id === facture.id ? { ...f, ...updateData } : f)
                }));
                console.log(`✅ Facture ${facture.numeroFacture} actualisée (Ciblée)`);
              }
            }
            return;
          }

          // Sinon, traitement par lot pour toutes les factures en attente (Background)
          const facturesEnAttente = factures.filter(f => f.statut === 'en_attente_retours');
          if (facturesEnAttente.length === 0) return;

          console.log(`🔄 Actualisation de ${facturesEnAttente.length} factures en attente...`);

          // Pour optimiser, on pourrait charger tous les retours récents en une fois, 
          // mais ici on garde la logique par facture pour la sécurité, en limitant le parallélisme si besoin.
          // Pour l'instant, on traite en série pour éviter de surcharger Firebase
          for (const facture of facturesEnAttente) {
            const d = facture.dateLivraison;
            const dateDebut = new Date(d); dateDebut.setHours(0, 0, 0, 0);
            const dateFin = new Date(d); dateFin.setHours(23, 59, 59, 999);

            const retoursSnap = await getDocs(query(
              collection(db, 'clientReturns'),
              where('clientId', '==', facture.clientId),
              where('dateLivraison', '>=', dateDebut),
              where('dateLivraison', '<=', dateFin)
            ));

            const retoursData = retoursSnap.docs.map(doc => ({
              ...doc.data(),
              dateLivraison: doc.data().dateLivraison.toDate()
            })) as InvendusClient[];

            if (verifierRetoursCompletes(facture.clientId, d, retoursData)) {
              const updateData = {
                statut: 'validee' as const,
                retoursCompletes: true,
                validatedAt: new Date(),
                updatedAt: new Date()
              };
              await updateDoc(doc(db, 'factures', facture.id), updateData);
              set(state => ({
                factures: state.factures.map(f => f.id === facture.id ? { ...f, ...updateData } : f)
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
    }),
    {
      name: 'facturation-storage',
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          return JSON.parse(str, (_key, value) => {
            if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
              return new Date(value);
            }
            return value;
          });
        },
        setItem: (name, value) => localStorage.setItem(name, JSON.stringify(value)),
        removeItem: (name) => localStorage.removeItem(name),
      })),
      partialize: (state) => ({
        parametres: state.parametres,
      }) as unknown as FacturationStore,
    }
  )
);
