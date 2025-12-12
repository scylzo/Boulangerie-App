import React, { useState } from 'react';
import { useStockStore } from '../../store/stockStore';
import { Plus, Edit2, Trash2, AlertTriangle, ArrowRightLeft } from 'lucide-react';
import { ConfirmModal } from '../ui/ConfirmModal';
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
    prixMoyenPondere: number | '';
    valeurTotale: number;
  }>({
    nom: '',
    unite: 'kg',
    stockMinimum: '',
    prixMoyenPondere: '',
    stockActuel: '',
    valeurTotale: 0
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing) {
      updateMatiere(isEditing, {
        ...formData,
        stockMinimum: Number(formData.stockMinimum) || 0,
        stockActuel: Number(formData.stockActuel) || 0,
        prixMoyenPondere: Number(formData.prixMoyenPondere) || 0,
        valeurTotale: (Number(formData.stockActuel) || 0) * (Number(formData.prixMoyenPondere) || 0)
      });
      setIsEditing(null);
    } else {
      addMatiere({
        nom: formData.nom || '',
        unite: formData.unite as UniteMesure || 'kg',
        stockMinimum: Number(formData.stockMinimum) || 0,
        stockActuel: Number(formData.stockActuel) || 0,
        prixMoyenPondere: Number(formData.prixMoyenPondere) || 0,
        valeurTotale: (Number(formData.stockActuel) || 0) * (Number(formData.prixMoyenPondere) || 0),
        active: true
      });
    }
    setFormData({ nom: '', unite: 'kg', stockMinimum: '', prixMoyenPondere: '', stockActuel: '', valeurTotale: 0 });
    setShowForm(false);
  };

  const startEdit = (matiere: MatierePremiere) => {
    setFormData(matiere);
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">Matières Premières</h2>
        <button
          onClick={() => {
            setIsEditing(null);
            setIsEditing(null);
            setFormData({ nom: '', unite: 'kg', stockMinimum: '', prixMoyenPondere: '', stockActuel: '', valeurTotale: 0 });
            setShowForm(!showForm);
          }}
          className="flex items-center space-x-2 bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors"
        >
          <Plus size={20} />
          <span>Nouvelle Matière</span>
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
              <input
                required
                type="text"
                value={formData.nom}
                onChange={e => setFormData({ ...formData, nom: e.target.value })}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                placeholder="Ex: Farine T55"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unité</label>
              <select
                value={formData.unite}
                onChange={e => setFormData({ ...formData, unite: e.target.value as UniteMesure })}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Stock Initial</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.stockActuel}
                onChange={e => setFormData({ ...formData, stockActuel: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                disabled={!!isEditing} // On ne modifie pas le stock directement en édition, il faut passer par un mouvement
              />
              {isEditing && <p className="text-xs text-gray-500 mt-1">Pour modifier le stock, utilisez "Mouvement"</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Seuil d'alerte</label>
              <input
                type="number"
                min="0"
                value={formData.stockMinimum}
                onChange={e => setFormData({ ...formData, stockMinimum: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prix Moyen Initial (FCFA)</label>
              <input
                type="number"
                min="0"
                value={formData.prixMoyenPondere}
                onChange={e => setFormData({ ...formData, prixMoyenPondere: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                disabled={!!isEditing}
              />
            </div>
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
            >
              {isEditing ? 'Mettre à jour' : 'Créer'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Nom</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-gray-600">Stock Actuel</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-gray-600">Valeur (FCFA)</th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-gray-600">État</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {matieres.map((matiere) => {
              const isLowStock = matiere.stockActuel <= matiere.stockMinimum;
              return (
                <tr key={matiere.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{matiere.nom}</div>
                    <div className="text-xs text-gray-500">PMP: {Math.round(matiere.prixMoyenPondere).toLocaleString()} FCFA / {matiere.unite}</div>
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-gray-900">
                    {matiere.stockActuel.toLocaleString()} <span className="text-gray-500 text-sm">{matiere.unite}</span>
                  </td>
                  <td className="px-6 py-4 text-right text-gray-600">
                    {Math.round(matiere.valeurTotale).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {isLowStock ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <AlertTriangle size={12} className="mr-1" />
                        Critique
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        OK
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end space-x-2">
                       <button
                        onClick={() => onAddMouvement(matiere)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="Ajouter un mouvement"
                      >
                        <ArrowRightLeft size={18} />
                      </button>
                      <button
                        onClick={() => startEdit(matiere)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                        title="Modifier"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(matiere.id, matiere.nom)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        title="Supprimer"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {matieres.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  Aucune matière première enregistrée.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, matiereId: '', matiereNom: '' })}
        onConfirm={confirmDelete}
        title="Confirmer la suppression"
        message={`Êtes-vous sûr de vouloir supprimer la matière première "${deleteConfirm.matiereNom}" ?\n\nCette action est irréversible.`}
        confirmText="Supprimer"
        cancelText="Annuler"
        type="danger"
        position="center"
      />
    </div>
  );
};
