
export interface Module {
  id: string;
  name: string;
  href: string;
  icon: string;
}

export const APP_MODULES: Module[] = [
  { id: 'dashboard', name: 'Tableau de bord', href: '/dashboard', icon: 'mdi:view-dashboard' },
  { id: 'production', name: 'Programme Production', href: '/production', icon: 'mdi:clipboard-text' },
  { id: 'boulanger', name: 'Vue Boulanger', href: '/boulanger', icon: 'ph:chef-hat-bold' },
  { id: 'rotation', name: 'Rotation Boulangers', href: '/rotation-boulangers', icon: 'mdi:calendar-sync' },
  { id: 'livraison', name: 'Livraisons', href: '/livraison', icon: 'lucide:truck' },
  { id: 'retours', name: 'Retours Clients', href: '/retours', icon: 'mdi:keyboard-return' },
  { id: 'boutique', name: 'Boutique', href: '/boutique', icon: 'mdi:store' },
  { id: 'facturation', name: 'Facturation', href: '/facturation', icon: 'mdi:file-document' },
  { id: 'stocks', name: 'Stocks', href: '/stocks', icon: 'mdi:warehouse' },
  { id: 'depenses', name: 'Dépenses', href: '/depenses', icon: 'mdi:cash-multiple' },
  { id: 'comptabilite', name: 'Comptabilité', href: '/comptabilite', icon: 'mdi:calculator' },
  { id: 'rapport', name: 'Rapport Journalier', href: '/rapport', icon: 'mdi:chart-bar' },
  { id: 'fiche_produit', name: 'Fiche Produit', href: '/admin/fiche-produit', icon: 'mdi:file-certificate' },
  { id: 'admin_produits', name: 'Gestion Produits', href: '/admin/produits', icon: 'mdi:bread-slice' },
  { id: 'admin_clients', name: 'Gestion Clients', href: '/admin/clients', icon: 'mdi:account-group' },
  { id: 'admin_livreurs', name: 'Gestion Livreurs', href: '/admin/livreurs', icon: 'mdi:motorbike' },
  { id: 'admin_users', name: 'Gestion Utilisateurs', href: '/admin/users', icon: 'mdi:account-key' },
];
