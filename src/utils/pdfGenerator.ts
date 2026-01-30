import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Facture, RapportJournalier, IndicateursPerformance, ProgrammeProduction } from '../types';
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
  const pageWidth = doc.internal.pageSize.width;

  // Configuration des couleurs - Palette Moderne
  const colors = {
    primary: [67, 56, 202],    // Indigo 700
    secondary: [107, 114, 128], // Gray 500
    accent: [79, 70, 229],     // Indigo 600
    bgHeader: [249, 250, 251], // Gray 50
    text: [31, 41, 55],        // Gray 800
    client: [59, 130, 246],    // Blue 500
    boutique: [16, 185, 129]   // Emerald 500
  };

  // 1. En-tête Moderne style Banner
  doc.setFillColor(colors.bgHeader[0], colors.bgHeader[1], colors.bgHeader[2]);
  doc.rect(0, 0, pageWidth, 45, 'F');
  doc.setDrawColor(229, 231, 235);
  doc.line(0, 45, pageWidth, 45);

  try {
    const logoImg = await loadImage(logoUrl);
    doc.addImage(logoImg, 'PNG', 15, 10, 22, 22);
  } catch (error) {
    console.error('Erreur chargement logo', error);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.text('RAPPORT JOURNALIER', 45, 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
  const dateStr = new Date(rapport.date).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  doc.text(dateStr.toUpperCase(), 45, 29);


  // 2. Section Indicateurs et Totaux (Colonnes pour optimiser l'espace)
  let yPos = 55;

  // KPIs en format Cartes (2 colonnes)
  if (indicateurs) {
    doc.setFontSize(12);
    doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
    doc.text('Indicateurs Clés', 15, yPos);

    const kpiRows = [
      ['Taux Global', `${indicateurs.tauxVenteGlobal.toFixed(1)}%`, 'Taux Clients', `${indicateurs.tauxVenteClients.toFixed(1)}%`],
      ['Taux Boutique', `${indicateurs.tauxVenteBoutique.toFixed(1)}%`, 'Pertes Totales', `${indicateurs.pertesTotales} u.`]
    ];

    autoTable(doc, {
      startY: yPos + 2,
      body: kpiRows,
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 1 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 40 },
        1: { cellWidth: 40 },
        2: { fontStyle: 'bold', cellWidth: 40 },
        3: { cellWidth: 40 }
      },
      margin: { left: 15 }
    });
    yPos = (doc as any).lastAutoTable.finalY + 8;
  }

  // Bilan Quantitatif
  doc.setFontSize(12);
  doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
  doc.text('Bilan Quantitatif', 15, yPos);
  const totalRow = [[
    `Prévu: ${rapport.totaux.quantitePrevue}`,
    `Produit: ${rapport.totaux.quantiteProduite}`,
    `Vendu: ${rapport.totaux.quantiteVendueTotal}`,
    `Invendus: ${rapport.totaux.invendusTotal}`
  ]];

  autoTable(doc, {
    startY: yPos + 2,
    body: totalRow,
    theme: 'plain',
    styles: { fontSize: 10, fontStyle: 'bold', textColor: colors.primary as any },
    columnStyles: { 0: { halign: 'left' } },
    margin: { left: 15 }
  });
  yPos = (doc as any).lastAutoTable.finalY + 8;

  // Bilan Financier Global
  doc.setFontSize(12);
  doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
  doc.text('Bilan Financier Global', 15, yPos);

  const financialRow = [[
    `CA Total: ${formatCurrencyCompact(rapport.totaux.valeurVenteTotal)}`,
    `CA Clients: ${formatCurrencyCompact(rapport.totaux.valeurVenteClients)}`,
    `CA Boutique: ${formatCurrencyCompact(rapport.totaux.valeurVenteBoutique)}`
  ]];

  autoTable(doc, {
    startY: yPos + 2,
    body: financialRow,
    theme: 'plain',
    styles: { fontSize: 10, fontStyle: 'bold', textColor: [22, 101, 52] as any }, // Vert sombre
    columnStyles: { 0: { halign: 'left' } },
    margin: { left: 15 }
  });
  yPos = (doc as any).lastAutoTable.finalY + 8;

  // 3. Tableaux de Données (Optimisés)

  // Tableau Clients
  doc.setFontSize(11);
  doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
  doc.text('DÉTAIL LIVRAISONS CLIENTS', 15, yPos);

  const clientData = rapport.produits
    .filter(p => p.destineClients)
    .map(p => [
      p.produit?.nom || p.produitId,
      (p.quantiteVendueClients + p.invendusClients).toString(),
      p.quantiteVendueClients.toString(),
      formatCurrencyCompact(p.valeurVenteClients),
      p.invendusClients.toString(),
      `${p.tauxVenteClients.toFixed(1)}%`
    ]);

  const totalClientLivre = rapport.produits.filter(p => p.destineClients).reduce((acc, p) => acc + (p.quantiteVendueClients + p.invendusClients), 0);
  const totalClientVendu = rapport.produits.filter(p => p.destineClients).reduce((acc, p) => acc + p.quantiteVendueClients, 0);
  const totalClientValeur = rapport.produits.filter(p => p.destineClients).reduce((acc, p) => acc + p.valeurVenteClients, 0);
  const totalClientInvendus = rapport.produits.filter(p => p.destineClients).reduce((acc, p) => acc + p.invendusClients, 0);

  autoTable(doc, {
    startY: yPos + 2,
    head: [['Produit', 'Livré', 'Vendu', 'Valeur', 'Retours', 'Taux']],
    body: clientData,
    foot: [['TOTAL', totalClientLivre.toString(), totalClientVendu.toString(), formatCurrencyCompact(totalClientValeur), totalClientInvendus.toString(), '']],
    theme: 'grid',
    headStyles: { fillColor: colors.client as any, fontSize: 8 },
    footStyles: { fillColor: [243, 244, 246], textColor: colors.text as any, fontStyle: 'bold', fontSize: 8, halign: 'center' },
    styles: { fontSize: 8, cellPadding: 1.5 },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'center', cellWidth: 15 },
      2: { halign: 'center', cellWidth: 15 },
      3: { halign: 'right', cellWidth: 25 },
      4: { halign: 'center', cellWidth: 15 },
      5: { halign: 'center', cellWidth: 15 }
    },
    didParseCell: (data) => {
      if (data.section === 'foot' && data.column.index === 0) {
        data.cell.styles.halign = 'left';
      }
    },
    margin: { left: 15, right: 15 }
  });

  yPos = (doc as any).lastAutoTable.finalY + 8;

  // Tableau Boutique
  doc.text('DÉTAIL VENTES BOUTIQUE', 15, yPos);

  const boutiqueData = rapport.produits
    .filter(p => p.destineBoutique)
    .map(p => [
      p.produit?.nom || p.produitId,
      (p.quantiteVendueBoutique + p.invendusBoutique).toString(),
      p.quantiteVendueBoutique.toString(),
      formatCurrencyCompact(p.valeurVenteBoutique),
      p.invendusBoutique.toString(),
      `${p.tauxVenteBoutique.toFixed(1)}%`
    ]);

  const totalBoutiqueStock = rapport.produits.filter(p => p.destineBoutique).reduce((acc, p) => acc + (p.quantiteVendueBoutique + p.invendusBoutique), 0);
  const totalBoutiqueVendu = rapport.produits.filter(p => p.destineBoutique).reduce((acc, p) => acc + p.quantiteVendueBoutique, 0);
  const totalBoutiqueValeur = rapport.produits.filter(p => p.destineBoutique).reduce((acc, p) => acc + p.valeurVenteBoutique, 0);
  const totalBoutiqueInvendus = rapport.produits.filter(p => p.destineBoutique).reduce((acc, p) => acc + p.invendusBoutique, 0);

  autoTable(doc, {
    startY: yPos + 2,
    head: [['Produit', 'En rayon', 'Vendu', 'Valeur', 'Invendus', 'Taux']],
    body: boutiqueData,
    foot: [['TOTAL', totalBoutiqueStock.toString(), totalBoutiqueVendu.toString(), formatCurrencyCompact(totalBoutiqueValeur), totalBoutiqueInvendus.toString(), '']],
    theme: 'grid',
    headStyles: { fillColor: colors.boutique as any, fontSize: 8 },
    footStyles: { fillColor: [243, 244, 246], textColor: colors.text as any, fontStyle: 'bold', fontSize: 8, halign: 'center' },
    styles: { fontSize: 8, cellPadding: 1.5 },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'center', cellWidth: 15 },
      2: { halign: 'center', cellWidth: 15 },
      3: { halign: 'right', cellWidth: 25 },
      4: { halign: 'center', cellWidth: 15 },
      5: { halign: 'center', cellWidth: 15 }
    },
    didParseCell: (data) => {
      if (data.section === 'foot' && data.column.index === 0) {
        data.cell.styles.halign = 'left';
      }
    },
    margin: { left: 15, right: 15 }
  });

  // 4. Pied de page discret
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(7);
  doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
  doc.text(`Document généré le ${new Date().toLocaleString('fr-FR')} - BOULANGERIE ERP`, 15, pageHeight - 10);
  doc.text(`Page 1/1`, pageWidth - 25, pageHeight - 10);

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

