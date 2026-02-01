# 🔧 GUIDE D'INSERTION MANUELLE - annulerCommandeAvecRedistribution

## 📍 Où insérer la fonction

**Fichier**: `/src/store/productionStore.ts`
**Position**: Après la fonction `annulerCommandeClient` (ligne ~664)
**Avant**: La fonction `supprimerProduitDeCommande` (ligne ~666)

## ✂️ Instructions Pas à Pas

### Étape 1: Ouvrir le fichier
Ouvrez `/src/store/productionStore.ts` dans votre éditeur

### Étape 2: Localiser la fonction annulerCommandeClient
Cherchez cette fonction (vers la ligne 654):
```typescript
annulerCommandeClient: (id) => {
  set((state) => ({
    commandesClients: state.commandesClients.map(cmd =>
      cmd.id === id
        ? { ...cmd, statut: 'annulee' as const, updatedAt: new Date() }
        : cmd
    )
  }));
  setTimeout(() => get().calculerTotauxParProduit(), 0);
},
```

### Étape 3: Ajouter la nouvelle fonction
**Juste après** la virgule de fermeture de `annulerCommandeClient` (ligne ~664),
**et avant** `supprimerProduitDeCommande` (ligne ~666),
**copiez-collez** le code suivant:

```typescript
annulerCommandeAvecRedistribution: async (commandeId: string, redistribution: RedistributionData) => {
  const { commandesClients, quantitesBoutique, programmeActuel } = get();
  const commande = commandesClients.find(c => c.id === commandeId);
  
  if (!commande || !programmeActuel) {
    throw new Error('Commande ou programme introuvable');
  }

  try {
    console.log('🔄 Annulation avec redistribution:', redistribution.type);

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

    if (redistribution.type === 'boutique') {
      console.log('📦 Redistribution vers boutique');
      commande.produits.forEach(produit => {
        const quantiteExistante = quantitesBoutique.find(q => q.produitId === produit.produitId);
        if (quantiteExistante) {
          get().modifierQuantiteBoutique(produit.produitId, quantiteExistante.quantite + produit.quantite);
        } else {
          get().ajouterQuantiteBoutique({
            produitId: produit.produitId,
            produit: produit.produit,
            quantite: produit.quantite
          });
        }
      });
    } else if (redistribution.type === 'client' && redistribution.clientId) {
      console.log('👤 Redistribution vers client:', redistribution.clientId);
      const commandeExistante = commandesClients.find(c => 
        c.clientId === redistribution.clientId &&
        new Date(c.dateLivraison).toDateString() === new Date(commande.dateLivraison).toDateString() &&
        c.statut !== 'annulee'
      );

      if (commandeExistante) {
        const nouveauxProduits = [...commandeExistante.produits];
        commande.produits.forEach(produit => {
          const produitExistant = nouveauxProduits.find(p => p.produitId === produit.produitId);
          if (produitExistant) {
            produitExistant.quantite += produit.quantite;
          } else {
            nouveauxProduits.push({
              produitId: produit.produitId,
              produit: produit.produit,
              quantite: produit.quantite,
              prixUnitaire: produit.prixUnitaire,
              repartitionCars: produit.repartitionCars
            });
          }
        });
        get().modifierCommandeClient(commandeExistante.id, {
          produits: nouveauxProduits,
          notes: (commandeExistante.notes || '') + `\n[Redistribué depuis ${commande.client?.nom || commande.clientId}]`
        });
      } else {
        const nouvelleCommande: Omit<CommandeClient, 'id' | 'createdAt' | 'updatedAt'> = {
          clientId: redistribution.clientId,
          client: undefined,
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
      }
    } else if (redistribution.type === 'mixte') {
      console.log('🔀 Redistribution mixte');
      redistribution.repartition.forEach(repart => {
        const produit = commande.produits.find(p => p.produitId === repart.produitId);
        if (!produit) return;

        if (repart.quantiteVersBoutique > 0) {
          const quantiteExistante = quantitesBoutique.find(q => q.produitId === repart.produitId);
          if (quantiteExistante) {
            get().modifierQuantiteBoutique(repart.produitId, quantiteExistante.quantite + repart.quantiteVersBoutique);
          } else {
            get().ajouterQuantiteBoutique({
              produitId: repart.produitId,
              produit: produit.produit,
              quantite: repart.quantiteVersBoutique
            });
          }
        }

        if (repart.quantiteVersClient > 0 && repart.clientDestinataireId) {
          const commandeExistante = commandesClients.find(c => 
            c.clientId === repart.clientDestinataireId &&
            new Date(c.dateLivraison).toDateString() === new Date(commande.dateLivraison).toDateString() &&
            c.statut !== 'annulee'
          );

          if (commandeExistante) {
            const produitExistant = commandeExistante.produits.find(p => p.produitId === repart.produitId);
            if (produitExistant) {
              get().modifierCommandeClient(commandeExistante.id, {
                produits: commandeExistante.produits.map(p =>
                  p.produitId === repart.produitId ? { ...p, quantite: p.quantite + repart.quantiteVersClient } : p
                )
              });
            } else {
              get().modifierCommandeClient(commandeExistante.id, {
                produits: [...commandeExistante.produits, {
                  produitId: repart.produitId,
                  produit: produit.produit,
                  quantite: repart.quantiteVersClient,
                  prixUnitaire: produit.prixUnitaire,
                  repartitionCars: produit.repartitionCars
                }]
              });
            }
          } else {
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
      });
    }

    get().calculerTotauxParProduit();
    await get().sauvegarderEtRecharger();
    console.log('✅ Commande annulée et produits redistribués avec succès');
  } catch (error) {
    console.error('❌ Erreur lors de la redistribution:', error);
    throw error;
  }
},
```

### Étape 4: Vérifier
Après l'insertion, votre code devrait ressembler à:
```typescript
annulerCommandeClient: (id) => {
  // ... code existant ...
},

annulerCommandeAvecRedistribution: async (commandeId: string, redistribution: RedistributionData) => {
  // ... nouveau code ...
},

supprimerProduitDeCommande: (commandeId, produitIndex) => {
  // ... code existant ...
},
```

### Étape 5: Sauvegarder
Sauvegardez le fichier. TypeScript devrait compiler sans erreur.

## ✅ Vérification

Les modifications suivantes ont déjà été faites automatiquement:
- ✅ Interface `RedistributionData` ajoutée (ligne ~8)
- ✅ Signature de fonction ajoutée dans `ProductionStore` (ligne ~73)

Il ne reste qu'à:
- ⏳ Ajouter l'implémentation de la fonction (ce guide)

## 🎯 Prochaine Étape

Une fois la fonction insérée, passez à l'intégration dans `PageLivraison.tsx` !
