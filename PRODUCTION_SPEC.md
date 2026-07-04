# Écran « Programme de Production » — Cahier des charges fonctionnel

> À soumettre à Claude Design pour repenser l'UI. Ce document décrit **exactement** toutes les
> fonctionnalités de l'écran `/production` de l'app « Chez Mina » (boulangerie, Abidjan, FCFA, français).
> Le design system « Monochrome Pro » du projet est déjà disponible (composants + tokens).

---

## 0. Objectif de l'écran
Préparer, pour **une date donnée**, le **programme de production** du fournil = l'agrégation de :
1. les **commandes clients** du jour, et
2. les **quantités boutique** (vente directe),
puis **envoyer** ce programme au boulanger et, en fin de journée, **clôturer** la production.

Chaque quantité est répartie sur **3 « cars » de livraison** :
- **Car 1 – Matin** (06:00–10:00)
- **Car 2 – Matin** (08:00–12:00)
- **Car – Soir** (15:00–19:00)

---

## 1. Cycle de vie / statuts du programme
Le programme a un **statut** qui pilote les actions disponibles :
- `brouillon` → en cours de préparation.
- `modifié` → modifié après un premier envoi.
- `envoyé` → transmis au boulanger.
- `produit` → production clôturée / verrouillée.

Règle : dès que le statut est `envoyé`, `modifié` ou `produit`, **annuler** une commande n'est plus une simple suppression → cela déclenche une **redistribution** (voir §5.4).

---

## 2. Données manipulées
- **Programme** (`programmeActuel`) : date, statut, `totauxParProduit[]`.
- **Commande client** : `clientId`, `dateLivraison`, `statut` (dont `annulee`), `produits[]` avec pour chaque produit : `produitId`, `quantiteCommandee`, `prixUnitaire`, et `repartitionCars { car1_matin, car2_matin, car_soir }`.
- **Quantité boutique** : `produitId`, `quantite`, `repartitionCars { car1_matin, car2_matin, car_soir }`.
- **Total par produit** (`totauxParProduit[]`) : `produit`, `totalGlobal`, `totalClient`, `totalBoutique`, `repartitionCar1Matin`, `repartitionCar2Matin`, `repartitionCarSoir`.
- **Client** : `nom`, `estRegulier`, `active`, `aKiosque`, `neTravaillePasDimanche`, `livreurId`, `livreursParCar { car1_matin, car2_matin, car_soir }`, `telephone`.
- **Livreur** : `id`, `nom`.
- Chargement **temps réel** (listener Firebase sur la date sélectionnée) + rafraîchissement au retour sur l'onglet.

---

## 3. En-tête & barre d'actions globales
1. **Titre** « Programme de production » + sous-titre + pastille icône.
2. **Badge de statut** (brouillon / modifié / envoyé au four / production validée), couleur selon statut.
3. **Stepper** visuel du cycle : Brouillon → Envoyé au four → Produit (étape active mise en avant).
4. **Sélecteur de date de production** : change la date → recharge le programme correspondant. Affiche la date en toutes lettres + la date/heure de création du programme.
5. **Bouton « Envoyer / Renvoyer le programme »** (§5.6) — libellé « Envoyer » si brouillon, sinon « Renvoyer ».
6. **Bouton « Rapport PDF »** : génère et télécharge le PDF du programme de production.
7. **Bouton « Valider la production »** (« Clôturer ») : visible seulement si statut `envoyé` ou `modifié` (§5.7).

---