export const generateProductionProgramPDF = async (programme: ProgrammeProduction) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const colors = {
    primary: [67, 56, 202],    // Indigo 700
    secondary: [107, 114, 128], // Gray 500
    text: [31, 41, 55],        // Gray 800
    highlight: [249, 250, 251] // Gray 50
  };

  // En-tête
  doc.setFillColor(colors.highlight[0], colors.highlight[1], colors.highlight[2]);
  doc.rect(0, 0, pageWidth, 40, 'F');

  try {
    const logoImg = await loadImage(logoUrl);
    doc.addImage(logoImg, 'PNG', 15, 8, 20, 20);
  } catch (e) { }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.text('PROGRAMME DE PRODUCTION', 40, 20);

  doc.setFontSize(10);
  doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
  const dateStr = new Date(programme.dateProduction).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  doc.text(dateStr.toUpperCase(), 40, 27);

  let yPos = 50;

  // Résumé Global
  const totalClient = programme.totauxParProduit.reduce((acc, p) => acc + (p.totalClient || 0), 0);
  const totalBoutique = programme.totauxParProduit.reduce((acc, p) => acc + (p.totalBoutique || 0), 0);
  const totalGlobal = programme.totauxParProduit.reduce((acc, p) => acc + p.totalGlobal, 0);

  doc.setFontSize(12);
  doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
  doc.text('Bilan de Production', 15, yPos);

  const summaryData = [[
    `Total Client: ${totalClient}`,
    `Total Boutique: ${totalBoutique}`,
    `TOTAL GÉNÉRAL: ${totalGlobal}`
  ]];

  autoTable(doc, {
    startY: yPos + 2,
    body: summaryData,
    theme: 'plain',
    styles: { fontSize: 10, fontStyle: 'bold', textColor: colors.primary as any },
    margin: { left: 15 }
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  // Détail par Produit
  doc.setFontSize(11);
  doc.text('DÉTAIL PAR PRODUIT', 15, yPos);

  const tableData = programme.totauxParProduit.map(p => [
    p.produit?.nom || p.produitId,
    (p.totalClient ?? 0).toString(),
    (p.totalBoutique ?? 0).toString(),
    (p.totalGlobal ?? 0).toString(),
    (p.quantiteProduiteReelle !== undefined && p.quantiteProduiteReelle !== null) ? p.quantiteProduiteReelle.toString() : '-'
  ]);

  autoTable(doc, {
    startY: yPos + 2,
    head: [['Produit', 'Qté Clients', 'Qté Boutique', 'Total Prévu', 'Réel']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: colors.primary as any, fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'center', cellWidth: 25 },
      2: { halign: 'center', cellWidth: 25 },
      3: { halign: 'center', cellWidth: 25 },
      4: { halign: 'center', cellWidth: 25 }
    },
    margin: { left: 15, right: 15 }
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  // Répartition par Car
  doc.setFontSize(11);
  doc.text('RÉPARTITION PAR CAR', 15, yPos);

  const carData = programme.totauxParProduit
    .filter(p => ((p.repartitionCar1Matin ?? 0) + (p.repartitionCar2Matin ?? 0) + (p.repartitionCarSoir ?? 0)) > 0)
    .map(p => [
      p.produit?.nom || p.produitId,
      (p.repartitionCar1Matin ?? 0).toString(),
      (p.repartitionCar2Matin ?? 0).toString(),
      (p.repartitionCarSoir ?? 0).toString(),
      ((p.repartitionCar1Matin ?? 0) + (p.repartitionCar2Matin ?? 0) + (p.repartitionCarSoir ?? 0)).toString()
    ]);

  autoTable(doc, {
    startY: yPos + 2,
    head: [['Produit', 'Car 1 Matin', 'Car 2 Matin', 'Car Soir', 'Total']],
    body: carData,
    theme: 'striped',
    headStyles: { fillColor: [75, 85, 99], fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'center', cellWidth: 30 },
      2: { halign: 'center', cellWidth: 30 },
      3: { halign: 'center', cellWidth: 30 },
      4: { halign: 'center', cellWidth: 20 }
    },
    margin: { left: 15, right: 15 }
  });

  // Pied de page
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(7);
  doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
  doc.text(`Généré le ${new Date().toLocaleString('fr-FR')} - Module Production`, 15, pageHeight - 10);

  return doc;
};

export const downloadProductionProgramPDF = async (programme: ProgrammeProduction) => {
  try {
    const doc = await generateProductionProgramPDF(programme);
    const dateStr = new Date(programme.dateProduction).toISOString().split('T')[0];
    const fileName = `Programme_Production_${dateStr}.pdf`;
    doc.save(fileName);
    return true;
  } catch (error) {
    console.error('Erreur PDF Production:', error);
    throw new Error('Impossible de générer le PDF');
  }
};
