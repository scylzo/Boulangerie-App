import React from 'react';
import { Icon } from '@iconify/react';
import { AssignationClientLivreur } from '../../components/shared/AssignationClientLivreur';

export const AssignationLivreurs: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header moderne type Odoo */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <Icon icon="mdi:truck-fast" className="text-2xl text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Assignation des Livreurs
              </h1>
              <p className="text-sm text-gray-500">
                Gérez l'assignation des clients aux livreurs pour optimiser les livraisons
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto p-6">
        {/* Composant d'assignation */}
        <AssignationClientLivreur />
      </div>
    </div>
  );
};