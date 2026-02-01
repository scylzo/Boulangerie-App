# Gestion des Annulations de Commandes Après Production

## 📋 Problématique

Lorsqu'un client annule sa commande au dernier moment alors que les produits ont déjà été fabriqués, il faut pouvoir redistribuer ces produits soit :
- Vers la boutique
- Vers un autre client  
- Mixte (partie boutique, partie autre client)

## ✅ Solution Implémentée

### 1. **Composant Modal de Redistribution**

Fichier créé : `/src/components/production/RedistributionModal.tsx`

**Fonctionnalités :**
- ✅ Sélection du type de redistribution (Boutique / Client / Mixte)
- ✅ Choix du client destinataire (si redistribution vers client)
- ✅ Répartition détaillée par produit (si redistribution mixte)
- ✅ Saisie du motif d'annulation (obligatoire)
- ✅ Validation des quantités (total = quantité commandée)
- ✅ Interface intuitive avec codes couleur

**Interface RedistributionData :**
```typescript
interface RedistributionData {
    type: 'boutique' | 'client' | 'mixte';
    clientId?: string;
    repartition: Array<{
        produitId: string;
        quantiteVersBoutique: number;
        quantiteVersClient: number;
        clientDestinataireId?: string;
    }>;
    motif: string;
}
```

### 2. **Fonction de Redistribution dans le Store**

À ajouter dans `/src/store/productionStore.ts` :

```typescript
annulerCommandeAvecRedistribution: async (commandeId: string, redistribution: RedistributionData) => {
    const { commandesClients, quantitesBoutique, programmeActuel } = get();
    const commande = commandesClients.find(c => c.id === commandeId);
    
    if (!commande || !programmeActuel) return;

    try {
        // 1. Marquer la commande comme annulée
        set((state) => ({
            commandesClients: state.commandesClients.map(cmd =>
                cmd.id === commandeId
                    ? { 
                        ...cmd, 
                        statut: 'annulee' as const, 
                        motifAnnulation: redistribution.motif,
                        updatedAt: new Date() 
                    }
                    : cmd
            )
        }));

        // 2. Redistribuer les produits selon le type
        if (redistribution.type === 'boutique') {
            // Tout vers la boutique
            commande.produits.forEach(produit => {
                const quantiteExistante = quantitesBoutique.find(q => q.produitId === produit.produitId);
                if (quantiteExistante) {
                    get().modifierQuantiteBoutique(
                        produit.produitId,
                        quantiteExistante.quantite + produit.quantite
                    );
                } else {
                    get().ajouterQuantiteBoutique({
                        produitId: produit.produitId,
                        produit: produit.produit,
                        quantite: produit.quantite
                    });
                }
            });
        } else if (redistribution.type === 'client' && redistribution.clientId) {
            // Tout vers un autre client
            const nouvelleCommande: Omit<CommandeClient, 'id' | 'createdAt' | 'updatedAt'> = {
                clientId: redistribution.clientId,
                client: undefined, // Sera résolu par le store
                dateCommande: new Date(),
                dateLivraison: commande.dateLivraison,
                produits: commande.produits.map(p => ({
                    produitId: p.produitId,
                    produit: p.produit,
                    quantite: p.quantite,
                    prixUnitaire: p.prixUnitaire,
                    repartitionCars: p.repartitionCars
                })),
                statut: 'confirmee',
                livreurId: undefined,
                notes: `Redistribué depuis commande annulée (${commande.client?.nom || commande.clientId})`
            };
            get().ajouterCommandeClient(nouvelleCommande);
        } else if (redistribution.type === 'mixte') {
            // Répartition mixte
            redistribution.repartition.forEach(repart => {
                // Vers boutique
                if (repart.quantiteVersBoutique > 0) {
                    const quantiteExistante = quantitesBoutique.find(q => q.produitId === repart.produitId);
                    const produit = commande.produits.find(p => p.produitId === repart.produitId);
                    
                    if (quantiteExistante) {
                        get().modifierQuantiteBoutique(
                            repart.produitId,
                            quantiteExistante.quantite + repart.quantiteVersBoutique
                        );
                    } else if (produit) {
                        get().ajouterQuantiteBoutique({
                            produitId: repart.produitId,
                            produit: produit.produit,
                            quantite: repart.quantiteVersBoutique
                        });
                    }
                }

                // Vers client
                if (repart.quantiteVersClient > 0 && repart.clientDestinataireId) {
                    const produit = commande.produits.find(p => p.produitId === repart.produitId);
                    if (produit) {
                        // Chercher si une commande existe déjà pour ce client à cette date
                        const commandeExistante = commandesClients.find(c => 
                            c.clientId === repart.clientDestinataireId &&
                            new Date(c.dateLivraison).toDateString() === new Date(commande.dateLivraison).toDateString() &&
                            c.statut !== 'annulee'
                        );

                        if (commandeExistante) {
                            // Ajouter à la commande existante
                            const produitExistant = commandeExistante.produits.find(p => p.produitId === repart.produitId);
                            if (produitExistant) {
                                get().modifierCommandeClient(commandeExistante.id, {
                                    produits: commandeExistante.produits.map(p =>
                                        p.produitId === repart.produitId
                                            ? { ...p, quantite: p.quantite + repart.quantiteVersClient }
                                            : p
                                    )
                                });
                            } else {
                                get().modifierCommandeClient(commandeExistante.id, {
                                    produits: [
                                        ...commandeExistante.produits,
                                        {
                                            produitId: repart.produitId,
                                            produit: produit.produit,
                                            quantite: repart.quantiteVersClient,
                                            prixUnitaire: produit.prixUnitaire,
                                            repartitionCars: produit.repartitionCars
                                        }
                                    ]
                                });
                            }
                        } else {
                            // Créer une nouvelle commande
                            const nouvelleCommande: Omit<CommandeClient, 'id' | 'createdAt' | 'updatedAt'> = {
                                clientId: repart.clientDestinataireId,
                                client: undefined,
                                dateCommande: new Date(),
                                dateLivraison: commande.dateLivraison,
                                produits: [{
                                    produitId: repart.produitId,
                                    produit: produit.produit,
                                    quantite: repart.quantiteVersClient,
                                    prixUnitaire: produit.prixUnitaire,
                                    repartitionCars: produit.repartitionCars
                                }],
                                statut: 'confirmee',
                                livreurId: undefined,
                                notes: `Redistribué depuis commande annulée (${commande.client?.nom || commande.clientId})`
                            };
                            get().ajouterCommandeClient(nouvelleCommande);
                        }
                    }
                }
            });
        }

        // 3. Recalculer les totaux
        get().calculerTotauxParProduit();

        // 4. Sauvegarder
        await get().sauvegarderEtRecharger();

        console.log('✅ Commande annulée et produits redistribués avec succès');
    } catch (error) {
        console.error('❌ Erreur lors de la redistribution:', error);
        throw error;
    }
}
```

