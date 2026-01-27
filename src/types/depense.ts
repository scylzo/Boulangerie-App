export type CategorieDepense =
    | 'Carburant Véhicule'
    | 'Carburant Moto'
    | 'Carburant Four'
    | 'Électricité'
    | 'Eau'
    | 'Loyer'
    | 'Salaires'
    | 'Entretien'
    | 'Intrants'
    | 'Marketing'
    | 'Transport'
    | 'Divers';

export interface Depense {
    id: string;
    date: Date;
    montant: number; // En FCFA
    categorie: CategorieDepense;
    description: string;
    fournisseur?: string; // Nom du fournisseur ou station service
    moyenPaiement?: 'Especes' | 'Mobile Money' | 'Virement' | 'Cheque';
    userId: string; // Autheur de la saisie
    dateDebutUsage?: Date; // Pour les dépenses sur une période (ex: Loyer, Carburant)
    dateFinUsage?: Date;   // Pour les dépenses sur une période
    createdAt: Date;
    updatedAt: Date;
}

// Pour les statistiques
export interface SyntheseDepenses {
    periode: string; // "Janvier 2024"
    total: number;
    parCategorie: Record<CategorieDepense, number>;
}
