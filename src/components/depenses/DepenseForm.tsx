import React, { useState } from 'react';
import { useDepenseStore } from '../../store/depenseStore';
import { useStockStore } from '../../store/stockStore';
import { useAuthStore } from '../../store';
import type { CategorieDepense } from '../../types/depense';
import { X, Plus, Loader2 } from 'lucide-react';

interface DepenseFormProps {
  onDesc: () => void;
}

const CATEGORIES: CategorieDepense[] = [
  'Carburant Véhicule',
  'Carburant Four',
  'Électricité',
  'Eau',
  'Loyer',
  'Salaires',
  'Entretien',
  'Intrants',
  'Marketing',
  'Transport',
  'Divers'
];

export const DepenseForm: React.FC<DepenseFormProps> = ({ onDesc }) => {
  const { ajouterDepense } = useDepenseStore();
  const { user } = useAuthStore();
  const { fournisseurs, chargerDonnees } = useStockStore();
  
  // Charger les fournisseurs si nécessaire
  React.useEffect(() => {
    if (fournisseurs.length === 0) {
      chargerDonnees();
    }
  }, [fournisseurs.length, chargerDonnees]);
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    categorie: 'Carburant Véhicule' as CategorieDepense,
    montant: '',
    description: '',
    fournisseur: '',
    date: new Date().toISOString().split('T')[0]
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);
    try {
      await ajouterDepense({
        categorie: formData.categorie,
        montant: Number(formData.montant),
        description: formData.description,
        fournisseur: formData.fournisseur || undefined,
        date: new Date(formData.date),
        userId: user.id
      });
      onDesc();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold">Nouvelle Dépense</h3>
        <button onClick={onDesc} className="text-gray-400 hover:text-gray-600">
          <X size={24} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <input
            type="date"
            required
            value={formData.date}
            onChange={e => setFormData({ ...formData, date: e.target.value })}
            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
          <select
            value={formData.categorie}
            onChange={e => setFormData({ ...formData, categorie: e.target.value as CategorieDepense })}
            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
          >
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Montant (FCFA)</label>
          <input
            type="number"
            required
            min="0"
            value={formData.montant}
            onChange={e => setFormData({ ...formData, montant: e.target.value })}
            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-lg font-semibold"
            placeholder="0"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <input
            type="text"
            required
            value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
            placeholder="Ex: Plein Partner, Facture Senelec..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fournisseur</label>
          <div className="flex gap-2">
            <select
                value={fournisseurs.some(f => f.nom === formData.fournisseur) ? formData.fournisseur : ''}
                onChange={e => setFormData({ ...formData, fournisseur: e.target.value })}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white"
            >
                <option value="">-- Sélectionner ou saisir manuellement --</option>
                {fournisseurs.map(f => (
                    <option key={f.id} value={f.nom}>{f.nom}</option>
                ))}
                <option value="autre">Autre (Saisie manuelle)</option>
            </select>
          </div>
          {(!fournisseurs.some(f => f.nom === formData.fournisseur) && formData.fournisseur !== '') || formData.fournisseur === 'autre' ? (
              <input
                type="text"
                value={formData.fournisseur === 'autre' ? '' : formData.fournisseur}
                onChange={e => setFormData({ ...formData, fournisseur: e.target.value })}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none mt-2"
                placeholder="Saisir le nom du fournisseur..."
                autoFocus
              />
          ) : null}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="animate-spin mr-2" size={20} />
          ) : (
            <Plus className="mr-2" size={20} />
          )}
          Enregistrer la dépense
        </button>
      </form>
    </div>
  );
};
