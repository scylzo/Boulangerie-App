import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Client, Livreur } from '../types';
import logoUrl from '../assets/logo.png';

export interface ClientReportFilters {
  kiosque: 'tous' | 'avec_kiosque' | 'sans_kiosque';
  typeClient: 'tous' | 'client' | 'boutique';
  statut: 'tous' | 'actif' | 'inactif';
  livreurId: string; // 'tous' ou id spécifique
  recherche?: string;
  tri: 'nom_asc' | 'nom_desc' | 'type' | 'kiosque_premier';
}

export interface ClientReportStatsConfig {
  inclureStats: boolean;
  afficherTotal: boolean;
  afficherKiosque: boolean;
  afficherActifs: boolean;
  afficherTypes: boolean;
  afficherLivreurs: boolean;
}

export interface ClientReportColumnsConfig {
  nom: boolean; // toujours true
  typeClient: boolean;
  kiosque: boolean;
  telephone: boolean;
  adresse: boolean;
  livreur: boolean;
  modePaiement: boolean;
  statut: boolean;
  conditionsPaiement: boolean;
  coordonneesGps: boolean;
}

export interface ClientReportConfig {
  titre?: string;
  clients: Client[];
  livreurs: Livreur[];
  filtres: ClientReportFilters;
  statsConfig: ClientReportStatsConfig;
  colonnesConfig: ClientReportColumnsConfig;
}

const getModePaiementLabel = (mode?: string): string => {
  switch (mode) {
    case 'espece': return 'Espèces';
    case 'om': return 'Orange Money';
    case 'wave': return 'Wave';
    case 'cheque': return 'Chèque';
    case 'virement': return 'Virement';
    default: return '—';
  }
};

/**
 * Filtre et trie les clients selon les options choisies
 */
export function filtrerEtTrierClients(
  clients: Client[],
  filtres: ClientReportFilters
): Client[] {
  let res = clients.filter((c) => {
    // Filtre Kiosque
    if (filtres.kiosque === 'avec_kiosque' && !c.aKiosque) return false;
    if (filtres.kiosque === 'sans_kiosque' && c.aKiosque) return false;

    // Filtre Type
    if (filtres.typeClient !== 'tous' && c.typeClient !== filtres.typeClient) return false;

    // Filtre Statut
    if (filtres.statut === 'actif' && !c.active) return false;
    if (filtres.statut === 'inactif' && c.active) return false;

    // Filtre Livreur
    if (filtres.livreurId !== 'tous') {
      const matchLivreur =
        c.livreurId === filtres.livreurId ||
        c.livreursParCar?.car1_matin === filtres.livreurId ||
        c.livreursParCar?.car2_matin === filtres.livreurId ||
        c.livreursParCar?.car_soir === filtres.livreurId;
      if (!matchLivreur) return false;
    }

    // Filtre Recherche
    if (filtres.recherche && filtres.recherche.trim() !== '') {
      const q = filtres.recherche.toLowerCase().trim();
      const nomComplet = `${c.prenom || ''} ${c.nom || ''}`.toLowerCase();
      const tel = (c.telephone || '').toLowerCase();
      const adr = (c.adresse || '').toLowerCase();
      if (!nomComplet.includes(q) && !tel.includes(q) && !adr.includes(q)) {
        return false;
      }
    }

    return true;
  });

  // Tri
  res = [...res].sort((a, b) => {
    const nomA = `${a.nom} ${a.prenom || ''}`.trim().toLowerCase();
    const nomB = `${b.nom} ${b.prenom || ''}`.trim().toLowerCase();

    switch (filtres.tri) {
      case 'nom_desc':
        return nomB.localeCompare(nomA);
      case 'type':
        if (a.typeClient !== b.typeClient) {
          return a.typeClient === 'boutique' ? -1 : 1;
        }
        return nomA.localeCompare(nomB);
      case 'kiosque_premier':
        if (!!a.aKiosque !== !!b.aKiosque) {
          return a.aKiosque ? -1 : 1;
        }
        return nomA.localeCompare(nomB);
      case 'nom_asc':
      default:
        return nomA.localeCompare(nomB);
    }
  });

  return res;
}

/**
 * Calcule les indicateurs statistiques pour les clients
 */
