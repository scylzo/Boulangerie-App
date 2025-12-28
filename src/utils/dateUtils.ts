/**
 * Fonctions utilitaires pour la gestion des dates
 */

// Formatage des dates
export const formaterDate = (date: Date): string => {
  return date.toLocaleDateString('fr-FR');
};

export const formaterDateHeure = (date: Date): string => {
  return date.toLocaleString('fr-FR');
};

export const formaterDateISO = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// Manipulation des dates
export const ajouterJours = (date: Date, jours: number): Date => {
  const nouvelleDate = new Date(date);
  nouvelleDate.setDate(nouvelleDate.getDate() + jours);
  return nouvelleDate;
};

export const obtenirDemain = (): Date => {
  return ajouterJours(new Date(), 1);
};

export const obtenirHier = (): Date => {
  return ajouterJours(new Date(), -1);
};

export const obtenirAujourdhui = (): Date => {
  return new Date();
};

// Comparaison des dates
export const memeJour = (date1: Date, date2: Date): boolean => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

export const estAujourdhui = (date: Date): boolean => {
  return memeJour(date, new Date());
};

export const estDemain = (date: Date): boolean => {
  return memeJour(date, obtenirDemain());
};

export const estHier = (date: Date): boolean => {
  return memeJour(date, obtenirHier());
};

// Début et fin de journée
export const debutDeJournee = (date: Date): Date => {
  const nouveauDate = new Date(date);
  nouveauDate.setHours(0, 0, 0, 0);
  return nouveauDate;
};

export const finDeJournee = (date: Date): Date => {
  const nouveauDate = new Date(date);
  nouveauDate.setHours(23, 59, 59, 999);
  return nouveauDate;
};

// Gestion des heures de service
export const estHeuresMatin = (): boolean => {
  const maintenant = new Date();
  return maintenant.getHours() >= 6 && maintenant.getHours() < 14;
};

export const estHeuresSoir = (): boolean => {
  const maintenant = new Date();
  return maintenant.getHours() >= 14 && maintenant.getHours() < 20;
};

export const estHorsHeures = (): boolean => {
  return !estHeuresMatin() && !estHeuresSoir();
};

// Jours de la semaine
export const estWeekend = (date: Date): boolean => {
  const jour = date.getDay();
  return jour === 0 || jour === 6; // Dimanche = 0, Samedi = 6
};

export const estJourOuvre = (date: Date): boolean => {
  return !estWeekend(date);
};

export const obtenirNomJour = (date: Date): string => {
  const jours = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  return jours[date.getDay()];
};

// Plage de dates
export const obtenirPlageDates = (dateDebut: Date, dateFin: Date): Date[] => {
  const dates: Date[] = [];
  let dateActuelle = new Date(dateDebut);

  while (dateActuelle <= dateFin) {
    dates.push(new Date(dateActuelle));
    dateActuelle = ajouterJours(dateActuelle, 1);
  }

  return dates;
};

export const obtenirDerniersSeptJours = (): Date[] => {
  const aujourd_hui = new Date();
  const il_y_a_sept_jours = ajouterJours(aujourd_hui, -6);
  return obtenirPlageDates(il_y_a_sept_jours, aujourd_hui);
};