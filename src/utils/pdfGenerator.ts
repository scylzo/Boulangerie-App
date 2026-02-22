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

  // Section Règlements (Détails)
  if (facture.reglements && facture.reglements.length > 0) {
    let regY = finalY + boxHeight + 10;

    // Titre section règlements
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('RÈGLEMENTS:', 20, regY);

    doc.setLineWidth(0.1);
    doc.line(20, regY + 2, 80, regY + 2);

    regY += 8;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);

    facture.reglements.forEach(reg => {
      const modeStr = reg.mode === 'espece' ? 'Espèces' : reg.mode.toUpperCase();
      doc.text(`${modeStr}:`, 20, regY);
      doc.text(formatCurrencyCompact(reg.montant), 75, regY, { align: 'right' });
      regY += 6;
    });

    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL RÉGLÉ:', 20, regY + 2);
    doc.text(formatCurrencyCompact(facture.montantRegle || 0), 75, regY + 2, { align: 'right' });
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
  // --- SECTION BILAN BOUTIQUE ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(colors.boutique[0], colors.boutique[1], colors.boutique[2]);
  doc.text('I. PERFORMANCE BOUTIQUE', 15, yPos);
  doc.setDrawColor(colors.boutique[0], colors.boutique[1], colors.boutique[2]);
  doc.setLineWidth(0.5);
  doc.line(15, yPos + 1, 195, yPos + 1);
  yPos += 8;

  const boutiqueSummary = [
    ['Taux de Vente', `${indicateurs?.tauxVenteBoutique.toFixed(1)}%`, 'Chiffre d\'Affaires', `${formatCurrencyCompact(indicateurs?.valeurVenteBoutique || 0)}`],
    ['Invendus (Pertes)', `${rapport.totaux.pertesBoutique || 0} u.`, 'Restants (à reconduire)', `${rapport.totaux.restantsBoutique || 0} u.`]
  ];

  autoTable(doc, {
    startY: yPos,
    body: boutiqueSummary,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 1, textColor: colors.text as any },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 40, textColor: [100, 100, 100] },
      1: { cellWidth: 50 },
      2: { fontStyle: 'bold', cellWidth: 40, textColor: [100, 100, 100] },
      3: { cellWidth: 50, fontStyle: 'bold', textColor: colors.boutique as any }
    },
    margin: { left: 15 }
  });
  yPos = (doc as any).lastAutoTable.finalY + 12;

  //   CLIENTS ---
  doc.setFontSize(10);
  doc.setTextColor(colors.client[0], colors.client[1], colors.client[2]);
  doc.text('II. PERFORMANCE CLIENTS (LIVRAISONS)', 15, yPos);
  doc.setDrawColor(colors.client[0], colors.client[1], colors.client[2]);
  doc.line(15, yPos + 1, 195, yPos + 1);
  yPos += 8;

  const clientsSummary = [
    ['Taux de Vente', `${indicateurs?.tauxVenteClients.toFixed(1)}%`, 'Chiffre d\'Affaires', `${formatCurrencyCompact(indicateurs?.valeurVenteClients || 0)}`],
    ['Retours Clients', `${indicateurs?.pertesClients || 0} u.`, '', '']
  ];

  autoTable(doc, {
    startY: yPos,
    body: clientsSummary,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 1, textColor: colors.text as any },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 40, textColor: [100, 100, 100] },
      1: { cellWidth: 50 },
      2: { fontStyle: 'bold', cellWidth: 40, textColor: [100, 100, 100] },
      3: { cellWidth: 50, fontStyle: 'bold', textColor: colors.client as any }
    },
    margin: { left: 15 }
  });
  yPos = (doc as any).lastAutoTable.finalY + 12;

  // --- SECTION SYNTHÈSE GLOBALE ---
  doc.setFontSize(10);
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.text('III. SYNTHÈSE GLOBALE DU JOUR', 15, yPos);
  doc.setDrawColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.line(15, yPos + 1, 195, yPos + 1);
  yPos += 8;

  const globalSummary = [
    ['Chiffre d\'Affaires Total', `${formatCurrencyCompact(indicateurs?.valeurVenteTotal || 0)}`, 'Taux de Vente Global', `${indicateurs?.tauxVenteGlobal.toFixed(1)}%`],
    ['Total Prévu', `${rapport.totaux.quantitePrevue} u.`, 'Total Vendu', `${rapport.totaux.quantiteVendueTotal} u.`],
    ['Total Produit', `${rapport.totaux.quantiteProduite} u.`, 'Stock Reporté', `${indicateurs?.restantsTotaux || 0} u.`]
  ];

  autoTable(doc, {
    startY: yPos,
    body: globalSummary,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 1, textColor: colors.text as any },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 45, textColor: [100, 100, 100] },
      1: { cellWidth: 45, fontStyle: 'bold', textColor: colors.primary as any },
      2: { fontStyle: 'bold', cellWidth: 45, textColor: [100, 100, 100] },
      3: { cellWidth: 45 }
    },
    margin: { left: 15 }
  });
  yPos = (doc as any).lastAutoTable.finalY + 15;

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
      (p.restantsBoutique || 0).toString(),
      (p.pertesBoutique || 0).toString(),
      `${p.tauxVenteBoutique.toFixed(1)}%`
    ]);

  const totalBoutiqueStock = rapport.produits.filter(p => p.destineBoutique).reduce((acc, p) => acc + (p.quantiteVendueBoutique + p.invendusBoutique), 0);
  const totalBoutiqueVendu = rapport.produits.filter(p => p.destineBoutique).reduce((acc, p) => acc + p.quantiteVendueBoutique, 0);
  const totalBoutiqueValeur = rapport.produits.filter(p => p.destineBoutique).reduce((acc, p) => acc + p.valeurVenteBoutique, 0);
  const totalBoutiqueRestants = rapport.produits.filter(p => p.destineBoutique).reduce((acc, p) => acc + (p.restantsBoutique || 0), 0);
  const totalBoutiquePertes = rapport.produits.filter(p => p.destineBoutique).reduce((acc, p) => acc + (p.pertesBoutique || 0), 0);

  autoTable(doc, {
    startY: yPos + 2,
    head: [['Produit', 'En rayon', 'Vendu', 'Valeur', 'Restants', 'Invendus', 'Taux']],
    body: boutiqueData,
    foot: [['TOTAL', totalBoutiqueStock.toString(), totalBoutiqueVendu.toString(), formatCurrencyCompact(totalBoutiqueValeur), totalBoutiqueRestants.toString(), totalBoutiquePertes.toString(), '']],
    theme: 'grid',
    headStyles: { fillColor: colors.boutique as any, fontSize: 8 },
    footStyles: { fillColor: [243, 244, 246], textColor: colors.text as any, fontStyle: 'bold', fontSize: 8, halign: 'center' },
    styles: { fontSize: 8, cellPadding: 1.5 },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'center', cellWidth: 14 },
      2: { halign: 'center', cellWidth: 14 },
      3: { halign: 'right', cellWidth: 20 },
      4: { halign: 'center', cellWidth: 17 },
      5: { halign: 'center', cellWidth: 17 },
      6: { halign: 'center', cellWidth: 13 }
    },
    didParseCell: (data) => {
      if (data.section === 'foot' && data.column.index === 0) {
        data.cell.styles.halign = 'left';
      }
      // Colorer les restants en vert
      if (data.section === 'body' && data.column.index === 4) {
        data.cell.styles.textColor = [22, 163, 74]; // Vert
      }
      // Colorer les pertes en rouge
      if (data.section === 'body' && data.column.index === 5) {
        data.cell.styles.textColor = [239, 68, 68]; // Rouge
      }
    },
    margin: { left: 15, right: 15 }
  });

  // 4. Pied de page discret
  const pageHeight = doc.internal.pageSize.height;

  // Section Annulations & Redistribution

  if (rapport.annulations && rapport.annulations.length > 0) {
    yPos = (doc as any).lastAutoTable.finalY + 12;

    // Vérifier si on a besoin d'une nouvelle page
    if (yPos > pageHeight - 60) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(11);
    doc.setTextColor(234, 88, 12); // Orange 600
    doc.text('ANNULATIONS ET REDISTRIBUTIONS', 15, yPos);

    const annulationData = rapport.annulations.map(ann => [
      ann.clientNom,
      ann.produits.map(p => `${p.nom} (x${p.quantite})`).join('\n'),
      ann.motif,
      `${ann.redistribution.type.toUpperCase()}\n-> ${ann.redistribution.destinationNom}`
    ]);

    autoTable(doc, {
      startY: yPos + 2,
      head: [['Client', 'Produits', 'Motif', 'Redistribution']],
      body: annulationData,
      theme: 'grid',
      headStyles: { fillColor: [234, 88, 12] as any, fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 45 },
        2: { cellWidth: 50 },
        3: { cellWidth: 50 }
      },
      margin: { left: 15, right: 15 }
    });
  }

  // 4. Pied de page discret
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

