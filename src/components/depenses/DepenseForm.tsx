import React, { useState } from 'react';
import { useDepenseStore } from '../../store/depenseStore';
import { useStockStore } from '../../store/stockStore';
import { useAuthStore } from '../../store';
import type { CategorieDepense, Depense } from '../../types/depense';
import { X, Plus, Loader2, Save } from 'lucide-react';

interface DepenseFormProps {
  onDesc: () => void;
  initialData?: Depense;
}

const CATEGORIES: CategorieDepense[] = [
  'Carburant Véhicule',
  'Carburant Moto',
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

export const DepenseForm: React.FC<DepenseFormProps> = ({ onDesc, initialData }) => {
  const { ajouterDepense, modifierDepense } = useDepenseStore();
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
    categorie: initialData?.categorie || 'Carburant Véhicule' as CategorieDepense,
    montant: initialData?.montant.toString() || '',
    description: initialData?.description || '',
    fournisseur: initialData?.fournisseur || '',
    date: initialData ? new Date(initialData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    dateDebutUsage: initialData?.dateDebutUsage ? new Date(initialData.dateDebutUsage).toISOString().split('T')[0] : '',
    dateFinUsage: initialData?.dateFinUsage ? new Date(initialData.dateFinUsage).toISOString().split('T')[0] : ''
  });

  const [showManualInput, setShowManualInput] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const commonData = {
        categorie: formData.categorie,
        montant: Number(formData.montant),
        description: formData.description,
        fournisseur: formData.fournisseur || undefined,
        date: new Date(formData.date),
        dateDebutUsage: formData.dateDebutUsage ? new Date(formData.dateDebutUsage) : undefined,
        dateFinUsage: formData.dateFinUsage ? new Date(formData.dateFinUsage) : undefined,
      };

      if (initialData) {
        await modifierDepense(initialData.id, commonData);
      } else {
        await ajouterDepense({
          ...commonData,
          userId: user.id
        });
      }
      onDesc();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md my-8 flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0">
          <h3 className="text-xl font-bold">{initialData ? 'Modifier la Dépense' : 'Nouvelle Dépense'}</h3>
          <button onClick={onDesc} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date de la dépense/achat</label>
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

          {/* Champs Période d'usage (Conditionnel) */}
          {['Carburant Four', 'Loyer', 'Électricité', 'Eau', 'Intrants'].includes(formData.categorie) && (
            <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
              <h4 className="text-sm font-bold text-orange-800 mb-2">Période de consommation (Optionnel)</h4>
              <div className="bg-white/50 p-2 rounded mb-3 text-xs text-orange-800 border border-orange-100">
                <p>Le calcul se fait sur la base du proratadans.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Début utilisation</label>
                  <input
                    type="date"
                    value={formData.dateDebutUsage}
                    onChange={e => setFormData({ ...formData, dateDebutUsage: e.target.value })}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Fin utilisation (Estimée)</label>
                  <input
                    type="date"
                    value={formData.dateFinUsage}
                    onChange={e => setFormData({ ...formData, dateFinUsage: e.target.value })}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                  />
                </div>
              </div>
            </div>
          )}

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
                value={showManualInput ? 'autre' : (fournisseurs.some(f => f.nom === formData.fournisseur) ? formData.fournisseur : '')}
                onChange={e => {
                  const val = e.target.value;
                  if (val === 'autre') {
                    setShowManualInput(true);
                    setFormData({ ...formData, fournisseur: '' });
                  } else {
                    setShowManualInput(false);
                    setFormData({ ...formData, fournisseur: val });
                  }
                }}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white"
              >
                <option value="">-- Sélectionner ou saisir manuellement --</option>
                {fournisseurs.map(f => (
                  <option key={f.id} value={f.nom}>{f.nom}</option>
                ))}
                <option value="autre">Autre (Saisie manuelle)</option>
              </select>
            </div>
            {(showManualInput || (formData.fournisseur !== '' && !fournisseurs.some(f => f.nom === formData.fournisseur))) && (
              <input
                type="text"
                value={formData.fournisseur}
                onChange={e => setFormData({ ...formData, fournisseur: e.target.value })}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none mt-2"
                placeholder="Saisir le nom du fournisseur..."
                autoFocus={showManualInput && formData.fournisseur === ''}
              />
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="animate-spin mr-2" size={20} />
            ) : initialData ? (
              <Save className="mr-2" size={20} />
            ) : (
              <Plus className="mr-2" size={20} />
            )}
            {initialData ? 'Mettre à jour' : 'Enregistrer la dépense'}
          </button>
        </form>
      </div>
    </div>
  );
};
