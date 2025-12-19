# 📘 Manuel Utilisateur Simplifié : Gestion Boulangerie

Ce document explique de manière simple comment fonctionnent les modules clés de votre application : **Comptabilité**, **Stocks / Économat** et **Rapport Journalier**. Il est conçu pour vous aider à former votre équipe ou à comprendre la logique derrière les chiffres.

---

## 1. 💰 La Comptabilité (Module Analytique)

Le module "Comptabilité" est votre tableau de bord financier. Son but est de vous dire si vous gagnez de l'argent ou si vous en perdez sur une période donnée (un mois précis).

### Comment ça marche ?
C'est une simple soustraction : **CE QUI RENTRE - CE QUI SORT = RÉSULTAT**.

#### A. Ce qui rentre (Recettes) 📈
L'application additionne deux sources de revenus :
1.  **Ventes Boutique** : C'est l'argent encaissé par les vendeuses (Pain, Pâtisseries, etc.).
    *   *Source* : Chaque jour, l'application enregistre les ventes "Matin" et "Soir" validées par l'équipe boutique.
2.  **Livraisons Facturées** : C'est l'argent que vous doivent vos clients livrés (Hôtels, Restaurants, Revendeurs).
    *   *Source* : Le système prend toutes les **factures** dont la date de livraison est dans le mois choisi. On prend le montant net (Total TTC).

#### B. Ce qui sort (Coûts & Dépenses) 📉
L'application additionne deux types de coûts :
1.  **Intrants (Matières Premières)** : C'est la valeur de la farine, du sucre, de la levure, etc., que vous avez **consommée** ou **perdue**.
    *   *Important* : Ce n'est pas ce que vous *achetez*, mais ce que vous *utilisez*. Si vous achetez 100 sacs de farine mais n'en utilisez que 10, le coût compté ici est celui de 10 sacs.
    *   *Calcul* : `Quantité Sortie du Stock × Prix d'achat (PMP)`.
2.  **Dépenses (Frais Généraux)** : C'est tout le reste (Carburant, Electricité, Salaires, Petites dépenses).
    *   *Source* : Ce que vous saisissez dans le menu "Dépenses".

#### C. Le Résultat 📊
*   Si le résultat est **Positif (+)** : La boulangerie est rentable ce mois-ci.
*   Si le résultat est **Négatif (-)** : Les coûts ont dépassé les recettes.

---

## 2. 📦 Stocks & Économat

Ce module gère votre garde-manger. Il suit tout ce qui entre et sort de votre réserve de matières premières.

### Les Règles d'Or
1.  **Tout mouvement doit être enregistré** : On ne sort pas un sac de farine sans le noter.
2.  **Le Prix Moyen (PMP)** : Pour calculer la valeur de votre stock, l'application utilise une moyenne.
    *   *Exemple* : Vous avez 1 sac acheté à 10.000F. Vous en achetez un autre à 12.000F. Votre stock vaut maintenant 11.000F par sac en moyenne. C'est ce prix moyen qui sera utilisé pour calculer vos coûts de production.

### Les Types de Mouvements
*   **Achat** 📥 : Quand le fournisseur livre. Le stock augmente, le prix moyen se met à jour.
*   **Consommation** 📤 : Quand le boulanger prend de la farine pour pétrir. Le stock diminue. C'est ce qui crée le "Coût Intrants" en compta.
*   **Perte** 🗑️ : Un sac déchiré, périmé ou volé. Le stock diminue. C'est aussi compté comme un coût (perte sèche).
*   **Correction** ✏️ : Pour ajuster le stock si vous faites un inventaire et trouvez des écarts.

---

## 3. 📝 Le Rapport Journalier

C'est le "bilan de santé" de la journée. Il permet de vérifier que la production correspond aux ventes.

### La Logique du Rapport
L'application essaie de réconcilier trois chiffres pour chaque produit (ex: Baguette) :
1.  **Quantité Produite** : Ce que les boulangers ont déclaré avoir fabriqué.
2.  **Quantité Vendue** : Ce que la boutique a vendu + Ce qui a été livré aux clients.
3.  **Invendus / Pertes** : Ce qu'il reste à la fin de la journée.

### L'Équation Magique
`Produit = Vendu + Invendu (ou Perte)`

Si `Produit` est plus grand que `Vendu + Invendu`, cela veut dire qu'il manque du pain (Vol ? Erreur de comptage ? Dégustation ?). C'est ce que l'application signale comme un écart ou une perte inexpliquée.

### Les Indicateurs
*   **Taux de Vente (%)** : Pourcentage de la production qui a été vendu.
    *   *Exemple* : 90% est excellent (presque tout vendu). 50% est mauvais (beaucoup de gaspillage).
*   **Pertes Totales** : Nombre de pièces produites qui n'ont rapporté aucun argent (invendus jetés, dons, casse).

---

### Résumé pour l'équipe

*   **Boulangers** : Remplissez bien la **Production Réelle**. C'est le point de départ de tout.
*   **Vendeuses** : Validez bien vos **Ventes** matin et soir. C'est votre Chiffre d'Affaires.
*   **Livreurs** : Vos **Factures** alimentent directement la compta. Une livraison oubliée = de l'argent invisible.
*   **Gérant** : Saisissez toutes les **Dépenses** et les sorties de **Stock**. Sans ça, le bénéfice affiché sera faux (trop optimiste).
