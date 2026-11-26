import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { useStockStore } from '../../store/stockStore';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../ui/ConfirmModal';
import { Modal } from '../ui/Modal';
import type { MatierePremiere, UniteMesure } from '../../types';
import { formaterQuantite } from '../../utils/calculations';
import { getOptionsConditionnement } from '../../utils/conditionnementStock';
import { useAuthStore } from '../../store/authStore';

interface MatiereListProps {
  onAddMouvement?: (matiere: MatierePremiere) => void;
  onReception?: (matiere: MatierePremiere) => void;
}

export const MatiereList: React.FC<MatiereListProps> = () => {
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
  const [correction, setCorrection] = useState<{
    isOpen: boolean;
    matiere?: MatierePremiere;
    valeur: string;
    uniteId?: string;
  }>({
    isOpen: false,
    valeur: ''
  });
  const [isCorrecting, setIsCorrecting] = useState(false);

  const openCorrection = (matiere: MatierePremiere) => {
    const opts = getOptionsConditionnement(matiere);
    setCorrection({
      isOpen: true,
      matiere,
      valeur: String(round2(Math.max(0, matiere.stockActuel))),
      uniteId: opts[0]?.id || matiere.unite
    });
  };

  const handleCorriger = async () => {
    if (!correction.matiere) return;
    const m = matieres.find(item => item.id === correction.matiere?.id) || correction.matiere;
    const opts = getOptionsConditionnement(m);
    const selectedOpt = opts.find(o => o.id === correction.uniteId) || opts[0];
    const factor = selectedOpt?.factor || 1;

    if (!correction.valeur.trim()) {
      toast.error('Veuillez saisir le stock réel compté.');
      return;
    }

    const saisieNum = parseFloat(correction.valeur.replace(',', '.'));
    if (isNaN(saisieNum) || saisieNum < 0) {
      toast.error('Quantité invalide (doit être un nombre positif ou 0).');
      return;
    }

    const cible = round2(saisieNum * factor);
    const delta = round2(cible - m.stockActuel);
    if (delta === 0) {
      toast.success(`Le stock est déjà conforme (${cible} ${m.unite})`);
      setCorrection({ isOpen: false, valeur: '' });
      return;
    }
    setIsCorrecting(true);
    try {
      const motifTexte = factor !== 1
        ? `Correction inventaire : ${saisieNum} ${selectedOpt.labelCourt} (${delta > 0 ? '+' : ''}${delta} ${m.unite})`
        : 'Correction inventaire';

      await addMouvement({
        date: new Date(),
        matiereId: m.id,
        type: 'correction',
        quantite: delta,
        motif: motifTexte,
        auteur: user ? `${user.prenom || ''} ${user.nom || ''}`.trim() : 'Gérant',
        userId: user?.id || 'current-user-id',
      });
      toast.success(`Stock corrigé : ${formaterQuantite(cible, m.unite)}`);
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
            onClick={() => {
              setIsEditing(null);
              setFormData({ nom: '', unite: 'kg', stockMinimum: '', stockActuel: '', dateCreation: new Date().toISOString().split('T')[0] });
              setShowForm(!showForm);
            }}
            className="flex items-center justify-center space-x-2 bg-sand-900 hover:bg-sand-800 text-white px-3 sm:px-4 py-2 rounded-lg transition-colors flex-1 sm:flex-none text-sm font-medium shadow-sm"
          >
            <Icon icon="mdi:plus" className="text-lg" />
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
                <option value="sac">Sac</option>
                <option value="sachet">Sachet</option>
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
              <div className="text-warning-600 mt-0.5"><Icon icon="mdi:alert-outline" className="w-5 h-5" /></div>
              <div className="text-sm text-warning-600 leading-relaxed">
                <span className="font-semibold">Note :</span> Créez d'abord la matière avec son unité de base.
                Vous pourrez ensuite enregistrer des livraisons via le bouton <b>+ Réception Stock</b>.
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
                <Icon icon="mdi:close" className="text-xl" />
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
                        <Icon icon="mdi:alert-circle-outline" className="w-3.5 h-3.5 mr-1" />
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
                      <button
                        onClick={() => openCorrection(matiere)}
                        title="Corriger le stock"
                        className={`p-1.5 sm:p-2 rounded-lg transition-colors cursor-pointer ${
                          matiere.stockActuel < 0
                            ? 'text-amber-700 bg-amber-50 ring-1 ring-amber-300'
                            : 'text-sand-600 hover:bg-amber-50 hover:text-amber-800'
                        }`}
                      >
                        <Icon icon="mdi:scale-balance" className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                      </button>
                      <button
                        onClick={() => startEdit(matiere)}
                        title="Modifier la matière"
                        className="p-1.5 sm:p-2 text-sand-500 hover:text-sand-800 hover:bg-sand-100 rounded-lg transition-colors cursor-pointer"
                      >
                        <Icon icon="mdi:pencil-outline" className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                      </button>
                      <button
                        onClick={() => handleDelete(matiere.id, matiere.nom)}
                        title="Supprimer la matière"
                        className="p-1.5 sm:p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Icon icon="mdi:trash-can-outline" className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
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
        const m = matieres.find(item => item.id === correction.matiere?.id) || correction.matiere;
        const opts = getOptionsConditionnement(m);
        const selectedOpt = opts.find(o => o.id === correction.uniteId) || opts[0];
        const factor = selectedOpt?.factor || 1;
        const hasValeur = correction.valeur.trim() !== '';
        const saisieNum = hasValeur ? (parseFloat(correction.valeur.replace(',', '.')) || 0) : 0;
        const cible = round2(saisieNum * factor);
        const delta = hasValeur ? round2(cible - m.stockActuel) : 0;

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
                  <Icon icon="mdi:scale-balance" className="w-5 h-5" />
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

              {/* Choix unité si conditionnable (ex: Sachet 500g, Carton, kg) */}
              {opts.length > 1 && (
                <div>
                  <label className="block text-xs font-semibold text-sand-700 mb-1">
                    Unité de comptage :
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 bg-sand-100/70 p-1 rounded-xl">
                    {opts.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setCorrection(c => ({ ...c, uniteId: opt.id }))}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center ${
                          selectedOpt.id === opt.id
                            ? 'bg-white text-terracotta-700 shadow-xs'
                            : 'text-sand-600 hover:text-sand-900'
                        }`}
                      >
                        {opt.labelCourt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-sand-700 mb-1.5">
                  Stock réel constaté ({selectedOpt.labelCourt})
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    autoFocus
                    placeholder="Ex: 10"
                    value={correction.valeur}
                    onChange={(e) => setCorrection((c) => ({ ...c, valeur: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCorriger(); }}
                    className="w-full px-3 py-2.5 pr-14 border border-sand-300 rounded-lg text-right font-semibold text-sand-900 tabular-nums focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-sand-400 pointer-events-none">
                    {selectedOpt.labelCourt}
                  </span>
                </div>
              </div>

              {factor !== 1 && saisieNum > 0 && (
                <div className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                  = {cible} {m.unite} équivalent en réserve
                </div>
              )}

              <div className="flex items-center justify-between text-sm">
                <span className="text-sand-500">Ajustement</span>
                <span className={`font-semibold tabular-nums ${!hasValeur || delta === 0 ? 'text-sand-400' : delta > 0 ? 'text-success-600' : 'text-danger-600'}`}>
                  {!hasValeur ? '—' : `${delta > 0 ? '+' : ''}${formaterQuantite(delta, m.unite)}`}
                </span>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setCorrection({ isOpen: false, valeur: '' })}
                  className="flex-1 py-2.5 rounded-xl border border-sand-300 text-sand-700 hover:bg-sand-50 font-medium cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleCorriger}
                  disabled={isCorrecting || !hasValeur || delta === 0}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-terracotta-600 hover:bg-terracotta-700 text-white font-semibold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
