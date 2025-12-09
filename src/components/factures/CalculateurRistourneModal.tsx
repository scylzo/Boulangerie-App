import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { TableLoader } from '../ui/Loader';
import { useFacturationStore } from '../../store/facturationStore';
import { useReferentielStore } from '../../store/referentielStore';
import { formatCurrency } from '../../utils/currency';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import toast from 'react-hot-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const CalculateurRistourneModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { chargerFactures } = useFacturationStore();
  const { chargerClients } = useReferentielStore();
  
  const [mois, setMois] = useState(new Date().getMonth()); // 0-11
  const [annee, setAnnee] = useState(new Date().getFullYear());
  const [calculating, setCalculating] = useState(false);
  const [resultats, setResultats] = useState<any[]>([]);

  const handleCalculer = async () => {
    setCalculating(true);
    try {
        // S'assurer qu'on a les dernières données
        await chargerFactures();
        await chargerClients();

        // 1. Filtrer les clients éligibles (Boutique + Option cochée)
        const clientsEligibles = useReferentielStore.getState().clients.filter(
            c => c.typeClient === 'boutique' && c.eligibleRistourne
        );

        if (clientsEligibles.length === 0) {
            setResultats([]);
            toast('Aucun client éligible à la ristourne trouvé.', { icon: 'ℹ️' });
            return;
        }

        const statsClients: any[] = [];

        // 2. Pour chaque client, trouver ses factures du mois
        for (const client of clientsEligibles) {
            const facturesClient = useFacturationStore.getState().factures.filter(f => {
                const d = new Date(f.dateLivraison);
                return f.clientId === client.id &&
                       d.getMonth() === mois && 
                       d.getFullYear() === annee &&
                       f.statut !== 'annulee' && 
                       f.statut !== 'brouillon';
            });

            if (facturesClient.length === 0) continue;

            let totalRistourne = 0;
            let totalVolume = 0; // Quantité produits totale
            let totalPaye = 0;   // Montant TTC payé (base boutique)

            // 3. Calculer la ristourne ligne par ligne
            facturesClient.forEach(facture => {
                facture.lignes.forEach(ligne => {
                   // La quantité facturée est celle qui compte (Livrée - Retournée)
                   const qte = ligne.quantiteFacturee;
                   if (qte <= 0) return;

                   // Trouver le produit pour connaître son "Prix Client" (réduit)
                   // Attention: Si le produit a été supprimé ou modifié, on prend la version actuelle du store
                   // Idéalement, il faudrait stocker le snapshot du produit dans la facture.
                   // Pour l'instant, on utilise l'info produit incluse dans la ligne (snapshot) ou fallback
                   const produit = ligne.produit; 
                   
                   if (produit && produit.prixClient && produit.prixBoutique) {
                       // Marge unitaire = Prix Boutique (payé) - Prix Client (réel)
                       // On vérifie que le prix facturé correspond bien au prix boutique (approximativement)
                       // Sinon ça veut dire qu'il a déjà eu un prix spécial.
                       // Pour simplifier: On applique bêtement la différence catalogue.
                       
                       const difference = (produit.prixBoutique || 0) - (produit.prixClient || 0);
                       if (difference > 0) {
                           totalRistourne += difference * qte;
                       }
                   }
                   
                   totalVolume += qte;
                   totalPaye += ligne.montantLigne; // C'est du HT en général dans ligne, à vérifier.
                });
            });

            if (totalRistourne > 0) {
                statsClients.push({
                    client: client.nom,
                    nombreFactures: facturesClient.length,
                    volumeProduits: totalVolume,
                    totalPaye,
                    totalRistourne
                });
            }
        }

        setResultats(statsClients);
        if(statsClients.length === 0) {
             toast('Aucune ristourne générée pour cette période.', { icon: 'info' });
        } else {
            toast.success(`${statsClients.length} clients avec ristourne calculée !`);
        }

    } catch (error) {
        console.error(error);
        toast.error("Erreur lors du calcul");
    } finally {
        setCalculating(false);
    }
  };

  const exportPDF = () => {
     const doc = new jsPDF();
     
     // En-tête
     doc.setFontSize(18);
     doc.text("Rapport des Ristournes Mensuelles", 14, 22);
     
     doc.setFontSize(11);
     const dateStr = new Date(annee, mois).toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
     doc.text(`Période : ${dateStr}`, 14, 32);
     doc.text(`Généré le : ${new Date().toLocaleDateString('fr-FR')}`, 14, 38);

     // Tableau
     const tableColumn = ["Client", "Nbr Factures", "Qté Produits", "Total Ristourne"];
     const tableRows = resultats.map(row => [
         row.client,
         row.nombreFactures,
         row.volumeProduits,
         formatCurrency(row.totalRistourne)
     ]);

     autoTable(doc, {
         head: [tableColumn],
         body: tableRows,
         startY: 45,
         theme: 'grid',
         styles: { fontSize: 10 },
         headStyles: { fillColor: [66, 66, 66] }
     });
     
     // Total général
     const totalGeneral = resultats.reduce((sum, r) => sum + r.totalRistourne, 0);
     const finalY = (doc as any).lastAutoTable.finalY || 50;
     
     doc.setFontSize(12);
     doc.setFont('helvetica', 'bold');
     doc.text(`Total à reverser : ${formatCurrency(totalGeneral)}`, 14, finalY + 15);

     doc.save(`ristournes_${annee}_${mois+1}.pdf`);
     toast.success("PDF téléchargé !");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Calculateur de Ristournes (Cashback)">
      <div className="space-y-6">
        
        {/* Filtres */}
        <div className="flex gap-4 items-end bg-gray-50 p-4 rounded-lg">
            <div className="flex-1">
                <Select
                    label="Mois"
                    value={mois.toString()}
                    onChange={(e) => setMois(parseInt(e.target.value))}
                    options={Array.from({length: 12}, (_, i) => ({
                        value: i.toString(),
                        label: new Date(2000, i, 1).toLocaleString('fr-FR', { month: 'long' })
                    }))}
                />
            </div>
            <div className="flex-1">
                <Select
                    label="Année"
                    value={annee.toString()}
                    onChange={(e) => setAnnee(parseInt(e.target.value))}
                    options={[
                        { value: '2024', label: '2024' },
                        { value: '2025', label: '2025' }
                    ]}
                />
            </div>
            <Button onClick={handleCalculer} isLoading={calculating}>
                Calculer
            </Button>
        </div>

        {/* Résultats */}
        <div className="min-h-[200px]">
            {calculating ? (
                <TableLoader message="Analyse des factures en cours..." />
            ) : resultats.length > 0 ? (
                <div className="space-y-4">
                    <div className="overflow-x-auto border rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Vol. Produits</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ristourne</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {resultats.map((row, idx) => (
                                    <tr key={idx}>
                                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.client}</td>
                                        <td className="px-4 py-3 text-sm text-right text-gray-500">{row.volumeProduits}</td>
                                        <td className="px-4 py-3 text-sm text-right font-bold text-green-600">
                                            {formatCurrency(row.totalRistourne)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-50">
                                <tr>
                                    <td colSpan={2} className="px-4 py-3 text-sm font-bold text-gray-900 text-right">TOTAL</td>
                                    <td className="px-4 py-3 text-sm font-bold text-green-700 text-right">
                                        {formatCurrency(resultats.reduce((acc, curr) => acc + curr.totalRistourne, 0))}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <div className="flex justify-end">
                        <Button variant="secondary" onClick={exportPDF}>
                            <Icon icon="mdi:file-pdf-box" className="mr-2 text-lg" />
                            Télécharger le rapport PDF
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="text-center py-10 text-gray-500">
                    Cliquez sur Calculer pour voir les ristournes à reverser.
                </div>
            )}
        </div>

      </div>
    </Modal>
  );
};
