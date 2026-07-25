/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from '@iconify/react';
import type { Livreur, Produit, CommandeClient, Client, CarLivraison } from '../../types';
import { useLivraisonStore } from '../../store/livraisonStore';
import {
  redistribuerQuantites,
  meulerScorePerformanceClient,
  type ClientAllocationInput,
  type ClientAllocationResult,
  type RedistributionMethod
} from '../../utils/redistributionEngine';
import toast from 'react-hot-toast';

interface ModalDeficitProductionProps {
  isOpen: boolean;
  onClose: () => void;
  initialLivreurId?: string | null;
  initialCar?: CarLivraison | 'tous';
  dateLivraison: string; // YYYY-MM-DD
  commandesClients: CommandeClient[];
  livreurs: Livreur[];
  produits: Produit[];
  clients: Client[];
  onApplyRedistribution: (
    updates: Array<{
      commandeId: string;
      produitId: string;
      carLivraison?: string;
      nouvelleQuantite: number;
    }>
  ) => Promise<void>;
}

export const ModalDeficitProduction: React.FC<ModalDeficitProductionProps> = ({
  isOpen,
  onClose,
  initialLivreurId,
  initialCar = 'tous',
  dateLivraison,
  commandesClients,
  livreurs,
  produits,
  clients,
  onApplyRedistribution
}) => {
  const { invendusClients, chargerInvendusPeriode } = useLivraisonStore();

  const [selectedLivreurId, setSelectedLivreurId] = useState<string>('');
  const [selectedCar, setSelectedCar] = useState<CarLivraison | 'tous'>(initialCar);

  useEffect(() => {
    if (isOpen) {
      setSelectedCar(initialCar || 'tous');
    }
  }, [isOpen, initialCar]);
  const [selectedProduitId, setSelectedProduitId] = useState<string>('');
  const [quantiteDispoInput, setQuantiteDispoInput] = useState<string>('');
  const [methode, setMethode] = useState<RedistributionMethod>('performance');
  const [allocationResults, setAllocationResults] = useState<ClientAllocationResult[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Charger les invendus récents (30 derniers jours) pour calculer les performances
  useEffect(() => {
    if (isOpen) {
      const dateFin = new Date(dateLivraison);
      const dateDebut = new Date(dateLivraison);
      dateDebut.setDate(dateDebut.getDate() - 30);
      chargerInvendusPeriode(dateDebut, dateFin).catch(console.warn);
    }
  }, [isOpen, dateLivraison, chargerInvendusPeriode]);

  // Initialiser le livreur sélectionné
  useEffect(() => {
    if (isOpen) {
      if (initialLivreurId) {
        setSelectedLivreurId(initialLivreurId);
      } else if (livreurs.length > 0) {
        setSelectedLivreurId(livreurs[0].id);
      }
    }
  }, [isOpen, initialLivreurId, livreurs]);

  // Extraire les clients et produits concernés par ce livreur et ce car pour cette date
  const clientInputsDisponibles = useMemo(() => {
    if (!selectedLivreurId) return { produitIds: [], inputsByProduit: new Map<string, ClientAllocationInput[]>() };

    const inputsByProduit = new Map<string, ClientAllocationInput[]>();

    commandesClients.forEach(cmd => {
      const client = clients.find(c => c.id === cmd.clientId);
      if (!client) return;

      cmd.produits.forEach(p => {
        if (!p.quantiteCommandee || p.quantiteCommandee <= 0) return;

        // Si le produit a une répartition par car
        if (p.repartitionCars) {
          Object.entries(p.repartitionCars).forEach(([carKey, qte]) => {
            if (!qte || qte <= 0) return;
            if (selectedCar !== 'tous' && carKey !== selectedCar) return;

            const key = carKey as keyof NonNullable<typeof client.livreursParCar>;
            const carLivreurId = client.livreursParCar?.[key] || client.livreurId || 'non-assigne';

            if (carLivreurId === selectedLivreurId) {
              if (!inputsByProduit.has(p.produitId)) {
                inputsByProduit.set(p.produitId, []);
              }

              // Déterminer la quantité initiale originale depuis la commandeType du client si disponible
              const ctItem = client.commandeType?.find(ct => ct.produitId === p.produitId);
              let qteInitialeOrigine = qte;
              if (ctItem?.repartitionCars && (ctItem.repartitionCars as any)[carKey] !== undefined) {
                const val = Number((ctItem.repartitionCars as any)[carKey]);
                if (!isNaN(val) && val > 0) qteInitialeOrigine = val;
              }

              inputsByProduit.get(p.produitId)!.push({
                commandeId: cmd.id,
                clientId: client.id,
                clientNom: client.nom,
                carLivraison: carKey,
                produitId: p.produitId,
                quantiteInitiale: Math.max(qte, qteInitialeOrigine)
              });
            }
          });
        } else {
          if (selectedCar !== 'tous') return;
          // Sinon fallback livreur standard
          const carLivreurId = client.livreurId || 'non-assigne';
          if (carLivreurId === selectedLivreurId) {
            if (!inputsByProduit.has(p.produitId)) {
              inputsByProduit.set(p.produitId, []);
            }

            const ctItem = client.commandeType?.find(ct => ct.produitId === p.produitId);
            let qteInitialeOrigine = p.quantiteCommandee;
            if (ctItem?.quantiteCommandee) {
              const val = Number(ctItem.quantiteCommandee);
              if (!isNaN(val) && val > 0) qteInitialeOrigine = val;
            }

            inputsByProduit.get(p.produitId)!.push({
              commandeId: cmd.id,
              clientId: client.id,
              clientNom: client.nom,
              produitId: p.produitId,
              quantiteInitiale: Math.max(p.quantiteCommandee, qteInitialeOrigine)
            });
          }
        }
      });
    });

    const produitIds = Array.from(inputsByProduit.keys());
    return { produitIds, inputsByProduit };
  }, [selectedLivreurId, selectedCar, commandesClients, clients]);

  // Sélectionner automatiquement le 1er produit disponible
  useEffect(() => {
    if (clientInputsDisponibles.produitIds.length > 0) {
      if (!clientInputsDisponibles.produitIds.includes(selectedProduitId)) {
        setSelectedProduitId(clientInputsDisponibles.produitIds[0]);
      }
    } else {
      setSelectedProduitId('');
    }
  }, [clientInputsDisponibles, selectedProduitId]);

  const inputsDuProduitSelectionne = useMemo(() => {
    return clientInputsDisponibles.inputsByProduit.get(selectedProduitId) || [];
  }, [clientInputsDisponibles, selectedProduitId]);

  const quantiteTotalePrévue = useMemo(() => {
    return inputsDuProduitSelectionne.reduce((sum, item) => sum + item.quantiteInitiale, 0);
  }, [inputsDuProduitSelectionne]);

  // Réinitialiser le champ dispo avec la quantité totale disponible par défaut
  useEffect(() => {
    setQuantiteDispoInput(quantiteTotalePrévue.toString());
  }, [quantiteTotalePrévue, selectedProduitId]);

  // Exécuter l'algorithme de redistribution lors des changements
  useEffect(() => {
    const qteDispo = parseInt(quantiteDispoInput, 10);
    if (isNaN(qteDispo) || qteDispo < 0) {
      setAllocationResults([]);
      return;
    }

    const results = redistribuerQuantites(
      inputsDuProduitSelectionne,
      qteDispo,
      methode,
      invendusClients
    );
    setAllocationResults(results);
  }, [inputsDuProduitSelectionne, quantiteDispoInput, methode, invendusClients]);

  // Modification manuelle d'une ligne
  const handleQuantiteManualChange = (index: number, newVal: string) => {
    const valInt = Math.max(0, parseInt(newVal, 10) || 0);
    setAllocationResults(prev => {
      const copy = [...prev];
      if (copy[index]) {
        copy[index] = {
          ...copy[index],
          quantiteAttribuee: valInt,
          difference: valInt - copy[index].quantiteInitiale
        };
      }
      return copy;
    });
  };

  const totalAttribueActuel = useMemo(() => {
    return allocationResults.reduce((sum, item) => sum + item.quantiteAttribuee, 0);
  }, [allocationResults]);

  const targetDispo = parseInt(quantiteDispoInput, 10) || 0;
  const isTotalExact = totalAttribueActuel === targetDispo;

  const handleRecalculateAuto = () => {
    const results = redistribuerQuantites(
      inputsDuProduitSelectionne,
      targetDispo,
      methode,
      invendusClients
    );
    setAllocationResults(results);
  };

  const handleResetToInitial = () => {
    setQuantiteDispoInput(quantiteTotalePrévue.toString());
    const initialResults = inputsDuProduitSelectionne.map(item => ({
      ...item,
      performanceScore: meulerScorePerformanceClient(item.clientId, item.produitId, invendusClients),
      quantiteAttribuee: item.quantiteInitiale,
      difference: 0
    }));
    setAllocationResults(initialResults);
    toast.success("Quantités réinitialisées à la répartition initiale (100%).");
  };

  const handleSubmit = async () => {
    if (allocationResults.length === 0) {
      toast.error('Aucune répartition à appliquer.');
      return;
    }

    if (!isTotalExact) {
      const diff = totalAttribueActuel - targetDispo;
      const msg = diff > 0
        ? `Le total attribué (${totalAttribueActuel}) dépasse la quantité disponible (${targetDispo}) de ${diff} unités.`
        : `Le total attribué (${totalAttribueActuel}) est inférieur à la quantité disponible (${targetDispo}) de ${Math.abs(diff)} unités.`;
      
      toast.error(msg);
      return;
    }

    setIsSubmitting(true);
    try {
      const updates = allocationResults.map(res => ({
        commandeId: res.commandeId,
        produitId: res.produitId,
        carLivraison: res.carLivraison,
        nouvelleQuantite: res.quantiteAttribuee
      }));

      await onApplyRedistribution(updates);
      toast.success(`✅ Redistribution de ${targetDispo} unités appliquée avec succès !`);
      onClose();
    } catch (error) {
      console.error('Erreur application redistribution:', error);
      toast.error('Erreur lors de la mise à jour des commandes.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const livreurActuel = livreurs.find(l => l.id === selectedLivreurId);
  const produitActuel = produits.find(p => p.id === selectedProduitId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-sand-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl border border-sand-200 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* En-tête de la Modal */}
        <div className="bg-sand-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-terracotta-500 rounded-xl flex items-center justify-center text-white shrink-0">
              <Icon icon="mdi:lightning-bolt" className="text-2xl" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold font-display">
                Gestion Déficit de Production
              </h2>
              <p className="text-xs text-sand-300">
                Redistribution intelligente des pains disponible par livreur
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-sand-800 hover:bg-sand-700 flex items-center justify-center text-sand-300 hover:text-white transition-colors"
          >
            <Icon icon="mdi:close" className="text-xl" />
          </button>
        </div>

        {/* Corps de la Modal */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Sélection Livreur, Car & Produit */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-sand-50 p-4 rounded-xl border border-sand-200">
            <div>
              <label className="block text-xs font-semibold text-sand-700 mb-1">Livreur concerné</label>
              <select
                value={selectedLivreurId}
                onChange={e => setSelectedLivreurId(e.target.value)}
                className="w-full h-10 px-3 border border-sand-300 rounded-lg bg-white font-medium text-sm text-sand-900 focus:ring-2 focus:ring-terracotta-500"
              >
                {livreurs.map(l => (
                  <option key={l.id} value={l.id}>{l.nom} {l.vehicule ? `(${l.vehicule})` : ''}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-sand-700 mb-1">Car / Tournée</label>
              <select
                value={selectedCar}
                onChange={e => setSelectedCar(e.target.value as CarLivraison | 'tous')}
                className="w-full h-10 px-3 border border-sand-300 rounded-lg bg-white font-medium text-sm text-sand-900 focus:ring-2 focus:ring-terracotta-500"
              >
                <option value="tous">Tous les cars</option>
                <option value="car1_matin">Car 1 - Matin</option>
                <option value="car2_matin">Car 2 - Matin</option>
                <option value="car_soir">Car - Soir</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-sand-700 mb-1">Produit à redistribuer</label>
              <select
                value={selectedProduitId}
                onChange={e => setSelectedProduitId(e.target.value)}
                disabled={clientInputsDisponibles.produitIds.length === 0}
                className="w-full h-10 px-3 border border-sand-300 rounded-lg bg-white font-medium text-sm text-sand-900 focus:ring-2 focus:ring-terracotta-500 disabled:bg-sand-100"
              >
                {clientInputsDisponibles.produitIds.length === 0 ? (
                  <option value="">Aucun produit pour ce car</option>
                ) : (
                  clientInputsDisponibles.produitIds.map(pId => {
                    const prod = produits.find(p => p.id === pId);
                    return <option key={pId} value={pId}>{prod?.nom || 'Produit inconnu'}</option>;
                  })
                )}
              </select>
            </div>
          </div>

          {inputsDuProduitSelectionne.length === 0 ? (
            <div className="p-8 text-center bg-sand-50 rounded-xl border border-dashed border-sand-300">
              <Icon icon="mdi:alert-circle-outline" className="text-4xl text-sand-400 mx-auto mb-2" />
              <p className="text-sand-600 font-medium">
                Aucune commande client trouvée pour {livreurActuel?.nom || 'ce livreur'} à la date du {dateLivraison}.
              </p>
            </div>
          ) : (
            <>
              {/* Quantité disponible & Méthode de calcul */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center bg-white p-4 rounded-xl border border-sand-200 shadow-sm">
                <div>
                  <div className="text-xs text-sand-500 font-medium">Total initialement prévu</div>
                  <div className="text-2xl font-bold font-display text-sand-900">
                    {quantiteTotalePrévue} <span className="text-xs font-normal text-sand-500">unités</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-sand-700 mb-1">
                    Quantité réellement disponible (Production)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max={quantiteTotalePrévue}
                      value={quantiteDispoInput}
                      onChange={e => setQuantiteDispoInput(e.target.value)}
                      className="w-full h-11 px-3 border-2 border-terracotta-500 rounded-lg text-lg font-bold text-sand-900 focus:ring-2 focus:ring-terracotta-400"
                    />
                    {targetDispo < quantiteTotalePrévue && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-danger-600 bg-danger-50 px-2 py-0.5 rounded">
                        Déficit : {targetDispo - quantiteTotalePrévue}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-sand-700 mb-1">Règle de redistribution</label>
                  <div className="flex bg-sand-100 p-1 rounded-lg border border-sand-200">
                    <button
                      type="button"
                      onClick={() => setMethode('performance')}
                      className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1 ${
                        methode === 'performance'
                          ? 'bg-white text-sand-900 shadow-sm'
                          : 'text-sand-600 hover:text-sand-900'
                      }`}
                    >
                      <Icon icon="mdi:star" className="text-warning-500" />
                      <span>Ventes (Performance)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMethode('prorata')}
                      className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1 ${
                        methode === 'prorata'
                          ? 'bg-white text-sand-900 shadow-sm'
                          : 'text-sand-600 hover:text-sand-900'
                      }`}
                    >
                      <Icon icon="mdi:scale-balance" className="text-info-500" />
                      <span>Prorata strict</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Tableau de proposition de redistribution */}
              <div className="border border-sand-200 rounded-xl overflow-hidden shadow-sm bg-white">
                <div className="bg-sand-100 px-4 py-2.5 border-b border-sand-200 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-sand-700 uppercase tracking-wider">
                    Proposition de Répartition ({allocationResults.length} clients)
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleResetToInitial}
                      className="text-xs text-sand-700 hover:text-sand-900 font-semibold flex items-center gap-1 bg-white px-2.5 py-1 rounded border border-sand-300 shadow-2xs hover:bg-sand-50 transition-colors"
                      title="Annuler le déficit et réinitialiser aux quantités prévues d'origine"
                    >
                      <Icon icon="mdi:undo-variant" className="text-sand-600" />
                      <span>Rétablir initial (100%)</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRecalculateAuto}
                      className="text-xs text-terracotta-600 hover:text-terracotta-800 font-semibold flex items-center gap-1 bg-white px-2.5 py-1 rounded border border-terracotta-200 shadow-2xs hover:bg-terracotta-50 transition-colors"
                    >
                      <Icon icon="mdi:refresh" />
                      <span>Recalculer déficit</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-sand-50 text-sand-600 font-semibold border-b border-sand-200">
                      <tr>
                        <th className="py-2.5 px-3">Client</th>
                        <th className="py-2.5 px-3 text-center">Taux Vente (30j)</th>
                        <th className="py-2.5 px-3 text-right">Prévu Initial</th>
                        <th className="py-2.5 px-3 text-center w-36">Attribué Redéfini</th>
                        <th className="py-2.5 px-3 text-right">Écart</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sand-100">
                      {allocationResults.map((res, idx) => {
                        const scorePct = Math.round(res.performanceScore * 100);
                        const carLabel = res.carLivraison === 'car1_matin' ? 'Car 1' : res.carLivraison === 'car2_matin' ? 'Car 2' : res.carLivraison === 'car_soir' ? 'Car Soir' : '';

                        return (
                          <tr key={`${res.commandeId}_${res.carLivraison || idx}`} className="hover:bg-sand-50/80 transition-colors">
                            <td className="py-2.5 px-3 font-medium text-sand-900">
                              <div>{res.clientNom}</div>
                              {carLabel && <span className="text-[10px] bg-sand-200 text-sand-700 px-1.5 py-0.5 rounded font-mono">{carLabel}</span>}
                            </td>

                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                                  scorePct >= 90
                                    ? 'bg-success-100 text-success-700'
                                    : scorePct >= 70
                                    ? 'bg-warning-100 text-warning-700'
                                    : 'bg-danger-100 text-danger-700'
                                }`}
                              >
                                {scorePct}%
                              </span>
                            </td>

                            <td className="py-2.5 px-3 text-right font-medium text-sand-600">
                              {res.quantiteInitiale}
                            </td>

                            <td className="py-2.5 px-3 text-center">
                              <input
                                type="number"
                                min="0"
                                max={res.quantiteInitiale}
                                value={res.quantiteAttribuee}
                                onChange={e => handleQuantiteManualChange(idx, e.target.value)}
                                className="w-20 px-2 py-1 border border-sand-300 rounded font-bold text-center text-sand-900 focus:ring-2 focus:ring-terracotta-500"
                              />
                            </td>

                            <td className="py-2.5 px-3 text-right font-semibold">
                              <span className={res.difference < 0 ? 'text-danger-600' : res.difference > 0 ? 'text-success-600' : 'text-sand-400'}>
                                {res.difference > 0 ? `+${res.difference}` : res.difference}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Pied de la Modal & Synthèse */}
        <div className="bg-sand-50 p-4 border-t border-sand-200 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border ${
              isTotalExact
                ? 'bg-success-50 text-success-700 border-success-200'
                : 'bg-danger-50 text-danger-700 border-danger-200'
            }`}>
              <Icon icon={isTotalExact ? "mdi:check-circle" : "mdi:alert-circle"} className="text-base" />
              <span>Total Réparti : {totalAttribueActuel} / {targetDispo}</span>
            </div>
            {!isTotalExact && (
              <span className="text-xs text-danger-600 font-medium hidden sm:inline">
                ({totalAttribueActuel > targetDispo ? `Dépassement de ${totalAttribueActuel - targetDispo}` : `Manque ${targetDispo - totalAttribueActuel}`})
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-sand-300 text-sand-700 hover:bg-sand-100 rounded-xl font-medium text-xs sm:text-sm transition-colors flex-1 sm:flex-none"
            >
              Annuler
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || allocationResults.length === 0 || !isTotalExact}
              className="px-5 py-2 bg-terracotta-600 hover:bg-terracotta-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed flex-1 sm:flex-none"
            >
              {isSubmitting ? (
                <>
                  <Icon icon="mdi:loading" className="animate-spin" />
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <Icon icon="mdi:check" />
                  <span>Appliquer la redistribution ({produitActuel?.nom})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
