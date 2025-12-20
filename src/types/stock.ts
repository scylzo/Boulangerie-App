export interface Fournisseur {
    id: string;
    nom: string;
    contact: string;
    telephone?: string;
    adresse?: string;
    categories: string[]; // ex: ['Farine', 'Levure', 'Emballage']
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export type UniteMesure = 'kg' | 'g' | 'l' | 'ml' | 'piece' | 'sac_50kg' | 'sac_25kg';

export interface MatierePremiere {
    id: string;
    nom: string;
    unite: UniteMesure;
    stockActuel: number;
    stockMinimum: number; // Seuil d'alerte
    prixMoyenPondere: number; // PMP en FCFA
    valeurTotale: number; // stockActuel * prixMoyenPondere
    fournisseurPrincipalId?: string;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export type TypeMouvement = 'achat' | 'consommation' | 'perte' | 'correction' | 'retour_fournisseur';

export interface MouvementStock {
    id: string;
    date: Date;
    matiereId: string;
    type: TypeMouvement;
    quantite: number; // Positive pour entrée, négative pour sortie/perte
    prixUnitaire?: number; // Pour les achats (FCFA)
    prixTotal?: number; // Pour les achats (FCFA)
    motif?: string; // ex: "Production matin", "Sac déchiré"
    referenceDocument?: string; // N° Facture, BL...
    auteur?: string; // Celui qui saisit ou effectue l'action
    responsable?: string; // Celui qui valide (nouveau champ)
    fournisseurId?: string; // Lien avec le fournisseur (pour achats)
    userId: string; // Qui a saisi le mouvement
    createdAt: Date;
}
