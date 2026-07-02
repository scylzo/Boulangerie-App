import React from 'react';
import { useDepenseStore } from '../../store/depenseStore';
import { Trash2, Calendar, Tag, CreditCard, Building2, Edit2 } from 'lucide-react';
import { useConfirmModal } from '../../hooks/useConfirmModal';
import { ConfirmModal } from '../ui/ConfirmModal';
import type { Depense } from '../../types/depense';

interface DepenseListProps {
  onEdit?: (depense: Depense) => void;
  onDeleteStock?: (id: string) => void;
  depenses?: Depense[];
  readOnly?: boolean;
}

export const DepenseList: React.FC<DepenseListProps> = ({ onEdit, onDeleteStock, depenses: propDepenses, readOnly = false }) => {
  const { depenses: storeDepenses, supprimerDepense, isLoading } = useDepenseStore();
  const depenses = propDepenses || storeDepenses;
  const { isOpen, title, message, confirm, handleConfirm, handleCancel } = useConfirmModal();

  const handleDelete = async (id: string) => {
    if (id.startsWith('stock_')) {
      if (onDeleteStock) {
        const confirmed = await confirm({
          title: 'Supprimer ce mouvement de stock ?',
          message: "Attention : Cette action supprimera définitivement le mouvement de l'historique de stock et mettra à jour les quantités. Êtes-vous sûr ?",
          type: 'danger',
          confirmText: 'Oui, supprimer du Stock',
          cancelText: 'Annuler'
        });

        if (confirmed) {
          onDeleteStock(id);
        }
      } else {
        // Fallback si la fonction n'est pas fournie (ne devrait pas arriver avec la modif parent)
        alert("Action impossible ici.");
      }
      return;
    }

    const confirmed = await confirm({
      title: 'Supprimer cette dépense ?',
      message: 'Cette action est irréversible.',
      type: 'danger',
      confirmText: 'Supprimer',
      cancelText: 'Annuler'
    });

    if (confirmed) {
      supprimerDepense(id);
    }
  };

  if (isLoading && depenses.length === 0) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-warning-500"></div>
      </div>
    );
  }

  if (depenses.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-sand-100">
        <div className="bg-sand-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <CreditCard className="text-sand-400" size={32} />
        </div>
        <h3 className="text-lg font-medium text-sand-900">Aucune dépense</h3>
        <p className="text-sand-500 mt-1">Commencez par ajouter une nouvelle dépense.</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-sand-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-sand-200">
            <thead className="bg-sand-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-sand-500 uppercase tracking-wider">
                  Date
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-sand-500 uppercase tracking-wider">
                  Catégorie
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-sand-500 uppercase tracking-wider">
                  Description
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-sand-500 uppercase tracking-wider">
                  Montant
                </th>
                {!readOnly && (
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-sand-500 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-sand-200">
              {depenses.map((depense) => (
                <tr key={depense.id} className="hover:bg-sand-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-sand-500">
                    <div className="flex items-center">
                      <Calendar size={16} className="mr-2 text-sand-400" />
                      {depense.date.toLocaleDateString('fr-FR')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sand-100 text-sand-800">
                      <Tag size={12} className="mr-1" />
                      {depense.categorie}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-sand-900 font-medium">{depense.description}</div>
                    {depense.fournisseur && (
                      <div className="flex items-center text-xs text-sand-500 mt-1">
                        <Building2 size={12} className="mr-1" />
                        {depense.fournisseur}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-sand-900">
                    {depense.montant.toLocaleString()} FCFA
                  </td>
                  {!readOnly && (
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        {onEdit && (
                          <button
                            onClick={() => onEdit(depense)}
                            className="text-sand-400 hover:text-warning-600 transition-colors p-2 hover:bg-warning-50 rounded-full"
                            title="Modifier"
                          >
                            <Edit2 size={18} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(depense.id)}
                          className="text-sand-400 hover:text-danger-700 transition-colors p-2 hover:bg-danger-50 rounded-full"
                          title="Supprimer"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        isOpen={isOpen}
        onClose={handleCancel}
        onConfirm={handleConfirm}
        title={title}
        message={message}
        type="danger"
      />
    </>
  );
};
