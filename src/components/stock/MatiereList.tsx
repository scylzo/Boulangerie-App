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
    dateCreation: string;
  }>({
    nom: '',
    unite: 'kg',
    stockMinimum: '',
    prixMoyenPondere: '',
    stockActuel: '',
    valeurTotale: 0,
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
      // Destructure to remove fields we don't want to update via this form anymore
      const { stockActuel, prixMoyenPondere, ...updates } = formData;
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
        stockActuel: 0, // Force 0 initial
        prixMoyenPondere: 0, // Force 0 initial
        valeurTotale: 0,
        active: true,
        createdAt: formData.dateCreation ? new Date(formData.dateCreation) : new Date()
      });
    }
    setFormData({ nom: '', unite: 'kg', stockMinimum: '', prixMoyenPondere: '', stockActuel: '', valeurTotale: 0, dateCreation: new Date().toISOString().split('T')[0] });
    setShowForm(false);
  };

  const startEdit = (matiere: MatierePremiere) => {
    setFormData({
        ...matiere,
        stockMinimum: matiere.stockMinimum,
        stockActuel: matiere.stockActuel,
        prixMoyenPondere: matiere.prixMoyenPondere,
        valeurTotale: matiere.valeurTotale,
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">Matières Premières</h2>
        <button
          onClick={() => {
            setIsEditing(null);
            setFormData({ nom: '', unite: 'kg', stockMinimum: '', prixMoyenPondere: '', stockActuel: '', valeurTotale: 0, dateCreation: new Date().toISOString().split('T')[0] });
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Date de création</label>
              <input
                type="date"
                value={formData.dateCreation}
                onChange={e => setFormData({ ...formData, dateCreation: e.target.value })}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
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
            {/* Removed Stock Initial Input to enforce using Movements */}
            {/* Removed Prix Moyen Initial Input to enforce using Movements */}
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

            <div className="col-span-1 md:col-span-2 bg-blue-50 p-3 rounded-lg flex items-start space-x-2">
                <div className="text-blue-500 mt-0.5"><AlertTriangle size={16} /></div>
                <div className="text-sm text-blue-700">
                    <span className="font-bold">Note :</span> Créez d'abord la matière avec son unité de base (ex: kg). 
                    Vous pourrez ensuite ajouter du stock en <b>Cartons</b> ou <b>Sacs</b> via le bouton "Mouvements" <ArrowRightLeft className="inline" size={14}/> dans la liste.
                </div>
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

      {/* Conversion Modal */}
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
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
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
                              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
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
                              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none font-bold"
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
                              <li>Prix : {Math.round(conversionState.matiere.prixMoyenPondere || 0).toLocaleString()} → <b>{Math.round((conversionState.matiere.prixMoyenPondere || 0) / parseFloat(conversionState.factor || '1')).toLocaleString()} FCFA / {conversionState.targetUnit}</b></li>
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
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Nom</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Date Création</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-gray-600">Stock Actuel</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-gray-600">Valeur (FCFA)</th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-gray-600">État</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {matieres.map((matiere) => {
              const isLowStock = matiere.stockActuel <= matiere.stockMinimum;
              // Check if unit is convertible (sac)
              const isConvertible = matiere.unite.includes('sac');

              return (
                <tr key={matiere.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{matiere.nom}</div>
                    <div className="text-xs text-gray-500">PMP: {Math.round(matiere.prixMoyenPondere).toLocaleString()} FCFA / {matiere.unite}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(matiere.createdAt).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-gray-900">
                    {matiere.stockActuel.toLocaleString()} <span className="text-gray-500 text-sm">{matiere.unite}</span>
                    {matiere.unite === 'kg' && matiere.stockActuel >= 50 && (
                        <div className="text-xs text-blue-600 mt-1">
                            (~{(matiere.stockActuel / 50).toLocaleString(undefined, {maximumFractionDigits: 1})} sacs de 50kg)
                        </div>
                    )}
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
                       {/* Conversion quick action */}
                       {isConvertible && (
                           <button
                                onClick={() => openConversion(matiere)}
                                className="px-2 py-1 text-xs bg-indigo-50 text-indigo-700 rounded border border-indigo-200 hover:bg-indigo-100 mr-2"
                                title="Convertir en kg"
                           >
                               Convertir kg
                           </button>
                       )}

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