export function calculerStatsClients(clients: Client[], livreurs: Livreur[]) {
  const total = clients.length;
  const avecKiosque = clients.filter((c) => c.aKiosque).length;
  const sansKiosque = total - avecKiosque;
  const pctKiosque = total > 0 ? (avecKiosque / total) * 100 : 0;

  const actifs = clients.filter((c) => c.active).length;
  const inactifs = total - actifs;
  const pctActifs = total > 0 ? (actifs / total) * 100 : 0;

  const typeBoutiques = clients.filter((c) => c.typeClient === 'boutique').length;
  const typeClients = clients.filter((c) => c.typeClient === 'client').length;

  const parLivreur: Record<string, { nom: string; count: number }> = {};
  livreurs.forEach((l) => {
    parLivreur[l.id] = { nom: l.nom, count: 0 };
  });

  let nonAssignes = 0;
  clients.forEach((c) => {
    const lid = c.livreurId || c.livreursParCar?.car1_matin || c.livreursParCar?.car2_matin || c.livreursParCar?.car_soir;
    if (lid && parLivreur[lid]) {
      parLivreur[lid].count += 1;
    } else {
      nonAssignes += 1;
    }
  });

  return {
    total,
    avecKiosque,
    sansKiosque,
    pctKiosque,
    actifs,
    inactifs,
    pctActifs,
    typeBoutiques,
    typeClients,
    parLivreur: Object.values(parLivreur).filter((item) => item.count > 0),
    nonAssignes,
  };
}

/**
 * Génère le document PDF de la fiche des clients
 */
