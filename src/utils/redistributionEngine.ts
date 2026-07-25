import type { InvendusClient } from '../types';

export interface ClientAllocationInput {
  commandeId: string;
  clientId: string;
  clientNom: string;
  carLivraison?: string;
  produitId: string;
  quantiteInitiale: number;
}

export interface ClientAllocationResult extends ClientAllocationInput {
  performanceScore: number; // Taux de vente entre 0 et 1 (ex: 0.95 = 95% de ventes)
  quantiteAttribuee: number;
  difference: number; // quantiteAttribuee - quantiteInitiale
}

export type RedistributionMethod = 'performance' | 'prorata';

/**
 * Calcule le score de performance (taux de vente) d'un client à partir de l'historique des invendus.
 * Si le client n'a pas d'historique, un score par défaut (1.0 = 100%) lui est attribué.
 */
export function meulerScorePerformanceClient(
  clientId: string,
  produitId: string,
  historiqueInvendus: InvendusClient[]
): number {
  if (!historiqueInvendus || historiqueInvendus.length === 0) {
    return 1.0; // Score par défaut parfait si aucun historique
  }

  const retoursClient = historiqueInvendus.filter(i => i.clientId === clientId);
  if (retoursClient.length === 0) {
    return 1.0;
  }

  let totalLivree = 0;
  let totalInvendus = 0;

  retoursClient.forEach(retour => {
    retour.produits.forEach(p => {
      if (p.produitId === produitId) {
        totalLivree += p.quantiteLivree || 0;
        totalInvendus += p.invendus || 0;
      }
    });
  });

  if (totalLivree <= 0) {
    return 1.0;
  }

  const vendu = Math.max(0, totalLivree - totalInvendus);
  const ratio = vendu / totalLivree;
  
  // Limiter entre 0.05 et 1.0 (minimum 5% pour ne pas complètement éliminer un client)
  return Math.min(1.0, Math.max(0.05, ratio));
}

/**
 * Moteur de redistribution de quantité en cas de déficit de production.
 */
export function redistribuerQuantites(
  clientsInputs: ClientAllocationInput[],
  quantiteDisponible: number,
  methode: RedistributionMethod,
  historiqueInvendus: InvendusClient[] = []
): ClientAllocationResult[] {
  if (clientsInputs.length === 0) return [];

  const totalDemande = clientsInputs.reduce((sum, item) => sum + item.quantiteInitiale, 0);

  // Cas trivial 1 : Si la quantité dispo >= demande totale, chacun reçoit sa commande intégrale
  if (quantiteDisponible >= totalDemande || totalDemande === 0) {
    return clientsInputs.map(item => ({
      ...item,
      performanceScore: meulerScorePerformanceClient(item.clientId, item.produitId, historiqueInvendus),
      quantiteAttribuee: item.quantiteInitiale,
      difference: 0
    }));
  }

  // Cas trivial 2 : Si la quantité disponible est 0
  if (quantiteDisponible <= 0) {
    return clientsInputs.map(item => ({
      ...item,
      performanceScore: meulerScorePerformanceClient(item.clientId, item.produitId, historiqueInvendus),
      quantiteAttribuee: 0,
      difference: -item.quantiteInitiale
    }));
  }

  // Étape 1 : Calcul des scores et des poids
  const itemsAvecScore = clientsInputs.map(item => {
    const score = meulerScorePerformanceClient(item.clientId, item.produitId, historiqueInvendus);
    
    // Poids de calcul :
    // - Prorata : Poids = Quantité demandée
    // - Performance : Poids = Quantité demandée * Score de performance
    const poids = methode === 'performance'
      ? item.quantiteInitiale * score
      : item.quantiteInitiale;

    return {
      ...item,
      score,
      poids
    };
  });

  const totalPoids = itemsAvecScore.reduce((sum, item) => sum + item.poids, 0);
  const diviseurPoids = totalPoids > 0 ? totalPoids : 1;

  // Étape 2 : Attribution brute flottante
  const allocationsFlottantes = itemsAvecScore.map(item => {
    const rationBrute = (item.poids / diviseurPoids) * quantiteDisponible;
    // Ne jamais attribuer plus que la quantité initialement demandée
    const rationCappe = Math.min(item.quantiteInitiale, rationBrute);
    return {
      item,
      rationBrute: rationCappe,
      partEntiere: Math.floor(rationCappe),
      partFractionnaire: rationCappe - Math.floor(rationCappe)
    };
  });

  // Étape 3 : Gestion du reste des entiers pour garantir que la somme exacte = quantiteDisponible
  let sommeActuelle = allocationsFlottantes.reduce((sum, a) => sum + a.partEntiere, 0);
  let resteADistribuer = quantiteDisponible - sommeActuelle;

  // Trier par fraction décroissante pour distribuer les +1 restants
  const copiesPourRestes = [...allocationsFlottantes].sort((a, b) => b.partFractionnaire - a.partFractionnaire);

  const attributionFinaleMap = new Map<string, number>();
  allocationsFlottantes.forEach(a => {
    attributionFinaleMap.set(`${a.item.commandeId}_${a.item.carLivraison || 'def'}`, a.partEntiere);
  });

  let index = 0;
  while (resteADistribuer > 0 && copiesPourRestes.length > 0) {
    const candidate = copiesPourRestes[index % copiesPourRestes.length];
    const key = `${candidate.item.commandeId}_${candidate.item.carLivraison || 'def'}`;
    const actuel = attributionFinaleMap.get(key) || 0;

    // Ne pas dépasser la quantité demandée initialement
    if (actuel < candidate.item.quantiteInitiale) {
      attributionFinaleMap.set(key, actuel + 1);
      resteADistribuer--;
    }
    index++;
    // Sécurité contre boucle infinie si toutes les limites sont atteintes
    if (index > copiesPourRestes.length * 2 && resteADistribuer > 0) {
      break;
    }
  }

  // Étape 4 : Formatage du résultat final
  return clientsInputs.map(item => {
    const key = `${item.commandeId}_${item.carLivraison || 'def'}`;
    const quantiteAttribuee = attributionFinaleMap.get(key) ?? 0;
    const performanceScore = meulerScorePerformanceClient(item.clientId, item.produitId, historiqueInvendus);

    return {
      ...item,
      performanceScore,
      quantiteAttribuee,
      difference: quantiteAttribuee - item.quantiteInitiale
    };
  });
}
