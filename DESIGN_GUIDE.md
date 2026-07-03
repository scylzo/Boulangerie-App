# Design System « Chez Mina » — Monochrome Pro

Guide de référence du design system. **Source de vérité unique : `src/index.css`**
(bloc `@theme`, Tailwind v4). Toute couleur, typo, rayon ou ombre passe par un *token*.

> 🎨 Aperçu visuel complet : ouvrir `design-system-preview.html` à la racine.

Direction : **dashboard haut de gamme** (langage Linear / Vercel), pensé pour des
clientes habituées à Odoo / Dolibarr / Sage — **sobre, dense, orienté données**.

---

## 1. Identité
Neutres froids, **primaire quasi-noir**, **accent indigo rare**, statuts colorés nets.
Typographie **Inter partout** (pas de serif). Densité soignée, bordures fines, ombres
très discrètes, chiffres tabulaires. On évite : couleurs vives décoratives, gros rayons,
ombres marquées, tout ce qui fait « template grand public ».

---

## 2. Tokens

> ⚠️ Pour raison historique, les **noms** de tokens sont conservés mais leurs **valeurs**
> sont monochromes pro. Mapping mental : `sand` = neutres, `terracotta` = **primaire (noir)**,
> `gold` = **accent (indigo)**.

### Couleurs
| Rôle | Échelle | Usage |
|------|---------|-------|
| **Neutres** (zinc froids) | `sand-50 → 950` | Fonds, bordures, texte. Fond app `sand-100`, surface `white`, bordure `sand-200`, texte `sand-700/900`, secondaire `sand-500` |
| **Primaire** (quasi-noir) | `terracotta-50 → 900` | Boutons primaires (`terracotta-500` = `#18181B`), éléments actifs, focus |
| **Accent** (indigo, rare) | `gold-50 → 600` | Liens, highlights, badges premium (`gold-500/600` = indigo) |
| **Succès** | `success-50/100/500/600/700` | Payé, validé, hausse |
| **Danger** | `danger-50/100/500/600/700` | Erreur, suppression, rupture |
| **Avertissement** | `warning-50/100/500/600` | En attente, seuils |
| **Info** | `info-50/100/500/600` | Informations (indigo) |

Valeurs neutres : `50 #FAFAFA · 100 #F4F4F5 · 200 #E4E4E7 · 300 #D4D4D8 · 400 #A1A1AA ·
500 #71717A · 600 #52525B · 700 #3F3F46 · 800 #27272A · 900 #18181B · 950 #09090B`.

### Typographie
- `--font-sans` = `--font-display` = **Inter** (400/500/600/700). Plus aucun serif.
- Titres (`h1/h2/h3`) : Inter, `letter-spacing: -0.02em`.
- Chiffres : classe `.tabular-nums` (KPI, tableaux, montants) pour l'alignement.

### Rayons & ombres
- Rayons resserrés : `rounded-md` (contrôles), `rounded-lg`/`rounded-xl` (cartes = `xl` = 12px), `rounded-full` (badges/avatars).
- Ombres neutres très subtiles : `shadow-soft`, `shadow-card` (cartes au repos), `shadow-elevated` (survol/panneaux), `shadow-overlay` (modales). On s'appuie surtout sur les **bordures**.

---

## 3. Composants (`src/components/ui/`)
Import : `import { Button, Card, StatCard, TrendChart } from '@/components/ui';`

| Composant | Rôle | Props clés |
|-----------|------|-----------|
| `Button` | Action | `variant` primary\|secondary\|danger\|outline\|ghost ; `size` ; `isLoading` |
| `Card` | Surface | `title`, `subtitle`, `className` |
| `Input` / `Select` | Formulaire | `label`, `error`, `helperText` (+ `options` pour Select) |
| `Modal` / `ConfirmModal` / `ConfirmButton` | Fenêtres & confirmations | `isOpen`, `onClose`, `type` |
| `Badge` | Statut / tag | `tone` neutral\|success\|danger\|warning\|info\|brand\|gold ; `icon` |
| `StatCard` | KPI | `label`, `value`, `icon`, `trend`, `trendLabel`, `tone` |
| `EmptyState` | Liste vide | `icon`, `title`, `description`, `action` |
| `Loader` (+ Page/Table/Card/Button) | Chargement | `size`, `message`, `fullScreen` |
| **`Sparkline`** | Micro-tendance inline | `data:number[]`, `className`, `fill` |
| **`RadialGauge`** | Jauge d'objectif | `value` (0–100), `size`, `className`, `label` |
| **`DonutChart`** | Répartition | `data:{label,value,className}[]`, `centerValue`, `centerLabel` |
| **`TrendChart`** | Courbe (aire+ligne) | `data:{label,value}[]`, `height`, `className`, `valueFormat` |

Les 4 composants de **dataviz** sont en **SVG pur, sans dépendance**, colorés via les
tokens (`currentColor` / classes `text-*`).

---

## 4. Patterns
```tsx
// KPI avec tendance
<StatCard label="Chiffre d'affaires" value="1 250 000 FCFA" icon="mdi:cash-multiple" trend={12} trendLabel="vs hier" />

// Courbe CA
<TrendChart data={caSeries} height={150} valueFormat={formatCurrency} />

// Jauge d'objectif
<RadialGauge value={productionProgress} size={52} stroke={6} />

// Donut de répartition
<DonutChart data={[{label:'Matières', value:120000, className:'text-sand-900'}, {label:'Charges', value:60000, className:'text-gold-500'}]} centerValue="180K" centerLabel="FCFA" />

// Badge de statut
<Badge tone="success" icon="mdi:check-circle">Payée</Badge>
```

### Shell
- **Sidebar** repliable en rail d'icônes (`Layout` gère `collapsed`, mémorisé en `localStorage`) ; actif = `bg-sand-100 text-sand-900`.
- **Topbar** : toggle du rail, recherche, notifications, profil + rôle, déconnexion.

---

## 5. Règles
1. **Jamais de couleur en dur** — toujours un token.
2. **Un seul accent coloré** (indigo/`gold`), utilisé avec parcimonie ; le reste est neutre + noir.
3. **Inter partout**, chiffres en `.tabular-nums`.
4. **Cartes** : `bg-white border border-sand-200 rounded-xl shadow-card`.
5. **Densité** : privilégier tableaux compacts, en-têtes de colonnes `uppercase text-xs text-sand-500`, lignes séparées `border-sand-100`.
6. **Statuts** = `Badge` colorés (les seules touches de couleur avec l'accent).
7. **Graphiques** via les composants dataviz du DS (jamais de lib ad hoc).

---

*Design system « Chez Mina » — Monochrome Pro · mis à jour le 2026-07-03. Tokens : `src/index.css`.*
