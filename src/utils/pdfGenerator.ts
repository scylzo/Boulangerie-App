import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Facture, RapportJournalier, IndicateursPerformance } from '../types';
import { formatCurrencyCompact } from './currency';
import logoUrl from '../assets/logo.png';

const loadImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = url;
    img.onload = () => resolve(img);
    img.onerror = reject;
  });
};

export const generateFacturePDF = async (facture: Facture) => {
  const doc = new jsPDF();

  // Configuration des couleurs
  const primaryColor: [number, number, number] = [107, 114, 128]; // Gris sobre
  const grayColor: [number, number, number] = [107, 114, 128];
  const lightGrayColor: [number, number, number] = [243, 244, 246];

  // En-tête - Logo et informations de l'entreprise
  try {
    const logoImg = await loadImage(logoUrl);
    doc.addImage(logoImg, 'PNG', 20, 15, 25, 25);
  } catch (error) {
    console.error('Erreur chargement logo', error);
  }

  doc.setFontSize(24);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('BOULANGERIE', 55, 25);

  doc.setFontSize(10);
  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
  doc.text('Adresse de la boulangerie', 55, 32);
  doc.text('Tél: +221 77 575 41 59 / +221 78 582 27 72', 55, 37);
  doc.text('Email: contact@boulangerie.sn', 55, 42);

  // Titre FACTURE
  doc.setFontSize(28);
  doc.setTextColor(0, 0, 0);
  doc.text('FACTURE', 140, 25);

  // Numéro de facture et dates
  doc.setFontSize(11);
  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
  doc.text(`N° ${facture.numeroFacture}`, 140, 35);
  doc.text(`Livraison: ${facture.dateLivraison.toLocaleDateString('fr-FR')}`, 140, 42);

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
  const boxHeight = (facture.soldeUtilise && facture.soldeUtilise > 0) ? 56 : 36;
  doc.setFillColor(lightGrayColor[0], lightGrayColor[1], lightGrayColor[2]);
  doc.rect(125, finalY, 65, boxHeight, 'F');

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

  // Gestion du solde utilisé
  if (facture.soldeUtilise && facture.soldeUtilise > 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(22, 163, 74); // Vert
    doc.text('Solde utilisé:', 130, finalY + 41);
    doc.text(`- ${formatCurrencyCompact(facture.soldeUtilise)}`, 185, finalY + 41, { align: 'right' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('NET À PAYER:', 130, finalY + 50);
    doc.text(formatCurrencyCompact(facture.netAPayer ?? 0), 185, finalY + 50, { align: 'right' });
  }

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

export const generateRapportJournalierPDF = async (rapport: RapportJournalier, indicateurs: IndicateursPerformance | null) => {
  const doc = new jsPDF();

  // Configuration des couleurs
  const primaryColor: [number, number, number] = [79, 70, 229]; // Indigo
  const secondaryColor: [number, number, number] = [107, 114, 128]; // Gris

  // En-tête
  try {
    const logoImg = await loadImage(logoUrl);
    doc.addImage(logoImg, 'PNG', 20, 15, 20, 20);
  } catch (error) {
    console.error('Erreur chargement logo', error);
  }

  doc.setFontSize(20);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('RAPPORT JOURNALIER', 50, 25);

  doc.setFontSize(10);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text(`Date: ${new Date(rapport.date).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })}`, 50, 32);
  doc.text(`Statut: ${rapport.statut.toUpperCase()}`, 50, 37);

  // Ligne de séparation
  doc.setDrawColor(229, 231, 235);
  doc.line(20, 45, 190, 45);

  // Section Indicateurs (KPIs)
  if (indicateurs) {
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Indicateurs de Performance', 20, 55);

    const kpiData = [
      ['Taux de Vente Global', `${indicateurs.tauxVenteGlobal.toFixed(1)}%`],
      ['Taux Vente Clients', `${indicateurs.tauxVenteClients.toFixed(1)}%`],
      ['Taux Vente Boutique', `${indicateurs.tauxVenteBoutique.toFixed(1)}%`],
      ['Pertes Totales', `${indicateurs.pertesTotales} unités`],
      ['Invendus Clients', `${indicateurs.pertesClients} unités`],
      ['Invendus Boutique', `${indicateurs.pertesBoutique} unités`]
    ];

    autoTable(doc, {
      startY: 60,
      body: kpiData,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 2 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 50 },
        1: { halign: 'left' }
      },
      margin: { left: 20 }
    });
  }

  // Section Totaux
  const currentY = (doc as any).lastAutoTable?.finalY || 60;
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text('Totaux de la journée', 20, currentY + 15);

  const totalData = [
    ['Quantité Prévue', rapport.totaux.quantitePrevue.toString()],
    ['Quantité Produite', rapport.totaux.quantiteProduite.toString()],
    ['Quantité Vendue', rapport.totaux.quantiteVendueTotal.toString()],
    ['Pertes / Invendus', rapport.totaux.invendusTotal.toString()]
  ];

  autoTable(doc, {
    startY: currentY + 20,
    head: [['Désignation', 'Valeur']],
    body: totalData,
    theme: 'grid',
    headStyles: { fillColor: primaryColor as any, textColor: [255, 255, 255] },
    styles: { fontSize: 10 },
    margin: { left: 20, right: 120 }
  });

  // Section Détail par Produit
  const detailY = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(14);
  doc.text('Détail par Produit', 20, detailY);

  const productData = rapport.produits.map(p => [
    p.produit?.nom || p.produitId,
    p.quantitePrevue.toString(),
    p.quantiteProduite.toString(),
    p.quantiteVendueTotal.toString(),
    p.invendusTotal.toString(),
    `${p.tauxVenteGlobal.toFixed(1)}%`
  ]);

  autoTable(doc, {
    startY: detailY + 5,
    head: [['Produit', 'Prévu', 'Prod.', 'Vendu', 'Inv.', 'Taux']],
    body: productData,
    theme: 'striped',
    headStyles: { fillColor: primaryColor as any, fontSize: 9, textColor: [255, 255, 255] },
    styles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'center' },
      5: { halign: 'center' }
    },
    margin: { left: 20, right: 20 }
  });

  // Pied de page
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text(
      `Rapport généré le ${new Date().toLocaleString('fr-FR')}`,
      20,
      doc.internal.pageSize.height - 10
    );
    doc.text(
      `Page ${i} sur ${pageCount}`,
      doc.internal.pageSize.width - 40,
      doc.internal.pageSize.height - 10
    );
  }

  return doc;
};

export const downloadRapportJournalierPDF = async (rapport: RapportJournalier, indicateurs: IndicateursPerformance | null) => {
  try {
    const doc = await generateRapportJournalierPDF(rapport, indicateurs);
    const dateStr = new Date(rapport.date).toISOString().split('T')[0];
    const fileName = `Rapport_Journalier_${dateStr}.pdf`;
    doc.save(fileName);
    return true;
  } catch (error) {
    console.error('Erreur lors de la génération du PDF:', error);
    throw new Error('Impossible de générer le PDF');
  }
};