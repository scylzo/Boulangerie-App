# ✅ Système d'Alerte "Clients Réguliers"

## 📋 Résumé
Implémentation d'un système pour prévenir les oublis de clients réguliers lors de la création du programme de production.

## 🔧 Fonctionnalités Ajoutées

### 1. Tagging des Clients
Dans le formulaire de gestion des clients (`ClientForm`), une nouvelle option **"Client Régulier"** a été ajoutée.
- Cocher cette case indique que le client commande quasi-quotidiennement.
- Stocké dans la base de données sous le champ `estRegulier: boolean`.

### 2. Détection Automatique
Dans la page **Programme de Production** (`ProgrammeProduction.tsx`), le système calcule en temps réel :
- La liste des clients marqués comme "Réguliers".
- La liste des clients ayant déjà une commande pour la date sélectionnée.
- La différence (Clients Réguliers sans commande).

### 3. Alerte Visuelle & Action Rapide
Si des clients réguliers manquent à l'appel, une **alerte orange** apparaît en haut de la liste des commandes.
- Affiche le nombre de clients manquants.
- Affiche la liste des noms.
- **Bouton d'ajout rapide** : Cliquer sur le nom du client ouvre directement le formulaire de création de commande pré-rempli pour ce client et cette date.

## 🚀 Utilisation
1. Aller dans **Gestion Clients**.
2. Modifier les clients habituels et cocher "Client Régulier".
3. Aller dans **Programme Production**.
4. Si un de ces clients est oublié pour la date choisie, l'alerte apparaîtra automatiquement.
