import React, { useState } from 'react';
import { useStockStore } from '../../store/stockStore';
import { Plus, Edit2, Trash2, Phone, MapPin, User, Tag } from 'lucide-react';
import type { Fournisseur } from '../../types';

export const FournisseurList: React.FC = () => {
  const { fournisseurs, addFournisseur, updateFournisseur, deleteFournisseur } = useStockStore();
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    nom: '',
    contact: '',
    telephone: '',
    adresse: '',
    categories: '' // Géré comme string séparée par virgules pour simplifier l'input
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const categoriesArray = formData.categories.split(',').map(c => c.trim()).filter(c => c !== '');

    if (isEditing) {
      await updateFournisseur(isEditing, {
        nom: formData.nom,
        contact: formData.contact,
        telephone: formData.telephone,
        adresse: formData.adresse,
        categories: categoriesArray
      });
      setIsEditing(null);
    } else {
      await addFournisseur({
        nom: formData.nom,
        contact: formData.contact,
        telephone: formData.telephone,
        adresse: formData.adresse,
        categories: categoriesArray,
        active: true
      });
    }
    resetForm();
    setShowForm(false);
  };

  const resetForm = () => {
    setFormData({ nom: '', contact: '', telephone: '', adresse: '', categories: '' });
  };

  const startEdit = (fournisseur: Fournisseur) => {
    setFormData({
      nom: fournisseur.nom,
      contact: fournisseur.contact,
      telephone: fournisseur.telephone || '',
      adresse: fournisseur.adresse || '',
      categories: fournisseur.categories.join(', ')
    });
    setIsEditing(fournisseur.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce fournisseur ?')) {
      await deleteFournisseur(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-800">Fournisseurs</h3>
        <button
          onClick={() => {
            setIsEditing(null);
            resetForm();
            setShowForm(!showForm);
          }}
          className="flex items-center space-x-2 bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors"
        >
          <Plus size={20} />
          <span>Nouveau Fournisseur</span>
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l'entreprise</label>
              <input
                required
                type="text"
                value={formData.nom}
                onChange={e => setFormData({ ...formData, nom: e.target.value })}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                placeholder="Ex: Grands Moulins de Dakar"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Principal (Nom)</label>
              <input
                required
                type="text"
                value={formData.contact}
                onChange={e => setFormData({ ...formData, contact: e.target.value })}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                placeholder="Ex: M. Diallo"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
              <input
                type="tel"
                value={formData.telephone}
                onChange={e => setFormData({ ...formData, telephone: e.target.value })}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                placeholder="Ex: 77 123 45 67"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
              <input
                type="text"
                value={formData.adresse}
                onChange={e => setFormData({ ...formData, adresse: e.target.value })}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                placeholder="Adresse du dépôt / bureau"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Catégories (séparées par des virgules)</label>
              <input
                type="text"
                value={formData.categories}
                onChange={e => setFormData({ ...formData, categories: e.target.value })}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                placeholder="Ex: Farine, Levure, Emballage"
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
              {isEditing ? 'Mettre à jour' : 'Ajouter'}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {fournisseurs.map((fournisseur) => (
          <div key={fournisseur.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="font-bold text-lg text-gray-800">{fournisseur.nom}</h4>
                <div className="flex items-center text-gray-500 text-sm mt-1">
                  <User size={14} className="mr-1" />
                  {fournisseur.contact}
                </div>
              </div>
              <div className="flex space-x-1">
                <button
                  onClick={() => startEdit(fournisseur)}
                  className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => handleDelete(fournisseur.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <div className="space-y-2 text-sm text-gray-600">
              {fournisseur.telephone && (
                <div className="flex items-center">
                  <Phone size={14} className="mr-2 text-gray-400" />
                  {fournisseur.telephone}
                </div>
              )}
              {fournisseur.adresse && (
                <div className="flex items-center">
                  <MapPin size={14} className="mr-2 text-gray-400" />
                  {fournisseur.adresse}
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-50 flex flex-wrap gap-2">
              {fournisseur.categories.map((cat, idx) => (
                <span key={idx} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-600">
                  <Tag size={10} className="mr-1" />
                  {cat}
                </span>
              ))}
              {fournisseur.categories.length === 0 && (
                <span className="text-xs text-gray-400 italic">Aucune catégorie</span>
              )}
            </div>
          </div>
        ))}
        
        {fournisseurs.length === 0 && !showForm && (
          <div className="col-span-full py-12 text-center text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <User size={48} className="mx-auto mb-4 opacity-20" />
            <p>Aucun fournisseur enregistré.</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 text-orange-500 hover:text-orange-600 font-medium"
            >
              Ajouter le premier fournisseur
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
