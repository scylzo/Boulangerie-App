# 📋 TODO : Pages à Améliorer

## ✅ Pages Déjà Améliorées

- [x] `src/pages/Dashboard.tsx`
- [x] `src/pages/admin/GestionLivreurs.tsx`
- [x] `src/pages/boutique/PageBoutique.tsx` (partiellement)
- [x] `src/pages/production/ProgrammeProduction.tsx` (sections principales: header, date, commandes)

## 📝 Pages à Améliorer

### Priorité Haute (Pages principales)

- [ ] **`src/pages/stock/GestionStock.tsx`**
  - Appliquer le design sobre
  - Améliorer le responsive des tableaux
  - Gérer les débordements de texte

- [ ] **`src/pages/production/ProgrammeProduction.tsx`** (sections restantes)
  - Améliorer les tableaux de produits
  - Section Quantités Boutique
  - Tableau des totaux
  - Actions en bas de page

- [ ] **`src/pages/facturation/GestionFactures.tsx`**
  - Tableaux responsive
  - Filtres responsive
  - Cards de factures

### Priorité Moyenne (Pages secondaires)

- [ ] **`src/pages/finance/Comptabilite.tsx`**
  - Graphiques responsive
  - Tableaux de données
  - Cards de statistiques

- [ ] **`src/pages/finance/GestionDepenses.tsx`**
  - Formulaires responsive
  - Liste des dépenses
  - Filtres

- [ ] **`src/pages/livraison/PageLivraison.tsx`**
  - Cards de livraisons
  - Assignations responsive
  - Statuts

- [ ] **`src/pages/rapport/RapportJournalier.tsx`**
  - Mise en page responsive
  - Tableaux de données
  - Export PDF

### Priorité Basse (Pages admin)

- [ ] **`src/pages/admin/GestionClients.tsx`**
  - Liste clients responsive
  - Formulaires
  - Filtres

- [ ] **`src/pages/admin/GestionProduits.tsx`**
  - Cards produits
  - Formulaires
  - Tableaux

- [ ] **`src/pages/admin/AssignationLivreurs.tsx`**
  - Interface d'assignation
  - Drag & drop responsive

- [ ] **`src/pages/admin/GestionUtilisateurs.tsx`**
  - Liste utilisateurs
  - Formulaires
  - Permissions

- [ ] **`src/pages/admin/DatabaseAdmin.tsx`**
  - Interface admin
  - Outils de gestion

### Composants à Améliorer

- [ ] **`src/components/shared/ProduitForm.tsx`**
  - Formulaire responsive
  - Inputs adaptatifs
  - Gestion des débordements

- [ ] **`src/components/shared/CommandeClientForm.tsx`**
  - Formulaire complexe responsive
  - Tableaux de produits
  - Totaux

- [ ] **`src/components/shared/ClientForm.tsx`**
  - Formulaire responsive
  - Validation

- [ ] **`src/components/shared/LivreurForm.tsx`**
  - Formulaire responsive

- [ ] **`src/components/stock/MatiereList.tsx`**
  - Tableau responsive
  - Actions

- [ ] **`src/components/stock/StockDashboard.tsx`**
  - Cards de statistiques
  - Graphiques responsive

- [ ] **`src/components/factures/FacturesList.tsx`**
  - Tableau responsive
  - Filtres

## 🎯 Checklist par Page

Pour chaque page, vérifier :

### 1. Container Principal
- [ ] `overflow-x-hidden` ajouté
- [ ] Padding responsive : `p-3 sm:p-4 md:p-6`
- [ ] Spacing adaptatif : `space-y-4 sm:space-y-6`
- [ ] Background sobre : `bg-gray-50`

### 2. Header
- [ ] Layout responsive : `flex-col sm:flex-row`
- [ ] Icône sobre : `bg-gray-900`
- [ ] Textes tronqués : `truncate`
- [ ] Padding adaptatif

### 3. Cards/Boxes
- [ ] Design sobre : `bg-white border-gray-100`
- [ ] Ombres légères : `shadow-sm`
- [ ] Coins arrondis : `rounded-xl`
- [ ] Overflow hidden
- [ ] Textes tronqués

### 4. Grilles
- [ ] Gaps réduits : `gap-3 sm:gap-4`
- [ ] Breakpoints appropriés
- [ ] Responsive columns

### 5. Boutons
- [ ] Couleurs sobres : `bg-gray-900`
- [ ] Pleine largeur sur mobile : `w-full sm:w-auto`
- [ ] Textes adaptatifs
- [ ] Icônes dimensionnées

### 6. Tableaux
- [ ] Overflow-x-auto
- [ ] Colonnes responsive
- [ ] Textes tronqués
- [ ] Actions responsive

### 7. Formulaires
- [ ] Inputs responsive
- [ ] Labels adaptatifs
- [ ] Validation visible
- [ ] Boutons responsive

### 8. Modals
- [ ] Taille responsive
- [ ] Padding adaptatif
- [ ] Overflow gestion
- [ ] Boutons responsive

## 📊 Progression

### Statistiques
- **Total de pages** : ~20
- **Pages améliorées** : 4 (dont 1 partiellement)
- **Progression** : 20%

### Estimation
- **Temps par page** : ~30-45 minutes
- **Temps total estimé** : ~10-15 heures
- **Priorité haute** : ~2-3 heures
- **Priorité moyenne** : ~4-5 heures
- **Priorité basse** : ~4-5 heures

## 🚀 Plan d'Action

### Phase 1 : Pages Principales (Semaine 1)
1. GestionStock.tsx
2. ProgrammeProduction.tsx
3. GestionFactures.tsx

### Phase 2 : Pages Secondaires (Semaine 2)
1. Comptabilite.tsx
2. GestionDepenses.tsx
3. PageLivraison.tsx
4. RapportJournalier.tsx

### Phase 3 : Pages Admin (Semaine 3)
1. GestionClients.tsx
2. GestionProduits.tsx
3. AssignationLivreurs.tsx
4. GestionUtilisateurs.tsx
5. DatabaseAdmin.tsx

### Phase 4 : Composants (Semaine 4)
1. Formulaires
2. Listes
3. Tableaux
4. Dashboards

## 📚 Ressources

- **Guide** : `DESIGN_GUIDE.md`
- **Documentation** : `DESIGN_IMPROVEMENTS.md`
- **Exemples** : Pages déjà améliorées

## ✅ Validation

Avant de marquer une page comme terminée :

1. [ ] Tester sur mobile (375px)
2. [ ] Tester sur tablette (768px)
3. [ ] Tester sur desktop (1024px+)
4. [ ] Vérifier aucun scroll horizontal
5. [ ] Vérifier aucun débordement
6. [ ] Vérifier la palette de couleurs
7. [ ] Vérifier les transitions
8. [ ] Vérifier l'accessibilité

---

**Mise à jour** : 2026-01-30  
**Responsable** : À définir
