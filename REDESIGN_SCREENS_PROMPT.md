# Refonte des écrans — Prompts pour Claude Design · « Chez Mina »

Ce document contient un **préambule** (le design system à respecter) puis une **fiche détaillée par écran**.
Pour redessiner un écran dans Claude Design : colle **le préambule** (§0) + **la fiche de l'écran** voulu.

---

## §0 — PRÉAMBULE (à coller en tête de chaque prompt)

> Tu redessines des écrans de **« Chez Mina »**, une application de gestion (ERP) pour une boulangerie
> artisanale. Utilise **exclusivement le design system déjà présent dans ce projet** (composants et tokens).
> Direction visuelle : **artisan, chaleureux, sophistiqué**.
>
> **Tokens (n'utilise jamais de couleur en dur) :**
> - Neutres chauds : `sand-50…950` (fond app `sand-100`, surfaces `white`, bordures `sand-200`, texte courant `sand-700/800`, titres `sand-900`, texte secondaire `sand-500`).
> - Accent principal : `terracotta-500/600` (boutons, liens, éléments actifs, focus).
> - Accent secondaire : `gold-300/500` (highlights, éléments premium).
> - Sémantiques : `success` (payé/validé/hausse), `danger` (erreur/impayé/rupture), `warning` (en attente/seuil), `info`.
>
> **Typographie :** titres en `font-display` (Fraunces, serif chaleureux) ; texte et données en `font-sans` (Inter).
> Valeurs chiffrées importantes (montants, KPI) en `font-display`.
>
> **Style :** cartes `bg-white border border-sand-200 rounded-xl shadow-card` ; coins `rounded-xl` ; ombres douces
> `shadow-soft`/`shadow-card`/`shadow-elevated` (jamais d'ombre noire dure) ; **pas de dégradés multicolores** ;
> responsive mobile-first (`p-4 sm:p-6`, `text-sm sm:text-base`, `flex-col sm:flex-row`) ; anti-débordement
> (`truncate`, `line-clamp-2`, `min-w-0 flex-1`, `overflow-hidden`).
>
> **Composants du design system à réutiliser :**
> `Button` (variants primary/secondary/danger/outline/ghost), `Card`, `Input`, `Select`, `Modal`, `ConfirmModal`,
> `ConfirmButton`, `Badge` (tone success/danger/warning/info/brand/gold/neutral), `StatCard` (KPI), `EmptyState`, `Loader`.
>
> Contexte métier : monnaie en **FCFA**, langue **français**. Rôles : boulangers, livreurs, vendeuses (boutique),
> clients (avec/sans kiosque). L'app est utilisée au quotidien, souvent sur mobile — la **lisibilité des chiffres**
> et la **rapidité de saisie** priment.

---

# MODULES & ÉCRANS

## 1. Authentification — `Login` · `/login`

- **Objectif :** connexion des employés.
- **Contenu :** logo/nom « Chez Mina », champ email, champ mot de passe, bouton « Se connecter », message d'erreur éventuel.
- **Structure :** page centrée plein écran, fond `sand-100`, une `Card` centrée (max-w-sm) avec le logo dans une pastille terracotta en haut, titre `font-display`, formulaire vertical.
- **Composants DS :** `Card`, `Input` (email + password avec œil), `Button` (primary, pleine largeur, `isLoading`).
- **États :** bouton en chargement pendant l'authentification ; erreur en `text-danger-600` sous le formulaire.
- **Notes :** ambiance boulangerie premium — éventuel visuel/texture discret. Tout doit tenir sans scroll sur mobile.

---

## 2. Tableau de bord — `Dashboard` · `/dashboard`
*(déjà migré côté code — sert de référence visuelle)*

- **Objectif :** vue d'ensemble de l'activité du jour.
- **Contenu :** 4 KPI (Ventes du jour, Encaissé, Impayés du jour + dette globale, Alertes stock) ; bloc « Production du jour » avec barres de progression par produit et % d'avancement ; bloc « Alertes stock » (articles sous seuil) ; bloc « Base clients » (actifs / kiosques / hors-kiosque + nouveaux arrivés) ; widget « Performances clients » sur une période.
- **Structure :** header (titre + date du jour dans une pastille) → grille 4 `StatCard` → grille détails (Production 2/3 + colonne Stock/Clients 1/3) → widget performances pleine largeur.
- **Composants DS :** `StatCard` (tones brand/success/danger/warning), `EmptyState` (production vide), `Badge` (statut production : `success` Terminée / `brand` En cours).
- **États :** `EmptyState` si pas de programme ; message « Stock optimal » (succès) si aucune alerte.

---

## 3. Production

### 3a. `ProgrammeProduction` · `/production` *(écran majeur)*
- **Objectif :** planifier la production du jour = commandes clients + quantités boutique, puis valider la production.
- **Contenu :** sélecteur de date ; toolbar d'actions (Envoyer/Renvoyer le programme, Rapport PDF, Valider production) + indicateur de statut ; section **Commandes Clients** (recherche client, liste des commandes avec produits/quantités, actions : bon de livraison, ajouter produits, modifier, annuler, supprimer) ; section **Quantités Boutique** (produits + quantités éditables) ; totaux par produit.
- **Structure :** header avec titre + badge de statut + toolbar ; date picker ; deux grandes sections en cartes ; lignes de commande denses mais lisibles.
- **Composants DS :** `Card`, `Badge` (statut : brouillon/envoyé/produit), `Button` (primary Valider, outline Rapport, ghost actions de ligne), `Input`/`Select` (recherche, quantités), `Modal` (ajout produits / nouvelle commande), `ConfirmModal` (annuler/supprimer), `EmptyState` (aucune commande / aucun produit).
- **États :** vides pour commandes et boutique ; chargement ; statut visuel clair (brouillon → envoyé → produit).
- **Notes :** beaucoup de données → privilégier tableaux/listes compacts, chiffres en `font-display`, actions de ligne en icônes `ghost` avec `title`.

### 3b. `VueBoulanger` · `/boulanger` *(vue imprimable)*
- **Objectif :** feuille de production destinée aux boulangers (matin/soir, clients + boutique), imprimable.
- **Contenu :** en-tête « Programme de production » + date ; production Clients (matin/soir), production Boutique, récapitulatif global par car, total général ; ajustement production réelle ; résumé.
- **Structure :** mise en page claire type « feuille de travail », grandes sections titrées, totaux mis en avant ; version impression sobre (noir sur blanc à l'impression, mais artisan à l'écran).
- **Composants DS :** `Card`, `Badge` (statut), `Button` (Imprimer, primary), tableaux de quantités.
- **Notes :** l'impression doit rester lisible — prévoir styles `print` (masquer chrome, garder les chiffres). Titres `font-display`, chiffres imposants.

### 3c. `RotationBoulangers` · `/rotation-boulangers`
- **Objectif :** paramétrer la rotation des équipes de boulangers et prévisualiser le calendrier.
- **Contenu :** paramètres de rotation (dates, cadence) ; liste des équipes (boulanger + assistant 1 + assistant 2, ajout/suppression d'équipe) ; aperçu calendrier.
- **Structure :** deux colonnes — à gauche paramètres + équipes (cartes éditables), à droite aperçu calendrier ; boutons d'action en bas.
- **Composants DS :** `Card`, `Input` (noms), `Button` (Ajouter équipe, Générer/Enregistrer), `ConfirmButton` (supprimer équipe), `Badge` (équipe active du jour), `EmptyState` (aucune équipe).

---

## 4. Facturation

### `GestionFactures` · `/facturation` *(écran majeur)*
- **Objectif :** générer et gérer les factures clients, encaissements, retours et avoirs.
- **Contenu :** carte KPI globale « Chiffre d'affaires facturé » du jour ; barre recherche client + actions (Générer factures) ; grille de clients ; vue détaillée d'un client (KPI client, liste factures avec statut, actions : détails, PDF, payer, saisir retour, avoir/crédit, supprimer) ; sélection multiple avec somme.
- **Structure :** vue liste (grille de clients) ↔ vue détail client (header navigation + StatCards client + filtres + liste factures). Barre d'actions collante.
- **Composants DS :** `StatCard` (CA facturé, encaissé, impayé), `Card`, `Badge` (statut facture : `success` Payée / `warning` Partielle / `danger` Impayée / neutral Annulée), `Button` (primary Générer, outline PDF), `Input` (recherche), `Modal` (paiement, retour, avoir), `ConfirmModal` (suppression), `EmptyState`.
- **États :** aucune facture / aucun client ; sélection active (barre de somme) ; chargement.
- **Notes :** le **statut de paiement** doit sauter aux yeux (Badge coloré) ; montants en `font-display`.

---

## 5. Livraison

### 5a. `PageLivraison` · `/livraison`
- **Objectif :** organiser et suivre les livraisons par livreur.
- **Contenu :** filtres (client, livreur, date) ; actions globales (imprimer) ; **vue par livreur** : KPI par livreur, en-tête livreur (avec code couleur), liste des livraisons/cars, actions (rapport imprimable, partage WhatsApp, supprimer le programme).
- **Structure :** header + boutons d'actions globales → carte filtres → une carte par livreur (barre de couleur latérale + en-tête sobre + contenu). 
- **Composants DS :** `Card`, `StatCard` (KPI livreur), `Badge` (statut livraison), `Button` (Imprimer, outline ; partage ghost), `Input`/`Select` (filtres), `ConfirmModal` (supprimer programme), `EmptyState`.
- **Notes :** garder le **code couleur par livreur** mais l'harmoniser (accent terracotta + variantes gold/info, pas de couleurs criardes).

### 5b. `SaisieRetours` · `/retours`
- **Objectif :** enregistrer les produits retournés (invendus) par client et par date de livraison.
- **Contenu :** recherche client + filtres ; sélecteur de date (affichage GROS de la date) ; liste des clients avec livraisons ; produits livrés + saisie des retours ; KPI (total retours).
- **Structure :** header → barre recherche/filtres → widget date proéminent → liste clients (carte par client avec produits livrés et champs retour) → footer d'enregistrement.
- **Composants DS :** `Card`, `Input` (recherche + quantités de retour), `Button` (Enregistrer primary, Modifier ghost), `Badge`, `StatCard` (KPI retours), `ConfirmModal` (supprimer retour), `EmptyState`.
- **Notes :** saisie rapide sur mobile → champs numériques larges, date très visible en `font-display`.

---

## 6. Boutique

### `PageBoutique` · `/boutique` *(écran majeur — flux journalier)*
- **Objectif :** gérer le stock et les ventes de la boutique sur la journée, avec passage de relais matin → soir entre vendeuses.
- **Contenu :** sélecteur de date de service ; stock de départ ; **flux journalier** (vendeuse du matin, saisie, passage de relais → vendeuse du soir, saisie ventes du soir) ; toggle « journée continue » ; saisie rapide (modal one-shot) ; ajout manuel de produit ; tableau des produits/ventes ; validation.
- **Structure :** header + widget date → carte « stock reçu » → section flux (étapes matin/relais/soir, visuellement séquencées) → tableau simple et clair → actions (Ajouter produit, Enregistrer les ventes).
- **Composants DS :** `Card`, `Badge` (statut journée / étape), `Button` (primary Enregistrer, outline Ajouter, secondary Réouvrir), `Input` (noms vendeuses, quantités), `Modal` (saisie rapide, ajout manuel, modif quantité), `ConfirmModal` (validation, suppression), `EmptyState` (pas de stock).
- **Notes :** matérialiser les **étapes matin → soir** comme un mini-parcours (steps) avec accents terracotta ; tableau lisible, totaux en `font-display`.

---

## 7. Stock

### 7a. `GestionStock` · `/stocks` *(conteneur)*
- **Objectif :** page cadre du module stock (titre + contenu / onglets vers déclaration & consommations).
- **Structure :** header « Gestion des Stocks » + navigation par onglets ou cartes d'accès vers les sous-écrans.
- **Composants DS :** `Card`, `Button`/onglets, `EmptyState`.

### 7b. `SaisieConsommations` · (module stock) *(écran dense)*
- **Objectif :** saisir les consommations de matières premières + calculatrice de rendement.
- **Contenu :** recherche matière (Farine, Gasoil…) ; toolbar ; **calculatrice de rendement** ; tableau scrollable des matières avec champs de saisie (quantités, valeurs) ; footer de confirmation.
- **Structure :** header → toolbar (recherche + calculatrice repliable) → tableau scrollable (colonnes lisibles, saisie inline) → footer collant « Confirmer les consommations ».
- **Composants DS :** `Input` (recherche + cellules), `Button` (primary Confirmer), `Card` (calculatrice), `ConfirmModal` (confirmation), `EmptyState`.
- **Notes :** tableau = cœur de l'écran → en-têtes `sand-50`, lignes zébrées douces (`sand-50`), champs numériques nets ; footer d'action toujours visible.

### 7c. `StockDeclaration` · `/stocks/declaration`
- **Objectif :** déclaration journalière des stocks (saisie des consommations).
- **Contenu :** recherche matière ; toolbar ; tableau scrollable ; footer « Confirmer la déclaration journalière ».
- **Composants DS :** identiques à 7b (`Input`, `Button`, `ConfirmModal`, `EmptyState`).

---

## 8. Finance

### 8a. `Comptabilite` · `/comptabilite`
- **Objectif :** vue comptable — recettes, coûts, résultat, avec graphiques.
- **Contenu :** KPI Cards (recettes, coûts, résultat) ; sections Recettes / Coûts / Résultat ; graphique de répartition des coûts ; détail matières premières ; structure du CA ; actions (Générer rapport PDF, Actualiser).
- **Structure :** header + actions → rangée de `StatCard` → sections détaillées en cartes → graphiques.
- **Composants DS :** `StatCard` (recettes success, coûts warning/danger, résultat brand ; `trend` si comparaison), `Card`, `Button` (outline Générer/Actualiser), `Badge`, graphiques (donut/barres) aux couleurs du DS (terracotta/gold/sand).
- **Notes :** résultat positif en `success`, négatif en `danger` ; montants en `font-display` ; graphiques dans la palette chaude.

### 8b. `GestionDepenses` · `/depenses`
- **Objectif :** enregistrer et suivre les dépenses par catégorie.
- **Contenu :** total + répartition par catégorie ; liste des dépenses ; actions (Nouvelle dépense, Générer rapport PDF, Actualiser) ; message « modification impossible » selon règles.
- **Structure :** header + actions → KPI total + graphique répartition catégorie → liste/tableau des dépenses.
- **Composants DS :** `StatCard` (total dépenses), `Card`, `Badge` (catégorie), `Button` (primary Nouvelle dépense), `Modal` (formulaire dépense), `ConfirmModal`, `EmptyState`.
- **Notes :** catégories = `Badge` de tons variés (brand/gold/info/neutral) cohérents.

---

## 9. Rapport

### `RapportJournalier` · `/rapport` *(écran majeur)*
- **Objectif :** rapport journalier consolidé — performance boutique + clients, ventes, livraisons, retours, annulations/redistribution.
- **Contenu :** barre de contrôle par jour (sélection + Générer) ; KPI Cards ; **Section Boutique** (performance, ventes, détails par produit, ventilation des invendus) ; **Section Clients** (performance, livraisons, détail retours par client) ; **Synthèse globale** ; commandes annulées & redistribution.
- **Structure :** header → barre jour → rangée KPI → sections thématiques en cartes titrées (`font-display`) → tableaux de détail.
- **Composants DS :** `StatCard`, `Card`, `Badge` (statuts, écarts), `Button` (primary Générer, outline Valider), `EmptyState` (« Aucun rapport disponible »).
- **Notes :** document de synthèse → hiérarchie claire, titres de section forts, chiffres clés en évidence ; écarts positifs/négatifs en `success`/`danger`.

---

## 10. Administration

### 10a. `GestionProduits` · `/admin/produits`
- **Objectif :** catalogue produits (CRUD).
- **Contenu :** liste/grille de produits (nom, prix, statut), recherche, ajout/modif via modal.
- **Structure :** header (titre + bouton « Nouveau produit ») → grille de cartes produit (avatar initiale, nom, prix `font-display`, badge statut, actions Modifier/Supprimer).
- **Composants DS :** `Card`, `Badge` (Actif/Inactif), `Button` (primary Nouveau), `Modal` (formulaire), `ConfirmModal` (suppression), `EmptyState` (« Ajouter le premier produit »).

### 10b. `GestionClients` · `/admin/clients`
- **Objectif :** gestion des clients (CRUD + type/paiement + livreurs assignés).
- **Contenu :** liste des clients avec infos principales, type & mode de paiement, livreurs assignés, actions.
- **Structure :** header (+ « Nouveau client ») → cartes client (header nom + badges type/kiosque, infos, livreurs en chips, actions).
- **Composants DS :** `Card`, `Badge` (kiosque `brand`, type de paiement, régulier `gold`), `Button`, `Modal`, `ConfirmModal`, `EmptyState`.

### 10c. `GestionLivreurs` · `/admin/livreurs`
- **Objectif :** équipe de livraison (CRUD).
- **Contenu :** cartes livreur (nom, contact, code couleur), actions.
- **Composants DS :** `Card`, `Badge`, `Button`, `Modal`, `ConfirmModal`, `EmptyState` (« Ajouter le premier livreur »).

### 10d. `GestionUtilisateurs` · `/admin/users`
- **Objectif :** comptes utilisateurs + rôles + permissions par module.
- **Contenu :** cartes utilisateur (nom, email, badge rôle, actions) ; section permissions modules (toggles par module).
- **Composants DS :** `Card`, `Badge` (rôle : admin/gérant/employé en tons distincts), `Button`, `Input` (nom, email, mot de passe), `Modal`, `ConfirmModal`, toggles ; `EmptyState`.
- **Notes :** grille de permissions lisible (module × droit) ; rôles = `Badge` cohérents.

### 10e. `FicheProduit` · `/admin/fiche-produit`
- **Objectif :** générateur de fiche produit / bon (client de passage + sélection de produits).
- **Contenu :** infos client (nom libre) ; sélection des produits (quantités) ; génération.
- **Composants DS :** `Card`, `Input`, `Select`, `Button` (primary Générer), tableau de sélection.

### 10f. `CarteKiosques` · `/admin/carte` *(carte géo)*
- **Objectif :** supervision géographique des kiosques + zones de livraison + performance.
- **Contenu :** carte (Leaflet) avec marqueurs kiosques, zones de livraison, position boulangerie ; toggle zones ; légende ; rapport/barre de progression ; modal de correction d'un kiosque.
- **Structure :** header intelligent (titre « Supervision Géo-Performance » + contrôles) → carte plein cadre → panneaux flottants (légende, toggles) → modal correction.
- **Composants DS :** `Card` (panneaux/légende), `Badge` (performance), `Button` (toggles, ghost), `Modal` (correction kiosque), `Loader`.
- **Notes :** marqueurs et zones dans la palette DS (terracotta = principal, gold/info pour catégories) ; panneaux flottants en `Card` translucides `shadow-elevated`.

### 10g. `AssignationLivreurs` · (admin)
- **Objectif :** écran cadre pour assigner clients ↔ livreurs.
- **Structure :** header + composant d'assignation (deux listes / glisser-déposer ou sélection).
- **Composants DS :** `Card`, `Select`/listes, `Button`, `Badge` (livreur), `EmptyState`.

### 10h. `DatabaseAdmin` · (admin — zone sensible)
- **Objectif :** actions dangereuses (reset base, purge données) + infos base.
- **Contenu :** « Actions Dangereuses » (reset complet, supprimer rapports/stocks boutique) ; statut ; infos sur la base.
- **Structure :** header → carte d'avertissement (bordure/tons `danger`) regroupant les actions destructrices → carte infos base.
- **Composants DS :** `Card` (zone danger : `border-danger-200 bg-danger-50`), `Button` (variant `danger`), `ConfirmModal` (double confirmation), `Badge` (statut).
- **Notes :** insister visuellement sur le **caractère destructif** (tons danger, confirmations explicites) — mais garder la cohérence artisan.

---

## Ordre de refonte conseillé (impact décroissant)
1. `Dashboard` (référence, fait) → 2. `GestionFactures` → 3. `ProgrammeProduction` → 4. `PageBoutique` →
5. `RapportJournalier` → 6. `PageLivraison` / `SaisieRetours` → 7. `Comptabilite` / `GestionDepenses` →
8. Stock (`SaisieConsommations`, `StockDeclaration`) → 9. Admin (Produits, Clients, Livreurs, Utilisateurs) →
10. `VueBoulanger`, `RotationBoulangers`, `FicheProduit`, `CarteKiosques`, `AssignationLivreurs`, `Login`, `DatabaseAdmin`.
