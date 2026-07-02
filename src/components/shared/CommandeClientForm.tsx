import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';

import type { Produit, Client, CommandeClient } from '../../types';
import { useProductionStore } from '../../store'; // Import store
import toast from 'react-hot-toast';

interface CommandeClientFormProps {
  produits: Produit[];
  clients: Client[];
  commande?: CommandeClient | null; // Commande à éditer (null pour ajout)
  mode?: 'create' | 'edit' | 'addProducts' | 'editSpecific'; // Mode d'utilisation du formulaire
  onSave: (commande: Omit<CommandeClient, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
  isLoading?: boolean;
  // État persisté du formulaire
  formulaireState?: {
    selectedClientId: string;
    dateLivraison: string;
    produitsCommandes: ProduitCommande[];
    utiliserPrixClient: boolean;
  };
  onUpdateFormulaire?: (updates: any) => void;
}

interface ProduitCommande {
  produitId: string;
  quantiteCommandee: number;
  prixUnitaire?: number;
  repartitionCars?: {
    car1_matin: number | string;
    car2_matin: number | string;
    car_soir: number | string;
  };
}

export const CommandeClientForm: React.FC<CommandeClientFormProps> = ({
  produits,
  clients,
  commande,
  mode = 'create',
  onSave,
  onCancel,
  isLoading = false,
  formulaireState,
  onUpdateFormulaire
}) => {
  // Utiliser l'état persisté s'il est fourni, sinon état local
  const [selectedClientId, setSelectedClientId] = useState(formulaireState?.selectedClientId || '');
  const [dateLivraison, setDateLivraison] = useState(
    formulaireState?.dateLivraison || new Date().toISOString().split('T')[0]
  );
  const [produitsCommandes, setProduitsCommandes] = useState<ProduitCommande[]>(formulaireState?.produitsCommandes || []);
  const [utiliserPrixClient, setUtiliserPrixClient] = useState(formulaireState?.utiliserPrixClient ?? true);

  // Synchroniser avec l'état persisté
  useEffect(() => {
    if (onUpdateFormulaire) {
      onUpdateFormulaire({
        selectedClientId,
        dateLivraison,
        produitsCommandes,
        utiliserPrixClient
      });
    }
  }, [selectedClientId, dateLivraison, produitsCommandes, utiliserPrixClient, onUpdateFormulaire]);

  // Initialiser le formulaire avec la commande à éditer
  useEffect(() => {
    if (commande) {
      setSelectedClientId(commande.clientId);

      // Gérer la date de livraison de manière sécurisée
      try {
        const dateLiv = commande.dateLivraison instanceof Date
          ? commande.dateLivraison
          : new Date(commande.dateLivraison);

        if (!isNaN(dateLiv.getTime())) {
          setDateLivraison(dateLiv.toISOString().split('T')[0]);
        } else {
          setDateLivraison(new Date().toISOString().split('T')[0]);
        }
      } catch (error) {
        console.error('Erreur de conversion de date:', error);
        setDateLivraison(new Date().toISOString().split('T')[0]);
      }

      // En mode édition complète, charger tous les produits existants
      // En mode ajout de produits, commencer avec une liste vide
      // En mode édition spécifique, charger seulement le produit spécifique
      if (mode === 'edit' || mode === 'editSpecific') {
        setProduitsCommandes(commande.produits.map(p => ({
          produitId: p.produitId,
          quantiteCommandee: p.quantiteCommandee,
          prixUnitaire: p.prixUnitaire,
          repartitionCars: p.repartitionCars || {
            car1_matin: '',
            car2_matin: '',
            car_soir: ''
          }
        })));
      } else {
        // Mode "addProducts" - commencer vide pour ajouter de nouveaux produits
        setProduitsCommandes([]);
      }
    } else {
      // Reset pour un nouveau formulaire
      setSelectedClientId('');
      setDateLivraison(formulaireState?.dateLivraison || new Date().toISOString().split('T')[0]);
      setProduitsCommandes([]);
    }
  }, [commande]);

  // Ajouter la fonction sauvegarderCommandeType depuis le store
  const { sauvegarderCommandeType } = useProductionStore();

  // Auto-fill commande type
  useEffect(() => {
    if (selectedClientId && mode === 'create' && produitsCommandes.length === 0) {
      const client = clients.find(c => c.id === selectedClientId);
      if (client?.commandeType && client.commandeType.length > 0) {
        setProduitsCommandes(client.commandeType.map(p => {
          // 1. Récupération du prix (Si 0 ou manquant, on prend le prix actuel du catalogue)
          let prix = p.prixUnitaire;
          if (!prix) {
            const productInfo = produits.find(prod => prod.id === p.produitId);
            // Si boutique, prix boutique. Sinon, prix client.
            prix = client.typeClient === 'boutique' ? productInfo?.prixBoutique : productInfo?.prixClient;
          }

          // 2. Migration / Fallback : Si pas de répartition mais une quantité totale (vieux format)
          let repartition = p.repartitionCars;
          if (!repartition && p.quantiteCommandee > 0) {
            repartition = {
              car1_matin: p.quantiteCommandee,
              car2_matin: '',
              car_soir: ''
            };
          }

          return {
            ...p,
            prixUnitaire: prix || 0,
            repartitionCars: repartition || { car1_matin: '', car2_matin: '', car_soir: '' }
          };
        }));
        toast.success("📋 Commande type chargée !");
      }
    }
  }, [selectedClientId]);

  const handleSauvegarderType = async () => {
    if (!selectedClientId || produitsCommandes.length === 0) return;
    try {
      // Nettoyer les données avant sauvegarde
      const produitsClean = produitsCommandes.map(p => ({
        produitId: p.produitId,
        quantiteCommandee: p.quantiteCommandee,
        repartitionCars: {
          car1_matin: Number(p.repartitionCars?.car1_matin) || 0,
          car2_matin: Number(p.repartitionCars?.car2_matin) || 0,
          car_soir: Number(p.repartitionCars?.car_soir) || 0
        }
      }));

      await sauvegarderCommandeType(selectedClientId, produitsClean);
      toast.success("💾 Commande type sauvegardée pour ce client !");
    } catch (error) {
      toast.error("Erreur lors de la sauvegarde de la commande type");
    }
  };

  // Recalculer les prix quand on change le type de prix
  useEffect(() => {
    const nouveauxProduits = produitsCommandes.map(item => {
      const produit = produits.find(p => p.id === item.produitId);
      if (produit) {
        const prix = utiliserPrixClient ? produit.prixClient : produit.prixBoutique;
        return {
          ...item,
          prixUnitaire: prix
        };
      }
      return item;
    });
    setProduitsCommandes(nouveauxProduits);
  }, [utiliserPrixClient, produits]);

  const clientsOptions = [
    { value: '', label: 'Sélectionnez un client' },
    ...clients.map(client => ({
      value: client.id,
      label: client.nom
    }))
  ];

  const produitsOptions = [
    { value: '', label: 'Sélectionnez un produit' },
    ...produits.filter(p => p.active).map(produit => {
      const prix = utiliserPrixClient ? produit.prixClient : produit.prixBoutique;
      return {
        value: produit.id,
        label: `${produit.nom} (${prix?.toLocaleString('fr-FR')} FCFA)`
      };
    })
  ];

  const ajouterProduit = () => {
    setProduitsCommandes([
      ...produitsCommandes,
      {
        produitId: '',
        quantiteCommandee: 0,
        repartitionCars: {
          car1_matin: '',
          car2_matin: '',
          car_soir: ''
        }
      }
    ]);
  };

  const supprimerProduit = (index: number) => {
    setProduitsCommandes(produitsCommandes.filter((_, i) => i !== index));
  };

  const modifierProduit = (index: number, field: keyof ProduitCommande, value: any) => {
    const nouveauxProduits = [...produitsCommandes];
    nouveauxProduits[index] = {
      ...nouveauxProduits[index],
      [field]: value
    };

    // Si on change le produit, on met à jour le prix automatiquement
    if (field === 'produitId') {
      const produit = produits.find(p => p.id === value);
      if (produit) {
        const prix = utiliserPrixClient ? produit.prixClient : produit.prixBoutique;
        nouveauxProduits[index].prixUnitaire = prix;
      }
    }

    // Si on modifie les répartitions, calculer la quantité totale
    if (field === 'repartitionCars') {
      const repartition = value;
      const total = (Number(repartition?.car1_matin) || 0) +
        (Number(repartition?.car2_matin) || 0) +
        (Number(repartition?.car_soir) || 0);
      nouveauxProduits[index].quantiteCommandee = total;
    }

    setProduitsCommandes(nouveauxProduits);
  };

  // Fonction spécialisée pour mettre à jour une répartition spécifique
  const modifierRepartition = (index: number, carField: string, value: string) => {
    const nouveauxProduits = [...produitsCommandes];
    const currentRepartition = nouveauxProduits[index].repartitionCars || {
      car1_matin: '',
      car2_matin: '',
      car_soir: ''
    };

    const newRepartition = {
      ...currentRepartition,
      [carField]: value
    };

    // Calculer la nouvelle quantité totale
    const newTotal = (Number(newRepartition.car1_matin) || 0) +
      (Number(newRepartition.car2_matin) || 0) +
      (Number(newRepartition.car_soir) || 0);

    nouveauxProduits[index] = {
      ...nouveauxProduits[index],
      repartitionCars: newRepartition,
      quantiteCommandee: newTotal
    };

    setProduitsCommandes(nouveauxProduits);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedClientId || produitsCommandes.length === 0) {
      alert('Veuillez sélectionner un client et au moins un produit');
      return;
    }

    const commandeValide = produitsCommandes.filter(p => {
      const total = (Number(p.repartitionCars?.car1_matin) || 0) +
        (Number(p.repartitionCars?.car2_matin) || 0) +
        (Number(p.repartitionCars?.car_soir) || 0);
      return p.produitId && total > 0;
    });

    if (commandeValide.length === 0) {
      alert('Veuillez saisir des quantités valides');
      return;
    }

    const produitsFormat = commandeValide.map(p => {
      // Sécurité : Si le prix est à 0, on le récupère du catalogue
      let prix = p.prixUnitaire;
      if (!prix) {
        const productInfo = produits.find(prod => prod.id === p.produitId);
        const client = clients.find(c => c.id === selectedClientId);
        prix = client?.typeClient === 'boutique' ? productInfo?.prixBoutique : productInfo?.prixClient;
      }

      return {
        ...p,
        prixUnitaire: prix || 0,
        repartitionCars: {
          car1_matin: Number(p.repartitionCars?.car1_matin) || 0,
          car2_matin: Number(p.repartitionCars?.car2_matin) || 0,
          car_soir: Number(p.repartitionCars?.car_soir) || 0
        }
      };
    });

    const commande: Omit<CommandeClient, 'id' | 'createdAt' | 'updatedAt'> = {
      clientId: selectedClientId,
      dateLivraison: new Date(dateLivraison),
      dateCommande: new Date(),
      statut: 'prevue',
      produits: produitsFormat
    };

    onSave(commande);

    // Reset form
    setSelectedClientId('');
    setDateLivraison(new Date().toISOString().split('T')[0]);
    setProduitsCommandes([]);
  };