// Types pour les performances clients
interface ClientPerformanceData {
  client: { id: string; nom: string; aKiosque?: boolean };
  totalAchats: number;
  nombreFactures: number;
  moyenneParFacture: number;
  tauxPaiement: number;
  quantiteTotale: number;
  quantiteRetournee: number;
  tauxRetour: number;
  scorePerformance: number;
}

export const generateClientPerformancePDF = async (
  performances: ClientPerformanceData[],
  periodeDays: number,
  dateDebut: Date,
  dateFin: Date
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;

  // Configuration des couleurs
  const colors = {
    primary: [59, 130, 246],    // Blue 500
    secondary: [107, 114, 128], // Gray 500
    text: [31, 41, 55],        // Gray 800
    highlight: [239, 246, 255], // Blue 50
    gold: [251, 191, 36],      // Amber 400
    silver: [156, 163, 175],   // Gray 400
    bronze: [249, 115, 22]     // Orange 500
  };

  // En-tête
  doc.setFillColor(colors.highlight[0], colors.highlight[1], colors.highlight[2]);
  doc.rect(0, 0, pageWidth, 45, 'F');

  try {
    const logoImg = await loadImage(logoUrl);
    doc.addImage(logoImg, 'PNG', 15, 10, 22, 22);
  } catch (error) {
    console.error('Erreur chargement logo', error);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.text('PERFORMANCES CLIENTS', 45, 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
  const periodeStr = `Période: ${dateDebut.toLocaleDateString('fr-FR')} - ${dateFin.toLocaleDateString('fr-FR')} (${periodeDays} jours)`;
  doc.text(periodeStr, 45, 29);

  doc.setFontSize(9);
  doc.text('Score: CA (40%) + Paiement (30%) + Retours (30%)', 45, 36);

  let yPos = 55;

  // Statistiques globales
  const totalCA = performances.reduce((sum, p) => sum + p.totalAchats, 0);
  const moyenneScore = performances.length > 0
    ? performances.reduce((sum, p) => sum + p.scorePerformance, 0) / performances.length
    : 0;
  const moyenneTauxRetour = performances.length > 0
    ? performances.reduce((sum, p) => sum + p.tauxRetour, 0) / performances.length
    : 0;

  doc.setFontSize(11);
  doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
  doc.text('Statistiques Globales', 15, yPos);

  const statsData = [[
    `CA Total: ${formatCurrencyCompact(totalCA)}`,
    `Clients actifs: ${performances.length}`,
    `Score moyen: ${moyenneScore.toFixed(1)}/100`,
    `Taux retour moyen: ${moyenneTauxRetour.toFixed(1)}%`
  ]];

  autoTable(doc, {
    startY: yPos + 2,
    body: statsData,
    theme: 'plain',
    styles: { fontSize: 9, fontStyle: 'bold', textColor: colors.primary as any },
    margin: { left: 15 }
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  // Tableau des performances
  doc.setFontSize(11);
  doc.text('TOP 20 CLIENTS', 15, yPos);

  const tableData = performances.slice(0, 20).map((perf, index) => {
    const rank = index + 1;
    let rankIcon = `${rank}`;

    // Utiliser des caractères ASCII au lieu d'émojis
    if (rank === 1) rankIcon = '1er';
    else if (rank === 2) rankIcon = '2e';
    else if (rank === 3) rankIcon = '3e';

    // Ajouter un indicateur pour les kiosques sans émoji
    const clientName = perf.client.nom + (perf.client.aKiosque ? ' [K]' : '');

    return [
      rankIcon,
      clientName,
      formatCurrencyCompact(perf.totalAchats),
      perf.nombreFactures.toString(),
      formatCurrencyCompact(perf.moyenneParFacture),
      `${perf.tauxPaiement.toFixed(0)}%`,
      `${perf.tauxRetour.toFixed(1)}%`,
      `${perf.scorePerformance.toFixed(0)}/100`
    ];
  });

  autoTable(doc, {
    startY: yPos + 2,
    head: [['#', 'Client', 'CA Total', 'Nb Fact.', 'Moy/Fact.', 'Paiement', 'Retours', 'Score']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: colors.primary as any,
      fontSize: 8,
      fontStyle: 'bold'
    },
    styles: {
      fontSize: 7,
      cellPadding: 1.5,
      overflow: 'linebreak'
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 'auto', minCellWidth: 35 },
      2: { halign: 'right', cellWidth: 22 },
      3: { halign: 'center', cellWidth: 15 },
      4: { halign: 'right', cellWidth: 22 },
      5: { halign: 'center', cellWidth: 18 },
      6: { halign: 'center', cellWidth: 18 },
      7: { halign: 'center', cellWidth: 20 }
    },
    didParseCell: (data) => {
      // Colorer les scores
      if (data.section === 'body' && data.column.index === 7) {
        const scoreText = data.cell.text[0];
        const score = parseInt(scoreText);

        if (score >= 80) {
          data.cell.styles.textColor = [22, 163, 74]; // Vert
          data.cell.styles.fontStyle = 'bold';
        } else if (score >= 60) {
          data.cell.styles.textColor = [59, 130, 246]; // Bleu
        } else if (score >= 40) {
          data.cell.styles.textColor = [249, 115, 22]; // Orange
        } else {
          data.cell.styles.textColor = [239, 68, 68]; // Rouge
        }
      }

      // Colorer les taux de retours
      if (data.section === 'body' && data.column.index === 6) {
        const tauxText = data.cell.text[0];
        const taux = parseFloat(tauxText);

        if (taux <= 5) {
          data.cell.styles.textColor = [22, 163, 74]; // Vert
        } else if (taux <= 15) {
          data.cell.styles.textColor = [249, 115, 22]; // Orange
        } else {
          data.cell.styles.textColor = [239, 68, 68]; // Rouge
        }
      }

      // Mettre en évidence le podium
      if (data.section === 'body' && data.row.index < 3) {
        data.cell.styles.fillColor = [255, 251, 235]; // Amber 50
      }
    },
    margin: { left: 15, right: 15 }
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  // Légende
  if (yPos < 250) {
    doc.setFontSize(8);
    doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
    doc.text('Légende:', 15, yPos);
    yPos += 5;
    doc.text('• Score: Indicateur global de performance (CA + Paiement + Retours)', 20, yPos);
    yPos += 4;
    doc.text('• Taux de retours: % de produits retournés sur le total livré', 20, yPos);
    yPos += 4;
    doc.text('• [K] = Client avec kiosque', 20, yPos);
  }

  // Pied de page
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(7);
  doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
  doc.text(`Document généré le ${new Date().toLocaleString('fr-FR')} - BOULANGERIE ERP`, 15, pageHeight - 10);
  doc.text(`Page 1/1`, pageWidth - 25, pageHeight - 10);

  return doc;
};

export const downloadClientPerformancePDF = async (
  performances: ClientPerformanceData[],
  periodeDays: number,
  dateDebut: Date,
  dateFin: Date
) => {
  try {
    const doc = await generateClientPerformancePDF(performances, periodeDays, dateDebut, dateFin);
    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `Performances_Clients_${periodeDays}j_${dateStr}.pdf`;
    doc.save(fileName);
    return true;
  } catch (error) {
    console.error('Erreur lors de la génération du PDF:', error);
    throw new Error('Impossible de générer le PDF');
  }
};

export interface LigneFicheProduit {
  produitNom: string;
  prixBase: number;
  quantiteVoulue: number;
  prixPropose: number;
}

export const generateFicheProduitPDF = async (clientNom: string, lignes: LigneFicheProduit[]) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const primaryColor: [number, number, number] = [234, 88, 12]; // Orange 600
  const secondaryColor: [number, number, number] = [107, 114, 128]; // Gray 500

  // En-tête
  try {
    const logoImg = await loadImage(logoUrl);
    doc.addImage(logoImg, 'PNG', 15, 15, 25, 25);
  } catch (error) {
    console.error('Erreur chargement logo', error);
  }

  doc.setFontSize(22);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('FICHE PRODUIT / OFFRE COMMERCIALE', 50, 25);

  doc.setFontSize(10);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`, 50, 32);
  doc.text(`Client: ${clientNom || 'Non spécifié'}`, 50, 38);

  // Ligne de séparation
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setLineWidth(0.5);
  doc.line(15, 45, pageWidth - 15, 45);

  // Tableau
  const tableData = lignes.map(l => [
    l.produitNom,
    formatCurrencyCompact(l.prixBase),
    '', // Quantité voulue vide
    '', // Prix proposé vide
    ''  // Total proposé vide
  ]);

  autoTable(doc, {
    startY: 55,
    head: [['Produit', 'Prix de Base', 'Quantité voulue', 'Prix proposé', 'Total proposé']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor as any,
      textColor: [255, 255, 255] as any,
      fontSize: 10,
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { cellWidth: 'auto', halign: 'left' },
      1: { cellWidth: 30, halign: 'right' },
      2: { cellWidth: 35, halign: 'center' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 35, halign: 'right' }
    },
    styles: { fontSize: 10, minCellHeight: 10 }, // Augmenter un peu la hauteur pour pouvoir écrire
    margin: { left: 15, right: 15 }
  });

  // Pied de page
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text('Cette fiche produit constitue une proposition commerciale et non une facture.', 15, pageHeight - 15);
  doc.text('Merci de votre confiance.', 15, pageHeight - 10);

  return doc;
};

export const downloadFicheProduitPDF = async (clientNom: string, lignes: LigneFicheProduit[]) => {
  try {
    const doc = await generateFicheProduitPDF(clientNom, lignes);
    const fileName = `Fiche_Produit_${clientNom.replace(/\s/g, '_') || 'Prospect'}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
    return true;
  } catch (error) {
    console.error('Erreur PDF Fiche Produit:', error);
    throw new Error('Impossible de générer le PDF');
  }
};

