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
  const { chargerFactures, factures } = useFacturationStore();
  const { chargerClients } = useReferentielStore();
  
  const [mois, setMois] = useState(new Date().getMonth()); // 0-11
  const [annee, setAnnee] = useState(new Date().getFullYear());
  const [calculating, setCalculating] = useState(false);
  const [resultats, setResultats] = useState<any[]>([]);
  const [expandedClients, setExpandedClients] = useState<Record<number, boolean>>({});

  // Génération dynamique des années disponibles à partir des factures
  const anneesDisponibles = React.useMemo(() => {
    const years = factures.map(f => {
      const d = new Date(f.dateLivraison);
      return d.getFullYear();
    });
    // Toujours inclure au moins l'année précédente, en cours et suivante
    const currentYear = new Date().getFullYear();
    years.push(currentYear - 1, currentYear, currentYear + 1);
    const uniqueYears = Array.from(new Set(years)).filter(y => !isNaN(y));
    return uniqueYears.sort((a, b) => b - a);
  }, [factures]);

  const toggleExpand = (idx: number) => {
    setExpandedClients(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const handleCalculer = async () => {
    setCalculating(true);
    setExpandedClients({});
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
            const details: any[] = [];

            // 3. Calculer la ristourne par facture
            facturesClient.forEach(facture => {
                let invoiceRistourne = 0;
                let invoiceVolume = 0;
                const productsList: string[] = [];

                facture.lignes.forEach(ligne => {
                   const qte = ligne.quantiteFacturee;
                   if (qte <= 0) return;

                   const produit = ligne.produit; 
                   if (produit && produit.prixClient && produit.prixBoutique) {
                       const difference = (produit.prixBoutique || 0) - (produit.prixClient || 0);
                       if (difference > 0) {
                           const lineRistourne = difference * qte;
                           invoiceRistourne += lineRistourne;
                           productsList.push(`${produit.nom} (${qte} × +${difference} F = ${formatCurrency(lineRistourne)})`);
                       }
                   }
                   
                   invoiceVolume += qte;
                   totalVolume += qte;
                   totalPaye += ligne.montantLigne;
                });

                if (invoiceRistourne > 0) {
                    totalRistourne += invoiceRistourne;
                    details.push({
                        dateLivraison: facture.dateLivraison,
                        numeroFacture: facture.numeroFacture,
                        produitsDetails: productsList.join(', '),
                        quantite: invoiceVolume,
                        totalRistourne: invoiceRistourne
                    });
                }
            });

            if (totalRistourne > 0) {
                details.sort((a, b) => new Date(a.dateLivraison).getTime() - new Date(b.dateLivraison).getTime());
                statsClients.push({
                    client: client.nom,
                    nombreFactures: facturesClient.length,
                    volumeProduits: totalVolume,
                    totalPaye,
                    totalRistourne,
                    details
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

     // Tableau récapitulatif
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
     let currentY = (doc as any).lastAutoTable.finalY || 50;
     
     doc.setFontSize(12);
     doc.setFont('helvetica', 'bold');
     doc.text(`Total à reverser : ${formatCurrency(totalGeneral)}`, 14, currentY + 12);
     currentY += 25;

     // Section détails
     doc.setFontSize(14);
     doc.text("Détails des Calculs par Client", 14, currentY);
     currentY += 8;

     resultats.forEach((row) => {
         // Vérifier s'il y a assez d'espace sur la page actuelle, sinon ajouter une page
         if (currentY > 250) {
             doc.addPage();
             currentY = 20;
         }

         doc.setFontSize(11);
         doc.setFont('helvetica', 'bold');
         doc.text(`Client : ${row.client} (Total Ristourne : ${formatCurrency(row.totalRistourne)})`, 14, currentY);
         currentY += 4;

         if (row.details && row.details.length > 0) {
             const detailColumns = ["Facture", "Date", "Détail Produits", "Quantité", "Ristourne"];
             const detailRows = row.details.map((d: any) => [
                 d.numeroFacture,
                 new Date(d.dateLivraison).toLocaleDateString('fr-FR'),
                 d.produitsDetails,
                 d.quantite.toString(),
                 formatCurrency(d.totalRistourne)
             ]);

             autoTable(doc, {
                 head: [detailColumns],
                 body: detailRows,
                 startY: currentY,
                 theme: 'striped',
                 styles: { fontSize: 8 },
                 headStyles: { fillColor: [100, 100, 100] },
                 columnStyles: {
                     0: { cellWidth: 35 },
                     1: { cellWidth: 25 },
                     2: { cellWidth: 'auto' },
                     3: { halign: 'right', cellWidth: 25 },
                     4: { halign: 'right', cellWidth: 35 }
                 }
             });

             currentY = (doc as any).lastAutoTable.finalY + 12;
         } else {
             doc.setFontSize(9);
             doc.setFont('helvetica', 'normal');
             doc.text("Aucun détail disponible.", 14, currentY);
             currentY += 10;
         }
     });

     doc.save(`ristournes_${annee}_${mois+1}.pdf`);
     toast.success("PDF téléchargé !");
  };

  const exportPDFClient = (row: any) => {
     const doc = new jsPDF();
     
     // En-tête
     doc.setFontSize(18);
     doc.setTextColor(66, 66, 66);
     doc.setFont('helvetica', 'bold');
     doc.text(`Fiche Ristourne - ${row.client}`, 14, 22);
     
     doc.setFontSize(11);
     doc.setFont('helvetica', 'normal');
     const dateStr = new Date(annee, mois).toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
     doc.text(`Période : ${dateStr}`, 14, 32);
     doc.text(`Généré le : ${new Date().toLocaleDateString('fr-FR')}`, 14, 38);

     // Résumé
     doc.setFontSize(12);
     doc.setFont('helvetica', 'bold');
     doc.text(`Synthèse :`, 14, 48);

     const summaryColumns = ["Nombre de Factures", "Quantité Produits", "Total Ristourne"];
     const summaryRows = [[
         row.nombreFactures.toString(),
         row.volumeProduits.toString(),
         formatCurrency(row.totalRistourne)
     ]];

     autoTable(doc, {
         head: [summaryColumns],
         body: summaryRows,
         startY: 52,
         theme: 'grid',
         styles: { fontSize: 10 },
         headStyles: { fillColor: [66, 66, 66] }
     });

     let currentY = (doc as any).lastAutoTable.finalY + 12;

     // Tableau de détail
     doc.setFontSize(12);
     doc.setFont('helvetica', 'bold');
     doc.text(`Détails des calculs :`, 14, currentY);
     currentY += 6;

     if (row.details && row.details.length > 0) {
         const detailColumns = ["Facture", "Date", "Détail Produits", "Quantité", "Ristourne"];
         const detailRows = row.details.map((d: any) => [
             d.numeroFacture,
             new Date(d.dateLivraison).toLocaleDateString('fr-FR'),
             d.produitsDetails,
             d.quantite.toString(),
             formatCurrency(d.totalRistourne)
         ]);

         autoTable(doc, {
             head: [detailColumns],
             body: detailRows,
             startY: currentY,
             theme: 'striped',
             styles: { fontSize: 8 },
             headStyles: { fillColor: [100, 100, 100] },
             columnStyles: {
                 0: { cellWidth: 35 },
                 1: { cellWidth: 25 },
                 2: { cellWidth: 'auto' },
                 3: { halign: 'right', cellWidth: 25 },
                 4: { halign: 'right', cellWidth: 35 }
             }
         });
     }

     doc.save(`ristourne_${row.client.replace(/\s+/g, '_')}_${annee}_${mois+1}.pdf`);
     toast.success(`PDF de ${row.client} téléchargé !`);
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
                    options={anneesDisponibles.map(y => ({
                        value: y.toString(),
                        label: y.toString()
                    }))}
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
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase w-20">Action</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {resultats.map((row, idx) => (
                                    <React.Fragment key={idx}>
                                        <tr 
                                            className="hover:bg-gray-50 cursor-pointer transition-colors"
                                            onClick={() => toggleExpand(idx)}
                                        >
                                            <td className="px-4 py-3 text-sm font-medium text-gray-900 flex items-center gap-2 select-none">
                                                <Icon 
                                                    icon={expandedClients[idx] ? "mdi:chevron-down" : "mdi:chevron-right"} 
                                                    className="text-gray-500 text-lg transition-transform" 
                                                />
                                                {row.client}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right text-gray-500">{row.volumeProduits}</td>
                                            <td className="px-4 py-3 text-sm text-right font-bold text-green-600">
                                                {formatCurrency(row.totalRistourne)}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    className="p-1 hover:bg-gray-200 rounded text-red-500 hover:text-red-700 transition-colors"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        exportPDFClient(row);
                                                    }}
                                                    title="Télécharger le PDF client"
                                                >
                                                    <Icon icon="mdi:file-pdf-box" className="text-xl" />
                                                </button>
                                            </td>
                                        </tr>
                                        {expandedClients[idx] && row.details && row.details.length > 0 && (
                                            <tr>
                                                <td colSpan={4} className="px-4 py-3 bg-gray-50">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <div className="text-xs font-semibold text-gray-600">
                                                            Détails des calculs de ristourne :
                                                        </div>
                                                        <Button 
                                                            variant="secondary" 
                                                            size="sm"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                exportPDFClient(row);
                                                            }}
                                                        >
                                                            <Icon icon="mdi:file-pdf-box" className="mr-1 text-base" />
                                                            Télécharger PDF Client
                                                        </Button>
                                                    </div>
                                                    <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white shadow-sm">
                                                        <table className="min-w-full divide-y divide-gray-100 text-xs">
                                                            <thead className="bg-gray-50 text-gray-500">
                                                                <tr>
                                                                    <th className="px-3 py-2 text-left font-medium">Facture</th>
                                                                    <th className="px-3 py-2 text-left font-medium">Date</th>
                                                                    <th className="px-3 py-2 text-left font-medium">Détail Produits</th>
                                                                    <th className="px-3 py-2 text-right font-medium">Quantité</th>
                                                                    <th className="px-3 py-2 text-right font-medium">Ristourne</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-gray-100 text-gray-700">
                                                                {row.details.map((detail: any, dIdx: number) => (
                                                                    <tr key={dIdx} className="hover:bg-gray-50">
                                                                        <td className="px-3 py-2 font-mono font-medium text-gray-900">{detail.numeroFacture}</td>
                                                                        <td className="px-3 py-2 text-gray-500">
                                                                            {new Date(detail.dateLivraison).toLocaleDateString('fr-FR')}
                                                                        </td>
                                                                        <td className="px-3 py-2 font-medium text-gray-600">{detail.produitsDetails}</td>
                                                                        <td className="px-3 py-2 text-right">{detail.quantite}</td>
                                                                        <td className="px-3 py-2 text-right font-semibold text-green-600 bg-green-50/20">
                                                                            {formatCurrency(detail.totalRistourne)}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-50">
                                <tr>
                                    <td colSpan={2} className="px-4 py-3 text-sm font-bold text-gray-900 text-right">TOTAL</td>
                                    <td className="px-4 py-3 text-sm font-bold text-green-700 text-right">
                                        {formatCurrency(resultats.reduce((acc, curr) => acc + curr.totalRistourne, 0))}
                                    </td>
                                    <td></td>
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
