export type CategorieDepense =
    | 'Carburant Véhicule'
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
    createdAt: Date;
    updatedAt: Date;
}

// Pour les statistiques
export interface SyntheseDepenses {
    periode: string; // "Janvier 2024"
    total: number;
    parCategorie: Record<CategorieDepense, number>;
}
