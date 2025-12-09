import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CommandeClient, Client, Produit, Livreur } from '../types';
import type { CarLivraison } from '../types';
import { CARS_LIVRAISON } from '../types/production';

interface LivraisonData {
  commande: CommandeClient;
  client: Client;
  produit: Produit;
  quantite: number;
}

interface DataLivreur {
  livreur: Livreur | null;
  commandesParCar: Map<CarLivraison, LivraisonData[]>;
}

export class PDFService {
  private formatDate(date: string): string {
    return new Date(date).toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }


  generateDeliveryReport(
    _livreurId: string,
    dataLivreur: DataLivreur,
    dateSelectionnee: string
  ): void {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const margin = 20;
    let yPosition = margin;

    // En-tête simple
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('PROGRAMME DE LIVRAISON', pageWidth / 2, yPosition, { align: 'center' });

    yPosition += 15;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(this.formatDate(dateSelectionnee), pageWidth / 2, yPosition, { align: 'center' });

    // Nom du livreur
    yPosition += 20;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    const livreurNom = dataLivreur.livreur
      ? dataLivreur.livreur.nom
      : 'Clients non assignes';

    doc.text(`LIVREUR: ${livreurNom}`, margin, yPosition);
    yPosition += 20;

    // Tableau global de toutes les livraisons
    const allLivraisons: any[] = [];

    Array.from(dataLivreur.commandesParCar.entries()).forEach(([car, livraisons]) => {
      livraisons.forEach((livraison) => {
        allLivraisons.push([
          livraison.client?.nom || 'Client inconnu',
          livraison.produit?.nom || 'Produit inconnu',
          livraison.quantite.toString(),
          CARS_LIVRAISON[car],
          '' // Colonne retours vide
        ]);
      });
    });

    if (allLivraisons.length > 0) {
      autoTable(doc, {
        head: [['Client', 'Produit', 'Quantite', 'Car', 'Retours']],
        body: allLivraisons,
        startY: yPosition,
        styles: {
          fontSize: 10,
          cellPadding: 4,
        },
        headStyles: {
          fillColor: [150, 150, 150],
          textColor: 255,
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245]
        },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 35 },
          2: { halign: 'center', cellWidth: 25 },
          3: { cellWidth: 30 },
          4: { cellWidth: 45 } // Colonne retours plus large pour l'écriture
        },
        margin: { left: margin, right: margin }
      });
    }

    // Télécharger le PDF
    const fileName = `livraison_${livreurNom.replace(/[^a-zA-Z0-9]/g, '_')}_${dateSelectionnee}.pdf`;
    doc.save(fileName);
  }

  generateGlobalDeliveryReport(
    commandesOrganisees: [string, DataLivreur][],
    dateSelectionnee: string
  ): void {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const margin = 20;
    let yPosition = margin;

    // En-tête principal
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('🍞 RAPPORT GLOBAL DE LIVRAISON', pageWidth / 2, yPosition, { align: 'center' });

    yPosition += 15;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(this.formatDate(dateSelectionnee), pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 25;

    // Statistiques globales
    const totalLivreurs = commandesOrganisees.length;
    const totalLivraisons = commandesOrganisees.reduce((total, [, data]) =>
      total + Array.from(data.commandesParCar.values()).reduce((sum, livraisons) => sum + livraisons.length, 0), 0
    );
    const totalClients = Array.from(new Set(
      commandesOrganisees.flatMap(([, data]) =>
        Array.from(data.commandesParCar.values()).flat().map(liv => liv.client?.id)
      )
    )).length;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('📊 STATISTIQUES GLOBALES', margin, yPosition);
    yPosition += 15;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`• ${totalLivreurs} livreur(s) actif(s)`, margin + 5, yPosition);
    yPosition += 8;
    doc.text(`• ${totalLivraisons} livraison(s) programmée(s)`, margin + 5, yPosition);
    yPosition += 8;
    doc.text(`• ${totalClients} client(s) à livrer`, margin + 5, yPosition);
    yPosition += 20;

    // Tableau récapitulatif par livreur
    const tableData = commandesOrganisees.map(([_livreurId, data]) => {
      const livreurNom = data.livreur?.nom || 'Non assigné';
      const nbCars = data.commandesParCar.size;
      const nbLivraisons = Array.from(data.commandesParCar.values())
        .reduce((total, livraisons) => total + livraisons.length, 0);

      return [
        livreurNom,
        data.livreur?.vehicule || '-',
        data.livreur?.telephone || '-',
        nbCars.toString(),
        nbLivraisons.toString()
      ];
    });

    autoTable(doc, {
      head: [['Livreur', 'Véhicule', 'Téléphone', 'Cars', 'Livraisons']],
      body: tableData,
      startY: yPosition,
      styles: {
        fontSize: 10,
        cellPadding: 4,
      },
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      margin: { left: margin, right: margin }
    });

    // Télécharger le PDF
    const fileName = `rapport_global_livraisons_${dateSelectionnee}.pdf`;
    doc.save(fileName);
  }
}

export const pdfService = new PDFService();