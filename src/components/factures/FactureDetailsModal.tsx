import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import logo from '../../assets/logo.png';
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
      case 'en_attente_retours': return 'bg-warning-100 text-warning-600 border-warning-100';
      case 'validee': return 'bg-info-100 text-info-600 border-info-100';
      case 'envoyee': return 'bg-terracotta-100 text-terracotta-800 border-terracotta-200';
      case 'payee': return 'bg-success-100 text-success-700 border-success-100';
      case 'partiellement_payee': return 'bg-warning-100 text-warning-600 border-warning-100';
      case 'annulee': return 'bg-danger-100 text-danger-700 border-danger-100';
      default: return 'bg-sand-100 text-sand-800 border-sand-200';
    }
  };

  const getStatutLibelle = (statut: string) => {
    switch (statut) {
      case 'en_attente_retours': return 'En attente retours';
      case 'validee': return 'Validée';
      case 'envoyee': return 'Envoyée';
      case 'payee': return 'Payée';
      case 'partiellement_payee': return 'Partiellement Payée';
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
        <div className="border-b border-sand-200 pb-4">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xl font-semibold text-sand-900 flex items-center gap-3">
                <img src={logo} alt="Logo" className="h-8 w-auto" />
                {facture.numeroFacture}
              </h3>
              <p className="text-sm text-sand-600 mt-1">
                Date de livraison : {facture.dateLivraison.toLocaleDateString('fr-FR')}
              </p>
              <p className="text-sm text-sand-600">
                Date de facturation : {facture.dateFacture.toLocaleDateString('fr-FR')}
              </p>
            </div>
            <div className="text-right">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatutColor(facture.statut)}`}>
                {getStatutLibelle(facture.statut)}
              </span>
              <div className="mt-2 font-display text-2xl font-semibold text-sand-900">
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
            <h4 className="text-lg font-medium text-sand-900 mb-3 flex items-center gap-2">
              <Icon icon="mdi:account" className="text-xl text-info-600" />
              Informations client
            </h4>
            <div className="bg-sand-50 rounded-lg p-4 space-y-2">
              <div>
                <span className="font-medium text-sand-700">Nom : </span>
                <span className="text-sand-900">{facture.client?.nom || 'Client inconnu'}</span>
              </div>
              {facture.client?.adresse && (
                <div>
                  <span className="font-medium text-sand-700">Adresse : </span>
                  <span className="text-sand-900">{facture.client.adresse}</span>
                </div>
              )}
              {facture.client?.telephone && (
                <div>
                  <span className="font-medium text-sand-700">Téléphone : </span>
                  <span className="text-sand-900">{facture.client.telephone}</span>
                </div>
              )}
              {facture.client?.email && (
                <div>
                  <span className="font-medium text-sand-700">Email : </span>
                  <span className="text-sand-900">{facture.client.email}</span>
                </div>
              )}
            </div>
          </div>

          <div>
            <h4 className="text-lg font-medium text-sand-900 mb-3 flex items-center gap-2">
              <Icon icon="mdi:file-document" className="text-xl text-success-600" />
              Détails facture
            </h4>
            <div className="bg-sand-50 rounded-lg p-4 space-y-2">
              <div>
                <span className="font-medium text-sand-700">Conditions de paiement : </span>
                <span className="text-sand-900">{facture.conditionsPaiement}</span>
              </div>
              <div>
                <span className="font-medium text-sand-700">TVA : </span>
                {editingTVA ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      value={nouveauTauxTVA}
                      onChange={(e) => setNouveauTauxTVA(e.target.value)}
                      className="w-16 px-2 py-1 border border-sand-300 rounded text-sm"
                      min="0"
                      max="100"
                      step="0.1"
                      autoFocus
                    />
                    <span className="text-sand-600 text-sm">%</span>
                    <button
                      onClick={handleModifierTVA}
                      className="text-success-600 hover:text-success-700 text-sm p-1"
                      title="Confirmer"
                    >
                      <Icon icon="mdi:check" />
                    </button>
                    <button
                      onClick={cancelEditingTVA}
                      className="text-danger-600 hover:text-danger-700 text-sm p-1"
                      title="Annuler"
                    >
                      <Icon icon="mdi:close" />
                    </button>
                  </div>
                ) : (
                  <span className="text-sand-900 flex items-center gap-2">
                    {facture.tauxTVA}%
                    {facture.statut !== 'payee' && facture.statut !== 'annulee' && (
                      <button
                        onClick={startEditingTVA}
                        className="text-info-600 hover:text-info-600 text-xs p-1"
                        title="Modifier le taux de TVA"
                      >
                        <Icon icon="mdi:pencil" />
                      </button>
                    )}
                  </span>
                )}
              </div>
              <div>
                <span className="font-medium text-sand-700">Retours complétés : </span>
                <span className={`font-medium ${facture.retoursCompletes ? 'text-success-600' : 'text-warning-600'}`}>
                  {facture.retoursCompletes ? 'Oui' : 'Non'}
                </span>
              </div>
              {facture.validatedAt && (
                <div>
                  <span className="font-medium text-sand-700">Validée le : </span>
                  <span className="text-sand-900">{facture.validatedAt.toLocaleDateString('fr-FR')}</span>
                </div>
              )}
              {facture.paidAt && (
                <>
                  <div>
                    <span className="font-medium text-sand-700">Payée le : </span>
                    <span className="text-sand-900">{facture.paidAt.toLocaleDateString('fr-FR')}</span>
                  </div>
                  {facture.modePaiement && (
                    <div>
                      <span className="font-medium text-sand-700">Mode de paiement : </span>
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-sm font-medium bg-sand-100 text-sand-800 capitalize">
                        <Icon
                          icon={
                            facture.modePaiement === 'espece' ? 'mdi:cash' :
                              facture.modePaiement === 'om' ? 'mdi:cellphone-nfc' : 'mdi:wave'
                          }
                          className={
                            facture.modePaiement === 'espece' ? 'text-success-600' :
                              facture.modePaiement === 'om' ? 'text-warning-600' : 'text-info-600'
                          }
                        />
                        {facture.modePaiement === 'espece' ? 'Espèce' : facture.modePaiement === 'om' ? 'Orange Money' : 'Wave'}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Lignes de la facture */}
        <div>
          <h4 className="text-lg font-medium text-sand-900 mb-3 flex items-center gap-2">
            <Icon icon="mdi:format-list-bulleted" className="text-xl text-terracotta-600" />
            Détail des produits
          </h4>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-sand-200 border border-sand-200 rounded-lg">
              <thead className="bg-sand-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-sand-500 uppercase tracking-wider">
                    Produit
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-sand-500 uppercase tracking-wider">
                    Qté livrée
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-sand-500 uppercase tracking-wider">
                    Qté retournée
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-sand-500 uppercase tracking-wider">
                    Qté facturée
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-sand-500 uppercase tracking-wider">
                    Prix unitaire
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-sand-500 uppercase tracking-wider">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-sand-200">
                {facture.lignes.map((ligne, index) => (
                  <tr key={index} className="hover:bg-sand-50">
                    <td className="px-4 py-3 text-sm font-medium text-sand-900">
                      {ligne.produit?.nom || 'Produit inconnu'}
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-sand-600">
                      {ligne.quantiteLivree}
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-sand-600">
                      {ligne.quantiteRetournee}
                    </td>
                    <td className="px-4 py-3 text-sm text-center font-medium text-sand-900">
                      {ligne.quantiteFacturee}
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-sand-600">
                      {formatCurrency(ligne.prixUnitaire)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-sand-900">
                      {formatCurrency(ligne.montantLigne)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totaux */}
        <div className="border-t border-sand-200 pt-4">
          <div className="flex justify-end">
            <div className="w-64">
              <div className="bg-sand-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="font-medium text-sand-700">Total HT :</span>
                  <span className="text-sand-900">{formatCurrency(facture.totalHT)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-sand-700">TVA ({facture.tauxTVA}%) :</span>
                  <span className="text-sand-900">{formatCurrency(facture.montantTVA)}</span>
                </div>
                <div className="flex justify-between border-t border-sand-200 pt-2">
                  <span className="font-semibold text-sand-900">Total TTC :</span>
                  <span className="font-semibold text-lg text-sand-900">{formatCurrency(facture.totalTTC)}</span>
                </div>

                {facture.soldeUtilise ? (
                  <div className="flex justify-between text-success-600 border-t border-sand-200 pt-2">
                    <span className="font-medium">Solde antérieur utilisé :</span>
                    <span>- {formatCurrency(facture.soldeUtilise)}</span>
                  </div>
                ) : null}

                {(facture.soldeUtilise && facture.soldeUtilise > 0) && (
                  <div className="flex justify-between border-t border-sand-200 pt-2">
                    <span className="font-semibold text-sand-900">Net à payer :</span>
                    <span className="font-semibold text-lg text-terracotta-600">{formatCurrency(facture.netAPayer ?? 0)}</span>
                  </div>
                )}

                {facture.montantRegle ? (
                  <>
                    <div className="flex justify-between border-t border-sand-200 pt-2">
                      <span className="font-medium text-sand-700">Montant réglé :</span>
                      <span className="font-medium text-sand-900">{formatCurrency(facture.montantRegle)}</span>
                    </div>
                    {facture.montantRegle < (facture.netAPayer ?? facture.totalTTC) && (
                      <div className="flex justify-between border-t border-terracotta-200 pt-2 text-terracotta-700 bg-terracotta-50 px-2 rounded mt-1">
                        <span className="font-semibold text-sm">Solde dû :</span>
                        <span className="font-semibold text-base">{formatCurrency((facture.netAPayer ?? facture.totalTTC) - facture.montantRegle)}</span>
                      </div>
                    )}
                  </>
                ) : null}

                {/* Détail des règlements multi-modes */}
                {facture.reglements && facture.reglements.length > 0 && (
                  <div className="mt-2 space-y-1 bg-sand-100 p-2 rounded-lg text-[10px] sm:text-xs">
                    <p className="font-semibold text-sand-400 uppercase tracking-wider mb-1">Détail des paiements</p>
                    {facture.reglements.map((r, i) => (
                      <div key={i} className="flex justify-between text-sand-600">
                        <span className="capitalize">{r.mode === 'espece' ? 'Espèces' : r.mode.toUpperCase()} :</span>
                        <span>{formatCurrency(r.montant)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {(facture.montantRegle && (facture.netAPayer ?? facture.totalTTC) && facture.montantRegle > (facture.netAPayer ?? facture.totalTTC)) ? (
                  <div className="flex justify-between text-info-600 pt-1">
                    <span className="font-medium">Crédit généré :</span>
                    <span>{formatCurrency(facture.montantRegle - (facture.netAPayer ?? facture.totalTTC))}</span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};