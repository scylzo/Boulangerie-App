# Design System « Chez Mina » — Artisan chaleureux

Guide de référence du design system de l'application. **Source de vérité unique :
`src/index.css`** (bloc `@theme`, Tailwind v4). Toute couleur, typo, rayon ou ombre
passe par un *token* — on n'écrit jamais de valeur en dur.

> 🎨 Aperçu visuel complet : ouvrir `design-system-preview.html` à la racine.

---

## 1. Identité

Look **artisan, chaleureux et sophistiqué** : fonds crème, texte espresso, accent
terracotta, touches d'or doux. Titres en serif optique (**Fraunces**), texte et
données en **Inter**. On évite les dégradés multicolores, le noir pur et les ombres
dures — tout est chaud et posé.

---

## 2. Tokens

### Couleurs

Toutes déclarées en `@theme` → utilisables comme `bg-*`, `text-*`, `border-*`, `ring-*`.

| Rôle | Échelle | Usage |
|------|---------|-------|
| **Sable** (neutres chauds) | `sand-50 → sand-950` | Fonds, bordures, texte |
| **Terracotta** (accent principal) | `terracotta-50 → 900` | Boutons primaires, liens, focus, éléments actifs |
| **Or doux** (secondaire) | `gold-50 → 600` | Highlights, badges premium |
| **Succès** | `success-50/100/500/600/700` | Payé, validé, en hausse |
| **Danger** | `danger-50/100/500/600/700` | Erreurs, suppression, rupture |
| **Avertissement** | `warning-50/100/500/600` | En attente, seuils |
| **Info** | `info-50/100/500/600` | Informations neutres |

**Conventions d'usage du sable :**

| Élément | Token |
|---------|-------|
| Fond de l'app | `bg-sand-100` |
| Surface / carte | `bg-white` |
| Fond de section douce (header de carte) | `bg-sand-50` |
| Bordure subtile | `border-sand-200` |
| Bordure d'input | `border-sand-300` |
| Texte secondaire / muted | `text-sand-500` / `text-sand-600` |
| Texte courant | `text-sand-700` / `text-sand-800` |
| Titres | `text-sand-900` |

### Typographie

| Token | Police | Usage |
|-------|--------|-------|
| `font-display` | Fraunces (serif) | `h1, h2, h3` (appliqué par défaut), valeurs KPI, titres de cartes |
| `font-sans` | Inter | Texte courant, labels, données, boutons |

Échelle indicative : titres `text-xl`/`text-2xl`/`text-4xl` en `font-semibold` ;
texte `text-sm`/`text-base` ; secondaire `text-xs`/`text-sm text-sand-500`.

### Rayons & ombres

- Rayons : `rounded-lg` (contrôles), `rounded-xl` (cartes, modales), `rounded-full` (badges).
- Ombres (teintées espresso, jamais noires) :
  - `shadow-soft` — boutons, éléments plats
  - `shadow-card` — cartes au repos
  - `shadow-elevated` — carte au survol
  - `shadow-overlay` — modales, popovers

---

## 3. Composants

Importer depuis le barrel : `import { Button, Card, StatCard, Badge } from '@/components/ui';`

| Composant | Rôle | Props clés |
|-----------|------|-----------|
| `Button` | Action | `variant` = primary \| secondary \| danger \| outline \| ghost ; `size` = sm \| md \| lg ; `isLoading` |
| `Card` | Conteneur de surface | `title`, `subtitle`, `className` |
| `Input` | Champ texte | `label`, `error`, `helperText` (gère aussi `type="password"`) |
| `Select` | Liste déroulante | `label`, `options`, `error`, `helperText` |
| `Modal` | Fenêtre / popover | `isOpen`, `onClose`, `title`, `size`, `inline`, `position` |
| `ConfirmModal` / `ConfirmButton` | Confirmation | `type` = info \| warning \| danger \| success |
| `Badge` | Statut / tag | `tone` = neutral \| success \| danger \| warning \| info \| brand \| gold ; `icon` ; `size` |
| `StatCard` | KPI dashboard | `label`, `value`, `icon`, `trend`, `trendLabel`, `tone` |
| `EmptyState` | Liste/tableau vide | `icon`, `title`, `description`, `action` |
| `Loader` (+ `PageLoader`, `TableLoader`, `CardLoader`, `ButtonLoader`) | Chargement | `size`, `message`, `fullScreen` |

---

## 4. Patterns

### Carte KPI
```tsx
<StatCard label="Chiffre d'affaires" value="1 250 000 FCFA"
  icon="mdi:cash-multiple" trend={12} trendLabel="vs hier" tone="brand" />
```

### Badge de statut
```tsx
<Badge tone="success" icon="mdi:check-circle">Payé</Badge>
<Badge tone="warning" icon="mdi:clock-outline">En attente</Badge>
<Badge tone="danger" icon="mdi:alert-circle">En rupture</Badge>
```

### État vide
```tsx
<EmptyState icon="mdi:tray" title="Aucune commande"
  description="Les nouvelles commandes du jour apparaîtront ici."
  action={<Button>Créer une commande</Button>} />
```

### En-tête de page (responsive)
```tsx
<div className="bg-white border-b border-sand-200 px-4 sm:px-6 py-3 sm:py-4">
  <div className="flex items-center gap-3 min-w-0">
    <div className="w-10 h-10 bg-terracotta-500 rounded-lg flex items-center justify-center shrink-0">
      <Icon icon="mdi:..." className="text-xl text-white" />
    </div>
    <div className="min-w-0">
      <h1 className="text-lg sm:text-xl font-semibold text-sand-900 truncate">Titre</h1>
      <p className="text-xs sm:text-sm text-sand-500 truncate">Description</p>
    </div>
  </div>
</div>
```

---

## 5. Règles

1. **Jamais de couleur en dur** — toujours un token (`text-sand-700`, pas `text-[#665847]`).
2. **Pas de dégradés multicolores** ni de noir pur ; accent = terracotta, highlight = or.
3. **Titres** en `font-display` ; **données/texte** en `font-sans`.
4. **Cartes** : `bg-white border border-sand-200 rounded-xl shadow-card`.
5. **Responsive** : padding `p-4 sm:p-5 md:p-6`, texte `text-sm sm:text-base`, layout `flex-col sm:flex-row`.
6. **Anti-débordement** : `truncate` / `line-clamp-2` sur les textes longs, `min-w-0 flex-1` dans les flex, `overflow-hidden` sur les conteneurs.
7. **Réutiliser les composants** `ui/` plutôt que réécrire des classes au cas par cas.

---

*Design system « Chez Mina » — mis à jour le 2026-07-02. Tokens : `src/index.css`.*
