# Guide Rapide : Appliquer le Design Sobre et Responsive

## 🎯 Checklist pour Chaque Page

### 1. Container Principal
```tsx
// ❌ Avant
<div className="space-y-6 md:space-y-8 p-4 md:p-6 pb-20 bg-slate-50/30 min-h-screen">

// ✅ Après
<div className="space-y-4 sm:space-y-6 p-3 sm:p-4 md:p-6 pb-20 bg-gray-50 min-h-screen overflow-x-hidden">
```

### 2. Header de Page
```tsx
// ❌ Avant
<div className="bg-white border-b border-gray-200 px-6 py-4">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-4">
      <div className="w-10 h-10 bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg">
        <Icon icon="mdi:icon" className="text-2xl text-white" />
      </div>
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Titre</h1>
        <p className="text-sm text-gray-500">Description</p>
      </div>
    </div>
  </div>
</div>

// ✅ Après
<div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4">
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
    <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
      <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center shrink-0">
        <Icon icon="mdi:icon" className="text-xl text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">Titre</h1>
        <p className="text-xs sm:text-sm text-gray-500 truncate">Description</p>
      </div>
    </div>
  </div>
</div>
```

### 3. Cards / Boxes
```tsx
// ❌ Avant
<div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
  <h3 className="font-bold text-xl text-gray-900">Titre</h3>
  <p className="text-gray-600">Description longue qui peut déborder</p>
</div>

// ✅ Après
<div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5 md:p-6 overflow-hidden">
  <h3 className="font-semibold text-base sm:text-lg text-gray-900 truncate" title="Titre">Titre</h3>
  <p className="text-sm sm:text-base text-gray-600 line-clamp-2">Description longue qui peut déborder</p>
</div>
```

### 4. Grilles
```tsx
// ❌ Avant
<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">

// ✅ Après
<div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
```

### 5. Boutons
```tsx
// ❌ Avant
<button className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 shadow-lg">
  <Icon icon="mdi:plus" className="text-lg" />
  <span className="font-medium">Ajouter</span>
</button>

// ✅ Après
<button className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-all shadow-sm w-full sm:w-auto">
  <Icon icon="mdi:plus" className="text-lg" />
  <span className="font-medium text-sm sm:text-base">Ajouter</span>
</button>
```

### 6. Badges / Tags
```tsx
// ❌ Avant
<span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">
  Actif
</span>

// ✅ Après
<span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] sm:text-xs font-medium rounded-full bg-emerald-50 text-emerald-700">
  <Icon icon="mdi:check-circle" className="text-xs" />
  Actif
</span>
```

### 7. Icônes
```tsx
// ❌ Avant
<div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl">
  <Icon icon="mdi:icon" className="text-2xl text-white" />
</div>

// ✅ Après
<div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-900 rounded-lg shrink-0">
  <Icon icon="mdi:icon" className="text-lg sm:text-xl text-white" />
</div>
```

### 8. Textes
```tsx
// ❌ Avant
<h1 className="text-2xl font-bold text-gray-900">Titre</h1>
<p className="text-sm text-gray-600">Description</p>

// ✅ Après
<h1 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900 truncate">Titre</h1>
<p className="text-xs sm:text-sm text-gray-600 truncate">Description</p>
```

### 9. Inputs
```tsx
// ❌ Avant
<input
  type="text"
  className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
/>

// ✅ Après
<input
  type="text"
  className="px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent text-sm sm:text-base w-full"
/>
```

### 10. Empty States
```tsx
// ❌ Avant
<div className="text-center py-16">
  <div className="w-20 h-20 bg-green-100 rounded-full mx-auto mb-6">
    <Icon icon="mdi:icon" className="text-4xl text-green-500" />
  </div>
  <h3 className="text-xl font-semibold text-gray-900 mb-3">Aucun élément</h3>
  <p className="text-gray-500 mb-8">Description</p>
</div>

// ✅ Après
<div className="text-center py-12 sm:py-16">
  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
    <Icon icon="mdi:icon" className="text-3xl sm:text-4xl text-gray-400" />
  </div>
  <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2 sm:mb-3">Aucun élément</h3>
  <p className="text-sm sm:text-base text-gray-500 mb-6 sm:mb-8 max-w-md mx-auto px-4">Description</p>
</div>
```

## 🎨 Palette de Couleurs à Utiliser

### Remplacements Systématiques

| ❌ Avant | ✅ Après |
|---------|---------|
| `bg-slate-50` | `bg-gray-50` |
| `bg-slate-100` | `bg-gray-100` |
| `text-slate-600` | `text-gray-600` |
| `text-slate-900` | `text-gray-900` |
| `border-slate-200` | `border-gray-200` |
| `bg-gradient-to-r from-green-600 to-emerald-600` | `bg-gray-900` |
| `bg-gradient-to-r from-blue-600 to-indigo-600` | `bg-gray-900` |
| `bg-gradient-to-r from-amber-600 to-orange-600` | `bg-gray-900` |
| `shadow-lg` | `shadow-sm` |
| `shadow-xl` | `shadow-md` |
| `rounded-2xl` | `rounded-xl` |
| `rounded-3xl` | `rounded-xl` |

### Couleurs d'Accent (usage limité)

- **Succès** : `bg-emerald-50 text-emerald-700` (au lieu de `bg-green-100 text-green-700`)
- **Erreur** : `bg-red-50 text-red-700`
- **Avertissement** : `bg-orange-50 text-orange-700`

