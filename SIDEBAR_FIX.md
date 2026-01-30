# ✅ Sidebar - Fermeture Automatique

## 📋 Résumé
Amélioration de l'expérience utilisateur sur mobile (UX) : la barre latérale de navigation (Sidebar) se ferme désormais automatiquement après avoir cliqué sur un lien.

## 🔧 Modification Appliquée

Sur le composant `Sidebar` (`src/components/layout/Sidebar.tsx`), ajout de l'événement `onClick` appelant la fonction `onClose` sur chaque élément `NavLink`.

```tsx
<NavLink
  to={item.href}
  onClick={onClose} // <- Ajouté
  className={...}
>
  ...
</NavLink>
```

## 🚀 Impact
- **Mobile** : La navigation est fluide, l'utilisateur n'a plus besoin de fermer manuellement le menu après avoir choisi une page.
- **Desktop** : Aucun changement visuel, la sidebar reste fixe (le state `isOpen` change mais n'affecte pas l'affichage grâce à `lg:translate-x-0`).