### 3. **Intégration dans l'Interface**

Dans le composant de gestion des commandes (ex: `ProgrammeProduction.tsx`), remplacer le bouton d'annulation simple par :

```tsx
import { RedistributionModal, RedistributionData } from '../components/production/RedistributionModal';

// État
const [showRedistributionModal, setShowRedistributionModal] = useState(false);
const [commandeARedistribuer, setCommandeARedistribuer] = useState<CommandeClient | null>(null);

// Handler
const handleAnnulerCommande = (commande: CommandeClient) => {
    const { programmeActuel } = useProductionStore();
    
    // Si le programme est déjà produit ou envoyé, afficher le modal de redistribution
    if (programmeActuel?.statut === 'produit' || programmeActuel?.statut === 'envoye') {
        setCommandeARedistribuer(commande);
        setShowRedistributionModal(true);
    } else {
        // Sinon, annulation simple
        annulerCommandeClient(commande.id);
    }
};

const handleConfirmRedistribution = async (redistribution: RedistributionData) => {
    if (!commandeARedistribuer) return;
    
    try {
        await annulerCommandeAvecRedistribution(commandeARedistribuer.id, redistribution);
        setShowRedistributionModal(false);
        setCommandeARedistribuer(null);
        // Afficher un message de succès
    } catch (error) {
        console.error(error);
        // Afficher un message d'erreur
    }
};

// Dans le JSX
<RedistributionModal
    isOpen={showRedistributionModal}
    onClose={() => {
        setShowRedistributionModal(false);
        setCommandeARedistribuer(null);
    }}
    commande={commandeARedistribuer!}
    clients={clients}
    onConfirm={handleConfirmRedistribution}
/>
```

## 🎯 Flux Complet

1. **Détection** : L'utilisateur clique sur "Annuler" pour une commande
2. **Vérification** : Le système vérifie si le programme est déjà produit
3. **Modal** : Si produit, affichage du modal de redistribution
4. **Choix** : L'utilisateur choisit comment redistribuer :
   - 🟢 Tout vers la boutique
   - 🔵 Tout vers un autre client
   - 🟣 Répartition mixte (détaillée par produit)
5. **Validation** : Saisie du motif obligatoire
6. **Exécution** :
   - Annulation de la commande
   - Ajout des quantités à la boutique et/ou
   - Création/modification de commande pour autre client
   - Recalcul des totaux
   - Sauvegarde en base
7. **Traçabilité** : Le motif est enregistré avec la commande annulée

## 📊 Avantages

✅ **Zéro perte** : Aucun produit fabriqué n'est perdu
✅ **Flexibilité** : 3 options de redistribution
✅ **Traçabilité** : Motif d'annulation enregistré
✅ **Automatisation** : Mise à jour automatique des stocks et commandes
✅ **UX optimale** : Interface claire et intuitive
✅ **Validation** : Vérification que toutes les quantités sont redistribuées

## 🔄 Prochaines Étapes

1. Ajouter la fonction `annulerCommandeAvecRedistribution` dans `productionStore.ts`
2. Intégrer le modal dans les pages de gestion des commandes
3. Tester le flux complet
4. Ajouter des notifications de succès/erreur
5. Optionnel : Ajouter un historique des redistributions dans le rapport journalier
