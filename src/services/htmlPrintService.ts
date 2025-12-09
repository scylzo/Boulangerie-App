/* eslint-disable @typescript-eslint/no-explicit-any */
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

export class HTMLPrintService {
  private formatDate(date: string): string {
    return new Date(date).toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  private getCarColor(car: CarLivraison): string {
    switch (car) {
      case 'car1_matin':
        return '#374151'; // gray-700
      case 'car2_matin':
        return '#4b5563'; // gray-600
      case 'car_soir':
        return '#1f2937'; // gray-800
      default:
        return '#4b5563'; // gray-600
    }
  }

  private getSigleProduit(nomProduit: string): string {
    const nom = nomProduit.toLowerCase().trim();

    // Sigles spécifiques pour les produits courants
    const siglesSpecifiques: Record<string, string> = {
      'pain au lait': 'PAL',
      'pain de mie': 'PDM',
      'pain complet': 'PC',
      'pain blanc': 'PB',
      'pain de campagne': 'PDC',
      'baguette': 'BAG',
      'baguette tradition': 'BAG-T',
      'croissant': 'CRO',
      'pain au chocolat': 'PAC',
      'chocolatine': 'CHO',
      'brioche': 'BRI',
      'viennoiserie': 'VIE',
      'tarte': 'TAR',
      'gâteau': 'GAT',
      'sandwich': 'SAN'
    };

    // Vérifier si on a un sigle spécifique
    if (siglesSpecifiques[nom]) {
      return siglesSpecifiques[nom];
    }

    // Sinon, créer un sigle à partir des initiales des mots
    const mots = nom.split(/\s+/);
    if (mots.length === 1) {
      // Un seul mot : prendre les 3 premières lettres en majuscules
      return nom.substring(0, 3).toUpperCase();
    } else {
      // Plusieurs mots : prendre la première lettre de chaque mot
      return mots.map(mot => mot[0]).join('').toUpperCase();
    }
  }

  private generateStyles(): string {
    return `
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          font-size: 10px;
          line-height: 1.3;
          color: #1f2937;
          background: white;
          padding: 8px;
        }
        
        .container {
          max-width: 100%;
          margin: 0 auto;
        }
        
        .header {
          text-align: center;
          margin-bottom: 8px;
          padding-bottom: 6px;
          border-bottom: 1px solid #e5e7eb;
        }
        
        .header h1 {
          font-size: 16px;
          font-weight: 700;
          color: #111827;
          margin-bottom: 2px;
        }
        
        .header .date {
          font-size: 11px;
          color: #6b7280;
          font-weight: 500;
        }
        
        .livreur-section {
          margin-bottom: 12px;
          page-break-inside: avoid;
        }
        
        .livreur-header {
          background: #f9fafb;
          padding: 6px 8px;
          border-left: 3px solid #4b5563;
          margin-bottom: 8px;
        }
        
        .livreur-header h2 {
          font-size: 13px;
          font-weight: 600;
          color: #111827;
          margin-bottom: 2px;
        }
        
        .livreur-header .info {
          font-size: 10px;
          color: #6b7280;
        }
        
        .car-section {
          margin-bottom: 10px;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          overflow: hidden;
          page-break-inside: avoid;
        }
        
        .car-header {
          color: white;
          padding: 5px 8px;
          font-weight: 600;
          font-size: 11px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .car-body {
          background: white;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
        }
        
        th {
          background: #f3f4f6;
          padding: 4px 6px;
          text-align: left;
          font-weight: 600;
          font-size: 9px;
          color: #374151;
          border-bottom: 1px solid #d1d5db;
        }
        
        td {
          padding: 4px 6px;
          border-bottom: 1px solid #e5e7eb;
          font-size: 9px;
          vertical-align: top;
        }
        
        tr:last-child td {
          border-bottom: none;
        }
        
        tr:hover {
          background: #f9fafb;
        }
        
        .summary {
          background: #374151;
          color: white;
          padding: 6px 8px;
          margin-top: 0;
          border-top: 1px solid #d1d5db;
        }
        
        .summary h4 {
          font-size: 10px;
          font-weight: 600;
          margin-bottom: 4px;
        }
        
        .summary-items {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }
        
        .summary-item {
          background: white;
          color: #111827;
          padding: 3px 6px;
          border-radius: 3px;
          font-size: 9px;
          font-weight: 500;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        
        .summary-item .count {
          background: #f3f4f6;
          padding: 1px 5px;
          border-radius: 8px;
          font-weight: 700;
        }
        
        .retours-column {
          width: 80px;
          min-height: 20px;
          border: 1px solid #d1d5db;
          border-radius: 3px;
          background: #fafafa;
        }
        
        .stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-bottom: 10px;
        }
        
        .stat-card {
          background: #f9fafb;
          padding: 6px 8px;
          border-radius: 4px;
          border-left: 3px solid #4b5563;
        }
        
        .stat-card .label {
          font-size: 8px;
          color: #6b7280;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        
        .stat-card .value {
          font-size: 18px;
          font-weight: 700;
          color: #111827;
          margin-top: 2px;
        }
        
        @media print {
          body {
            padding: 0;
            font-size: 9px;
          }
          
          .no-print {
            display: none !important;
          }
          
          .livreur-section {
            page-break-after: always;
          }
          
          .car-section {
            page-break-inside: avoid;
          }
          
          th {
            font-size: 8px;
            padding: 3px 5px;
          }
          
          td {
            font-size: 8px;
            padding: 3px 5px;
          }
          
          @page {
            margin: 8mm;
            size: A4;
          }
        }
      </style>
    `;
  }

  generateDeliveryReportHTML(
    dataLivreur: DataLivreur,
    dateSelectionnee: string
  ): void {
    const livreurNom = dataLivreur.livreur?.nom || 'Clients non assignés';

    let html = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Programme de Livraison - ${livreurNom}</title>
        ${this.generateStyles()}
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📦 Programme de Livraison</h1>
            <div class="date">${this.formatDate(dateSelectionnee)}</div>
          </div>
          
          <div class="livreur-section">
            <div class="livreur-header">
              <h2>${livreurNom}</h2>
              ${dataLivreur.livreur?.telephone ? `<div class="info">📞 ${dataLivreur.livreur.telephone}</div>` : ''}
              ${dataLivreur.livreur?.vehicule ? `<div class="info">🚗 ${dataLivreur.livreur.vehicule}</div>` : ''}
            </div>
    `;

    // Pour chaque car - Ordre défini : car1_matin, car2_matin, car_soir
    const ordresCars: CarLivraison[] = ['car1_matin', 'car2_matin', 'car_soir'];
    const carsEntries = Array.from(dataLivreur.commandesParCar.entries());
    const carsTries = carsEntries.sort(([carA], [carB]) => {
      return ordresCars.indexOf(carA) - ordresCars.indexOf(carB);
    });

    carsTries.forEach(([car, livraisons]) => {
      const carColor = this.getCarColor(car);

      // Grouper les livraisons par client
      const livraisonsParClient = new Map<string, { client: Client, produits: Map<string, number> }>();

      livraisons.forEach((livraison) => {
        const clientId = livraison.client?.id || 'inconnu';
        if (!livraisonsParClient.has(clientId)) {
          livraisonsParClient.set(clientId, {
            client: livraison.client,
            produits: new Map()
          });
        }
        const clientData = livraisonsParClient.get(clientId)!;
        const produitNom = livraison.produit?.nom || 'Produit inconnu';
        const quantiteActuelle = clientData.produits.get(produitNom) || 0;
        const nouvelleQuantite = Number(livraison.quantite) || 0;
        clientData.produits.set(produitNom, quantiteActuelle + nouvelleQuantite);
      });

      // Récupérer tous les produits uniques pour ce car
      const produitsUniques = Array.from(new Set(
        livraisons.map(liv => liv.produit?.nom || 'Produit inconnu')
      )).sort();

      html += `
            <div class="car-section">
              <div class="car-header" style="background-color: ${carColor};">
                <span>🚚 ${CARS_LIVRAISON[car]}</span>
                <span>${livraisonsParClient.size} client(s)</span>
              </div>
              
              <div class="car-body">
                <table>
                  <thead>
                    <tr>
                      <th style="width: 20%;">Client</th>
      `;

      // Ajouter une colonne pour chaque produit
      produitsUniques.forEach((produit) => {
        const sigle = this.getSigleProduit(produit);
        html += `<th style="text-align: center; width: ${70 / produitsUniques.length}%;" title="${produit}">${sigle}</th>`;
      });

      html += `
                      <th style="width: 10%;">Retours</th>
                    </tr>
                  </thead>
                  <tbody>
      `;

      // Afficher une ligne par client
      Array.from(livraisonsParClient.values()).forEach((clientData) => {
        html += `
                    <tr>
                      <td><strong>${clientData.client?.nom || 'Client inconnu'}</strong></td>
        `;

        // Afficher la quantité pour chaque produit
        produitsUniques.forEach((produit) => {
          const quantite = clientData.produits.get(produit) || 0;
          if (quantite > 0) {
            html += `<td style="text-align: center; font-weight: 700;">${quantite}</td>`;
          } else {
            html += `<td style="text-align: center; color: #d1d5db;">-</td>`;
          }
        });

        html += `
                      <td><div class="retours-column"></div></td>
                    </tr>
        `;
      });

      // Résumé du car - Calculer à partir des données groupées par client
      const resume: Record<string, number> = {};
      Array.from(livraisonsParClient.values()).forEach((clientData) => {
        clientData.produits.forEach((quantite, produitNom) => {
          resume[produitNom] = (resume[produitNom] || 0) + quantite;
        });
      });

      html += `
                  </tbody>
                </table>
              </div>
              
              <div class="summary" style="background-color: ${carColor};">
                <h4>📊 Résumé ${CARS_LIVRAISON[car]}</h4>
                <div class="summary-items">
      `;

      Object.entries(resume).forEach(([produit, total]) => {
        const sigle = this.getSigleProduit(produit);
        html += `
                  <div class="summary-item">
                    <span><strong>${sigle}</strong> - ${produit}</span>
                    <span class="count">${total}</span>
                  </div>
        `;
      });

      html += `
                </div>
              </div>
            </div>
      `;
    });

    html += `
          </div>
          
          <div class="no-print" style="text-align: center; margin-top: 30px; padding: 20px; background: #f3f4f6; border-radius: 8px;">
            <button onclick="window.print()" style="background: #4b5563; color: white; padding: 12px 24px; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer;">
              🖨️ Imprimer ce document
            </button>
            <button onclick="window.close()" style="background: #9ca3af; color: white; padding: 12px 24px; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; margin-left: 12px;">
              ✕ Fermer
            </button>
          </div>
        </div>
      </body>
      </html>
    `;

    // Ouvrir dans une nouvelle fenêtre
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }
  }

  generateGlobalReportHTML(
    commandesOrganisees: [string, DataLivreur][],
    dateSelectionnee: string
  ): void {
    const totalLivreurs = commandesOrganisees.length;
    const totalLivraisons = commandesOrganisees.reduce((total, [, data]) =>
      total + Array.from(data.commandesParCar.values()).reduce((sum, livraisons) => sum + livraisons.length, 0), 0
    );
    const totalClients = Array.from(new Set(
      commandesOrganisees.flatMap(([, data]) =>
        Array.from(data.commandesParCar.values()).flat().map(liv => liv.client?.id)
      )
    )).length;

    let html = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Rapport Global de Livraison</title>
        ${this.generateStyles()}
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🍞 Rapport Global de Livraison</h1>
            <div class="date">${this.formatDate(dateSelectionnee)}</div>
          </div>
          
          <div class="stats">
            <div class="stat-card">
              <div class="label">Livreurs Actifs</div>
              <div class="value">${totalLivreurs}</div>
            </div>
            <div class="stat-card">
              <div class="label">Total Livraisons</div>
              <div class="value">${totalLivraisons}</div>
            </div>
            <div class="stat-card">
              <div class="label">Clients à Livrer</div>
              <div class="value">${totalClients}</div>
            </div>
          </div>
    `;

    // Pour chaque livreur
    commandesOrganisees.forEach(([, dataLivreur]) => {
      const livreurNom = dataLivreur.livreur?.nom || 'Clients non assignés';

      html += `
          <div class="livreur-section">
            <div class="livreur-header">
              <h2>${livreurNom}</h2>
              ${dataLivreur.livreur?.telephone ? `<div class="info">📞 ${dataLivreur.livreur.telephone}</div>` : ''}
              ${dataLivreur.livreur?.vehicule ? `<div class="info">🚗 ${dataLivreur.livreur.vehicule}</div>` : ''}
            </div>
      `;

      // Pour chaque car du livreur - Ordre défini : car1_matin, car2_matin, car_soir
      const ordresCars: CarLivraison[] = ['car1_matin', 'car2_matin', 'car_soir'];
      const carsEntries = Array.from(dataLivreur.commandesParCar.entries());
      const carsTries = carsEntries.sort(([carA], [carB]) => {
        return ordresCars.indexOf(carA) - ordresCars.indexOf(carB);
      });

      carsTries.forEach(([car, livraisons]) => {
        const carColor = this.getCarColor(car);

        // Grouper les livraisons par client
        const livraisonsParClient = new Map<string, { client: Client, produits: Map<string, number> }>();

        livraisons.forEach((livraison) => {
          const clientId = livraison.client?.id || 'inconnu';
          if (!livraisonsParClient.has(clientId)) {
            livraisonsParClient.set(clientId, {
              client: livraison.client,
              produits: new Map()
            });
          }
          const clientData = livraisonsParClient.get(clientId)!;
          const produitNom = livraison.produit?.nom || 'Produit inconnu';
          const quantiteActuelle = clientData.produits.get(produitNom) || 0;
          const nouvelleQuantite = Number(livraison.quantite) || 0;
          clientData.produits.set(produitNom, quantiteActuelle + nouvelleQuantite);
        });

        // Récupérer tous les produits uniques pour ce car
        const produitsUniques = Array.from(new Set(
          livraisons.map(liv => liv.produit?.nom || 'Produit inconnu')
        )).sort();

        html += `
            <div class="car-section">
              <div class="car-header" style="background-color: ${carColor};">
                <span>🚚 ${CARS_LIVRAISON[car]}</span>
                <span>${livraisonsParClient.size} client(s)</span>
              </div>
              
              <div class="car-body">
                <table>
                  <thead>
                    <tr>
                      <th style="width: 20%;">Client</th>
        `;

        // Ajouter une colonne pour chaque produit
        produitsUniques.forEach((produit) => {
          const sigle = this.getSigleProduit(produit);
          html += `<th style="text-align: center; width: ${70 / produitsUniques.length}%;" title="${produit}">${sigle}</th>`;
        });

        html += `
                      <th style="width: 10%;">Retours</th>
                    </tr>
                  </thead>
                  <tbody>
        `;

        // Afficher une ligne par client
        Array.from(livraisonsParClient.values()).forEach((clientData) => {
          html += `
                    <tr>
                      <td><strong>${clientData.client?.nom || 'Client inconnu'}</strong></td>
          `;

          // Afficher la quantité pour chaque produit
          produitsUniques.forEach((produit) => {
            const quantite = clientData.produits.get(produit) || 0;
            if (quantite > 0) {
              html += `<td style="text-align: center; font-weight: 700;">${quantite}</td>`;
            } else {
              html += `<td style="text-align: center; color: #d1d5db;">-</td>`;
            }
          });

          html += `
                      <td><div class="retours-column"></div></td>
                    </tr>
          `;
        });

        // Résumé du car - Calculer à partir des données groupées par client
        const resume: Record<string, number> = {};
        Array.from(livraisonsParClient.values()).forEach((clientData) => {
          clientData.produits.forEach((quantite, produitNom) => {
            resume[produitNom] = (resume[produitNom] || 0) + quantite;
          });
        });

        html += `
                  </tbody>
                </table>
              </div>
              
              <div class="summary" style="background-color: ${carColor};">
                <h4>📊 Résumé ${CARS_LIVRAISON[car]}</h4>
                <div class="summary-items">
        `;

        Object.entries(resume).forEach(([produit, total]) => {
          const sigle = this.getSigleProduit(produit);
          html += `
                  <div class="summary-item">
                    <span><strong>${sigle}</strong> - ${produit}</span>
                    <span class="count">${total}</span>
                  </div>
          `;
        });

        html += `
                </div>
              </div>
            </div>
        `;
      });

      html += `
          </div>
      `;
    });

    html += `
          <div class="no-print" style="text-align: center; margin-top: 30px; padding: 20px; background: #f3f4f6; border-radius: 8px;">
            <button onclick="window.print()" style="background: #4b5563; color: white; padding: 12px 24px; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer;">
              🖨️ Imprimer ce document
            </button>
            <button onclick="window.close()" style="background: #9ca3af; color: white; padding: 12px 24px; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; margin-left: 12px;">
              ✕ Fermer
            </button>
          </div>
        </div>
      </body>
      </html>
    `;

    // Ouvrir dans une nouvelle fenêtre
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }
  }
}

export const htmlPrintService = new HTMLPrintService();
