import React, { useState } from 'react';
import { useDepenseStore } from '../../store/depenseStore';
import { useStockStore } from '../../store/stockStore';
import { useAuthStore } from '../../store';
import type { CategorieDepense, Depense } from '../../types/depense';
import { X, Plus, Loader2, Save, ChevronDown, ChevronUp, Fuel, Users, Zap, Droplet, Wrench, Package } from 'lucide-react';

interface DepenseFormProps {
  onDesc: () => void;
  initialData?: Depense;
}

const CATEGORIES: CategorieDepense[] = [
  'Carburant Véhicule',
  'Carburant Moto',
  'Électricité',
  'Eau',
  'Loyer',
  'Salaires',
  'Entretien',
  'Marketing',
  'Transport',
  'Divers'
];

const QUICK_CATEGORIES: { id: CategorieDepense; label: string; icon: React.ReactNode }[] = [
  { id: 'Carburant Véhicule', label: 'Carburant', icon: <Fuel size={15} /> },
  { id: 'Salaires', label: 'Salaires & Avances', icon: <Users size={15} /> },
  { id: 'Électricité', label: 'Électricité', icon: <Zap size={15} /> },
  { id: 'Eau', label: 'Eau', icon: <Droplet size={15} /> },
  { id: 'Entretien', label: 'Entretien', icon: <Wrench size={15} /> },
  { id: 'Divers', label: 'Divers', icon: <Package size={15} /> },
];