  const calculerTotal = () => {
    return produitsCommandes.reduce((total, item) => {
      // Priorité au prix enregistré dans la ligne, sinon prix catalogue
      const prix = item.prixUnitaire || produits.find(p => p.id === item.produitId)?.prixUnitaire || 0;
      return total + (prix * (item.quantiteCommandee || 0));
    }, 0);
  };

  return (
    <div>
      {/* Sous-titre explicatif */}
      <div className="mb-6 p-4 bg-sand-50 rounded-lg border border-sand-200">
        <p className="text-sand-700 text-sm">
          {mode === 'addProducts' ? "Ajoutez des produits à la commande existante. Les quantités seront fusionnées avec les produits déjà commandés." :
            mode === 'edit' ? "Modifiez les détails de la commande. Cette action remplacera tous les produits actuels." :
              mode === 'editSpecific' ? "Modifiez les détails de ce produit spécifique dans la commande." :
                "Créez une nouvelle commande pour le client sélectionné."}
        </p>
      </div>

      {/* Résumé de la commande existante en mode addProducts */}
      {mode === 'addProducts' && commande && (
        <div className="mb-6 p-4 bg-info-50 rounded-lg border border-info-100">
          <h4 className="text-sm font-semibold text-info-600 mb-3 flex items-center gap-2">
            <Icon icon="mdi:information" />
            Produits actuellement commandés
          </h4>
          <div className="grid gap-2">
            {commande.produits.map((item, index) => {
              const produit = produits.find(p => p.id === item.produitId);
              return (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span className="text-info-600">{produit?.nom || 'Produit inconnu'}</span>
                  <span className="font-medium text-info-600">x{item.quantiteCommandee}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Information en mode editSpecific */}
      {mode === 'editSpecific' && commande && (
        <div className="mb-6 p-4 bg-warning-50 rounded-lg border border-warning-100">
          <h4 className="text-sm font-semibold text-warning-600 mb-2 flex items-center gap-2">
            <Icon icon="mdi:pencil-outline" />
            Mode édition produit spécifique
          </h4>
          <p className="text-sm text-warning-600">
            Vous modifiez uniquement le produit sélectionné. Les autres produits de la commande ne seront pas affectés.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Sélection client et date */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Client *"
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            options={clientsOptions}
            required
            disabled={mode === 'addProducts' || mode === 'editSpecific'}
          />

          <Input
            label="Date de livraison *"
            type="date"
            value={dateLivraison}
            onChange={(e) => setDateLivraison(e.target.value)}
            required
            disabled={mode === 'addProducts' || mode === 'editSpecific'}
          />
        </div>

        {/* Alerte Travail le Dimanche */}
        {(() => {
          const client = clients.find(c => c.id === selectedClientId);
          const isSunday = new Date(dateLivraison).getDay() === 0;
          if (client?.neTravaillePasDimanche && isSunday) {
            return (
              <div className="p-4 bg-danger-50 border border-danger-100 rounded-lg flex items-start gap-3 animate-pulse">
                <Icon icon="mdi:alert" className="text-danger-600 text-xl mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-danger-700">Attention : Repos le Dimanche</h4>
                  <p className="text-sm text-danger-700">
                    Ce client ne travaille habituellement pas le dimanche. Vérifiez bien qu'il a passé commande pour cette date.
                  </p>
                </div>
              </div>
            );
          }
          return null;
        })()}

        {/* Choix du type de prix */}
        <div className="flex items-center space-x-3 p-4 bg-warning-50 border border-warning-100 rounded-lg">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={utiliserPrixClient}
              onChange={(e) => setUtiliserPrixClient(e.target.checked)}
              className="h-4 w-4 text-warning-600 focus:ring-warning-500 border-sand-300 rounded"
            />
            <span className="ml-2 text-sm font-medium text-sand-900">
              Utiliser les prix client
            </span>
          </label>
          <span className="text-sm text-sand-600">
            {utiliserPrixClient ? '(Prix réduits pour les clients)' : '(Prix boutique standard)'}
          </span>
        </div>

        {/* Liste des produits */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h4 className="text-lg font-medium text-sand-900">
                {mode === 'addProducts' ? 'Nouveaux produits à ajouter' : mode === 'editSpecific' ? 'Produit à modifier' : 'Produits commandés'}
              </h4>
              {mode === 'edit' && (
                <p className="text-sm text-sand-500 mt-1">
                  Vous pouvez modifier les quantités ou ajouter de nouveaux produits
                </p>
              )}
              {mode === 'create' && (
                <p className="text-sm text-sand-500 mt-1">
                  Une seule commande par client et par date - Les produits ultérieurs s'ajouteront à cette commande
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={ajouterProduit}
              className="bg-info-50 hover:bg-info-100 text-info-600 border-info-100"
            >
              + Ajouter un produit
            </Button>
          </div>

          {produitsCommandes.length === 0 ? (
            <div className="text-center py-8 bg-sand-50 rounded-lg">
              <p className="text-sand-500">Aucun produit ajouté</p>
              <p className="text-sm text-sand-400 mt-1">Cliquez sur "Ajouter un produit" pour commencer</p>
            </div>
          ) : (
            <div className="space-y-4">
              {produitsCommandes.map((item, index) => {
                const produitSelectionne = produits.find(p => p.id === item.produitId);
                const repartitionTotal = (Number(item.repartitionCars?.car1_matin) || 0) +
                  (Number(item.repartitionCars?.car2_matin) || 0) +
                  (Number(item.repartitionCars?.car_soir) || 0);

                return (
                  <div
                    key={index}
                    className="border border-sand-200 rounded-lg p-4 bg-white"
                  >
                    {/* En-tête du produit */}
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                        {/* Sélection produit */}
                        <div>
                          <label className="block text-xs font-medium text-sand-700 mb-1">Produit</label>
                          <Select
                            options={produitsOptions}
                            value={item.produitId}
                            onChange={(e) => modifierProduit(index, 'produitId', e.target.value)}
                            required
                          />
                        </div>

                        {/* Quantité totale calculée */}
                        <div>
                          <label className="block text-xs font-medium text-sand-700 mb-1">Quantité totale</label>
                          <div className="px-3 py-2 bg-sand-50 border border-sand-300 rounded-md text-sm font-bold text-sand-900">
                            {repartitionTotal || 0} pièce(s)
                          </div>
                          <p className="text-xs text-sand-500 mt-1">Calculé automatiquement</p>
                        </div>

                        {/* Prix unitaire */}
                        <div>
                          <label className="block text-xs font-medium text-sand-700 mb-1">Prix unitaire</label>
                          <Input
                            type="number"
                            step="1"
                            placeholder="Prix"
                            value={item.prixUnitaire ?? produitSelectionne?.prixUnitaire ?? ''}
                            onChange={(e) => modifierProduit(index, 'prixUnitaire', e.target.value === '' ? '' : parseFloat(e.target.value))}
                            className="bg-sand-50"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => supprimerProduit(index)}
                        className="ml-3 text-danger-500 hover:text-danger-700 text-sm"
                        title="Supprimer ce produit"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Répartition par car */}
                    <div className="border-t pt-3">
                      <div className="mb-3">
                        <h4 className="text-sm font-medium text-sand-700">Répartition par car de livraison</h4>
                        <p className="text-xs text-sand-500">Saisissez les quantités pour chaque car</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {/* Car 1 Matin */}
                        <div className="bg-warning-50 border border-warning-100 rounded p-2">
                          <label className="block text-xs font-medium text-warning-600 mb-1 flex items-center gap-1">
                            <Icon icon="lucide:truck" className="text-xs" />
                            Car 1 - Matin
                          </label>
                          <Input
                            type="number"
                            min="0"
                            value={item.repartitionCars?.car1_matin || ''}
                            onChange={(e) => {
                              modifierRepartition(index, 'car1_matin', e.target.value);
                            }}
                            className="text-center font-bold text-warning-600"
                          />
                        </div>

                        {/* Car 2 Matin */}
                        <div className="bg-info-50 border border-info-100 rounded p-2">
                          <label className="block text-xs font-medium text-info-600 mb-1 flex items-center gap-1">
                            <Icon icon="lucide:truck" className="text-xs" />
                            Car 2 - Matin
                          </label>
                          <Input
                            type="number"
                            min="0"
                            value={item.repartitionCars?.car2_matin || ''}
                            onChange={(e) => {
                              modifierRepartition(index, 'car2_matin', e.target.value);
                            }}
                            className="text-center font-bold text-info-600"
                          />
                        </div>

                        {/* Car 1 Soir */}
                        <div className="bg-terracotta-50 border border-terracotta-200 rounded p-2">
                          <label className="block text-xs font-medium text-terracotta-700 mb-1 flex items-center gap-1">
                            <Icon icon="lucide:truck" className="text-xs" />
                            Car 1 - Soir
                          </label>
                          <Input
                            type="number"
                            min="0"
                            value={item.repartitionCars?.car_soir || ''}
                            onChange={(e) => {
                              modifierRepartition(index, 'car_soir', e.target.value);
                            }}
                            className="text-center font-bold text-terracotta-700"
                          />
                        </div>
                      </div>

                    </div>

                    {/* Total du produit */}
                    <div className="flex justify-end mt-3 pt-2 border-t">
                      <div className="text-sm font-medium text-sand-900">
                        Total: {repartitionTotal && (item.prixUnitaire || produitSelectionne?.prixUnitaire)
                          ? `${(repartitionTotal * (item.prixUnitaire || produitSelectionne?.prixUnitaire || 0)).toLocaleString('fr-FR')} FCFA`
                          : '0 FCFA'
                        }
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Bouton d'ajout supplémentaire */}
              <div className="flex justify-center py-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={ajouterProduit}
                  className="bg-success-50 hover:bg-success-100 text-success-700 border-success-100 border-dashed"
                >
                  <Icon icon="mdi:plus" className="mr-2" />
                  Ajouter un autre produit
                </Button>
              </div>

              {/* Total et aide */}
              <div className="pt-4 border-t border-sand-200">
                <div className="flex justify-between items-center">
                  <div className="text-lg font-bold text-sand-900">
                    Total: {calculerTotal().toLocaleString('fr-FR')} FCFA
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-6 border-t border-sand-200">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
          >
            Annuler
          </Button>
          <Button
            type="submit"
            isLoading={isLoading}
            disabled={!selectedClientId || produitsCommandes.length === 0}
          >
            {mode === 'addProducts' ? 'Ajouter les produits' :
              mode === 'edit' ? 'Modifier la commande' :
                mode === 'editSpecific' ? 'Modifier le produit' :
                  'Créer la commande'}
          </Button>
        </div>

        {/* Bouton Commande Type (visible seulement en création/édition si des produits sont présents) */}
        {mode !== 'editSpecific' && produitsCommandes.length > 0 && selectedClientId && (
          <div className="bg-info-50 border border-info-100 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-info-600">Commande Type</h4>
                <p className="text-xs text-info-600">Sauvegarder cette configuration pour ce client ?</p>
              </div>
              <button
                type="button"
                onClick={handleSauvegarderType}
                className="flex items-center gap-2 px-4 py-2 bg-info-600 hover:bg-info-600 text-white rounded-lg transition-all shadow-sm hover:shadow-md text-sm font-medium"
              >
                <Icon icon="mdi:content-save-settings" className="text-lg" />
                Définir comme commande type
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};