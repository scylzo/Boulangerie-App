import React, { useState } from 'react';
import { useStockStore } from '../../store/stockStore';
import { Plus, Edit2, Trash2, AlertTriangle, ArrowRightLeft } from 'lucide-react';
import { ConfirmModal } from '../ui/ConfirmModal';
import { Modal } from '../ui/Modal';
import type { MatierePremiere, UniteMesure } from '../../types';

interface MatiereListProps {
  onAddMouvement: (matiere: MatierePremiere) => void;
}

export const MatiereList: React.FC<MatiereListProps> = ({ onAddMouvement }) => {
  const { matieres, addMatiere, updateMatiere, deleteMatiere } = useStockStore();
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; matiereId: string; matiereNom: string }>({
    isOpen: false,
    matiereId: '',
    matiereNom: ''
  });

  // Form state
  const [formData, setFormData] = useState<{
    nom: string;
    unite: UniteMesure;
    stockMinimum: number | '';
    stockActuel: number | '';
    dateCreation: string;
  }>({
    nom: '',
    unite: 'kg',
    stockMinimum: '',
    stockActuel: '',
    dateCreation: new Date().toISOString().split('T')[0]
  });
  // Conversion state
  const { convertMatiereUnit } = useStockStore();
  const [conversionState, setConversionState] = useState<{
    isOpen: boolean;
    matiere?: MatierePremiere;
    factor: string;
    targetUnit: UniteMesure;
  }>({
    isOpen: false,
    factor: '1',
    targetUnit: 'kg'
  });

  const openConversion = (matiere: MatierePremiere) => {
    setConversionState({
      isOpen: true,
      matiere,
      factor: '1',
      targetUnit: 'kg'
    });
  };

  const handleConversion = async () => {
    if (!conversionState.matiere || !conversionState.factor) return;

    const factor = parseFloat(conversionState.factor);
    if (isNaN(factor) || factor <= 0) return;

    await convertMatiereUnit(
      conversionState.matiere.id,
      factor,
      conversionState.targetUnit
    );

    setConversionState({ isOpen: false, factor: '1', targetUnit: 'kg' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing) {
      const { stockActuel, ...updates } = formData;
      updateMatiere(isEditing, {
        ...updates,
        stockMinimum: Number(formData.stockMinimum) || 0,
        createdAt: formData.dateCreation ? new Date(formData.dateCreation) : new Date()
      });
      setIsEditing(null);
    } else {
      addMatiere({
        nom: formData.nom || '',
        unite: formData.unite as UniteMesure || 'kg',
        stockMinimum: Number(formData.stockMinimum) || 0,
        stockActuel: 0,
        prixUnitaireMoyen: 0,
        active: true,
        createdAt: formData.dateCreation ? new Date(formData.dateCreation) : new Date()
      });
    }
    setFormData({ nom: '', unite: 'kg', stockMinimum: '', stockActuel: '', dateCreation: new Date().toISOString().split('T')[0] });
    setShowForm(false);
  };

  const startEdit = (matiere: MatierePremiere) => {
    setFormData({
      ...matiere,
      stockMinimum: matiere.stockMinimum,
      stockActuel: matiere.stockActuel,
      dateCreation: new Date(matiere.createdAt).toISOString().split('T')[0]
    });
    setIsEditing(matiere.id);
    setShowForm(true);
  };

  const handleDelete = (id: string, nom: string) => {
    setDeleteConfirm({
      isOpen: true,
      matiereId: id,
      matiereNom: nom
    });
  };

  const confirmDelete = () => {
    deleteMatiere(deleteConfirm.matiereId);
    setDeleteConfirm({ isOpen: false, matiereId: '', matiereNom: '' });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h2 className="text-base sm:text-lg font-bold text-gray-800">Matières Premières</h2>
        <button
          onClick={() => {
            setIsEditing(null);
            setFormData({ nom: '', unite: 'kg', stockMinimum: '', stockActuel: '', dateCreation: new Date().toISOString().split('T')[0] });
            setShowForm(!showForm);
          }}
          className="flex items-center justify-center space-x-2 bg-orange-600 hover:bg-orange-700 text-white px-3 sm:px-4 py-2 rounded-lg transition-colors w-full sm:w-auto text-sm sm:text-base"
        >
          <Plus size={18} className="sm:w-5 sm:h-5" />
          <span>Nouvelle Matière</span>
        </button>
      </div>

      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={isEditing ? 'Modifier la Matière' : 'Nouvelle Matière'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
              <input
                required
                type="text"
                value={formData.nom}
                onChange={e => setFormData({ ...formData, nom: e.target.value })}
                className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
                placeholder="Ex: Farine GMD (Sac 50kg)"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date de création</label>
              <input
                type="date"
                value={formData.dateCreation}
                onChange={e => setFormData({ ...formData, dateCreation: e.target.value })}
                className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unité</label>
              <select
                value={formData.unite}
                onChange={e => setFormData({ ...formData, unite: e.target.value as UniteMesure })}
                className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
              >
                <option value="kg">Kilogramme (kg)</option>
                <option value="g">Gramme (g)</option>
                <option value="l">Litre (l)</option>
                <option value="piece">Pièce</option>
                <option value="sac_50kg">Sac 50kg</option>
                <option value="sac_25kg">Sac 25kg</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Seuil d'alerte</label>
              <input
                type="number"
                min="0"
                value={formData.stockMinimum}
                onChange={e => setFormData({ ...formData, stockMinimum: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
              />
            </div>

            <div className="col-span-1 md:col-span-2 bg-orange-50/50 p-4 rounded-xl flex items-start space-x-3 border border-orange-100">
              <div className="text-orange-600 mt-0.5"><AlertTriangle size={18} /></div>
              <div className="text-sm text-orange-800 leading-relaxed">
                <span className="font-bold">Note :</span> Créez d'abord la matière avec son unité de base.
                Vous pourrez ensuite ajouter du stock via le bouton <b>Mouvements</b> <ArrowRightLeft className="inline mx-1" size={14} /> dans la liste.
              </div>
            </div>
          </div>
          <div className="flex gap-3 pt-6">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 px-5 py-3 text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-xl transition-all"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 px-5 py-3 text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl shadow-sm hover:shadow-md transition-all"
            >
              {isEditing ? 'Mettre à jour' : 'Créer la matière'}
            </button>
          </div>
        </form>
      </Modal>

      {conversionState.isOpen && conversionState.matiere && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">
                Convertir l'unité : {conversionState.matiere.nom}
              </h3>
              <button
                onClick={() => setConversionState({ ...conversionState, isOpen: false })}
                className="text-gray-400 hover:text-gray-600"
              >
                <Plus className="rotate-45" size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-500 mb-2">
                Convertir de <b>{conversionState.matiere.unite}</b> vers :
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nouvelle Unité</label>
                <select
                  value={conversionState.targetUnit}
                  onChange={(e) => setConversionState({ ...conversionState, targetUnit: e.target.value as UniteMesure })}
                  className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                >
                  <option value="kg">Kilogramme (kg)</option>
                  <option value="g">Gramme (g)</option>
                  <option value="l">Litre (l)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Facteur de conversion : 1 {conversionState.matiere.unite} = ? {conversionState.targetUnit}
                </label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={conversionState.factor}
                  onChange={(e) => setConversionState({ ...conversionState, factor: e.target.value })}
                  className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none font-bold"
                  placeholder="Ex: 50"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Exemple: Si 1 sac = 50kg, entrez <b>50</b>.
                </p>
              </div>

              <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800">
                <p className="font-medium">Aperçu du résultat :</p>
                <ul className="list-disc list-inside mt-1 space-y-1 text-xs">
                  <li>Stock : {conversionState.matiere.stockActuel} → <b>{((conversionState.matiere.stockActuel || 0) * parseFloat(conversionState.factor || '0')).toLocaleString()} {conversionState.targetUnit}</b></li>
                </ul>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-100">
              <button
                onClick={() => setConversionState({ ...conversionState, isOpen: false })}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
              >
                Annuler
              </button>
              <button
                onClick={handleConversion}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm"
              >
                Confirmer la conversion
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-600">Nom</th>
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-600">Date Création</th>
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-right text-xs sm:text-sm font-semibold text-gray-600">Stock Actuel</th>
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs sm:text-sm font-semibold text-gray-600">État</th>
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-right text-xs sm:text-sm font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {matieres.map((matiere) => {
              const isLowStock = matiere.stockActuel <= matiere.stockMinimum;
              const isConvertible = matiere.unite.includes('sac');

              return (
                <tr key={matiere.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 sm:px-6 py-3 sm:py-4">
                    <div className="text-xs sm:text-sm font-medium text-gray-900">{matiere.nom}</div>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-600">
                    {new Date(matiere.createdAt).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-right text-xs sm:text-sm font-medium text-gray-900">
                    {matiere.stockActuel.toLocaleString()} <span className="text-gray-500 text-xs">{matiere.unite}</span>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                    {isLowStock ? (
                      <span className="inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <AlertTriangle size={12} className="mr-1" />
                        Critique
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        OK
                      </span>
                    )}
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-right">
                    <div className="flex justify-end space-x-1 sm:space-x-2">
                      {isConvertible && (
                        <button
                          onClick={() => openConversion(matiere)}
                          className="px-1.5 sm:px-2 py-1 text-xs bg-indigo-50 text-indigo-700 rounded border border-indigo-200 hover:bg-indigo-100"
                        >
                          <span className="hidden sm:inline">Convertir kg</span>
                          <span className="sm:hidden">Conv.</span>
                        </button>
                      )}
                      <button onClick={() => onAddMouvement(matiere)} className="p-1.5 sm:p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
                        <ArrowRightLeft size={16} className="sm:w-[18px] sm:h-[18px]" />
                      </button>
                      <button onClick={() => startEdit(matiere)} className="p-1.5 sm:p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                        <Edit2 size={16} className="sm:w-[18px] sm:h-[18px]" />
                      </button>
                      <button onClick={() => handleDelete(matiere.id, matiere.nom)} className="p-1.5 sm:p-2 text-red-600 hover:bg-red-50 rounded-lg">
                        <Trash2 size={16} className="sm:w-[18px] sm:h-[18px]" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, matiereId: '', matiereNom: '' })}
        onConfirm={confirmDelete}
        title="Confirmer la suppression"
        message={`Voulez-vous supprimer "${deleteConfirm.matiereNom}" ? Cette action est irréversible.`}
        confirmText="Supprimer"
        cancelText="Annuler"
        type="danger"
        position="center"
      />
    </div>
  );
};