## 4. Section « Commandes Clients »
### 4.1 En-tête de section
- Icône + titre + **compteur** de commandes.
- **Champ de recherche** client (filtre en direct la liste par nom ; bouton d'effacement ; affiche « X sur N commande(s) »).
- **Bouton « Nouvelle commande »** (ouvre le formulaire, §5.1).

### 4.2 Alerte « Clients réguliers manquants »
- Calcule les clients `estRegulier && active` qui **n'ont pas** de commande ce jour.
- Affiche un encart d'alerte listant ces clients sous forme de **puces cliquables** → un clic ouvre directement la création de commande **pré-remplie** pour ce client.

### 4.3 État vide
- Si aucune commande (ou aucune ne correspond à la recherche) : message + CTA « Ajouter la première commande » (ou « Effacer la recherche »).

### 4.4 Carte de commande (une par client)
En-tête :
- Avatar + **nom du client**.
- **Date de livraison**.
- **Badge « Repos Dimanche ! »** (clignotant) si la date est un dimanche et que le client `neTravaillePasDimanche`.
- **Badge « ANNULÉE »** si la commande est annulée.
- **Montant total** de la commande (FCFA) + **nombre d'articles**.

Sous-bloc « Produits commandés » (compteur d'items) avec **4 actions de commande** :
- **Bon de livraison** (icône) : génère un bon imprimable (HTML) ; résout intelligemment le(s) **livreur(s)** affecté(s) selon les cars actifs (`livreursParCar` sinon `livreurId`).
- **Ajouter des produits** : ouvre le formulaire en mode ajout (fusionne avec la commande existante).
- **Annuler la commande** : voir §5.4.
- **Supprimer définitivement** : voir §5.5.

Liste des produits (grille) — pour chaque produit :
- Icône produit (déduite du nom : baguette, pain, croissant, brioche, tarte, gâteau, sandwich, viennoiserie…), **nom**, **quantité** (`x N`), **sous-total** (FCFA).
- Boutons **Modifier ce produit** (§5.3) et **Supprimer ce produit** (§5.8).
- **Répartition par cars** (si définie) : puces « Car 1M : n », « Car 2M : n », « Car S : n ».

### 4.5 Stats résumé de la section
Bandeau : **nb de commandes** · **nb d'articles** · **total FCFA**.

---

## 5. Formulaires, modals & actions (détail)
### 5.1 Nouvelle commande — modal `CommandeClientForm`
- Sélection client + date (pré-remplies selon le contexte) + ajout de produits (quantités, prix, répartition par cars).
- **Anti-doublon** : si une commande existe déjà pour ce client à cette date, les produits sont **fusionnés** (un même produit est remplacé, un nouveau est ajouté) au lieu de créer un doublon.

### 5.2 Ajout de produits à une commande existante — même modal, mode « addProducts »
- Fusionne les nouveaux produits avec ceux existants (remplace si même produit, ajoute sinon).

### 5.3 Modifier un produit précis — modal `ModifierProduitForm`
- Édite un seul produit d'une commande (quantité, prix, répartition).

### 5.4 Annuler une commande
- Si statut programme = `brouillon`/`modifié` (avant envoi) → **confirmation** (type warning) puis annulation simple.
- Si statut = `envoyé`/`modifié`/`produit` (déjà transmis) → ouvre la **modal de Redistribution** (`RedistributionModal`) : permet de **réaffecter les produits** de la commande annulée (vers d'autres clients / boutique) pour ne pas perdre la production déjà lancée.

### 5.5 Supprimer une commande définitivement
- **Confirmation** (type danger, action irréversible) puis suppression.

### 5.6 Envoyer / Renvoyer le programme au boulanger
- **Validations** avant envoi ; si problème détecté (aucune commande, aucun produit, toutes annulées, produit à quantité 0) → confirmation « Envoyer malgré tout ».
- Sinon → **récapitulatif de confirmation** : nb de commandes valides, nb de types de produits, nb de produits boutique.
- Passe le statut à `envoyé`.

### 5.7 Valider / Clôturer la production
- **Confirmation** expliquant : passage en « Terminé », **verrouillage** du programme, et **rappel** de faire la « Déclaration de Consommation » (menu Stocks) pour mettre à jour l'inventaire.
- Passe le statut à `produit`.

### 5.8 Supprimer un produit d'une commande
- **Confirmation** ; message spécial si c'est le **dernier** produit (⚠️ supprime toute la commande).

### 5.9 Confirmations
- Toutes les actions destructrices/critiques passent par une modal de confirmation typée (info / warning / danger).

---

## 6. Section « Quantités Boutique »
- En-tête + **bouton « Ajouter produit »** (ouvre `QuantiteBoutiqueForm`).
- **État vide** : CTA « Ajouter le premier produit ».
- **Grille de cartes** — une par produit boutique :
  - Icône + **nom** + **quantité** (n pièces).
  - Actions **Modifier** / **Supprimer** (apparaissent au survol).
  - **Répartition par cars** (Car 1M / Car 2M / Car S) avec quantités.
- **Bandeau de stats** : nb produits boutique · total pièces · sous-totaux **Car 1M / Car 2M / Car S**.
- **Bouton d'action flottant** (FAB, bas-droite) pour ajouter rapidement un produit boutique.
- Modal `QuantiteBoutiqueForm` : création **ou** édition (remplace automatiquement si le produit existe déjà) avec répartition par cars.

---

## 7. Section « Programme de Production » (synthèse / totaux)
Visible seulement s'il y a des totaux. Sous-titre : « Répartition des quantités par produit et par car de livraison ».

### 7.1 KPI par car (4 cartes)
- **Car 1 – Matin** (06:00–10:00) : total pièces.
- **Car 2 – Matin** (08:00–12:00) : total pièces.
- **Car – Soir** (15:00–19:00) : total pièces.
- **Total Général** : somme toutes livraisons.

### 7.2 Détail par produit (grille de cartes)
Pour chaque produit :
- Icône + **nom** + **total global** (pièces).
- **Répartition Clients vs Boutique** (deux compteurs).
- **Planning de livraison** : ligne par car actif (Car 1M / Car 2M / Car S) avec créneau horaire + quantité.

---

## 8. États transverses
- **Chargement** (spinner / `isLoading`) pendant les opérations.
- **Vide** : commandes, boutique, ou programme sans totaux.
- **Alerte dimanche** (client au repos).
- **Commande annulée** (badge, style atténué).
- **Temps réel** : la liste se met à jour automatiquement quand les données changent.

---

## 9. Objectifs de la refonte (pistes pour Claude Design)
- **Densité « ERP pro »** (type Odoo) : privilégier des **tableaux compacts** plutôt que de grandes cartes, surtout pour « Détail par produit » et « Commandes clients » quand il y en a beaucoup.
- **Hiérarchie claire** entre les 3 blocs (Commandes / Boutique / Synthèse) — envisager des **onglets** ou une mise en page 2 colonnes.
- **Répartition par cars** omniprésente : trouver une représentation homogène et lisible (colonnes Car 1M / Car 2M / Car S récurrentes, code couleur cohérent).
- Mettre en avant le **workflow de statut** (stepper) et rendre évident l'état « verrouillé » quand `produit`.
- **Saisie rapide** : ajout de commande / produit / quantité doit être fluide (le métier saisit vite, souvent le matin tôt, parfois sur mobile).
- Conserver **toutes** les fonctions ci-dessus — c'est un outil de travail quotidien, rien ne doit disparaître.

---

## 10. Composants du design system réutilisables
`Button`, `Card`, `Input`, `Select`, `Modal`, `ConfirmModal`, `Badge`, `StatCard`, `EmptyState`, `Loader`,
`RadialGauge` (avancement), `DonutChart` / `TrendChart` (si pertinent), `Sparkline`. Tokens : neutres froids,
primaire quasi-noir, accent indigo, statuts colorés, Inter, chiffres tabulaires.
