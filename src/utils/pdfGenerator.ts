import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Facture } from '../types';
import { formatCurrencyCompact } from './currency';

export const generateFacturePDF = async (facture: Facture) => {
  const doc = new jsPDF();

  // Configuration des couleurs
  const primaryColor: [number, number, number] = [107, 114, 128]; // Gris sobre
  const grayColor: [number, number, number] = [107, 114, 128];
  const lightGrayColor: [number, number, number] = [243, 244, 246];

  // En-tête - Logo et informations de l'entreprise
  doc.setFontSize(24);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('BOULANGERIE', 20, 25);

  doc.setFontSize(10);
  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
  doc.text('Adresse de la boulangerie', 20, 32);
  doc.text('Tél: +221 77 575 41 59 / +221 78 582 27 72', 20, 37);
  doc.text('Email: contact@boulangerie.sn', 20, 42);

  // Titre FACTURE
  doc.setFontSize(28);
  doc.setTextColor(0, 0, 0);
  doc.text('FACTURE', 140, 25);

  // Numéro de facture et dates
  doc.setFontSize(11);
  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
  doc.text(`N° ${facture.numeroFacture}`, 140, 35);
  doc.text(`Date: ${facture.dateFacture.toLocaleDateString('fr-FR')}`, 140, 42);
  doc.text(`Livraison: ${facture.dateLivraison.toLocaleDateString('fr-FR')}`, 140, 49);

  // Statut de la facture
  const statutColor = getStatutColorPDF(facture.statut);
  doc.setFillColor(statutColor[0], statutColor[1], statutColor[2]);
  doc.rect(140, 52, 50, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text(getStatutLibelle(facture.statut), 142, 58);

  // Ligne de séparation
  doc.setLineWidth(0.5);
  doc.setDrawColor(grayColor[0], grayColor[1], grayColor[2]);
  doc.line(20, 70, 190, 70);

  // Informations client
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text('FACTURER À:', 20, 85);

  doc.setFontSize(11);
  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
  let yPos = 95;
  doc.text(facture.client?.nom || 'Client inconnu', 20, yPos);

  if (facture.client?.adresse) {
    yPos += 6;
    const adresse = facture.client.adresse;
    doc.text(adresse, 20, yPos);
  }

  if (facture.client?.telephone) {
    yPos += 6;
    doc.text(`Tél: ${facture.client.telephone}`, 20, yPos);
  }

  if (facture.client?.email) {
    yPos += 6;
    const email = facture.client.email;
    doc.text(`Email: ${email}`, 20, yPos);
  }

  // Conditions de paiement (côté droit)
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text('CONDITIONS:', 140, 85);
  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
  const conditions = facture.conditionsPaiement || 'À réception';
  doc.text(conditions, 140, 95);
  doc.text(`TVA: ${facture.tauxTVA}%`, 140, 102);

  // Tableau des produits
  const tableStartY = Math.max(yPos + 15, 120);

  const tableData = facture.lignes.map(ligne => [
    ligne.produit?.nom || 'Produit inconnu',
    ligne.quantiteLivree.toString(),
    ligne.quantiteRetournee.toString(),
    ligne.quantiteFacturee.toString(),
    formatCurrencyCompact(ligne.prixUnitaire),
    formatCurrencyCompact(ligne.montantLigne)
  ]);

  autoTable(doc, {
    startY: tableStartY,
    head: [['Produit', 'Qté Liv.', 'Qté Ret.', 'Qté Fact.', 'P.U.', 'Total']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor as any,
      textColor: [255, 255, 255] as any,
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center'
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 2
    },
    columnStyles: {
      0: { cellWidth: 'auto' as any, halign: 'left', minCellWidth: 50 },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 24, halign: 'right' },
      5: { cellWidth: 24, halign: 'right' }
    },
    alternateRowStyles: {
      fillColor: lightGrayColor as any
    },
    margin: { left: 20, right: 20 },
    styles: {
      overflow: 'linebreak',
      cellWidth: 'wrap'
    }
  });

  // Totaux
  const finalY = (doc as any).lastAutoTable.finalY + 10;

  // Cadre pour les totaux
  doc.setFillColor(lightGrayColor[0], lightGrayColor[1], lightGrayColor[2]);
  doc.rect(125, finalY, 65, 36, 'F');

  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);

  // Total HT
  doc.text('Total HT:', 130, finalY + 10);
  doc.text(formatCurrencyCompact(facture.totalHT), 185, finalY + 10, { align: 'right' });

  // TVA
  doc.text(`TVA (${facture.tauxTVA}%):`, 130, finalY + 19);
  doc.text(formatCurrencyCompact(facture.montantTVA), 185, finalY + 19, { align: 'right' });

  // Ligne de séparation
  doc.setLineWidth(0.3);
  doc.line(130, finalY + 23, 185, finalY + 23);

  // Total TTC (en gras)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL TTC:', 130, finalY + 32);
  doc.text(formatCurrencyCompact(facture.totalTTC), 185, finalY + 32, { align: 'right' });

  // Pied de page
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);

  // Informations légales
  doc.text('Merci de votre confiance !', 20, pageHeight - 25);
  doc.text('TVA incluse - Paiement à réception de facture', 20, pageHeight - 20);
  doc.text(`Facture générée le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, 20, pageHeight - 15);

  // Numéro de page
  doc.text('Page 1/1', 170, pageHeight - 15);

  return doc;
};

// Fonctions utilitaires
const getStatutColorPDF = (statut: string): [number, number, number] => {
  switch (statut) {
    case 'en_attente_retours': return [251, 191, 36]; // Jaune
    case 'validee': return [59, 130, 246]; // Bleu
    case 'envoyee': return [99, 102, 241]; // Indigo
    case 'payee': return [34, 197, 94]; // Vert
    case 'annulee': return [239, 68, 68]; // Rouge
    default: return [107, 114, 128]; // Gris
  }
};

const getStatutLibelle = (statut: string): string => {
  switch (statut) {
    case 'en_attente_retours': return 'EN ATTENTE';
    case 'validee': return 'VALIDÉE';
    case 'envoyee': return 'ENVOYÉE';
    case 'payee': return 'PAYÉE';
    case 'annulee': return 'ANNULÉE';
    default: return statut.toUpperCase();
  }
};

export const downloadFacturePDF = async (facture: Facture) => {
  try {
    const doc = await generateFacturePDF(facture);
    const fileName = `Facture_${facture.numeroFacture}_${facture.client?.nom?.replace(/\s/g, '_') || 'Client'}.pdf`;
    doc.save(fileName);
    return true;
  } catch (error) {
    console.error('Erreur lors de la génération du PDF:', error);
    throw new Error('Impossible de générer le PDF');
  }
};