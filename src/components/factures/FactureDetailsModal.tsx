import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { formatCurrency } from '../../utils/currency';
import { downloadFacturePDF } from '../../utils/pdfGenerator';
import { useFacturationStore } from '../../store/facturationStore';
import type { Facture } from '../../types';

interface FactureDetailsModalProps {
  facture: Facture | null;
  isOpen: boolean;
  onClose: () => void;
}

export const FactureDetailsModal: React.FC<FactureDetailsModalProps> = ({
  facture,
  isOpen,
  onClose
}) => {
  const { modifierTauxTVA } = useFacturationStore();
  const [editingTVA, setEditingTVA] = useState(false);
  const [nouveauTauxTVA, setNouveauTauxTVA] = useState('');

  if (!facture) return null;

  const getStatutColor = (statut: string) => {
    switch (statut) {
      case 'en_attente_retours': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'validee': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'envoyee': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'payee': return 'bg-green-100 text-green-800 border-green-200';
      case 'annulee': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatutLibelle = (statut: string) => {
    switch (statut) {
      case 'en_attente_retours': return 'En attente retours';
      case 'validee': return 'Validée';
      case 'envoyee': return 'Envoyée';
      case 'payee': return 'Payée';
      case 'annulee': return 'Annulée';
      default: return statut;
    }
  };

  const handleModifierTVA = async () => {
    try {
      const taux = parseFloat(nouveauTauxTVA);

      if (isNaN(taux) || taux < 0 || taux > 100) {
        toast.error('⚠️ Veuillez saisir un taux de TVA valide (0-100%)');
        return;
      }

      await modifierTauxTVA(facture.id, taux);
      toast.success(`✅ Taux de TVA modifié à ${taux}%`);
      setEditingTVA(false);
      setNouveauTauxTVA('');
    } catch (error) {
      toast.error('❌ Erreur lors de la modification du taux de TVA');
    }
  };

  const startEditingTVA = () => {
    setNouveauTauxTVA(facture.tauxTVA.toString());
    setEditingTVA(true);
  };

  const cancelEditingTVA = () => {
    setEditingTVA(false);
    setNouveauTauxTVA('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Facture ${facture.numeroFacture}`} size="lg">
      <div className="space-y-6">
        {/* En-tête de la facture */}
        <div className="border-b border-gray-200 pb-4">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">
                {facture.numeroFacture}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Date de livraison : {facture.dateLivraison.toLocaleDateString('fr-FR')}
              </p>
              <p className="text-sm text-gray-600">
                Date de facturation : {facture.dateFacture.toLocaleDateString('fr-FR')}
              </p>
            </div>
            <div className="text-right">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatutColor(facture.statut)}`}>
                {getStatutLibelle(facture.statut)}
              </span>
              <div className="mt-2 text-2xl font-bold text-gray-900">
                {formatCurrency(facture.totalTTC)}
              </div>
              {(facture.statut === 'validee' || facture.statut === 'envoyee' || facture.statut === 'payee') && (
                <div className="mt-3">
                  <Button
                    onClick={async () => {
                      try {
                        await downloadFacturePDF(facture);
                        toast.success(`📄 PDF de la facture ${facture.numeroFacture} téléchargé`);
                      } catch (error) {
                        toast.error('❌ Erreur lors de la génération du PDF');
                      }
                    }}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Icon icon="mdi:download" className="text-sm" />
                    Télécharger PDF
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Informations client */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-lg font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Icon icon="mdi:account" className="text-xl text-blue-600" />
              Informations client
            </h4>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div>
                <span className="font-medium text-gray-700">Nom : </span>
                <span className="text-gray-900">{facture.client?.nom || 'Client inconnu'}</span>
              </div>
              {facture.client?.adresse && (
                <div>
                  <span className="font-medium text-gray-700">Adresse : </span>
                  <span className="text-gray-900">{facture.client.adresse}</span>
                </div>
              )}
              {facture.client?.telephone && (
                <div>
                  <span className="font-medium text-gray-700">Téléphone : </span>
                  <span className="text-gray-900">{facture.client.telephone}</span>
                </div>
              )}
              {facture.client?.email && (
                <div>
                  <span className="font-medium text-gray-700">Email : </span>
                  <span className="text-gray-900">{facture.client.email}</span>
                </div>
              )}
            </div>
          </div>

          <div>
            <h4 className="text-lg font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Icon icon="mdi:file-document" className="text-xl text-green-600" />
              Détails facture
            </h4>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div>
                <span className="font-medium text-gray-700">Conditions de paiement : </span>
                <span className="text-gray-900">{facture.conditionsPaiement}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">TVA : </span>
                {editingTVA ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      value={nouveauTauxTVA}
                      onChange={(e) => setNouveauTauxTVA(e.target.value)}
                      className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                      min="0"
                      max="100"
                      step="0.1"
                      autoFocus
                    />
                    <span className="text-gray-600 text-sm">%</span>
                    <button
                      onClick={handleModifierTVA}
                      className="text-green-600 hover:text-green-800 text-sm p-1"
                      title="Confirmer"
                    >
                      <Icon icon="mdi:check" />
                    </button>
                    <button
                      onClick={cancelEditingTVA}
                      className="text-red-600 hover:text-red-800 text-sm p-1"
                      title="Annuler"
                    >
                      <Icon icon="mdi:close" />
                    </button>
                  </div>
                ) : (
                  <span className="text-gray-900 flex items-center gap-2">
                    {facture.tauxTVA}%
                    {facture.statut !== 'payee' && facture.statut !== 'annulee' && (
                      <button
                        onClick={startEditingTVA}
                        className="text-blue-600 hover:text-blue-800 text-xs p-1"
                        title="Modifier le taux de TVA"
                      >
                        <Icon icon="mdi:pencil" />
                      </button>
                    )}
                  </span>
                )}
              </div>
              <div>
                <span className="font-medium text-gray-700">Retours complétés : </span>
                <span className={`font-medium ${facture.retoursCompletes ? 'text-green-600' : 'text-orange-600'}`}>
                  {facture.retoursCompletes ? 'Oui' : 'Non'}
                </span>
              </div>
              {facture.validatedAt && (
                <div>
                  <span className="font-medium text-gray-700">Validée le : </span>
                  <span className="text-gray-900">{facture.validatedAt.toLocaleDateString('fr-FR')}</span>
                </div>
              )}
              {facture.paidAt && (
                <div>
                  <span className="font-medium text-gray-700">Payée le : </span>
                  <span className="text-gray-900">{facture.paidAt.toLocaleDateString('fr-FR')}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Lignes de la facture */}
        <div>
          <h4 className="text-lg font-medium text-gray-900 mb-3 flex items-center gap-2">
            <Icon icon="mdi:format-list-bulleted" className="text-xl text-purple-600" />
            Détail des produits
          </h4>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Produit
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Qté livrée
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Qté retournée
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Qté facturée
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Prix unitaire
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {facture.lignes.map((ligne, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {ligne.produit?.nom || 'Produit inconnu'}
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-gray-600">
                      {ligne.quantiteLivree}
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-gray-600">
                      {ligne.quantiteRetournee}
                    </td>
                    <td className="px-4 py-3 text-sm text-center font-medium text-gray-900">
                      {ligne.quantiteFacturee}
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-gray-600">
                      {formatCurrency(ligne.prixUnitaire)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                      {formatCurrency(ligne.montantLigne)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totaux */}
        <div className="border-t border-gray-200 pt-4">
          <div className="flex justify-end">
            <div className="w-64">
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="font-medium text-gray-700">Total HT :</span>
                  <span className="text-gray-900">{formatCurrency(facture.totalHT)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-700">TVA ({facture.tauxTVA}%) :</span>
                  <span className="text-gray-900">{formatCurrency(facture.montantTVA)}</span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-2">
                  <span className="font-bold text-gray-900">Total TTC :</span>
                  <span className="font-bold text-lg text-gray-900">{formatCurrency(facture.totalTTC)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};