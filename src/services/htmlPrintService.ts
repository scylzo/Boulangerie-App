/* eslint-disable @typescript-eslint/no-explicit-any */
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
          font-size: 14px;
          line-height: 1.4;
          color: #1f2937;
          background: white;
          padding: 12px;
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
          font-size: 20px;
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
            <div class="logo">
              <img src="/src/assets/logo.png" alt="Boulangerie Chez Mina" style="height: 60px; margin: 0 auto 8px auto; display: block;" />
            </div>
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
            <div class="logo">
              <img src="/src/assets/logo.png" alt="Boulangerie Chez Mina" style="height: 60px; margin: 0 auto 8px auto; display: block;" />
            </div>
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

  generateProductionReportHTML(
    programme: ProgrammeProduction,
    produits: Produit[]
  ): void {
    // Calcul des totaux (totauxParProduit contient déjà clients + boutique)
    const totalClients = programme.totauxParProduit?.reduce((acc, p) => acc + p.totalClient, 0) || 0;
    const totalBoutique = programme.totauxParProduit?.reduce((acc, p) => acc + p.totalBoutique, 0) || 0;
    const totalGeneral = programme.totauxParProduit?.reduce((acc, p) => acc + p.totalGlobal, 0) || 0;

    // Produits avec quantités matin
    const produitsMatin = programme.totauxParProduit?.filter(p =>
      (p.repartitionCar1Matin + p.repartitionCar2Matin) > 0) || [];

    // Produits avec quantités soir
    const produitsSoir = programme.totauxParProduit?.filter(p =>
      p.repartitionCarSoir > 0) || [];

    const statutText = programme.statut === 'envoye' ? '✅ CONFIRMÉ' :
                      programme.statut === 'modifie' ? '🔄 MODIFIÉ' :
                      programme.statut === 'produit' ? '✅ PRODUIT' : '⏳ BROUILLON';

    let html = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Programme de Production</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            font-size: 11px;
            line-height: 1.4;
            color: #1f2937;
            background: white;
            padding: 12px;
          }

          .container {
            max-width: 100%;
            margin: 0 auto;
          }

          .header {
            text-align: center;
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 2px solid #374151;
          }

          .header .logo {
            margin-bottom: 8px;
          }

          .header .logo img {
            height: 60px;
            margin: 0 auto;
            display: block;
          }

          .header h1 {
            font-size: 20px;
            font-weight: 700;
            color: #111827;
            margin-bottom: 4px;
          }

          .header .date {
            font-size: 13px;
            color: #6b7280;
            font-weight: 500;
            margin-bottom: 2px;
          }

          .header .status {
            font-size: 12px;
            font-weight: 600;
            padding: 4px 8px;
            border-radius: 4px;
            display: inline-block;
            background: #f3f4f6;
            color: #374151;
          }

          .stats {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin-bottom: 20px;
            background: #374151;
            padding: 16px;
            border-radius: 8px;
            color: white;
          }

          .stat-card {
            text-align: center;
          }

          .stat-card .label {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
            opacity: 0.8;
          }

          .stat-card .value {
            font-size: 24px;
            font-weight: 700;
          }

          .stat-card .unit {
            font-size: 11px;
            opacity: 0.8;
          }

          .section {
            margin-bottom: 24px;
            page-break-inside: avoid;
          }

          .section-header {
            background: #f9fafb;
            padding: 8px 12px;
            border-left: 4px solid #4b5563;
            margin-bottom: 12px;
            border-radius: 4px;
          }

          .section-header.matin {
            border-left-color: #f59e0b;
            background: #fffbeb;
          }

          .section-header.soir {
            border-left-color: #6366f1;
            background: #eef2ff;
          }

          .section-header.boutique {
            border-left-color: #059669;
            background: #ecfdf5;
          }

          .section-header h2 {
            font-size: 16px;
            font-weight: 600;
            color: #111827;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .products-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 12px;
          }

          .product-card {
            border: 1px solid #d1d5db;
            border-radius: 6px;
            overflow: hidden;
            page-break-inside: avoid;
          }

          .product-header {
            background: #374151;
            color: white;
            padding: 8px 12px;
            font-weight: 600;
            font-size: 12px;
          }

          .product-header.matin {
            background: #f59e0b;
          }

          .product-header.soir {
            background: #6366f1;
          }

          .product-header.boutique {
            background: #059669;
          }

          .product-body {
            padding: 12px;
          }

          .car-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 4px 0;
            border-bottom: 1px solid #f3f4f6;
          }

          .car-row:last-child {
            border-bottom: none;
          }

          .car-label {
            font-size: 10px;
            color: #6b7280;
            font-weight: 500;
          }

          .car-value {
            font-size: 14px;
            font-weight: 700;
            color: #111827;
          }

          .total-row {
            margin-top: 8px;
            padding-top: 8px;
            border-top: 2px solid #e5e7eb;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .total-label {
            font-size: 11px;
            font-weight: 600;
            color: #374151;
          }

          .total-value {
            font-size: 18px;
            font-weight: 700;
            color: #111827;
          }

          .soir-total {
            text-align: center;
            padding: 20px;
            background: #f8fafc;
            border-radius: 8px;
          }

          .soir-total .value {
            font-size: 32px;
            font-weight: 700;
            color: #111827;
            margin-bottom: 4px;
          }

          .soir-total .label {
            font-size: 12px;
            color: #6b7280;
          }

          .footer {
            margin-top: 40px;
            padding-top: 16px;
            border-top: 1px solid #d1d5db;
            text-align: center;
            font-size: 9px;
            color: #6b7280;
          }

          @media print {
            body {
              padding: 8px;
              font-size: 10px;
            }

            .no-print {
              display: none !important;
            }

            .section {
              page-break-inside: avoid;
            }

            .products-grid {
              grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
              gap: 8px;
            }

            @page {
              margin: 8mm;
              size: A4;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">
              <img src="/src/assets/logo.png" alt="Boulangerie Chez Mina" />
            </div>
            <h1>🥖 Programme de Production</h1>
            <div class="date">
              Production : ${(() => {
                // Correction pour les anciens programmes
                const dateCreation = programme.dateCreation;
                const dateProduction = programme.dateProduction;
                const sameDay = dateCreation.toDateString() === dateProduction.toDateString();

                if (sameDay) {
                  const correctedDate = new Date(dateProduction);
                  correctedDate.setDate(correctedDate.getDate() + 1);
                  return correctedDate.toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  });
                } else {
                  return dateProduction.toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  });
                }
              })()}
            </div>
            <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">
              Programme créé le ${programme.dateCreation.toLocaleDateString('fr-FR')} à ${programme.dateCreation.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div class="status">${statutText}</div>
          </div>

          <div class="stats">
            <div class="stat-card">
              <div class="label">Production Clients</div>
              <div class="value">${totalClients}</div>
              <div class="unit">pièces</div>
            </div>
            <div class="stat-card">
              <div class="label">Production Boutique</div>
              <div class="value">${totalBoutique}</div>
              <div class="unit">pièces</div>
            </div>
            <div class="stat-card">
              <div class="label">Total Général</div>
              <div class="value">${totalGeneral}</div>
              <div class="unit">pièces</div>
            </div>
          </div>
    `;

    // Section Production Clients - Matin
    if (produitsMatin.length > 0) {
      html += `
          <div class="section">
            <div class="section-header matin">
              <h2>☀️ Production Clients - Matin</h2>
            </div>
            <div class="products-grid">
      `;

      produitsMatin.forEach(produitTotal => {
        const produit = produits.find(p => p.id === produitTotal.produitId);
        const car1 = produitTotal.repartitionCar1Matin;
        const car2 = produitTotal.repartitionCar2Matin;
        const total = car1 + car2;

        html += `
              <div class="product-card">
                <div class="product-header matin">${produit?.nom || 'Produit'}</div>
                <div class="product-body">
                  <div class="car-row">
                    <span class="car-label">Car 1</span>
                    <span class="car-value">${car1}</span>
                  </div>
                  <div class="car-row">
                    <span class="car-label">Car 2</span>
                    <span class="car-value">${car2}</span>
                  </div>
                  <div class="total-row">
                    <span class="total-label">Total Matin</span>
                    <span class="total-value">${total}</span>
                  </div>
                </div>
              </div>
        `;
      });

      html += `
            </div>
          </div>
      `;
    }

    // Section Production Clients - Soir
    if (produitsSoir.length > 0) {
      html += `
          <div class="section">
            <div class="section-header soir">
              <h2>🌙 Production Clients - Soir</h2>
            </div>
            <div class="products-grid">
      `;

      produitsSoir.forEach(produitTotal => {
        const produit = produits.find(p => p.id === produitTotal.produitId);
        const total = produitTotal.repartitionCarSoir;

        html += `
              <div class="product-card">
                <div class="product-header soir">${produit?.nom || 'Produit'}</div>
                <div class="product-body">
                  <div class="soir-total">
                    <div class="value">${total}</div>
                    <div class="label">pièces</div>
                  </div>
                </div>
              </div>
        `;
      });

      html += `
            </div>
          </div>
      `;
    }

    // Section Production Boutique
    if (programme.quantitesBoutique && programme.quantitesBoutique.length > 0) {
      html += `
          <div class="section">
            <div class="section-header boutique">
              <h2>🏪 Production Boutique</h2>
            </div>
            <div class="products-grid">
      `;

      programme.quantitesBoutique.forEach(quantite => {
        const produit = produits.find(p => p.id === quantite.produitId);
        const repartition = quantite.repartitionCars;

        html += `
              <div class="product-card">
                <div class="product-header boutique">${produit?.nom || 'Produit'}</div>
                <div class="product-body">
                  <div class="total-row" style="margin-top: 0; padding-top: 0; border-top: none;">
                    <span class="total-label">Total Boutique</span>
                    <span class="total-value">${quantite.quantite}</span>
                  </div>
        `;

        if (repartition) {
          html += `
                  <div style="margin-top: 12px; padding-top: 8px; border-top: 1px solid #e5e7eb;">
                    <div style="font-size: 9px; color: #6b7280; margin-bottom: 6px; font-weight: 600;">RÉPARTITION:</div>
          `;

          if (repartition.car1_matin > 0) {
            html += `
                    <div class="car-row">
                      <span class="car-label">Car 1 Matin</span>
                      <span class="car-value">${repartition.car1_matin}</span>
                    </div>
            `;
          }

          if (repartition.car2_matin > 0) {
            html += `
                    <div class="car-row">
                      <span class="car-label">Car 2 Matin</span>
                      <span class="car-value">${repartition.car2_matin}</span>
                    </div>
            `;
          }

          if (repartition.car_soir > 0) {
            html += `
                    <div class="car-row">
                      <span class="car-label">Car Soir</span>
                      <span class="car-value">${repartition.car_soir}</span>
                    </div>
            `;
          }

          html += `
                  </div>
          `;
        }

        html += `
                </div>
              </div>
        `;
      });

      html += `
            </div>
          </div>
      `;
    }

    const currentDate = new Date();
    html += `
          <div class="footer">
            Document généré le ${currentDate.toLocaleDateString('fr-FR')} à ${currentDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            <br>
            Boulangerie Chez Mina - Programme de Production
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

  generateDeliveryReceiptHTML(
    commande: any,
    client: any,
    produits: any[]
  ): void {
    console.log('🧾 Génération bon de livraison - Données reçues:', {
      commande: commande ? 'OK' : 'MANQUANT',
      client: client ? 'OK' : 'MANQUANT',
      produits: produits ? `${produits.length} produits` : 'MANQUANT'
    });

    if (!commande) {
      console.error('❌ Commande manquante pour générer le bon de livraison');
      alert('Erreur: Impossible de générer le bon de livraison - commande manquante');
      return;
    }

    if (!client) {
      console.error('❌ Client manquant pour générer le bon de livraison');
      alert('Erreur: Impossible de générer le bon de livraison - client manquant');
      return;
    }

    const total = commande.produits.reduce((acc: number, item: any) =>
      acc + (item.quantiteCommandee * (item.prixUnitaire || 0)), 0);

    const currentDate = new Date();
    const dateLivraison = new Date(commande.dateLivraison);

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bon de Livraison - ${client?.nom || 'Client'}</title>
        <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>
        ${this.generateStyles()}
        <style>
          .delivery-header {
            text-align: center;
            background: #6b7280;
            color: white;
            padding: 20px;
            border-radius: 10px 10px 0 0;
            margin-bottom: 20px;
          }

          .client-info, .order-info {
            background: #f8fafc;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 15px;
            border-left: 4px solid #374151;
          }

          .products-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            background: white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }

          .products-table th {
            background: #f3f4f6;
            padding: 15px;
            text-align: left;
            border-bottom: 2px solid #d1d5db;
            font-weight: 600;
            font-size: 15px;
          }

          .products-table td {
            padding: 12px 15px;
            border-bottom: 1px solid #d1d5db;
            font-size: 15px;
          }

          .total-section {
            background: #f9fafb;
            padding: 15px;
            border-radius: 8px;
            text-align: right;
            margin-top: 20px;
            border: 2px solid #374151;
          }

          .signature-section {
            display: flex;
            justify-content: space-between;
            margin-top: 40px;
            gap: 40px;
          }

          .signature-box {
            flex: 1;
            border: 2px dashed #d1d5db;
            height: 80px;
            border-radius: 8px;
            text-align: center;
            padding: 10px;
            color: #6b7280;
          }

          .icon {
            display: inline-block;
            width: 16px;
            height: 16px;
            vertical-align: middle;
            margin-right: 6px;
          }

          .section-title {
            display: flex;
            align-items: center;
            margin-bottom: 10px;
            font-weight: 600;
          }

          .section-title .icon {
            margin-right: 8px;
            color: #374151;
          }

          /* Styles pour les boutons d'impression */
          .print-buttons {
            text-align: center;
            margin-top: 30px;
            padding: 20px;
            background: #f3f4f6;
            border-radius: 8px;
            border-top: 1px solid #d1d5db;
          }

          .print-btn {
            background: #374151;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            margin: 0 6px;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            transition: background-color 0.2s;
          }

          .print-btn:hover {
            background: #4b5563;
          }

          .print-btn.secondary {
            background: #9ca3af;
          }

          .print-btn.secondary:hover {
            background: #6b7280;
          }

          /* Styles d'impression */
          @media print {
            @page {
              margin: 15mm;
              size: A4;
            }

            body {
              font-size: 12pt;
              line-height: 1.4;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            .delivery-header {
              background: #6b7280 !important;
              color: white !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            .client-info, .order-info {
              background: #f8fafc !important;
              border-left: 4px solid #374151 !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            .products-table th {
              background: #f3f4f6 !important;
              border-bottom: 2px solid #374151 !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            .products-table td {
              border-bottom: 1px solid #d1d5db !important;
            }

            .total-section {
              background: #f9fafb !important;
              border: 2px solid #374151 !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            .signature-box {
              border: 2px dashed #374151 !important;
              background: white !important;
            }

            /* Masquer les boutons d'impression lors de l'impression */
            .no-print, .print-buttons {
              display: none !important;
            }

            /* Éviter les coupures de page dans les sections */
            .client-info, .order-info, .total-section {
              page-break-inside: avoid;
            }

            /* Garder le tableau ensemble si possible */
            .products-table {
              page-break-inside: auto;
            }

            .products-table tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="delivery-header">
            <div class="logo">
              <img src="/src/assets/logo.png" alt="Boulangerie Chez Mina" style="height: 50px; margin-bottom: 10px;" />
            </div>
            <h1><i data-lucide="clipboard-list" class="icon"></i>BON DE LIVRAISON</h1>
            <p>N° ${commande.id.slice(-8).toUpperCase()}</p>
          </div>

          <div class="client-info">
            <h3 class="section-title"><i data-lucide="user" class="icon"></i>INFORMATIONS CLIENT</h3>
            <p><strong>Nom :</strong> ${client?.nom || 'Non spécifié'}</p>
            <p><strong>Téléphone :</strong> ${client?.telephone || 'Non spécifié'}</p>
            <p><strong>Adresse :</strong> ${client?.adresse || 'Non spécifiée'}</p>
            <p><strong>Livreur :</strong> ${client?.livreur || 'Non assigné'}</p>
          </div>

          <div class="order-info">
            <h3 class="section-title"><i data-lucide="calendar" class="icon"></i>INFORMATIONS COMMANDE</h3>
            <p><strong>Date de livraison :</strong> ${dateLivraison.toLocaleDateString('fr-FR')}</p>
            <p><strong>Date d'impression :</strong> ${currentDate.toLocaleDateString('fr-FR')} à ${currentDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
            <p><strong>Statut :</strong> <span style="color: #374151; font-weight: bold;">À LIVRER</span></p>
          </div>

          <table class="products-table">
            <thead>
              <tr>
                <th>Produit</th>
                <th style="text-align: center">Quantité</th>
                <th style="text-align: right">Prix unitaire</th>
                <th style="text-align: right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${commande.produits.map((item: any) => {
                const produit = produits.find(p => p.id === item.produitId);
                const sousTotal = item.quantiteCommandee * (item.prixUnitaire || 0);
                return `
                  <tr>
                    <td><strong>${produit?.nom || 'Produit inconnu'}</strong></td>
                    <td style="text-align: center">${item.quantiteCommandee}</td>
                    <td style="text-align: right">${(item.prixUnitaire || 0).toLocaleString('fr-FR')} FCFA</td>
                    <td style="text-align: right"><strong>${sousTotal.toLocaleString('fr-FR')} FCFA</strong></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="total-section">
            <h3><i data-lucide="banknote" class="icon"></i>TOTAL À PAYER : ${total.toLocaleString('fr-FR')} FCFA</h3>
          </div>

          <div class="signature-section">
            <div class="signature-box">
              <strong>Signature Livreur</strong>
              <br><small>Date et heure :</small>
            </div>
            <div class="signature-box">
              <strong>Signature Client</strong>
              <br><small>Nom et signature :</small>
            </div>
          </div>

          <div class="footer" style="text-align: left; margin-top: 30px;">
            <p style="font-size: 16px; font-weight: 600; color: #374151; margin-bottom: 8px;">
              Merci de votre confiance !
            </p>
            <p style="font-size: 0.8em; color: #6b7280;">
              Document généré le ${currentDate.toLocaleDateString('fr-FR')} à ${currentDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              <br>
              Boulangerie Chez Mina - Bon de Livraison
            </p>
          </div>

          <div class="print-buttons">
            <button onclick="window.print()" class="print-btn">
              <i data-lucide="printer"></i>
              Imprimer ce document
            </button>
            <button onclick="window.close()" class="print-btn secondary">
              <i data-lucide="x"></i>
              Fermer
            </button>
          </div>
        </div>
        <script>
          lucide.createIcons();
        </script>
      </body>
      </html>
    `;

    console.log('🔄 Tentative d\'ouverture de la fenêtre d\'impression...');
    try {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        console.log('✅ Fenêtre ouverte avec succès, écriture du contenu...');
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        console.log('✅ Bon de livraison généré et affiché');
      } else {
        console.error('❌ Impossible d\'ouvrir la fenêtre d\'impression');
        alert('⚠️ Impossible d\'ouvrir la fenêtre d\'impression.\nVérifiez que les pop-ups ne sont pas bloqués dans votre navigateur.');
      }
    } catch (error) {
      console.error('❌ Erreur lors de l\'ouverture de la fenêtre:', error);
      alert('Erreur technique lors de l\'ouverture de la fenêtre d\'impression.');
    }
  }
}

export const htmlPrintService = new HTMLPrintService();
