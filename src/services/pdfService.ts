import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CommandeClient, Client, Produit, Livreur, ProgrammeProduction } from '../types';
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

  generateProductionReport(
    programme: ProgrammeProduction,
    produits: Produit[]
  ): void {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const margin = 20;
    let yPosition = margin;

    // En-tête principal
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('🥖 PROGRAMME DE PRODUCTION', pageWidth / 2, yPosition, { align: 'center' });

    yPosition += 15;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(this.formatDate(programme.dateProduction.toISOString()), pageWidth / 2, yPosition, { align: 'center' });

    // Statut
    yPosition += 10;
    doc.setFontSize(10);
    const statutText = programme.statut === 'envoye' ? '✅ CONFIRMÉ' :
                     programme.statut === 'modifie' ? '🔄 MODIFIÉ' :
                     programme.statut === 'produit' ? '✅ PRODUIT' : '⏳ BROUILLON';
    doc.text(`Statut: ${statutText}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 20;

    // Calcul des totaux
    const totalClients = programme.totauxParProduit?.reduce((acc, p) =>
      acc + (p.repartitionCar1Matin || 0) + (p.repartitionCar2Matin || 0) + (p.repartitionCarSoir || 0), 0) || 0;
    const totalBoutique = programme.quantitesBoutique?.reduce((acc, q) => acc + q.quantite, 0) || 0;
    const totalGeneral = totalClients + totalBoutique;

    // Résumé global
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('📊 RÉSUMÉ DE PRODUCTION', margin, yPosition);
    yPosition += 15;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`• Production Clients: ${totalClients} pièces`, margin + 5, yPosition);
    yPosition += 8;
    doc.text(`• Production Boutique: ${totalBoutique} pièces`, margin + 5, yPosition);
    yPosition += 8;
    doc.setFont('helvetica', 'bold');
    doc.text(`• TOTAL GÉNÉRAL: ${totalGeneral} pièces`, margin + 5, yPosition);
    yPosition += 25;

    // Section 1: Production Clients
    if (programme.totauxParProduit && programme.totauxParProduit.length > 0) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('👥 PRODUCTION CLIENTS', margin, yPosition);
      yPosition += 15;

      const clientsData: any[] = [];
      programme.totauxParProduit.forEach(total => {
        const produit = produits.find(p => p.id === total.produitId);
        if (produit && (total.repartitionCar1Matin > 0 || total.repartitionCar2Matin > 0 || total.repartitionCarSoir > 0)) {
          clientsData.push([
            produit.nom,
            total.repartitionCar1Matin > 0 ? total.repartitionCar1Matin.toString() : '-',
            total.repartitionCar2Matin > 0 ? total.repartitionCar2Matin.toString() : '-',
            total.repartitionCarSoir > 0 ? total.repartitionCarSoir.toString() : '-',
            (total.repartitionCar1Matin + total.repartitionCar2Matin + total.repartitionCarSoir).toString()
          ]);
        }
      });

      if (clientsData.length > 0) {
        autoTable(doc, {
          head: [['Produit', 'Car 1 Matin', 'Car 2 Matin', 'Car Soir', 'Total']],
          body: clientsData,
          startY: yPosition,
          styles: {
            fontSize: 9,
            cellPadding: 3,
          },
          headStyles: {
            fillColor: [100, 100, 100],
            textColor: 255,
            fontStyle: 'bold'
          },
          alternateRowStyles: {
            fillColor: [245, 245, 245]
          },
          columnStyles: {
            0: { cellWidth: 50 },
            1: { halign: 'center', cellWidth: 25 },
            2: { halign: 'center', cellWidth: 25 },
            3: { halign: 'center', cellWidth: 25 },
            4: { halign: 'center', cellWidth: 25, fontStyle: 'bold' }
          },
          margin: { left: margin, right: margin }
        });

        yPosition = (doc as any).lastAutoTable.finalY + 20;
      }
    }

    // Section 2: Production Boutique
    if (programme.quantitesBoutique && programme.quantitesBoutique.length > 0) {
      if (yPosition > 220) { // Nouvelle page si nécessaire
        doc.addPage();
        yPosition = margin;
      }

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('🏪 PRODUCTION BOUTIQUE', margin, yPosition);
      yPosition += 15;

      const boutiqueData: any[] = [];
      programme.quantitesBoutique.forEach(quantite => {
        const produit = produits.find(p => p.id === quantite.produitId);
        if (produit) {
          const repartition = quantite.repartitionCars;
          boutiqueData.push([
            produit.nom,
            quantite.quantite.toString(),
            repartition?.car1_matin ? repartition.car1_matin.toString() : '-',
            repartition?.car2_matin ? repartition.car2_matin.toString() : '-',
            repartition?.car_soir ? repartition.car_soir.toString() : '-'
          ]);
        }
      });

      if (boutiqueData.length > 0) {
        autoTable(doc, {
          head: [['Produit', 'Total', 'Car 1M', 'Car 2M', 'Car S']],
          body: boutiqueData,
          startY: yPosition,
          styles: {
            fontSize: 9,
            cellPadding: 3,
          },
          headStyles: {
            fillColor: [59, 130, 246],
            textColor: 255,
            fontStyle: 'bold'
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252]
          },
          columnStyles: {
            0: { cellWidth: 60 },
            1: { halign: 'center', cellWidth: 25, fontStyle: 'bold' },
            2: { halign: 'center', cellWidth: 20 },
            3: { halign: 'center', cellWidth: 20 },
            4: { halign: 'center', cellWidth: 20 }
          },
          margin: { left: margin, right: margin }
        });
      }
    }

    // Pied de page avec informations
    const currentDate = new Date();
    const footerY = doc.internal.pageSize.height - 20;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Document généré le ${currentDate.toLocaleDateString('fr-FR')} à ${currentDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
      pageWidth / 2, footerY, { align: 'center' });
    doc.text('Boulangerie App - Programme de Production', pageWidth / 2, footerY + 5, { align: 'center' });

    // Télécharger le PDF
    const dateString = programme.dateProduction.toISOString().split('T')[0];
    const fileName = `programme_production_${dateString}.pdf`;
    doc.save(fileName);
  }
}

export const pdfService = new PDFService();