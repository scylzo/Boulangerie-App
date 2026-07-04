import React, { useState } from 'react';
import { useStockStore } from '../../store/stockStore';
import { Plus, Edit2, Trash2, AlertTriangle, ArrowRightLeft, Scale } from 'lucide-react';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../ui/ConfirmModal';
import { Modal } from '../ui/Modal';
import type { MatierePremiere, UniteMesure } from '../../types';
import { formaterQuantite } from '../../utils/calculations';
import { useAuthStore } from '../../store/authStore';

interface MatiereListProps {
  onAddMouvement: (matiere: MatierePremiere) => void;
}

export const MatiereList: React.FC<MatiereListProps> = ({ onAddMouvement }) => {
  const { matieres, addMatiere, updateMatiere, deleteMatiere, addMouvement } = useStockStore();
  const { user } = useAuthStore();
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

  // Correction de stock (inventaire)
  const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  const [correction, setCorrection] = useState<{ isOpen: boolean; matiere?: MatierePremiere; valeur: string }>({
    isOpen: false,
    valeur: ''
  });
  const [isCorrecting, setIsCorrecting] = useState(false);

  const openCorrection = (matiere: MatierePremiere) => {
    setCorrection({ isOpen: true, matiere, valeur: String(round2(Math.max(0, matiere.stockActuel))) });
  };

  const handleCorriger = async () => {
    if (!correction.matiere) return;
    const cible = round2(parseFloat(correction.valeur.replace(',', '.')) || 0);
    const delta = round2(cible - correction.matiere.stockActuel);
    if (delta === 0) {
      setCorrection({ isOpen: false, valeur: '' });
      return;
    }
    setIsCorrecting(true);
    try {
      await addMouvement({
        date: new Date(),
        matiereId: correction.matiere.id,
        type: 'correction',
        quantite: delta,
        motif: 'Correction inventaire',
        auteur: user ? `${user.prenom || ''} ${user.nom || ''}`.trim() : '',
        userId: user?.id || 'current-user-id',
      });
      toast.success(`Stock corrigé : ${formaterQuantite(cible, correction.matiere.unite)}`);
      setCorrection({ isOpen: false, valeur: '' });
    } catch {
      toast.error('Erreur lors de la correction du stock');
    } finally {
      setIsCorrecting(false);
    }
  };

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
    
    // Assainissement des données : on s'assure que le seuil est bien un nombre
    const stockMinimum = formData.stockMinimum === '' ? 0 : Number(formData.stockMinimum);
    const createdAt = formData.dateCreation ? new Date(formData.dateCreation) : new Date();

    if (isEditing) {
      // On ne passe que les champs modifiables pour éviter de polluer Firestore avec 'id' ou 'dateCreation'
      updateMatiere(isEditing, {
        nom: formData.nom,
        unite: formData.unite,
        stockMinimum,
        createdAt
      });
      setIsEditing(null);
    } else {
      addMatiere({
        nom: formData.nom || '',
        unite: formData.unite as UniteMesure || 'kg',
        stockMinimum,
        stockActuel: 0,
        prixUnitaireMoyen: 0,
        active: true,
        createdAt
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
        <h2 className="text-base sm:text-lg font-semibold text-sand-800">Matières Premières</h2>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button
            onClick={() => useStockStore.getState().reparerHistoriqueStock()}
            className="flex items-center justify-center space-x-2 bg-sand-100 hover:bg-sand-200 text-sand-700 px-3 py-2 rounded-lg transition-colors text-xs sm:text-sm font-semibold border border-sand-300"
            title="Recalcule le stock actuel et le Prix Moyen Pondéré de toutes les matières en rejouant l'historique des mouvements"
          >
            <AlertTriangle size={14} className="sm:w-4 sm:h-4 text-warning-500" />
            <span>Réparer PMP</span>
          </button>
          <button
            onClick={() => {
              setIsEditing(null);
              setFormData({ nom: '', unite: 'kg', stockMinimum: '', stockActuel: '', dateCreation: new Date().toISOString().split('T')[0] });
              setShowForm(!showForm);
            }}
            className="flex items-center justify-center space-x-2 bg-warning-600 hover:bg-warning-600 text-white px-3 sm:px-4 py-2 rounded-lg transition-colors flex-1 sm:flex-none text-sm sm:text-base"
          >
            <Plus size={18} className="sm:w-5 sm:h-5" />
            <span>Nouvelle Matière</span>
          </button>
        </div>
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
              <label className="block text-sm font-medium text-sand-700 mb-1">Nom</label>
              <input
                required
                type="text"
                value={formData.nom}
                onChange={e => setFormData({ ...formData, nom: e.target.value })}
                className="w-full p-2.5 border border-sand-200 rounded-xl focus:ring-2 focus:ring-warning-500/20 focus:border-warning-500 outline-none transition-all"
                placeholder="Ex: Farine GMD (Sac 50kg)"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-sand-700 mb-1">Date de création</label>
              <input
                type="date"
                value={formData.dateCreation}
                onChange={e => setFormData({ ...formData, dateCreation: e.target.value })}
                className="w-full p-2.5 border border-sand-200 rounded-xl focus:ring-2 focus:ring-warning-500/20 focus:border-warning-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-sand-700 mb-1">Unité</label>
              <select
                value={formData.unite}
                onChange={e => setFormData({ ...formData, unite: e.target.value as UniteMesure })}
                className="w-full p-2.5 border border-sand-200 rounded-xl focus:ring-2 focus:ring-warning-500/20 focus:border-warning-500 outline-none transition-all"
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
              <label className="block text-sm font-medium text-sand-700 mb-1">Seuil d'alerte</label>
              <input
                type="number"
                min="0"
                value={formData.stockMinimum}
                onChange={e => setFormData({ ...formData, stockMinimum: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                className="w-full p-2.5 border border-sand-200 rounded-xl focus:ring-2 focus:ring-warning-500/20 focus:border-warning-500 outline-none transition-all"
              />
            </div>

            <div className="col-span-1 md:col-span-2 bg-warning-50/50 p-4 rounded-xl flex items-start space-x-3 border border-warning-100">
              <div className="text-warning-600 mt-0.5"><AlertTriangle size={18} /></div>
              <div className="text-sm text-warning-600 leading-relaxed">
                <span className="font-semibold">Note :</span> Créez d'abord la matière avec son unité de base.
                Vous pourrez ensuite ajouter du stock via le bouton <b>Mouvements</b> <ArrowRightLeft className="inline mx-1" size={14} /> dans la liste.
              </div>
            </div>
          </div>
          <div className="flex gap-3 pt-6">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 px-5 py-3 text-sm font-semibold text-sand-700 bg-white hover:bg-sand-50 border border-sand-300 rounded-xl transition-all"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 px-5 py-3 text-sm font-semibold text-white bg-warning-600 hover:bg-warning-600 rounded-xl shadow-sm hover:shadow-elevated transition-all"
            >
              {isEditing ? 'Mettre à jour' : 'Créer la matière'}
            </button>
          </div>
        </form>
      </Modal>

      {conversionState.isOpen && conversionState.matiere && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-elevated w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-sand-100 flex justify-between items-center bg-sand-50">
              <h3 className="font-semibold text-sand-800">
                Convertir l'unité : {conversionState.matiere.nom}
              </h3>
              <button
                onClick={() => setConversionState({ ...conversionState, isOpen: false })}
                className="text-sand-400 hover:text-sand-600"
              >
                <Plus className="rotate-45" size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-sand-500 mb-2">
                Convertir de <b>{conversionState.matiere.unite}</b> vers :
              </p>

              <div>
                <label className="block text-sm font-medium text-sand-700 mb-1">Nouvelle Unité</label>
                <select
                  value={conversionState.targetUnit}
                  onChange={(e) => setConversionState({ ...conversionState, targetUnit: e.target.value as UniteMesure })}
                  className="w-full p-2 border border-sand-200 rounded-lg focus:ring-2 focus:ring-warning-500 outline-none"
                >
                  <option value="kg">Kilogramme (kg)</option>
                  <option value="g">Gramme (g)</option>
                  <option value="l">Litre (l)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-sand-700 mb-1">
                  Facteur de conversion : 1 {conversionState.matiere.unite} = ? {conversionState.targetUnit}
                </label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={conversionState.factor}
                  onChange={(e) => setConversionState({ ...conversionState, factor: e.target.value })}
                  className="w-full p-2 border border-sand-200 rounded-lg focus:ring-2 focus:ring-warning-500 outline-none font-semibold"
                  placeholder="Ex: 50"
                />
                <p className="text-xs text-sand-500 mt-1">
                  Exemple: Si 1 sac = 50kg, entrez <b>50</b>.
                </p>
              </div>

              <div className="bg-info-50 p-3 rounded-lg text-sm text-info-600">
                <p className="font-medium">Aperçu du résultat :</p>
                <ul className="list-disc list-inside mt-1 space-y-1 text-xs">
                  <li>Stock : {formaterQuantite(conversionState.matiere.stockActuel)} → <b>{formaterQuantite((conversionState.matiere.stockActuel || 0) * parseFloat(conversionState.factor || '0'), conversionState.targetUnit)}</b></li>
                </ul>
              </div>
            </div>

            <div className="px-6 py-4 bg-sand-50 flex justify-end gap-3 border-t border-sand-100">
              <button
                onClick={() => setConversionState({ ...conversionState, isOpen: false })}
                className="px-4 py-2 border border-sand-300 rounded-lg text-sand-700 hover:bg-sand-100"
              >
                Annuler
              </button>
              <button
                onClick={handleConversion}
                className="px-4 py-2 bg-info-600 text-white rounded-lg hover:bg-info-600 font-medium shadow-sm"
              >
                Confirmer la conversion
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-sand-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-sand-50 border-b border-sand-100">
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-sand-600">Nom</th>
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-sand-600">Date Création</th>
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-right text-xs sm:text-sm font-semibold text-sand-600">Stock Actuel</th>
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs sm:text-sm font-semibold text-sand-600">État</th>
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-right text-xs sm:text-sm font-semibold text-sand-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-100">
            {matieres.map((matiere) => {
              // Si le seuil est à 0, on considère que l'alerte est désactivée (État vert/OK)
              const isLowStock = matiere.stockMinimum > 0 && matiere.stockActuel <= matiere.stockMinimum;
              const isConvertible = matiere.unite.includes('sac');

              return (
                <tr key={matiere.id} className="hover:bg-sand-50 transition-colors">
                  <td className="px-3 sm:px-6 py-3 sm:py-4">
                    <div className="text-xs sm:text-sm font-medium text-sand-900">{matiere.nom}</div>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-sand-600">
                    {new Date(matiere.createdAt).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-right">
                    <div className="text-xs sm:text-sm font-medium text-sand-900">
                      {formaterQuantite(matiere.stockActuel)} <span className="text-sand-500 text-xs">{matiere.unite}</span>
                    </div>
                    <div className="text-[10px] text-sand-400 mt-0.5">
                      Seuil: {formaterQuantite(matiere.stockMinimum, matiere.unite)}
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                    {isLowStock ? (
                      <span className="inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-xs font-medium bg-danger-100 text-danger-700">
                        <AlertTriangle size={12} className="mr-1" />
                        Critique
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-700">
                        OK
                      </span>
                    )}
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-right">
                    <div className="flex justify-end space-x-1 sm:space-x-2">
                      {isConvertible && (
                        <button
                          onClick={() => openConversion(matiere)}
                          className="px-1.5 sm:px-2 py-1 text-xs bg-terracotta-50 text-terracotta-700 rounded border border-terracotta-200 hover:bg-terracotta-100"
                        >
                          <span className="hidden sm:inline">Convertir kg</span>
                          <span className="sm:hidden">Conv.</span>
                        </button>
                      )}
                      <button onClick={() => onAddMouvement(matiere)} title="Mouvement de stock" className="p-1.5 sm:p-2 text-info-600 hover:bg-info-50 rounded-lg">
                        <ArrowRightLeft size={16} className="sm:w-[18px] sm:h-[18px]" />
                      </button>
                      <button
                        onClick={() => openCorrection(matiere)}
                        title="Corriger le stock (inventaire)"
                        className={`p-1.5 sm:p-2 rounded-lg ${matiere.stockActuel < 0 ? 'text-warning-600 hover:bg-warning-50 ring-1 ring-warning-200' : 'text-sand-600 hover:bg-sand-100'}`}
                      >
                        <Scale size={16} className="sm:w-[18px] sm:h-[18px]" />
                      </button>
                      <button onClick={() => startEdit(matiere)} title="Modifier" className="p-1.5 sm:p-2 text-sand-600 hover:bg-sand-100 rounded-lg">
                        <Edit2 size={16} className="sm:w-[18px] sm:h-[18px]" />
                      </button>
                      <button onClick={() => handleDelete(matiere.id, matiere.nom)} className="p-1.5 sm:p-2 text-danger-600 hover:bg-danger-50 rounded-lg">
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

      {/* Correction de stock (inventaire) */}
      {correction.isOpen && correction.matiere && (() => {
        const m = correction.matiere;
        const cible = round2(parseFloat(correction.valeur.replace(',', '.')) || 0);
        const delta = round2(cible - m.stockActuel);
        return (
          <Modal
            isOpen={correction.isOpen}
            onClose={() => setCorrection({ isOpen: false, valeur: '' })}
            title={`Corriger le stock — ${m.nom}`}
            size="sm"
            position="center"
          >
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-terracotta-50 text-terracotta-600 flex items-center justify-center shrink-0">
                  <Scale size={20} />
                </div>
                <p className="text-sm text-sand-500">
                  Saisis le <b>stock réellement compté</b>. Un mouvement de correction sera enregistré pour aligner le système sur la réalité.
                </p>
              </div>

              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-sand-50 border border-sand-200 text-sm">
                <span className="text-sand-500">Stock système actuel</span>
                <span className={`font-semibold tabular-nums ${m.stockActuel < 0 ? 'text-danger-600' : 'text-sand-900'}`}>
                  {formaterQuantite(m.stockActuel, m.unite)}
                </span>
              </div>

              <div>
                <label className="block text-sm font-medium text-sand-700 mb-1.5">Stock réel constaté ({m.unite})</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  autoFocus
                  value={correction.valeur}
                  onChange={(e) => setCorrection((c) => ({ ...c, valeur: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCorriger(); }}
                  className="w-full px-3 py-2.5 border border-sand-300 rounded-lg text-right font-semibold text-sand-900 tabular-nums focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
                />
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-sand-500">Ajustement</span>
                <span className={`font-semibold tabular-nums ${delta === 0 ? 'text-sand-400' : delta > 0 ? 'text-success-600' : 'text-danger-600'}`}>
                  {delta > 0 ? '+' : ''}{formaterQuantite(delta, m.unite)}
                </span>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => setCorrection({ isOpen: false, valeur: '' })}
                  className="flex-1 py-2.5 rounded-xl border border-sand-300 text-sand-700 hover:bg-sand-50 font-medium"
                >
                  Annuler
                </button>
                <button
                  onClick={handleCorriger}
                  disabled={isCorrecting || delta === 0}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-terracotta-600 hover:bg-terracotta-700 text-white font-semibold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCorrecting ? 'Correction…' : 'Valider la correction'}
                </button>
              </div>
            </div>
          </Modal>
        );
      })()}

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