## 🔧 Classes Utilitaires Importantes

### Prévention des Débordements
```tsx
// Sur les containers
className="overflow-hidden"
className="overflow-x-hidden"

// Sur les textes
className="truncate"
className="line-clamp-2"

// Dans les flex containers
className="min-w-0 flex-1"
className="shrink-0"
```

### Responsive Spacing
```tsx
// Padding
className="p-3 sm:p-4 md:p-6"
className="px-4 sm:px-6"
className="py-3 sm:py-4"

// Margin
className="mb-3 sm:mb-4"
className="mt-4 sm:mt-6"

// Gap
className="gap-2 sm:gap-3"
className="gap-3 sm:gap-4"

// Space
className="space-y-3 sm:space-y-4"
className="space-y-4 sm:space-y-6"
```

### Responsive Layout
```tsx
// Flex
className="flex-col sm:flex-row"
className="flex items-center gap-3 sm:gap-4"

// Grid
className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
className="grid gap-3 sm:gap-4"

// Width
className="w-full sm:w-auto"
className="max-w-full"
```

### Responsive Text
```tsx
// Size
className="text-xs sm:text-sm"
className="text-sm sm:text-base"
className="text-base sm:text-lg"
className="text-lg sm:text-xl"

// Weight
className="font-medium sm:font-semibold"
className="font-semibold sm:font-bold"
```

## 📝 Exemple Complet : Card de Produit

```tsx
// ❌ Avant
<div className="bg-gradient-to-br from-white to-gray-50 border border-gray-200 rounded-2xl p-6 hover:border-green-300 hover:shadow-2xl transition-all duration-300 group">
  <div className="flex items-start justify-between mb-4">
    <div className="flex items-start gap-4">
      <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
        <span className="text-white font-bold text-xl">P</span>
      </div>
      <div>
        <h3 className="font-bold text-xl text-gray-900 mb-1">Nom du Produit Très Long Qui Peut Déborder</h3>
        <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">
          <Icon icon="mdi:check-circle" className="text-xs" />
          Actif
        </span>
      </div>
    </div>
  </div>
  <div className="space-y-3 mb-6">
    <div className="flex items-center gap-2">
      <Icon icon="mdi:currency-usd" className="text-gray-400" />
      <span className="text-sm text-gray-700">Prix: 5000 FCFA</span>
    </div>
  </div>
  <div className="flex gap-2">
    <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-green-600 hover:text-green-700 bg-green-50 hover:bg-green-100 rounded-xl transition-all font-medium shadow-sm hover:shadow-md">
      <Icon icon="mdi:pencil" className="text-lg" />
      <span>Modifier</span>
    </button>
    <button className="flex items-center justify-center gap-2 px-4 py-2 text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-xl transition-all font-medium shadow-sm hover:shadow-md">
      <Icon icon="mdi:delete-outline" className="text-lg" />
    </button>
  </div>
</div>

// ✅ Après
<div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 hover:border-gray-300 hover:shadow-md transition-all duration-200 overflow-hidden">
  <div className="flex items-start justify-between mb-3 sm:mb-4">
    <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-900 rounded-lg flex items-center justify-center shrink-0">
        <span className="text-white font-bold text-base sm:text-lg">P</span>
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-base sm:text-lg text-gray-900 mb-1 truncate" title="Nom du Produit Très Long Qui Peut Déborder">
          Nom du Produit Très Long Qui Peut Déborder
        </h3>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] sm:text-xs font-medium rounded-full bg-emerald-50 text-emerald-700">
          <Icon icon="mdi:check-circle" className="text-xs" />
          Actif
        </span>
      </div>
    </div>
  </div>
  <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-5">
    <div className="flex items-center gap-2">
      <Icon icon="mdi:currency-usd" className="text-gray-400 shrink-0" />
      <span className="text-xs sm:text-sm text-gray-700 truncate">Prix: 5000 FCFA</span>
    </div>
  </div>
  <div className="flex gap-2">
    <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-gray-700 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-lg transition-all text-xs sm:text-sm font-medium">
      <Icon icon="mdi:pencil" className="text-base sm:text-lg" />
      <span className="hidden sm:inline">Modifier</span>
    </button>
    <button className="flex items-center justify-center gap-1.5 px-3 py-2 text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-all text-xs sm:text-sm font-medium">
      <Icon icon="mdi:delete-outline" className="text-base sm:text-lg" />
    </button>
  </div>
</div>
```

## ✅ Points de Vérification Finale

Avant de valider une page, vérifier :

1. [ ] Aucun gradient (sauf exceptions justifiées)
2. [ ] Palette grise dominante
3. [ ] Tous les textes longs ont `truncate`
4. [ ] Tous les containers ont `overflow-hidden`
5. [ ] Padding responsive : `p-3 sm:p-4 md:p-6`
6. [ ] Gaps réduits : `gap-3 sm:gap-4`
7. [ ] Textes adaptatifs : `text-sm sm:text-base`
8. [ ] Layout responsive : `flex-col sm:flex-row`
9. [ ] Icônes sobres : `bg-gray-900` ou `bg-gray-100`
10. [ ] Ombres légères : `shadow-sm` ou `shadow-md`
11. [ ] Coins arrondis cohérents : `rounded-xl`
12. [ ] Bordures subtiles : `border-gray-100` ou `border-gray-200`

---

**Bon courage pour l'application de ces améliorations ! 🚀**
