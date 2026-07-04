import React from 'react';
import { Icon } from '@iconify/react';
import { AssignationClientLivreur } from '../../components/shared/AssignationClientLivreur';

export const AssignationLivreurs: React.FC = () => {
  return (
    <div className="min-h-screen bg-sand-100">
      {/* Header moderne type Odoo */}
      <div className="bg-white border-b border-sand-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-terracotta-50 rounded-xl flex items-center justify-center">
              <Icon icon="mdi:truck-fast" className="text-2xl text-terracotta-600" />
            </div>
            <div>
              <h1 className="font-display text-xl sm:text-2xl font-semibold text-sand-900">
                Assignation des Livreurs
              </h1>
              <p className="text-sm text-sand-500">
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