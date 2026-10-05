import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoUrl from '../assets/logo.png';
import type { Saveur } from '../store/saveurStore';

export type TypeRapportSaveur = 'sale' | 'sucre' | 'tous';

export interface VenteSaveurDetail {
  date: string;
  clientNom: string;
  produitNom: string;
  saveur: Saveur;
  quantite: number;
  valeur: number;
  source?: 'caisse' | 'boutique' | 'livraison' | string;
  numeroFacture?: string;
}

export interface SaveurReportData {
  periode: { debut: string; fin: string };
  source: 'caisse' | 'boutique' | 'livraison' | 'toutes';
  payeesUniquement: boolean;
  typeSelection?: TypeRapportSaveur;
  ventesParSaveur: Record<Saveur, { qty: number; valeur: number }>;
  coutParSaveur: Record<Saveur, number>;
  produitsSale: { nom: string; qty: number; valeur: number }[];
  produitsSucre: { nom: string; qty: number; valeur: number }[];
  achats: {
    id?: string;
    date: string;
    montant: number;
    saveur: Saveur;
    note?: string;
  }[];
  ventesDetaillees?: VenteSaveurDetail[];
}

const formatDateFR = (d: string) => {
  if (!d) return '';
  const parts = d.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return d;
};

const formatPdfCurrency = (amount: number): string => {
  return `${Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} F`;
};

const getSourceLibelle = (source: SaveurReportData['source'], payeesUniquement: boolean) => {
  switch (source) {
    case 'caisse':
      return 'Caisse (Comptoir)';
    case 'boutique':
      return 'Boutique';
    case 'livraison':
      return payeesUniquement ? 'Livraison (Factures payées uniquement)' : 'Livraison (Toutes factures)';
    case 'toutes':
    default:
      return payeesUniquement ? 'Toutes sources (Comptoir + Factures payées)' : 'Toutes sources (Comptoir + Livraison)';
  }
};

/**
 * Génère le rapport PDF complet du suivi Salé / Sucré selon le type choisi
 */