export const DepenseForm: React.FC<DepenseFormProps> = ({ onDesc, initialData }) => {
  const { ajouterDepense, modifierDepense } = useDepenseStore();
  const { user } = useAuthStore();
  const { fournisseurs, chargerDonnees } = useStockStore();

  React.useEffect(() => {
    if (fournisseurs.length === 0) {
      chargerDonnees();
    }
  }, [fournisseurs.length, chargerDonnees]);

  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [formData, setFormData] = useState({
    categorie: (initialData?.categorie && initialData.categorie !== 'Intrants' ? initialData.categorie : 'Carburant Véhicule') as CategorieDepense,
    montant: initialData?.montant ? initialData.montant.toString() : '',
    moyenPaiement: initialData?.moyenPaiement || ('Especes' as 'Especes' | 'Mobile Money' | 'Virement' | 'Cheque'),
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
        moyenPaiement: formData.moyenPaiement,
        description: formData.description.trim() || formData.categorie,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-elevated w-full max-w-lg my-6 flex flex-col max-h-[92vh] overflow-hidden">
        {/* En-tête */}
        <div className="px-5 py-4 border-b border-sand-100 flex justify-between items-center bg-sand-50/80 shrink-0">
          <div>
            <h3 className="font-display text-lg sm:text-xl font-bold text-sand-900">
              {initialData ? 'Modifier la Dépense' : 'Enregistrer une Dépense'}
            </h3>
            <p className="text-xs text-sand-500">Sortie de caisse ou paiement d'exploitation</p>
          </div>
          <button onClick={onDesc} className="p-1 rounded-lg text-sand-400 hover:text-sand-600 hover:bg-sand-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {/* Sélection rapide de catégorie */}
          <div>
            <label className="block text-xs font-semibold text-sand-600 uppercase tracking-wider mb-2">
              Catégorie principale
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-2">
              {QUICK_CATEGORIES.map(cat => {
                const isSelected = formData.categorie === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        categorie: cat.id
                      }));
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-medium border transition-all text-left ${
                      isSelected
                        ? 'bg-sand-900 text-white border-sand-900 shadow-sm'
                        : 'bg-sand-50 text-sand-700 border-sand-200 hover:bg-sand-100'
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span className="truncate">{cat.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Sélecteur complet si catégorie rare */}
            <select
              value={formData.categorie}
              onChange={e => setFormData({ ...formData, categorie: e.target.value as CategorieDepense })}
              className="w-full p-2 border border-sand-200 rounded-lg text-xs bg-white text-sand-700 outline-none focus:ring-1 focus:ring-sand-900"
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>Toutes les options : {cat}</option>
              ))}
            </select>
          </div>

          {/* Montant & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-sand-600 mb-1">
                Montant total (FCFA) <span className="text-danger-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  required
                  min="0"
                  step="1"
                  value={formData.montant}
                  onChange={e => setFormData({ ...formData, montant: e.target.value })}
                  className="w-full px-3 py-2.5 border border-sand-300 rounded-xl focus:ring-2 focus:ring-terracotta-500/20 focus:border-terracotta-600 outline-none text-lg font-bold text-sand-900 tabular-nums"
                  placeholder="Ex: 12000"
                />
                <span className="absolute right-3 top-3 text-xs font-bold text-sand-400 pointer-events-none">FCFA</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-sand-600 mb-1">Date</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2.5 border border-sand-300 rounded-xl focus:ring-2 focus:ring-terracotta-500/20 focus:border-terracotta-600 outline-none text-sm text-sand-800"
              />
            </div>
          </div>

          {/* Moyen de Paiement */}
          <div>
            <label className="block text-xs font-semibold text-sand-600 uppercase tracking-wider mb-1.5">
              Origine du paiement
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'Especes', label: '💵 Espèces (Caisse)' },
                { id: 'Mobile Money', label: '📱 Wave / OM' },
                { id: 'Cheque', label: '🏦 Virement / Chèque' }
              ].map(mode => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, moyenPaiement: mode.id as any })}
                  className={`py-2 px-2 text-xs rounded-xl font-medium border transition-colors text-center ${
                    formData.moyenPaiement === mode.id
                      ? 'bg-sand-900 text-white border-sand-900 shadow-sm'
                      : 'bg-sand-50 text-sand-700 border-sand-200 hover:bg-sand-100'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-sand-600 mb-1">
              Description / Motif <span className="text-danger-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-sand-300 rounded-xl focus:ring-2 focus:ring-terracotta-500/20 focus:border-terracotta-600 outline-none text-sm"
              placeholder="Ex: 8 sacs de glace pour le pétrin, Gasoil véhicule de livraison..."
            />
          </div>

          {/* Fournisseur (Optionnel) */}
          <div>
            <label className="block text-xs font-semibold text-sand-600 mb-1">Bénéficiaire / Fournisseur (Optionnel)</label>
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
                className="w-full p-2 border border-sand-300 rounded-xl focus:ring-2 focus:ring-sand-900 outline-none bg-white text-xs text-sand-700"
              >
                <option value="">-- Aucun ou sélectionner --</option>
                {fournisseurs.map(f => (
                  <option key={f.id} value={f.nom}>{f.nom}</option>
                ))}
                <option value="autre">Autre (Saisie libre)</option>
              </select>
            </div>
            {(showManualInput || (formData.fournisseur !== '' && !fournisseurs.some(f => f.nom === formData.fournisseur))) && (
              <input
                type="text"
                value={formData.fournisseur}
                onChange={e => setFormData({ ...formData, fournisseur: e.target.value })}
                className="w-full p-2 border border-sand-300 rounded-xl focus:ring-2 focus:ring-sand-900 outline-none mt-2 text-xs"
                placeholder="Ex: Total, Senelec, Fournisseur glace, Nom employé..."
                autoFocus={showManualInput && formData.fournisseur === ''}
              />
            )}
          </div>

          {/* Options Avancées (Période / Prorata) */}
          <div className="border-t border-sand-200 pt-3">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center justify-between w-full text-xs font-semibold text-sand-600 hover:text-sand-900 py-1"
            >
              <span>⏱️ Période de consommation / Prorata (Optionnel)</span>
              {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showAdvanced && (
              <div className="mt-2 bg-sand-50 p-3 rounded-xl border border-sand-200 space-y-2 text-xs">
                <p className="text-sand-500">
                  À remplir uniquement pour une charge qui s'étale sur plusieurs semaines ou mois (ex: loyer du mois, gros approvisionnement carburant).
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sand-700 mb-1 font-medium">Début utilisation</label>
                    <input
                      type="date"
                      value={formData.dateDebutUsage}
                      onChange={e => setFormData({ ...formData, dateDebutUsage: e.target.value })}
                      className="w-full p-2 border border-sand-300 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-sand-700 mb-1 font-medium">Fin utilisation</label>
                    <input
                      type="date"
                      value={formData.dateFinUsage}
                      onChange={e => setFormData({ ...formData, dateFinUsage: e.target.value })}
                      className="w-full p-2 border border-sand-300 rounded-lg text-xs"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || !formData.montant || Number(formData.montant) <= 0}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl shadow-sm text-sm font-semibold text-white bg-terracotta-600 hover:bg-terracotta-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-terracotta-500 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : initialData ? (
                <Save size={18} />
              ) : (
                <Plus size={18} />
              )}
              <span>{initialData ? 'Mettre à jour la dépense' : 'Valider la dépense'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