export async function genererRapportClientsPDF(config: ClientReportConfig): Promise<void> {
  const { clients, livreurs, filtres, statsConfig, colonnesConfig } = config;
  const clientsFiltres = filtrerEtTrierClients(clients, filtres);
  const stats = calculerStatsClients(clientsFiltres, livreurs);

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // --- BANDEAU SUPÉRIEUR ---
  doc.setFillColor(24, 24, 27); // #18181b
  doc.rect(0, 0, pageWidth, 34, 'F');

  // Liseré terracotta
  doc.setFillColor(180, 83, 9);
  doc.rect(0, 33, pageWidth, 1.5, 'F');

  // Cartouche blanc pour logo Chez Mina
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(12, 5, 38, 18, 2, 2, 'F');

  try {
    doc.addImage(logoUrl, 'PNG', 14, 6.5, 34, 15);
  } catch {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(24, 24, 27);
    doc.text('CHEZ MINA', 15, 14);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(113, 113, 122);
    doc.text('Boulangerie & Pâtisserie', 15, 19);
  }

  // Titre du document
  const titre = config.titre || 'LISTE OFFICIELLE DES CLIENTS';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(titre, pageWidth - 14, 13, { align: 'right' });

  // Sous-titre et date
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(212, 212, 216);

  let filtreDescription: string[] = [];
  if (filtres.kiosque === 'avec_kiosque') filtreDescription.push('Avec kiosque');
  else if (filtres.kiosque === 'sans_kiosque') filtreDescription.push('Sans kiosque');
  if (filtres.typeClient === 'client') filtreDescription.push('Clients ordinaires');
  else if (filtres.typeClient === 'boutique') filtreDescription.push('Boutiques');
  if (filtres.statut === 'actif') filtreDescription.push('Actifs');
  else if (filtres.statut === 'inactif') filtreDescription.push('Inactifs');

  const filtreTexte = filtreDescription.length > 0 ? `Filtres appliqués : ${filtreDescription.join(' · ')}` : 'Tous les clients';
  doc.text(`${filtreTexte} (${clientsFiltres.length} client(s))`, pageWidth - 14, 19, { align: 'right' });

  const maintenant = new Date();
  const dateEdition = `Édité le ${maintenant.toLocaleDateString('fr-FR')} à ${maintenant.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  doc.setFontSize(7.5);
  doc.setTextColor(161, 161, 170);
  doc.text(dateEdition, pageWidth - 14, 25, { align: 'right' });

  let currentY = 40;

  // --- SECTION STATISTIQUES / SYNTHÈSE (Si activée) ---
  if (statsConfig.inclureStats) {
    const kpis: { label: string; val: string; sub?: string; color: [number, number, number] }[] = [];

    if (statsConfig.afficherTotal) {
      kpis.push({
        label: 'TOTAL CLIENTS',
        val: `${stats.total}`,
        sub: 'Portefeuille sélectionné',
        color: [30, 41, 59],
      });
    }

    if (statsConfig.afficherKiosque) {
      kpis.push({
        label: 'AVEC KIOSQUE',
        val: `${stats.avecKiosque}`,
        sub: `${stats.pctKiosque.toFixed(1)}% (${stats.sansKiosque} sans kiosque)`,
        color: [180, 83, 9], // Terracotta / ambre
      });
    }

    if (statsConfig.afficherActifs) {
      kpis.push({
        label: 'CLIENTS ACTIFS',
        val: `${stats.actifs}`,
        sub: `${stats.pctActifs.toFixed(1)}% (${stats.inactifs} inactifs)`,
        color: [16, 149, 117], // Emerald
      });
    }

    if (statsConfig.afficherTypes) {
      kpis.push({
        label: 'RÉPARTITION TYPES',
        val: `${stats.typeClients} C / ${stats.typeBoutiques} B`,
        sub: `${stats.typeClients} client(s) · ${stats.typeBoutiques} boutique(s)`,
        color: [37, 99, 235], // Blue
      });
    }

    if (statsConfig.afficherLivreurs && stats.parLivreur.length > 0) {
      const topLivreur = [...stats.parLivreur].sort((a, b) => b.count - a.count)[0];
      kpis.push({
        label: 'AFFECTATION LIVREURS',
        val: `${stats.total - stats.nonAssignes} assignés`,
        sub: topLivreur ? `Top: ${topLivreur.nom} (${topLivreur.count})` : 'Répartis',
        color: [124, 58, 237], // Purple
      });
    }

    if (kpis.length > 0) {
      const cardGap = 4;
      const cardWidth = (pageWidth - 28 - (kpis.length - 1) * cardGap) / kpis.length;
      const cardHeight = 16;

      kpis.forEach((kpi, idx) => {
        const x = 14 + idx * (cardWidth + cardGap);
        // Fond carte
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(x, currentY, cardWidth, cardHeight, 1.5, 1.5, 'F');
        // Bordure gauche colorée
        doc.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2]);
        doc.rect(x, currentY, 2, cardHeight, 'F');

        // Titre KPI
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text(kpi.label, x + 5, currentY + 4.5);

        // Valeur KPI
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
        doc.text(kpi.val, x + 5, currentY + 9.5);

        // Sous-titre
        if (kpi.sub) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(5.5);
          doc.setTextColor(148, 163, 184);
          doc.text(kpi.sub, x + 5, currentY + 13.5);
        }
      });

      currentY += cardHeight + 6;
    }
  }

  // --- PRÉPARATION DES COLONNES DU TABLEAU ---
  const tableHeaders: string[] = ['Nom & Prénom'];

  if (colonnesConfig.typeClient) {
    tableHeaders.push('Type');
  }
  if (colonnesConfig.kiosque) {
    tableHeaders.push('Kiosque');
  }
  if (colonnesConfig.telephone) {
    tableHeaders.push('Téléphone');
  }
  if (colonnesConfig.adresse) {
    tableHeaders.push('Adresse');
  }
  if (colonnesConfig.livreur) {
    tableHeaders.push('Livreur / Cars');
  }
  if (colonnesConfig.modePaiement) {
    tableHeaders.push('Mode Paiement');
  }
  if (colonnesConfig.statut) {
    tableHeaders.push('Statut');
  }
  if (colonnesConfig.conditionsPaiement) {
    tableHeaders.push('Conditions');
  }
  if (colonnesConfig.coordonneesGps) {
    tableHeaders.push('GPS');
  }

  const livreurMap = new Map<string, string>();
  livreurs.forEach((l) => livreurMap.set(l.id, l.nom));

  const tableRows = clientsFiltres.map((c) => {
    const row: string[] = [];

    // Nom & Prénom
    const nomComplet = c.prenom ? `${c.prenom} ${c.nom}` : c.nom;
    row.push(nomComplet);

    if (colonnesConfig.typeClient) {
      row.push(c.typeClient === 'boutique' ? 'Boutique' : 'Client');
    }
    if (colonnesConfig.kiosque) {
      row.push(c.aKiosque ? 'OUI' : 'Non');
    }
    if (colonnesConfig.telephone) {
      row.push(c.telephone || '—');
    }
    if (colonnesConfig.adresse) {
      row.push(c.adresse || '—');
    }
    if (colonnesConfig.livreur) {
      const def = c.livreurId ? livreurMap.get(c.livreurId) : null;
      const c1 = c.livreursParCar?.car1_matin ? livreurMap.get(c.livreursParCar.car1_matin) : null;
      const c2 = c.livreursParCar?.car2_matin ? livreurMap.get(c.livreursParCar.car2_matin) : null;
      const cs = c.livreursParCar?.car_soir ? livreurMap.get(c.livreursParCar.car_soir) : null;

      let parts: string[] = [];
      if (def) parts.push(`Déf: ${def}`);
      if (c1) parts.push(`C1: ${c1}`);
      if (c2) parts.push(`C2: ${c2}`);
      if (cs) parts.push(`Soir: ${cs}`);
      row.push(parts.length > 0 ? parts.join(' | ') : 'Non assigné');
    }
    if (colonnesConfig.modePaiement) {
      row.push(getModePaiementLabel(c.modePaiementPreference));
    }
    if (colonnesConfig.statut) {
      row.push(c.active ? 'Actif' : 'Inactif');
    }
    if (colonnesConfig.conditionsPaiement) {
      row.push(c.conditionsPaiement || (c.eligibleRistourne ? 'Ristourne' : 'Standard'));
    }
    if (colonnesConfig.coordonneesGps) {
      if (c.latitude && c.longitude) {
        row.push(`${c.latitude.toFixed(4)}, ${c.longitude.toFixed(4)}`);
      } else {
        row.push('—');
      }
    }

    return row;
  });

  // --- DESSIN DU TABLEAU AVEC AUTOTABLE ---
  autoTable(doc, {
    startY: currentY,
    head: [tableHeaders],
    body: tableRows,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.2,
      textColor: [39, 39, 42],
      lineColor: [228, 228, 231],
      lineWidth: 0.15,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [39, 39, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
      cellPadding: 3,
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
    didParseCell: (data) => {
      // Coloration conditionnelle pour Statut & Kiosque
      const headerText = tableHeaders[data.column.index];
      if (headerText === 'Kiosque' && data.section === 'body') {
        if (data.cell.raw === 'OUI') {
          data.cell.styles.textColor = [180, 83, 9]; // Terracotta / or
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = [156, 163, 175];
        }
      }
      if (headerText === 'Statut' && data.section === 'body') {
        if (data.cell.raw === 'Actif') {
          data.cell.styles.textColor = [16, 149, 117]; // Vert
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = [156, 163, 175];
        }
      }
    },
    margin: { left: 14, right: 14, bottom: 16 },
  });

  // --- PIED DE PAGE PAGINÉ ---
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(161, 161, 170);

    // Ligne fine
    doc.setDrawColor(228, 228, 231);
    doc.line(14, pageHeight - 10, pageWidth - 14, pageHeight - 10);

    doc.text('Chez Mina Noflaye — Boulangerie & Pâtisserie · Système de Gestion', 14, pageHeight - 6);
    doc.text(`Page ${i} sur ${totalPages}`, pageWidth - 14, pageHeight - 6, { align: 'right' });
  }

  // Téléchargement
  const dateStr = new Date().toISOString().split('T')[0];
  const suffixe = filtres.kiosque === 'avec_kiosque' ? 'Avec_Kiosque' : filtres.kiosque === 'sans_kiosque' ? 'Sans_Kiosque' : 'Tous';
  doc.save(`Fiche_Clients_${suffixe}_${dateStr}.pdf`);
}

/**
 * Exporte la liste des clients au format CSV (compatible Excel avec BOM UTF-8)
 */
export function exporterClientsCSV(config: ClientReportConfig): void {
  const { clients, livreurs, filtres, statsConfig, colonnesConfig } = config;
  const clientsFiltres = filtrerEtTrierClients(clients, filtres);
  const stats = calculerStatsClients(clientsFiltres, livreurs);

  const escapeCSV = (val: string | number | undefined | null) => {
    const str = String(val ?? '').replace(/"/g, '""');
    return `"${str}"`;
  };

  const lines: string[] = [];

  // En-tête du document
  lines.push(`"${config.titre || 'LISTE DES CLIENTS — CHEZ MINA'}"`);
  lines.push(`"Date d'export";"${new Date().toLocaleString('fr-FR')}"`);
  lines.push(`"Total clients retenus";${clientsFiltres.length}`);
  lines.push('');

  // Statistiques si demandées
  if (statsConfig.inclureStats) {
    lines.push(`"SYNTHÈSE STATISTIQUE"`);
    if (statsConfig.afficherTotal) lines.push(`"Total clients";${stats.total}`);
    if (statsConfig.afficherKiosque) {
      lines.push(`"Avec kiosque";${stats.avecKiosque};"${stats.pctKiosque.toFixed(1)}%"`);
      lines.push(`"Sans kiosque";${stats.sansKiosque};"${(100 - stats.pctKiosque).toFixed(1)}%"`);
    }
    if (statsConfig.afficherActifs) {
      lines.push(`"Clients actifs";${stats.actifs};"${stats.pctActifs.toFixed(1)}%"`);
      lines.push(`"Clients inactifs";${stats.inactifs};"${(100 - stats.pctActifs).toFixed(1)}%"`);
    }
    if (statsConfig.afficherTypes) {
      lines.push(`"Boutiques";${stats.typeBoutiques}`);
      lines.push(`"Clients ordinaires";${stats.typeClients}`);
    }
    lines.push('');
  }

  // Colonnes du tableau
  const headers: string[] = ['"Nom & Prénom"'];
  if (colonnesConfig.typeClient) headers.push('"Type"');
  if (colonnesConfig.kiosque) headers.push('"Kiosque"');
  if (colonnesConfig.telephone) headers.push('"Téléphone"');
  if (colonnesConfig.adresse) headers.push('"Adresse"');
  if (colonnesConfig.livreur) headers.push('"Livreur(s)"');
  if (colonnesConfig.modePaiement) headers.push('"Mode de Paiement"');
  if (colonnesConfig.statut) headers.push('"Statut"');
  if (colonnesConfig.conditionsPaiement) headers.push('"Conditions de Paiement"');
  if (colonnesConfig.coordonneesGps) headers.push('"GPS"');

  lines.push(headers.join(';'));

  const livreurMap = new Map<string, string>();
  livreurs.forEach((l) => livreurMap.set(l.id, l.nom));

  // Lignes de données
  clientsFiltres.forEach((c) => {
    const row: string[] = [];
    const nomComplet = c.prenom ? `${c.prenom} ${c.nom}` : c.nom;
    row.push(escapeCSV(nomComplet));

    if (colonnesConfig.typeClient) {
      row.push(escapeCSV(c.typeClient === 'boutique' ? 'Boutique' : 'Client'));
    }
    if (colonnesConfig.kiosque) {
      row.push(escapeCSV(c.aKiosque ? 'Oui' : 'Non'));
    }
    if (colonnesConfig.telephone) {
      row.push(escapeCSV(c.telephone || ''));
    }
    if (colonnesConfig.adresse) {
      row.push(escapeCSV(c.adresse || ''));
    }
    if (colonnesConfig.livreur) {
      const def = c.livreurId ? livreurMap.get(c.livreurId) : null;
      const c1 = c.livreursParCar?.car1_matin ? livreurMap.get(c.livreursParCar.car1_matin) : null;
      const c2 = c.livreursParCar?.car2_matin ? livreurMap.get(c.livreursParCar.car2_matin) : null;
      const cs = c.livreursParCar?.car_soir ? livreurMap.get(c.livreursParCar.car_soir) : null;
      const parts = [def && `Déf: ${def}`, c1 && `C1: ${c1}`, c2 && `C2: ${c2}`, cs && `Soir: ${cs}`].filter(Boolean);
      row.push(escapeCSV(parts.join(' | ')));
    }
    if (colonnesConfig.modePaiement) {
      row.push(escapeCSV(getModePaiementLabel(c.modePaiementPreference)));
    }
    if (colonnesConfig.statut) {
      row.push(escapeCSV(c.active ? 'Actif' : 'Inactif'));
    }
    if (colonnesConfig.conditionsPaiement) {
      row.push(escapeCSV(c.conditionsPaiement || (c.eligibleRistourne ? 'Ristourne' : 'Standard')));
    }
    if (colonnesConfig.coordonneesGps) {
      row.push(escapeCSV(c.latitude && c.longitude ? `${c.latitude}, ${c.longitude}` : ''));
    }

    lines.push(row.join(';'));
  });

  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const dateStr = new Date().toISOString().split('T')[0];
  link.setAttribute('download', `Export_Clients_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
