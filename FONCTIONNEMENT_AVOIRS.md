# Fonctionnement du Système d'Avoirs (Crédits Clients)

Ce document décrit le fonctionnement technique et fonctionnel de la gestion des avoirs (soldes clients) dans l'application de gestion de boulangerie.

## 1. Définition

L'**Avoir** représente un solde financier positif en faveur du client. Il est stocké dans la base de données sous le champ `solde` de l'objet `Client`.

*   **Solde positif (> 0)** : Le client dispose d'un crédit (argent que la boulangerie doit au client ou avance sur paiement).
*   **Solde nul (0)** : Aucun compte à rendre.
*   *Note: Les dettes (soldes négatifs) ne sont pas gérées par ce champ pour l'instant, elles sont représentées par les factures impayées.*

## 2. Création d'un Avoir (Alimentation du Solde)

Le solde d'un client augmente (crédit) dans les cas suivants :

### A. Paiement Excédentaire
Lorsqu'une facture est marquée comme **Payée** et que le montant reçu est supérieur au montant net à payer.

*   **Action** : Saisie du paiement dans le modal de paiement.
*   **Logique** : `Nouveau Solde = Ancien Solde + (Montant Reçu - Net à Payer)`
*   **Code** : `facturationStore.ts` -> `marquerPayee()`

### B. Annulation ou Suppression de Facture
Lorsqu'une facture qui avait utilisé un avoir est **Annulée** ou **Supprimée**.

*   **Action** : Annulation/Suppression d'une facture validée.
*   **Logique** : Le montant du `soldeUtilise` sur cette facture est remboursé au client.
*   **Code** : `facturationStore.ts` -> `annulerFacture()` et `supprimerFacture()`

## 3. Utilisation d'un Avoir (Déduction)

Le solde est automatiquement utilisé pour réduire le montant des nouvelles factures.

### Automatisation
Le système tente d'utiliser le solde disponible à chaque **Génération** ou **Mise à jour** de facture.

*   **Processus** : Fonction `genererFacturesDepuisLivraisons`.
*   **Calcul** :
    1.  Calcul du `Total TTC` de la facture.
    2.  Vérification du `solde` disponible du client.
    3.  Application : `Solde Utilisé = Min(Solde Disponible, Total TTC)`.
    4.  Mise à jour du net : `Net à Payer = Total TTC - Solde Utilisé`.
*   **Impact BDD** : Le solde du client est immédiatement décrémenté dans Firestore lors de la génération/validation de la facture pour éviter qu'il ne soit utilisé deux fois si plusieurs factures sont générées simultanément.

## 4. Visibilité et Suivi

### Sur la Facture
Les champs suivants permettent de tracer l'utilisation des avoirs :
*   `soldeUtilise` (Montant) : Montant de l'avoir déduit de cette facture.
*   `netAPayer` (Montant) : Le montant final réclamé au client (`Total TTC - soldeUtilise`).

### Dans l'Interface Utilisateur
*   **Modal de Paiement** : Affiche le "Net à Payer" (déjà réduit) et signale si un nouveau crédit va être généré.
*   **Détails Facture** : Une ligne "Solde antérieur utilisé" apparaît en vert si une déduction a eu lieu.
*   **Liste Clients** : Le champ `solde` est stocké sur le client et peut être consulté (à ajouter techniquement sur la fiche client pour plus de visibilité).

## 5. Résumé des Flux

| Action Utilisateur | Conséquence Financière | Conséquence sur `Client.solde` |
| :--- | :--- | :--- |
| **Payer Facture (Montant > Dû)** | Trop perçu transformé en crédit | ⬆️ Augmente |
| **Générer Facture** | Utilisation automatique du crédit existant | ⬇️ Diminue |
| **Annuler Facture** | Remboursement du crédit utilisé | ⬆️ Augmente (Restitution) |

---
*Document généré le 01/01/2026*