export async function genererRapportSaveurPDF(data: SaveurReportData) {
  const type = data.typeSelection || 'sale';
  const inclureSale = type === 'sale' || type === 'tous';
  const inclureSucre = type === 'sucre' || type === 'tous';

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // --- CALCULS GLOBAUX ---
  const vSale = data.ventesParSaveur.sale;
  const vSucre = data.ventesParSaveur.sucre;
  const cSale = data.coutParSaveur.sale;
  const cSucre = data.coutParSaveur.sucre;

  const mSale = vSale.valeur - cSale;
  const mSucre = vSucre.valeur - cSucre;

  const roiSale = cSale > 0 ? (mSale / cSale) * 100 : null;
  const roiSucre = cSucre > 0 ? (mSucre / cSucre) * 100 : null;

  const totalVentes = vSale.valeur + vSucre.valeur;
  const totalQty = vSale.qty + vSucre.qty;
  const totalCouts = cSale + cSucre;
  const totalMarge = totalVentes - totalCouts;
  const totalRoi = totalCouts > 0 ? (totalMarge / totalCouts) * 100 : null;

  const partSale = totalVentes > 0 ? (vSale.valeur / totalVentes) * 100 : 0;
  const partSucre = totalVentes > 0 ? (vSucre.valeur / totalVentes) * 100 : 0;

  // Filtrage des achats
  const achatsFiltres = data.achats.filter((a) => {
    if (type === 'sale') return a.saveur === 'sale';
    if (type === 'sucre') return a.saveur === 'sucre';
    return true;
  });

  // Date de début affichée :
  // Si la période sélectionnée est antérieure au début réel de l'activité (< 2026-01-01),
  // on utilise la date de la première opération réelle dans les achats filtrés
  let debutAffiche = data.periode.debut;
  if (debutAffiche < '2026-01-01') {
    const datesAchats = achatsFiltres.map(a => a.date).filter(d => d >= '2026-01-01').sort();
    if (datesAchats.length > 0) {
      debutAffiche = datesAchats[0];
    } else {
      debutAffiche = data.periode.fin.slice(0, 7) + '-01';
    }
  }

  // --- EN-TÊTE GRAPHIQUE ---
  // Bandeau sombre supérieur
  doc.setFillColor(24, 24, 27);
  doc.rect(0, 0, pageWidth, 38, 'F');

  // Liseré accent : terracotta si salé, indigo si sucré, bicolore ou neutre si les deux
  const lisereColor: [number, number, number] =
    type === 'sale' ? [180, 83, 9] : type === 'sucre' ? [79, 70, 229] : [180, 83, 9];
  doc.setFillColor(lisereColor[0], lisereColor[1], lisereColor[2]);
  doc.rect(0, 37, pageWidth, 1.5, 'F');

  // Cartouche blanc pour mettre en valeur le logo Chez Mina avec un contraste parfait
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(12, 6, 42, 20, 2, 2, 'F');

  let logoCharge = false;
  try {
    // Ratio réel de l'image : 3166 x 1311 (w/h = 2.415)
    doc.addImage(logoUrl, 'PNG', 14, 8, 38, 15.7);
    logoCharge = true;
  } catch {
    logoCharge = false;
  }

  if (!logoCharge) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(24, 24, 27);
    doc.text('CHEZ MINA', 15, 16);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(113, 113, 122);
    doc.text('Boulangerie & Pâtisserie', 15, 22);
  }

  // Titre du Rapport selon sélection
  const titreRapport =
    type === 'sale'
      ? 'RAPPORT DE RENTABILITÉ — PRODUITS SALÉS'
      : type === 'sucre'
      ? 'RAPPORT DE RENTABILITÉ — PRODUITS SUCRÉS'
      : 'RAPPORT DE RENTABILITÉ — SALÉ & SUCRÉ';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(titreRapport, pageWidth - 14, 15, { align: 'right' });

  // Période et Source
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(212, 212, 216);
  const periodeTexte = `Période : Du ${formatDateFR(debutAffiche)} au ${formatDateFR(data.periode.fin)}`;
  doc.text(periodeTexte, pageWidth - 14, 21, { align: 'right' });

  const sourceTexte = `Source : ${getSourceLibelle(data.source, data.payeesUniquement)}`;
  doc.text(sourceTexte, pageWidth - 14, 26, { align: 'right' });

  // Date et heure de génération
  const maintenant = new Date();
  const dateEdition = `Édité le ${maintenant.toLocaleDateString('fr-FR')} à ${maintenant.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  doc.setFontSize(7.5);
  doc.setTextColor(161, 161, 170);
  doc.text(dateEdition, pageWidth - 14, 32, { align: 'right' });

  let currentY = 46;

  const verifierEspace = (hauteurRequise: number) => {
    if (currentY + hauteurRequise > pageHeight - 22) {
      doc.addPage();
      currentY = 20;
      return true;
    }
    return false;
  };

  let sectionNum = 1;

  // =========================================================================
  // SECTION 1 : SYNTHÈSE DE PERFORMANCE
  // =========================================================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(24, 24, 27);

  if (type === 'tous') {
    doc.text(`${sectionNum}. SYNTHÈSE COMPARATIVE SALÉ VS SUCRÉ`, 14, currentY);
    currentY += 4;

    const syntheseBody = [
      [
        'Produits Salés',
        `${vSale.qty} u.`,
        formatPdfCurrency(vSale.valeur),
        formatPdfCurrency(cSale),
        (mSale >= 0 ? '+' : '') + formatPdfCurrency(mSale),
        roiSale !== null ? `${roiSale >= 0 ? '+' : ''}${roiSale.toFixed(1)} %` : '—',
        `${partSale.toFixed(1)} %`,
      ],
      [
        'Produits Sucrés',
        `${vSucre.qty} u.`,
        formatPdfCurrency(vSucre.valeur),
        formatPdfCurrency(cSucre),
        (mSucre >= 0 ? '+' : '') + formatPdfCurrency(mSucre),
        roiSucre !== null ? `${roiSucre >= 0 ? '+' : ''}${roiSucre.toFixed(1)} %` : '—',
        `${partSucre.toFixed(1)} %`,
      ],
      [
        'TOTAL COMBINÉ',
        `${totalQty} u.`,
        formatPdfCurrency(totalVentes),
        formatPdfCurrency(totalCouts),
        (totalMarge >= 0 ? '+' : '') + formatPdfCurrency(totalMarge),
        totalRoi !== null ? `${totalRoi >= 0 ? '+' : ''}${totalRoi.toFixed(1)} %` : '—',
        '100.0 %',
      ],
    ];

    autoTable(doc, {
      startY: currentY,
      head: [['Catégorie', 'Unités', 'Chiffre Ventes', 'Coûts Achats', 'Marge Nette', 'Rentab. (ROI)', 'Part CA']],
      body: syntheseBody,
      theme: 'grid',
      headStyles: {
        fillColor: [24, 24, 27],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5,
        halign: 'center',
      },
      columnStyles: {
        0: { fontStyle: 'bold', halign: 'left', cellWidth: 38 },
        1: { halign: 'center', cellWidth: 20 },
        2: { halign: 'right', fontStyle: 'bold', cellWidth: 28 },
        3: { halign: 'right', cellWidth: 26 },
        4: { halign: 'right', fontStyle: 'bold', cellWidth: 28 },
        5: { halign: 'center', cellWidth: 24 },
        6: { halign: 'center', cellWidth: 18 },
      },
      styles: { fontSize: 8.5, cellPadding: 2.5, textColor: [39, 39, 42] },
      didParseCell: (dataCell) => {
        if (dataCell.row.index === 2 && dataCell.section === 'body') {
          dataCell.cell.styles.fillColor = [244, 244, 245];
          dataCell.cell.styles.fontStyle = 'bold';
        }
        if (dataCell.section === 'body' && dataCell.column.index === 4) {
          const rowIdx = dataCell.row.index;
          const val = rowIdx === 0 ? mSale : rowIdx === 1 ? mSucre : totalMarge;
          dataCell.cell.styles.textColor = val >= 0 ? [22, 101, 52] : [185, 28, 28];
        }
      },
    });
  } else if (type === 'sale') {
    doc.text(`${sectionNum}. SYNTHÈSE DE PERFORMANCE — SALÉ`, 14, currentY);
    currentY += 4;

    const syntheseBody = [
      [
        'Total Produits Salés',
        `${vSale.qty} u.`,
        formatPdfCurrency(vSale.valeur),
        formatPdfCurrency(cSale),
        (mSale >= 0 ? '+' : '') + formatPdfCurrency(mSale),
        roiSale !== null ? `${roiSale >= 0 ? '+' : ''}${roiSale.toFixed(1)} %` : '—',
      ],
    ];

    autoTable(doc, {
      startY: currentY,
      head: [['Périmètre', 'Unités Vendues', 'Chiffre Ventes', 'Coûts Achats (Courses)', 'Marge Nette', 'Rentabilité (ROI)']],
      body: syntheseBody,
      theme: 'grid',
      headStyles: {
        fillColor: [180, 83, 9],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5,
        halign: 'center',
      },
      columnStyles: {
        0: { fontStyle: 'bold', halign: 'left', cellWidth: 42 },
        1: { halign: 'center', cellWidth: 26 },
        2: { halign: 'right', fontStyle: 'bold', cellWidth: 32 },
        3: { halign: 'right', cellWidth: 34 },
        4: { halign: 'right', fontStyle: 'bold', cellWidth: 30 },
        5: { halign: 'center', fontStyle: 'bold', cellWidth: 28 },
      },
      styles: { fontSize: 8.5, cellPadding: 3, textColor: [39, 39, 42] },
      didParseCell: (dataCell) => {
        if (dataCell.section === 'body') {
          dataCell.cell.styles.fillColor = [254, 243, 199];
          if (dataCell.column.index === 4) {
            dataCell.cell.styles.textColor = mSale >= 0 ? [22, 101, 52] : [185, 28, 28];
          }
        }
      },
    });
  } else {
    // type === 'sucre'
    doc.text(`${sectionNum}. SYNTHÈSE DE PERFORMANCE — SUCRÉ`, 14, currentY);
    currentY += 4;

    const syntheseBody = [
      [
        'Total Produits Sucrés',
        `${vSucre.qty} u.`,
        formatPdfCurrency(vSucre.valeur),
        formatPdfCurrency(cSucre),
        (mSucre >= 0 ? '+' : '') + formatPdfCurrency(mSucre),
        roiSucre !== null ? `${roiSucre >= 0 ? '+' : ''}${roiSucre.toFixed(1)} %` : '—',
      ],
    ];

    autoTable(doc, {
      startY: currentY,
      head: [['Périmètre', 'Unités Vendues', 'Chiffre Ventes', 'Coûts Achats (Courses)', 'Marge Nette', 'Rentabilité (ROI)']],
      body: syntheseBody,
      theme: 'grid',
      headStyles: {
        fillColor: [79, 70, 229],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5,
        halign: 'center',
      },
      columnStyles: {
        0: { fontStyle: 'bold', halign: 'left', cellWidth: 42 },
        1: { halign: 'center', cellWidth: 26 },
        2: { halign: 'right', fontStyle: 'bold', cellWidth: 32 },
        3: { halign: 'right', cellWidth: 34 },
        4: { halign: 'right', fontStyle: 'bold', cellWidth: 30 },
        5: { halign: 'center', fontStyle: 'bold', cellWidth: 28 },
      },
      styles: { fontSize: 8.5, cellPadding: 3, textColor: [39, 39, 42] },
      didParseCell: (dataCell) => {
        if (dataCell.section === 'body') {
          dataCell.cell.styles.fillColor = [224, 231, 255];
          if (dataCell.column.index === 4) {
            dataCell.cell.styles.textColor = mSucre >= 0 ? [22, 101, 52] : [185, 28, 28];
          }
        }
      },
    });
  }

  currentY = (doc as any).lastAutoTable.finalY + 9;
  sectionNum++;

  // =========================================================================
  // SECTION : DÉTAIL DES VENTES SALÉES (si inclus)
  // =========================================================================
  if (inclureSale) {
    verifierEspace(40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(24, 24, 27);
    doc.text(`${sectionNum}. DÉTAIL DES VENTES SALÉES (${data.produitsSale.length} article${data.produitsSale.length > 1 ? 's' : ''})`, 14, currentY);
    currentY += 4;

    const saleBody =
      data.produitsSale.length === 0
        ? [['—', 'Aucune vente de produit salé sur la période', '0 u.', '0 F', '0.0 %']]
        : data.produitsSale.map((p, idx) => {
            const part = vSale.valeur > 0 ? (p.valeur / vSale.valeur) * 100 : 0;
            return [
              (idx + 1).toString(),
              p.nom.toUpperCase(),
              `${p.qty} u.`,
              formatPdfCurrency(p.valeur),
              `${part.toFixed(1)} %`,
            ];
          });

    if (data.produitsSale.length > 0) {
      saleBody.push([
        '',
        'SOUS-TOTAL SALÉ',
        `${vSale.qty} u.`,
        formatPdfCurrency(vSale.valeur),
        '100.0 %',
      ]);
    }

    autoTable(doc, {
      startY: currentY,
      head: [['#', 'Désignation Produit Salé', 'Quantité', 'Chiffre Ventes', 'Part Salé']],
      body: saleBody,
      theme: 'striped',
      headStyles: {
        fillColor: [180, 83, 9],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'left',
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { cellWidth: 95 },
        2: { halign: 'center', cellWidth: 25 },
        3: { halign: 'right', fontStyle: 'bold', cellWidth: 32 },
        4: { halign: 'center', cellWidth: 20 },
      },
      styles: { fontSize: 8, cellPadding: 2, textColor: [39, 39, 42] },
      didParseCell: (dataCell) => {
        if (data.produitsSale.length > 0 && dataCell.row.index === saleBody.length - 1 && dataCell.section === 'body') {
          dataCell.cell.styles.fillColor = [254, 243, 199];
          dataCell.cell.styles.fontStyle = 'bold';
        }
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 9;
    sectionNum++;
  }

  // =========================================================================
  // SECTION : DÉTAIL DES VENTES SUCRÉES (si inclus)
  // =========================================================================
  if (inclureSucre) {
    verifierEspace(40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(24, 24, 27);
    doc.text(`${sectionNum}. DÉTAIL DES VENTES SUCRÉES (${data.produitsSucre.length} article${data.produitsSucre.length > 1 ? 's' : ''})`, 14, currentY);
    currentY += 4;

    const sucreBody =
      data.produitsSucre.length === 0
        ? [['—', 'Aucune vente de produit sucré sur la période', '0 u.', '0 F', '0.0 %']]
        : data.produitsSucre.map((p, idx) => {
            const part = vSucre.valeur > 0 ? (p.valeur / vSucre.valeur) * 100 : 0;
            return [
              (idx + 1).toString(),
              p.nom.toUpperCase(),
              `${p.qty} u.`,
              formatPdfCurrency(p.valeur),
              `${part.toFixed(1)} %`,
            ];
          });

    if (data.produitsSucre.length > 0) {
      sucreBody.push([
        '',
        'SOUS-TOTAL SUCRÉ',
        `${vSucre.qty} u.`,
        formatPdfCurrency(vSucre.valeur),
        '100.0 %',
      ]);
    }

    autoTable(doc, {
      startY: currentY,
      head: [['#', 'Désignation Produit Sucré', 'Quantité', 'Chiffre Ventes', 'Part Sucré']],
      body: sucreBody,
      theme: 'striped',
      headStyles: {
        fillColor: [79, 70, 229],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'left',
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { cellWidth: 95 },
        2: { halign: 'center', cellWidth: 25 },
        3: { halign: 'right', fontStyle: 'bold', cellWidth: 32 },
        4: { halign: 'center', cellWidth: 20 },
      },
      styles: { fontSize: 8, cellPadding: 2, textColor: [39, 39, 42] },
      didParseCell: (dataCell) => {
        if (data.produitsSucre.length > 0 && dataCell.row.index === sucreBody.length - 1 && dataCell.section === 'body') {
          dataCell.cell.styles.fillColor = [224, 231, 255];
          dataCell.cell.styles.fontStyle = 'bold';
        }
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 9;
    sectionNum++;
  }

  // =========================================================================
  // CALCULS VENTES DÉTAILLÉES (CLIENTS & DATES)
  // =========================================================================
  const ventesDetailleesFiltrees = (data.ventesDetaillees || []).filter((v) => {
    if (type === 'sale') return v.saveur === 'sale';
    if (type === 'sucre') return v.saveur === 'sucre';
    return true;
  }).sort((a, b) => {
    const compDate = a.date.localeCompare(b.date);
    if (compDate !== 0) return compDate;
    return a.clientNom.localeCompare(b.clientNom);
  });

  const clientMap = new Map<string, { clientNom: string; qty: number; valeur: number; nbVentes: number }>();
  ventesDetailleesFiltrees.forEach((v) => {
    const nom = v.clientNom || 'Client non spécifié';
    const c = clientMap.get(nom) || { clientNom: nom, qty: 0, valeur: 0, nbVentes: 0 };
    c.qty += v.quantite;
    c.valeur += v.valeur;
    c.nbVentes += 1;
    clientMap.set(nom, c);
  });
  const clientsList = Array.from(clientMap.values()).sort((a, b) => b.valeur - a.valeur);
  const totalClientsQty = ventesDetailleesFiltrees.reduce((acc, v) => acc + v.quantite, 0);
  const totalClientsVal = ventesDetailleesFiltrees.reduce((acc, v) => acc + v.valeur, 0);

  // =========================================================================
  // SECTION : RÉPARTITION DES VENTES PAR CLIENT (si renseigné)
  // =========================================================================
  if (clientsList.length > 0) {
    verifierEspace(40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(24, 24, 27);
    const titreClients =
      type === 'sale'
        ? `${sectionNum}. RÉPARTITION DES VENTES PAR CLIENT — SALÉ (${clientsList.length})`
        : type === 'sucre'
        ? `${sectionNum}. RÉPARTITION DES VENTES PAR CLIENT — SUCRÉ (${clientsList.length})`
        : `${sectionNum}. RÉPARTITION DES VENTES PAR CLIENT (${clientsList.length})`;
    doc.text(titreClients, 14, currentY);
    currentY += 4;

    const clientsBody = clientsList.map((c, idx) => {
      const part = totalClientsVal > 0 ? (c.valeur / totalClientsVal) * 100 : 0;
      return [
        (idx + 1).toString(),
        c.clientNom.toUpperCase(),
        `${c.qty} u.`,
        formatPdfCurrency(c.valeur),
        `${part.toFixed(1)} %`,
      ];
    });

    clientsBody.push([
      '',
      'TOTAL CLIENTS',
      `${totalClientsQty} u.`,
      formatPdfCurrency(totalClientsVal),
      '100.0 %',
    ]);

    const clientHeaderColor: [number, number, number] =
      type === 'sale' ? [180, 83, 9] : type === 'sucre' ? [79, 70, 229] : [24, 24, 27];

    autoTable(doc, {
      startY: currentY,
      head: [['#', 'Client / Destination', 'Quantité Vendue', 'Chiffre Ventes', 'Part CA']],
      body: clientsBody,
      theme: 'striped',
      headStyles: {
        fillColor: clientHeaderColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'left',
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { cellWidth: 90, fontStyle: 'bold' },
        2: { halign: 'center', cellWidth: 26 },
        3: { halign: 'right', fontStyle: 'bold', cellWidth: 32 },
        4: { halign: 'center', cellWidth: 24 },
      },
      styles: { fontSize: 8, cellPadding: 2, textColor: [39, 39, 42] },
      didParseCell: (dataCell) => {
        if (dataCell.row.index === clientsBody.length - 1 && dataCell.section === 'body') {
          dataCell.cell.styles.fillColor =
            type === 'sale' ? [254, 243, 199] : type === 'sucre' ? [224, 231, 255] : [244, 244, 245];
          dataCell.cell.styles.fontStyle = 'bold';
        }
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 9;
    sectionNum++;
  }

  // =========================================================================
  // SECTION : JOURNAL DÉTAILLÉ DES VENTES (PAR DATE & CLIENT)
  // =========================================================================
  if (ventesDetailleesFiltrees.length > 0) {
    verifierEspace(40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(24, 24, 27);
    const titreJournalVentes =
      type === 'sale'
        ? `${sectionNum}. JOURNAL DÉTAILLÉ DES VENTES PAR DATE & CLIENT — SALÉ (${ventesDetailleesFiltrees.length})`
        : type === 'sucre'
        ? `${sectionNum}. JOURNAL DÉTAILLÉ DES VENTES PAR DATE & CLIENT — SUCRÉ (${ventesDetailleesFiltrees.length})`
        : `${sectionNum}. JOURNAL DÉTAILLÉ DES VENTES PAR DATE & CLIENT (${ventesDetailleesFiltrees.length})`;
    doc.text(titreJournalVentes, 14, currentY);
    currentY += 4;

    const headerVentes =
      type === 'tous'
        ? [['Date', 'Client', 'Catégorie', 'Désignation Produit', 'Quantité', 'Montant Vente']]
        : [['Date', 'Client', 'Désignation Produit', 'Quantité', 'Montant Vente']];

    const ventesBody = ventesDetailleesFiltrees.map((v) => {
      if (type === 'tous') {
        return [
          formatDateFR(v.date),
          v.clientNom,
          v.saveur === 'sale' ? 'Salé' : 'Sucré',
          v.produitNom,
          `${v.quantite} u.`,
          formatPdfCurrency(v.valeur),
        ];
      }
      return [
        formatDateFR(v.date),
        v.clientNom,
        v.produitNom,
        `${v.quantite} u.`,
        formatPdfCurrency(v.valeur),
      ];
    });

    if (type === 'tous') {
      ventesBody.push([
        'TOTAL',
        `${clientsList.length} client(s)`,
        '',
        `${ventesDetailleesFiltrees.length} vente(s)`,
        `${totalClientsQty} u.`,
        formatPdfCurrency(totalClientsVal),
      ]);
    } else {
      ventesBody.push([
        'TOTAL',
        `${clientsList.length} client(s)`,
        `${ventesDetailleesFiltrees.length} vente(s)`,
        `${totalClientsQty} u.`,
        formatPdfCurrency(totalClientsVal),
      ]);
    }

    const ventesHeaderColor: [number, number, number] =
      type === 'sale' ? [180, 83, 9] : type === 'sucre' ? [79, 70, 229] : [55, 65, 81];

    autoTable(doc, {
      startY: currentY,
      head: headerVentes,
      body: ventesBody,
      theme: 'grid',
      headStyles: {
        fillColor: ventesHeaderColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'left',
      },
      columnStyles:
        type === 'tous'
          ? {
              0: { cellWidth: 22, halign: 'center' },
              1: { cellWidth: 44, fontStyle: 'bold' },
              2: { cellWidth: 20, halign: 'center' },
              3: { cellWidth: 46 },
              4: { cellWidth: 20, halign: 'center' },
              5: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
            }
          : {
              0: { cellWidth: 24, halign: 'center' },
              1: { cellWidth: 52, fontStyle: 'bold' },
              2: { cellWidth: 54 },
              3: { cellWidth: 22, halign: 'center' },
              4: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
            },
      styles: { fontSize: 8, cellPadding: 2, textColor: [39, 39, 42] },
      didParseCell: (dataCell) => {
        if (dataCell.row.index === ventesBody.length - 1 && dataCell.section === 'body') {
          dataCell.cell.styles.fillColor = [243, 244, 246];
          dataCell.cell.styles.fontStyle = 'bold';
        }
        if (type === 'tous' && dataCell.section === 'body' && dataCell.column.index === 2) {
          if (dataCell.cell.raw === 'Salé') {
            dataCell.cell.styles.textColor = [180, 83, 9];
            dataCell.cell.styles.fontStyle = 'bold';
          } else if (dataCell.cell.raw === 'Sucré') {
            dataCell.cell.styles.textColor = [79, 70, 229];
            dataCell.cell.styles.fontStyle = 'bold';
          }
        }
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 9;
    sectionNum++;
  }

  // =========================================================================
  // SECTION : JOURNAL DES ACHATS (FILTRÉ SELON TYPE)
  // =========================================================================
  verifierEspace(40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(24, 24, 27);
  const titreAchats =
    type === 'sale'
      ? `${sectionNum}. JOURNAL DES ACHATS & TICKETS DE COURSES — SALÉ (${achatsFiltres.length})`
      : type === 'sucre'
      ? `${sectionNum}. JOURNAL DES ACHATS & TICKETS DE COURSES — SUCRÉ (${achatsFiltres.length})`
      : `${sectionNum}. JOURNAL DES ACHATS & TICKETS DE COURSES (${achatsFiltres.length})`;
  doc.text(titreAchats, 14, currentY);
  currentY += 4;

  const totalCoutsFiltre =
    type === 'sale' ? cSale : type === 'sucre' ? cSucre : totalCouts;

  const achatsBody =
    achatsFiltres.length === 0
      ? [['—', '—', 'Aucun achat enregistré sur cette période', '0 F']]
      : achatsFiltres.map((a) => [
          formatDateFR(a.date),
          a.saveur === 'sale' ? 'Salé' : 'Sucré',
          a.note || '—',
          formatPdfCurrency(a.montant),
        ]);

  if (achatsFiltres.length > 0) {
    const libelleTotal =
      type === 'sale'
        ? 'TOTAL ACHATS SALÉ'
        : type === 'sucre'
        ? 'TOTAL ACHATS SUCRÉ'
        : `Salé: ${formatPdfCurrency(cSale)} | Sucré: ${formatPdfCurrency(cSucre)}`;

    achatsBody.push([
      'TOTAL',
      libelleTotal,
      '',
      formatPdfCurrency(totalCoutsFiltre),
    ]);
  }

  autoTable(doc, {
    startY: currentY,
    head: [['Date', 'Catégorie', 'Description / Note', 'Montant Dépensé']],
    body: achatsBody,
    theme: 'grid',
    headStyles: {
      fillColor: [55, 65, 81],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
    },
    columnStyles: {
      0: { cellWidth: 26, halign: 'center' },
      1: { cellWidth: type === 'tous' ? 26 : 38, halign: 'center', fontStyle: 'bold' },
      2: { cellWidth: type === 'tous' ? 95 : 83 },
      3: { cellWidth: 35, halign: 'right', fontStyle: 'bold' },
    },
    styles: { fontSize: 8, cellPadding: 2, textColor: [39, 39, 42] },
    didParseCell: (dataCell) => {
      if (achatsFiltres.length > 0 && dataCell.row.index === achatsBody.length - 1 && dataCell.section === 'body') {
        dataCell.cell.styles.fillColor = [243, 244, 246];
        dataCell.cell.styles.fontStyle = 'bold';
      }
      if (dataCell.section === 'body' && dataCell.column.index === 1) {
        if (dataCell.cell.raw === 'Salé') {
          dataCell.cell.styles.textColor = [180, 83, 9];
        } else if (dataCell.cell.raw === 'Sucré') {
          dataCell.cell.styles.textColor = [79, 70, 229];
        }
      }
    },
  });

  // =========================================================================
  // PIED DE PAGE SUR TOUTES LES PAGES
  // =========================================================================
  const totalPages = (doc as any).internal.getNumberOfPages();
  const libelleBas =
    type === 'sale'
      ? 'Chez Mina • Suivi Salé'
      : type === 'sucre'
      ? 'Chez Mina • Suivi Sucré'
      : 'Chez Mina • Suivi Salé / Sucré';

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    doc.setDrawColor(228, 228, 231);
    doc.setLineWidth(0.3);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(113, 113, 122);
    doc.text(libelleBas, 14, pageHeight - 7);
    doc.text(`Page ${i} sur ${totalPages}`, pageWidth / 2, pageHeight - 7, { align: 'center' });
    doc.text(`Période du ${formatDateFR(data.periode.debut)} au ${formatDateFR(data.periode.fin)}`, pageWidth - 14, pageHeight - 7, { align: 'right' });
  }

  const suffixe = type === 'sale' ? 'Sale' : type === 'sucre' ? 'Sucre' : 'Sale_Sucre';
  const nomFichier = `Rapport_${suffixe}_${data.periode.debut}_au_${data.periode.fin}.pdf`;
  doc.save(nomFichier);
}

/**
 * Exporte les données choisies en CSV (UTF-8 avec BOM compatible Excel)
 */
export function exporterSaveurCSV(data: SaveurReportData) {
  const type = data.typeSelection || 'sale';
  const inclureSale = type === 'sale' || type === 'tous';
  const inclureSucre = type === 'sucre' || type === 'tous';

  const vSale = data.ventesParSaveur.sale;
  const vSucre = data.ventesParSaveur.sucre;
  const cSale = data.coutParSaveur.sale;
  const cSucre = data.coutParSaveur.sucre;

  const mSale = vSale.valeur - cSale;
  const mSucre = vSucre.valeur - cSucre;
  const totalVentes = vSale.valeur + vSucre.valeur;
  const totalQty = vSale.qty + vSucre.qty;
  const totalCouts = cSale + cSucre;
  const totalMarge = totalVentes - totalCouts;

  const lines: string[] = [];

  const escapeCSV = (val: string | number) => {
    const str = String(val ?? '').replace(/"/g, '""');
    return `"${str}"`;
  };

  const titrePrincipal =
    type === 'sale'
      ? 'RAPPORT DE RENTABILITÉ — PRODUITS SALÉS'
      : type === 'sucre'
      ? 'RAPPORT DE RENTABILITÉ — PRODUITS SUCRÉS'
      : 'RAPPORT DE RENTABILITÉ — SALÉ & SUCRÉ';

  // Date de début affichée (sécurité anti-2025)
  let debutAffiche = data.periode.debut;
  if (debutAffiche < '2026-01-01') {
    const datesAchats = data.achats
      .filter(a => type === 'tous' || a.saveur === type)
      .map(a => a.date)
      .filter(d => d >= '2026-01-01')
      .sort();
    if (datesAchats.length > 0) {
      debutAffiche = datesAchats[0];
    } else {
      debutAffiche = data.periode.fin.slice(0, 7) + '-01';
    }
  }

  // En-tête
  lines.push(`"${titrePrincipal}"`);
  lines.push(`"Période";"Du ${formatDateFR(debutAffiche)} au ${formatDateFR(data.periode.fin)}"`);
  lines.push(`"Source des ventes";${escapeCSV(getSourceLibelle(data.source, data.payeesUniquement))}`);
  lines.push(`"Date d'export";"${new Date().toLocaleString('fr-FR')}"`);
  lines.push('');

  // 1. Synthèse
  lines.push(`"1. SYNTHÈSE GLOBALE"`);
  if (type === 'tous') {
    lines.push(`"Catégorie";"Unités vendues";"Chiffre d'Affaires (FCFA)";"Coût d'Achat (FCFA)";"Marge Nette (FCFA)";"ROI (%)";"Part CA (%)"`);
    lines.push(`"Salé";${vSale.qty};${vSale.valeur};${cSale};${mSale};"${cSale > 0 ? ((mSale / cSale) * 100).toFixed(1) + '%' : '—'}";"${totalVentes > 0 ? ((vSale.valeur / totalVentes) * 100).toFixed(1) + '%' : '0%'}"`);
    lines.push(`"Sucré";${vSucre.qty};${vSucre.valeur};${cSucre};${mSucre};"${cSucre > 0 ? ((mSucre / cSucre) * 100).toFixed(1) + '%' : '—'}";"${totalVentes > 0 ? ((vSucre.valeur / totalVentes) * 100).toFixed(1) + '%' : '0%'}"`);
    lines.push(`"TOTAL";${totalQty};${totalVentes};${totalCouts};${totalMarge};"${totalCouts > 0 ? ((totalMarge / totalCouts) * 100).toFixed(1) + '%' : '—'}";"100%"`);
  } else if (type === 'sale') {
    lines.push(`"Catégorie";"Unités vendues";"Chiffre d'Affaires (FCFA)";"Coût d'Achat (FCFA)";"Marge Nette (FCFA)";"ROI (%)"`);
    lines.push(`"Salé";${vSale.qty};${vSale.valeur};${cSale};${mSale};"${cSale > 0 ? ((mSale / cSale) * 100).toFixed(1) + '%' : '—'}"`);
  } else {
    lines.push(`"Catégorie";"Unités vendues";"Chiffre d'Affaires (FCFA)";"Coût d'Achat (FCFA)";"Marge Nette (FCFA)";"ROI (%)"`);
    lines.push(`"Sucré";${vSucre.qty};${vSucre.valeur};${cSucre};${mSucre};"${cSucre > 0 ? ((mSucre / cSucre) * 100).toFixed(1) + '%' : '—'}"`);
  }
  lines.push('');

  // 2. Détail Salé si inclus
  if (inclureSale) {
    lines.push(`"VENTES DÉTAILLÉES — PRODUITS SALÉS"`);
    lines.push(`"Produit";"Quantité vendue";"Montant Ventes (FCFA)";"Part dans le Salé (%)"`);
    data.produitsSale.forEach((p) => {
      const part = vSale.valeur > 0 ? (p.valeur / vSale.valeur) * 100 : 0;
      lines.push(`${escapeCSV(p.nom)};${p.qty};${p.valeur};"${part.toFixed(1)}%"`);
    });
    lines.push('');
  }

  // 3. Détail Sucré si inclus
  if (inclureSucre) {
    lines.push(`"VENTES DÉTAILLÉES — PRODUITS SUCRÉS"`);
    lines.push(`"Produit";"Quantité vendue";"Montant Ventes (FCFA)";"Part dans le Sucré (%)"`);
    data.produitsSucre.forEach((p) => {
      const part = vSucre.valeur > 0 ? (p.valeur / vSucre.valeur) * 100 : 0;
      lines.push(`${escapeCSV(p.nom)};${p.qty};${p.valeur};"${part.toFixed(1)}%"`);
    });
    lines.push('');
  }

  // Ventes détaillées (clients & dates) si présentes
  const ventesDetailleesFiltrees = (data.ventesDetaillees || []).filter((v) => {
    if (type === 'sale') return v.saveur === 'sale';
    if (type === 'sucre') return v.saveur === 'sucre';
    return true;
  }).sort((a, b) => a.date.localeCompare(b.date));

  if (ventesDetailleesFiltrees.length > 0) {
    const clientMap = new Map<string, { clientNom: string; qty: number; valeur: number }>();
    ventesDetailleesFiltrees.forEach((v) => {
      const cle = v.clientNom || 'Client non spécifié';
      const exist = clientMap.get(cle) || { clientNom: cle, qty: 0, valeur: 0 };
      exist.qty += v.quantite;
      exist.valeur += v.valeur;
      clientMap.set(cle, exist);
    });
    const clientsList = Array.from(clientMap.values()).sort((a, b) => b.valeur - a.valeur);
    const totalVal = ventesDetailleesFiltrees.reduce((acc, v) => acc + v.valeur, 0);

    lines.push(`"RÉPARTITION DES VENTES PAR CLIENT"`);
    lines.push(`"Client";"Quantité vendue";"Chiffre d'Affaires (FCFA)";"Part (%)"`);
    clientsList.forEach((c) => {
      const part = totalVal > 0 ? (c.valeur / totalVal) * 100 : 0;
      lines.push(`${escapeCSV(c.clientNom)};${c.qty};${c.valeur};"${part.toFixed(1)}%"`);
    });
    lines.push('');

    lines.push(`"JOURNAL DÉTAILLÉ DES VENTES (PAR DATE & CLIENT)"`);
    lines.push(`"Date";"Client";"Désignation Produit";"Catégorie";"Quantité";"Montant Vente (FCFA)";"Référence / Source"`);
    ventesDetailleesFiltrees.forEach((v) => {
      lines.push(
        `${escapeCSV(formatDateFR(v.date))};${escapeCSV(v.clientNom)};${escapeCSV(v.produitNom)};${escapeCSV(v.saveur === 'sale' ? 'Salé' : 'Sucré')};${v.quantite};${v.valeur};${escapeCSV(v.numeroFacture || v.source || '')}`
      );
    });
    lines.push('');
  }

  // 4. Achats filtrés
  const achatsFiltres = data.achats.filter((a) => {
    if (type === 'sale') return a.saveur === 'sale';
    if (type === 'sucre') return a.saveur === 'sucre';
    return true;
  });

  const titreJournal =
    type === 'sale'
      ? 'JOURNAL DES ACHATS — SALÉ (TICKETS DE COURSES)'
      : type === 'sucre'
      ? 'JOURNAL DES ACHATS — SUCRÉ (TICKETS DE COURSES)'
      : 'JOURNAL DES ACHATS (TICKETS DE COURSES)';

  lines.push(`"${titreJournal}"`);
  lines.push(`"Date";"Catégorie";"Description";"Montant (FCFA)"`);
  achatsFiltres.forEach((a) => {
    lines.push(`${escapeCSV(formatDateFR(a.date))};${escapeCSV(a.saveur === 'sale' ? 'Salé' : 'Sucré')};${escapeCSV(a.note || '')};${a.montant}`);
  });

  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const suffixe = type === 'sale' ? 'Sale' : type === 'sucre' ? 'Sucre' : 'Sale_Sucre';
  link.setAttribute('download', `Export_${suffixe}_${debutAffiche}_au_${data.periode.fin}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
