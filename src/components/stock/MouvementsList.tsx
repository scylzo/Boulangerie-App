import React, { useState } from 'react';
import { useStockStore } from '../../store/stockStore';
import { ArrowDownLeft, ArrowUpRight, Search, Edit2, Trash2 } from 'lucide-react';
import type { MouvementStock, MatierePremiere } from '../../types';
import { ConfirmModal } from '../ui/ConfirmModal';
import { MouvementModal } from './MouvementModal';

type EnrichedMouvement = MouvementStock & {
  matiereNom: string;
  matiereUnite: string;
  matiere?: MatierePremiere;
};

export const MouvementsList: React.FC = () => {
  const { mouvements, matieres, deleteMouvement } = useStockStore();
  const [searchTerm, setSearchTerm] = useState('');

  // Filters State
  const [filterType, setFilterType] = useState<string>('all');
  const [filterArticle, setFilterArticle] = useState<string>('all');
  const [filterDateDebut, setFilterDateDebut] = useState<string>('');
  const [filterDateFin, setFilterDateFin] = useState<string>('');

  // Edit & Delete State
  const [editingMouvement, setEditingMouvement] = useState<EnrichedMouvement | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string }>({ isOpen: false, id: '' });

  // Enrichir les mouvements avec le nom de la matière
  const enrichedMouvements = mouvements.map(m => {
    const matiere = matieres.find(mat => mat.id === m.matiereId);
    return {
      ...m,
      matiereNom: matiere ? matiere.nom : 'Article Inconnu',
      matiereUnite: matiere ? matiere.unite : '',
      matiere: matiere // On garde la ref entière pour le modal d'édition
    };
  });

  const filteredMouvements = enrichedMouvements.filter(m => {
    // Filtre par recherche textuelle
    const matchSearch = m.matiereNom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.motif && m.motif.toLowerCase().includes(searchTerm.toLowerCase()));

    // Filtre par type
    const matchType = filterType === 'all' || m.type === filterType;

    // Filtre par article
    const matchArticle = filterArticle === 'all' || m.matiereId === filterArticle;

    // Filtre par date
    let matchDate = true;
    if (filterDateDebut || filterDateFin) {
      const mouvementDate = new Date(m.date);
      mouvementDate.setHours(0, 0, 0, 0);

      if (filterDateDebut) {
        const dateDebut = new Date(filterDateDebut);
        dateDebut.setHours(0, 0, 0, 0);
        matchDate = matchDate && mouvementDate >= dateDebut;
      }

      if (filterDateFin) {
        const dateFin = new Date(filterDateFin);
        dateFin.setHours(23, 59, 59, 999);
        matchDate = matchDate && mouvementDate <= dateFin;
      }
    }

    return matchSearch && matchType && matchArticle && matchDate;
  });

  const handleDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      await deleteMouvement(deleteConfirm.id);
      setDeleteConfirm({ isOpen: false, id: '' });
    } catch (error) {
      console.error(error);
      alert("Impossible de supprimer ce mouvement");
    }
  };

  const getTypeStyle = (type: MouvementStock['type']) => {
    switch (type) {
      case 'achat':
        return 'bg-success-100 text-success-700';
      case 'consommation':
        return 'bg-info-100 text-info-600';
      case 'perte':
        return 'bg-danger-100 text-danger-700';
      case 'correction':
        return 'bg-sand-100 text-sand-800';
      case 'retour_fournisseur':
        return 'bg-warning-100 text-warning-600';
      default:
        return 'bg-sand-100 text-sand-800';
    }
  };

  const getIcon = (type: MouvementStock['type']) => {
    if (type === 'achat') return <ArrowDownLeft size={16} className="mr-1" />;
    return <ArrowUpRight size={16} className="mr-1" />;
  };

  const resetFilters = () => {
    setFilterType('all');
    setFilterArticle('all');
    setFilterDateDebut('');
    setFilterDateFin('');
    setSearchTerm('');
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h3 className="text-base sm:text-lg font-semibold text-sand-800">Historique des Mouvements</h3>
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sand-400" size={18} />
          <input
            type="text"
            placeholder="Rechercher..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-warning-500 outline-none w-full sm:w-64"
          />
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-sand-50 p-3 sm:p-4 rounded-lg border border-sand-200">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Filtre Type */}
          <div>
            <label className="block text-xs font-medium text-sand-700 mb-1">Type de mouvement</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full p-2 border rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-warning-500 outline-none bg-white"
            >
              <option value="all">Tous les types</option>
              <option value="achat">Achat / Entrée</option>
              <option value="consommation">Consommation</option>
              <option value="perte">Perte</option>
              <option value="correction">Correction</option>
              <option value="retour_fournisseur">Retour fournisseur</option>
            </select>
          </div>

          {/* Filtre Article */}
          <div>
            <label className="block text-xs font-medium text-sand-700 mb-1">Article</label>
            <select
              value={filterArticle}
              onChange={(e) => setFilterArticle(e.target.value)}
              className="w-full p-2 border rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-warning-500 outline-none bg-white"
            >
              <option value="all">Tous les articles</option>
              {matieres
                .filter(m => m.active)
                .sort((a, b) => a.nom.localeCompare(b.nom))
                .map(matiere => (
                  <option key={matiere.id} value={matiere.id}>
                    {matiere.nom}
                  </option>
                ))
              }
            </select>
          </div>

          {/* Filtre Date Début */}
          <div>
            <label className="block text-xs font-medium text-sand-700 mb-1">Date début</label>
            <input
              type="date"
              value={filterDateDebut}
              onChange={(e) => setFilterDateDebut(e.target.value)}
              className="w-full p-2 border rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-warning-500 outline-none"
            />
          </div>

          {/* Filtre Date Fin */}
          <div>
            <label className="block text-xs font-medium text-sand-700 mb-1">Date fin</label>
            <input
              type="date"
              value={filterDateFin}
              onChange={(e) => setFilterDateFin(e.target.value)}
              className="w-full p-2 border rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-warning-500 outline-none"
            />
          </div>
        </div>

        {/* Bouton Reset */}
        <div className="mt-3 flex justify-end">
          <button
            onClick={resetFilters}
            className="text-xs sm:text-sm text-warning-600 hover:text-warning-600 font-medium">
            Réinitialiser les filtres
          </button>
        </div>

        {/* Résumé des filtres actifs */}
        <div className="mt-2 text-xs text-sand-600">
          <span className="font-medium">{filteredMouvements.length}</span> mouvement(s) affiché(s)
          {mouvements.length !== filteredMouvements.length && (
            <span> sur {mouvements.length} au total</span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-sand-50 text-left text-xs font-semibold text-sand-500 uppercase tracking-wider">
              <th className="px-3 py-3 w-32">Date</th>
              <th className="px-3 py-3">Article</th>
              <th className="px-3 py-3">Type</th>
              <th className="px-3 py-3 text-right">Quantité</th>
              <th className="px-3 py-3">Réf / Motif</th>
              <th className="px-3 py-3 w-20">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-sand-100">
            {filteredMouvements.map((m) => (
              <tr key={m.id} className="hover:bg-sand-50 transition-colors group">
                <td className="px-3 py-4 whitespace-nowrap text-sm text-sand-500">
                  <div className="flex flex-col">
                    <span className="font-medium">{new Date(m.date).toLocaleDateString('fr-FR')}</span>
                    {new Date(m.date).getHours() !== 0 && new Date(m.date).getMinutes() !== 0 && (
                      <span className="text-xs text-sand-400">
                        {new Date(m.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-sand-900">
                  {m.matiereNom}
                </td>
                <td className="px-3 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getTypeStyle(m.type)}`}>
                    {getIcon(m.type)}
                    {m.type === 'achat' ? 'Entrée' : m.type.charAt(0).toUpperCase() + m.type.slice(1)}
                  </span>
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-sm text-right font-medium text-sand-900">
                  {/* Affichage Quantité */}
                  <div className="font-bold text-sand-900">
                    {m.quantite.toLocaleString('fr-FR')} {m.matiereUnite}
                  </div>
                  {/* Parsing du motif pour afficher les sacs ou sachets si présents */}
                  {(() => {
                    // Cherche motifs du type "(3 sacs)" ou "2 sachets", etc.
                    const containerMatch = m.motif && m.motif.match(/(\d+(?:[.,]\d+)?)\s*(sachets?|sacs?)\b/i);
                    const weightMatch = m.motif && m.motif.match(/de\s*(\d+)/i); // Cherche "de 50" dans "sacs de 50kg"

                    if (containerMatch) {
                      const count = containerMatch[1];
                      const unitLabel = containerMatch[2].toLowerCase();

                      return (
                        <div className="text-xs text-info-600 font-medium">
                          {count} {unitLabel} {weightMatch ? `x ${weightMatch[1]}kg` : ''}
                        </div>
                      );
                    }
                    return null;
                  })()}
                </td>

                <td className="px-3 py-4 text-sm text-sand-500 max-w-xs truncate">
                  <div className="flex flex-col">
                    <span title={m.motif}>{m.motif || '-'}</span>
                    <div className="flex gap-2 text-xs text-sand-400 mt-0.5">
                      {m.referenceDocument && <span>Ref: {m.referenceDocument}</span>}
                      {m.responsable && <span className="text-success-600">Validé: {m.responsable}</span>}
                    </div>
                  </div>
                </td>

                <td className="px-3 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => m.matiere && setEditingMouvement(m)}
                      className="p-1.5 text-info-600 hover:bg-info-50 rounded"
                      title="Modifier"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm({ isOpen: true, id: m.id })}
                      className="p-1.5 text-danger-600 hover:bg-danger-50 rounded"
                      title="Supprimer (Annule l'impact stock)"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredMouvements.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sand-500">
                  Aucun mouvement trouvé.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, id: '' })}
        onConfirm={handleDelete}
        title="Supprimer ce mouvement ?"
        message="Attention : Le stock de la matière première sera ajusté en conséquence (inversion du mouvement)."
        confirmText="Supprimer et Ajuster Stock"
        cancelText="Annuler"
        type="danger"
      />

      {editingMouvement && editingMouvement.matiere && (
        <MouvementModal
          isOpen={true}
          onClose={() => setEditingMouvement(null)}
          selectedMatiere={editingMouvement.matiere}
          initialData={editingMouvement}
          isEditing={true}
        />
      )}
    </div>
  );
};
