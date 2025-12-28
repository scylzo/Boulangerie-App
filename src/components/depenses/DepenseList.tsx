import React from 'react';
import { useDepenseStore } from '../../store/depenseStore';
import { Trash2, Calendar, Tag, CreditCard, Building2 } from 'lucide-react';
import { useConfirmModal } from '../../hooks/useConfirmModal';
import { ConfirmModal } from '../ui/ConfirmModal';

export const DepenseList: React.FC = () => {
  const { depenses, supprimerDepense, isLoading } = useDepenseStore();
  const { isOpen, title, message, confirm, handleConfirm, handleCancel } = useConfirmModal();

  const handleDelete = async (id: string) => {
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (depenses.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
        <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <CreditCard className="text-gray-400" size={32} />
        </div>
        <h3 className="text-lg font-medium text-gray-900">Aucune dépense</h3>
        <p className="text-gray-500 mt-1">Commencez par ajouter une nouvelle dépense.</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Catégorie
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Montant
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {depenses.map((depense) => (
                <tr key={depense.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center">
                      <Calendar size={16} className="mr-2 text-gray-400" />
                      {depense.date.toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      <Tag size={12} className="mr-1" />
                      {depense.categorie}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 font-medium">{depense.description}</div>
                    {depense.fournisseur && (
                      <div className="flex items-center text-xs text-gray-500 mt-1">
                        <Building2 size={12} className="mr-1" />
                        {depense.fournisseur}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-gray-900">
                    {depense.montant.toLocaleString()} F
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleDelete(depense.id)}
                      className="text-red-400 hover:text-red-900 transition-colors p-2 hover:bg-red-50 rounded-full"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
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
