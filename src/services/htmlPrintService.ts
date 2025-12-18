/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CommandeClient, Client, Produit, Livreur, ProgrammeProduction } from '../types';
import type { CarLivraison } from '../types';
import { CARS_LIVRAISON } from '../types/production';
import logoImg from '../assets/logo.png';

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
  private getLogoUrl(): string {
    console.log('🖼️ URL du logo importée:', logoImg);

    // Vérifier si l'URL importée est valide
    if (logoImg && logoImg.length > 0) {
      console.log('✅ URL du logo valide, utilisation directe');
      return logoImg;
    } else {
      console.log('⚠️ URL du logo invalide, utilisation du SVG de fallback');
      // SVG de fallback avec le logo de la boulangerie
      return 'data:image/svg+xml;base64,' + btoa(`
        <svg width="100" height="60" viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg">
          <rect width="100" height="60" fill="#f59e0b" stroke="#d97706" stroke-width="2"/>
          <text x="50" y="25" text-anchor="middle" fill="white" font-size="14" font-family="Arial" font-weight="bold">
            🥖 BOULANGERIE
          </text>
          <text x="50" y="45" text-anchor="middle" fill="white" font-size="12" font-family="Arial" font-weight="bold">
            CHEZ MINA
          </text>
        </svg>
      `);
    }
  }

  private formatDate(date: string): string {
    return new Date(date).toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  private formatDateWithCorrection(dateProduction: Date): string {
    // Retourner la date de production telle quelle, sans correction
    return dateProduction.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  private getCarColor(_car: CarLivraison): string {
    return '#000000'; // Tous les en-têtes en noir pour B&W
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
          font-family: 'Helvetica Neue', Arial, sans-serif;
          font-size: 10px;
          line-height: 1.2;
          color: #000;
          background: white;
          padding: 0;
        }
        
        .container {
          max-width: 100%;
          margin: 0 auto;
        }
        
        .header {
           position: relative;
           margin-bottom: 5px;
           border-bottom: 2px solid #000;
           padding-bottom: 5px;
        }
        
        .header h1 {
          font-size: 18px;
          font-weight: 900;
          text-transform: uppercase;
          color: #000;
          margin-bottom: 2px;
        }
        
        .header .date {
          font-size: 11px;
          color: #000;
          font-weight: bold;
        }
        
        /* Top left info block */
        .header-info-left {
            position: absolute;
            top: 0;
            left: 0;
            text-align: left;
        }

        .header-info-left h2 {
           font-size: 14px;
           font-weight: 900;
           text-transform: uppercase;
           margin: 0;
        }
        .header-info-left div {
           font-size: 10px;
        }
        
        .livreur-section {
          margin-bottom: 5px;
          /* Reduced page-break aggression, rely on flow unless necessary */
          page-break-after: auto;
        }
        
        .livreur-header {
          background: white;
          padding: 2px 0;
          border-bottom: 1px solid #000;
          margin-bottom: 5px;
          display: flex;
          justify-content: space-between;
          align-items: baseline;
        }
        
        .livreur-header h2 {
          font-size: 14px;
          font-weight: 800;
          text-transform: uppercase;
          color: #000;
          margin: 0;
        }
        
        .livreur-header .info {
          font-size: 10px;
          font-weight: normal;
        }
        
        .car-section {
          margin-bottom: 10px;
          border: 1px solid #000;
          page-break-inside: avoid;
        }
        
        .car-header {
          background: #000;
          color: white;
          padding: 3px 5px;
          font-weight: 800;
          font-size: 11px;
          text-transform: uppercase;
          display: flex;
          justify-content: space-between;
          align-items: center;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        
        .car-body {
          background: white;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
        }
        
        th {
          background: #eee;
          padding: 2px 4px;
          text-align: center;
          font-weight: 800;
          font-size: 9px;
          color: #000;
          border: 1px solid #000;
          text-transform: uppercase;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        th:first-child {
            text-align: left;
        }
        
        td {
          padding: 2px 4px;
          border: 1px solid #000;
          font-size: 9px;
          vertical-align: middle;
          color: #000;
        }
        
        tr:nth-child(even) {
          background: #f9f9f9;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        
        .summary {
          background: white;
          color: #000;
          padding: 4px;
          border-top: 2px solid #000;
        }
        
        .summary h4 {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          margin-bottom: 2px;
          text-decoration: underline;
        }
        
        .summary-items {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
        }
        
        .summary-item {
          background: white;
          color: #000;
          padding: 1px 0;
          font-size: 9px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 2px;
          border: 1px solid #ccc;
          padding: 1px 4px;
          border-radius: 2px;
        }
        
        .summary-item .count {
          background: #000;
          color: white;
          padding: 0 4px;
          border-radius: 4px;
          font-weight: 700;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        
        .retours-column {
          width: 100%;
          height: 12px;
        }
        
        .stats {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            border: 1px solid #000;
            padding: 5px;
        }
        
        .stat-card {
            text-align: center;
        }
        
        .stat-card .label {
            font-size: 8px;
            text-transform: uppercase;
            font-weight: 600;
        }

        .stat-card .value {
            font-size: 14px;
            font-weight: 800;
        }
        
        @media print {
          @page {
            margin: 5mm;
            size: A4;
          }

          body {
            -webkit-print-color-adjust: exact;
             print-color-adjust: exact;
          }
          
          .no-print {
            display: none !important;
          }

          .livreur-section {
             break-after: auto;
             page-break-after: auto;
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
    const logoUrl = this.getLogoUrl();

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
          <div class="header" style="position: relative; margin-bottom: 20px;">
            <!-- Livreur Info - Absolutly positioned top left -->
            <div style="position: absolute; top: 0; left: 0; text-align: left;">
               <h2 style="font-size: 16px; font-weight: 900; text-transform: uppercase; margin: 0;">${livreurNom}</h2>
               ${dataLivreur.livreur?.telephone ? `<div style="font-size: 11px; margin-top: 4px;">📞 ${dataLivreur.livreur.telephone}</div>` : ''}
               ${dataLivreur.livreur?.vehicule ? `<div style="font-size: 11px; margin-top: 2px;">🚗 ${dataLivreur.livreur.vehicule}</div>` : ''}
            </div>

            <!-- Centered Header Content -->
            <div style="text-align: center;">
               <img src="${logoUrl}" alt="Logo" style="height: 50px; margin-bottom: 5px; display: inline-block;" />
               <h1 style="font-size: 24px; margin: 0; text-transform: uppercase;">Programme de Livraison</h1>
               <div class="date" style="font-size: 14px; font-weight: bold; margin-top: 2px;">${this.formatDate(dateSelectionnee)}</div>
            </div>
          </div>
          
          <div class="livreur-section">
            <!-- Header removed as it is now in main header -->
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

    const logoUrl = this.getLogoUrl();

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
              <img src="${logoUrl}" alt="Boulangerie Chez Mina" style="height: 60px; margin: 0 auto 8px auto; display: block;" />
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
            <div class="livreur-header" style="flex-direction: column; align-items: flex-start; gap: 2px;">
              <h2 style="font-size: 18px; margin: 0;">${livreurNom}</h2>
              <div style="display: flex; gap: 15px; font-size: 11px;">
                  ${dataLivreur.livreur?.telephone ? `<div>📞 ${dataLivreur.livreur.telephone}</div>` : ''}
                  ${dataLivreur.livreur?.vehicule ? `<div>🚗 ${dataLivreur.livreur.vehicule}</div>` : ''}
              </div>
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
    // Calcul des répartitions clients uniquement (sans boutique)
    const calculerRepartitionsClients = () => {
      if (!programme?.commandesClients) return new Map();

      const repartitionsClients = new Map<string, {
        car1Matin: number;
        car2Matin: number;
        carSoir: number;
      }>();

      // Parcourir uniquement les commandes clients (exclure boutique)
      programme.commandesClients
        .filter(commande => commande.statut !== 'annulee')
        .forEach(commande => {
          commande.produits.forEach(item => {
            const current = repartitionsClients.get(item.produitId) || {
              car1Matin: 0,
              car2Matin: 0,
              carSoir: 0
            };

            const car1Matin = Number(item.repartitionCars?.car1_matin) || 0;
            const car2Matin = Number(item.repartitionCars?.car2_matin) || 0;
            const carSoir = Number(item.repartitionCars?.car_soir) || 0;

            repartitionsClients.set(item.produitId, {
              car1Matin: current.car1Matin + car1Matin,
              car2Matin: current.car2Matin + car2Matin,
              carSoir: current.carSoir + carSoir
            });
          });
        });

      return repartitionsClients;
    };

    const repartitionsClients = calculerRepartitionsClients();

    // Calcul des totaux corrects
    const totalClients = programme.totauxParProduit?.reduce((acc, p) => acc + (p.totalClient || 0), 0) || 0;
    const totalBoutique = programme.totauxParProduit?.reduce((acc, p) => acc + (p.totalBoutique || 0), 0) || 0;
    const totalGeneral = programme.totauxParProduit?.reduce((acc, p) => acc + p.totalGlobal, 0) || 0;

    // Produits clients avec quantités matin (calculé depuis repartitionsClients)
    const produitsMatin = Array.from(repartitionsClients.entries())
      .filter(([, repartition]) => (repartition.car1Matin + repartition.car2Matin) > 0)
      .map(([produitId]) => {
        const produit = produits.find(p => p.id === produitId);
        const repartition = repartitionsClients.get(produitId)!;
        return {
          produitId,
          produit,
          car1Matin: repartition.car1Matin,
          car2Matin: repartition.car2Matin
        };
      });

    // Produits clients avec quantités soir (calculé depuis repartitionsClients)
    const produitsSoir = Array.from(repartitionsClients.entries())
      .filter(([, repartition]) => repartition.carSoir > 0)
      .map(([produitId]) => {
        const produit = produits.find(p => p.id === produitId);
        const repartition = repartitionsClients.get(produitId)!;
        return {
          produitId,
          produit,
          carSoir: repartition.carSoir
        };
      });

    const statutText = programme.statut === 'envoye' ? '✅ CONFIRMÉ' :
      programme.statut === 'modifie' ? '🔄 MODIFIÉ' :
        programme.statut === 'produit' ? '✅ PRODUIT' : '⏳ BROUILLON';

    const logoUrl = this.getLogoUrl();

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
            font-size: 9px;
            line-height: 1.2;
            color: #000;
            background: white;
            padding: 5px;
          }

          .container {
            max-width: 100%;
            margin: 0 auto;
          }

          .header {
             position: relative;
             margin-bottom: 5px;
             border-bottom: 2px solid #000;
             padding-bottom: 5px;
          }

          .header h1 {
            font-size: 16px;
            font-weight: 900;
            text-transform: uppercase;
            color: #000;
            margin-bottom: 2px;
          }
          
          /* Top left info block */
          .header-info-left {
            position: absolute;
            top: 0;
            left: 0;
            text-align: left;
          }

          .header-info-left .date {
            font-size: 11px;
            font-weight: bold;
            color: #000;
            margin-bottom: 1px;
            text-transform: uppercase;
          }

          .header-info-left .meta {
             font-size: 9px;
             color: #000;
          }
          
          .header-info-left .status {
             margin-top: 2px;
             font-size: 9px;
             font-weight: bold;
             text-transform: uppercase;
             border: 1px solid #000;
             padding: 0 4px;
             display: inline-block;
          }

          .stats {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 5px;
            margin-bottom: 10px;
            border: 1px solid #000;
            padding: 5px;
          }

          .stat-card {
            text-align: center;
          }

          .stat-card .label {
            font-size: 9px;
            text-transform: uppercase;
            font-weight: 600;
            color: #000;
          }

          .stat-card .value {
            font-size: 14px;
            font-weight: 800;
            color: #000;
          }

          .stat-card .unit {
            font-size: 8px;
            color: #000;
          }

          .section {
            margin-bottom: 10px;
            page-break-inside: avoid;
          }

          .section-header {
            background: white;
            padding: 2px 0;
            border-bottom: 1px solid #000;
            margin-bottom: 5px;
          }

          .section-header h2 {
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            color: #000;
            margin: 0;
          }

          .products-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 4px;
          }

          .product-card {
            border: 1px solid #000;
            page-break-inside: avoid;
          }

          .product-header {
            background: #000;
            color: white;
            padding: 2px 4px;
            font-weight: 700;
            font-size: 10px;
            text-transform: uppercase;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .product-body {
            padding: 2px 4px;
          }
          
          .car-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px dotted #000;
            padding: 1px 0;
          }
          
          .car-row:last-child {
             border-bottom: none;
          }

          .total-row {
            border-top: 1px solid #000;
            margin-top: 2px;
            padding-top: 2px;
            display: flex;
            justify-content: space-between;
            font-weight: bold;
          }
          
          .soir-total {
             border: 1px solid #000;
             padding: 4px;
             text-align: center;
          }
          
          .footer {
            margin-top: 10px;
            border-top: 1px solid #000;
            padding-top: 5px;
            text-align: center;
            font-size: 8px;
          }

          @media print {
            body {
               font-size: 9px;
               -webkit-print-color-adjust: exact;
               print-color-adjust: exact;
            }
            .no-print { display: none !important; }
            .section { page-break-inside: avoid; }
            .product-card { page-break-inside: avoid; }
            @page { margin: 5mm; size: A4; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <!-- Top Left Info -->
            <div class="header-info-left">
               <div class="date">
                 Production : ${this.formatDateWithCorrection(programme.dateProduction)}
               </div>
               <div class="meta">
                 Créé le ${programme.dateCreation.toLocaleDateString('fr-FR')} à ${programme.dateCreation.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
               </div>
               <div class="status">${statutText}</div>
            </div>

            <!-- Centered Title & Logo -->
            <div style="text-align: center;">
                <div class="logo">
                  <img src="${logoUrl}" alt="Boulangerie Chez Mina" style="height: 50px; display: inline-block; margin-bottom: 5px;" />
                </div>
                <h1>🥖 Programme de Production</h1>
            </div>
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

      produitsMatin.forEach(produitData => {
        const car1 = produitData.car1Matin;
        const car2 = produitData.car2Matin;
        const total = car1 + car2;

        html += `
              <div class="product-card">
                <div class="product-header matin">${produitData.produit?.nom || 'Produit'}</div>
                <div class="product-body">
                  <div class="product-content">
        `;

        // Afficher Car 1 seulement si > 0
        if (car1 > 0) {
          html += `
                    <div class="car-row">
                      <span class="car-label">Car 1 Matin</span>
                      <span class="car-value">${car1}</span>
                    </div>
          `;
        }

        // Afficher Car 2 seulement si > 0
        if (car2 > 0) {
          html += `
                    <div class="car-row">
                      <span class="car-label">Car 2 Matin</span>
                      <span class="car-value">${car2}</span>
                    </div>
          `;
        }

        html += `
                  </div>
                  <div class="total-row">
                    <span class="total-label">Total Matin Clients</span>
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

      produitsSoir.forEach(produitData => {
        const total = produitData.carSoir;

        html += `
              <div class="product-card">
                <div class="product-header soir">${produitData.produit?.nom || 'Produit'}</div>
                <div class="product-body">
                  <div class="soir-total">
                    <div class="value">${total}</div>
                    <div class="label">pièces clients</div>
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

    // --- DEBUT NOUVELLE SECTION RAPPORT PAR CAR ---
    // Calcul des totaux par car (Clients + Boutique)
    const totauxCar1Matin = new Map<string, number>();
    const totauxCar2Matin = new Map<string, number>();
    const totauxCarSoir = new Map<string, number>();

    // 1. Ajouter les quantités Clients
    Array.from(repartitionsClients.entries()).forEach(([produitId, repartition]) => {
      if (repartition.car1Matin > 0) totauxCar1Matin.set(produitId, (totauxCar1Matin.get(produitId) || 0) + repartition.car1Matin);
      if (repartition.car2Matin > 0) totauxCar2Matin.set(produitId, (totauxCar2Matin.get(produitId) || 0) + repartition.car2Matin);
      if (repartition.carSoir > 0) totauxCarSoir.set(produitId, (totauxCarSoir.get(produitId) || 0) + repartition.carSoir);
    });

    // 2. Ajouter les quantités Boutique
    if (programme.quantitesBoutique) {
      programme.quantitesBoutique.forEach(q => {
        const repartition = q.repartitionCars;
        if (repartition) {
          if (repartition.car1_matin > 0) totauxCar1Matin.set(q.produitId, (totauxCar1Matin.get(q.produitId) || 0) + repartition.car1_matin);
          if (repartition.car2_matin > 0) totauxCar2Matin.set(q.produitId, (totauxCar2Matin.get(q.produitId) || 0) + repartition.car2_matin);
          if (repartition.car_soir > 0) totauxCarSoir.set(q.produitId, (totauxCarSoir.get(q.produitId) || 0) + repartition.car_soir);
        }
      });
    }

    // Générer HTML pour le récapitulatif par Car
    const hasCar1 = totauxCar1Matin.size > 0;
    const hasCar2 = totauxCar2Matin.size > 0;
    const hasCarSoir = totauxCarSoir.size > 0;

    if (hasCar1 || hasCar2 || hasCarSoir) {
      html += `
          <div class="section" style="margin-top: 10px; padding-top: 4px; border-top: 1px solid #d1d5db">
            <div class="section-header" style="background: #374151; color: white; border-left: none;">
               <h2 style="color: white; justify-content: center; font-size: 14px;">🚚 Récapitulatif Global par Car</h2>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
       `;

      // Helper pour générer une colonne de car
      const generateCarColumn = (title: string, dataMap: Map<string, number>, color: string, bgColor: string) => {
        if (dataMap.size === 0) return '';

        const carEntries = Array.from(dataMap.entries());
        const totalGeneral = carEntries.reduce((acc, [, qty]) => acc + qty, 0);

        let colHtml = `
            <div style="border: 1px solid ${color}; border-radius: 4px; overflow: hidden; background: white;">
               <div style="background: ${bgColor}; padding: 6px; text-align: center; border-bottom: 1px solid #e5e7eb;">
                 <h3 style="font-size: 11px; font-weight: 700; color: #111827; margin: 0; text-transform: uppercase;">${title}</h3>
                 <div style="font-size: 8px; color: #6b7280; margin-top: 2px;">Clients + Boutique</div>
               </div>
               <table style="width: 100%; border-collapse: collapse; font-size: 9px;">
                 <tbody>
         `;

        carEntries.forEach(([produitId, qty]) => {
          const produit = produits.find(p => p.id === produitId);
          colHtml += `
                 <tr style="border-bottom: 1px solid #f3f4f6;">
                   <td style="padding: 4px 6px; color: #374151;">${produit?.nom || 'Inconnu'}</td>
                   <td style="padding: 4px 6px; text-align: right; font-weight: 700;">${qty}</td>
                 </tr>
            `;
        });

        colHtml += `
                 <tr style="background: ${bgColor}; border-top: 1px solid ${color};">
                    <td style="padding: 6px 8px; font-weight: 700; text-transform: uppercase;">TOTAL</td>
                    <td style="padding: 6px 8px; text-align: right; font-weight: 700; font-size: 11px;">${totalGeneral}</td>
                 </tr>
                 </tbody>
               </table>
            </div>
         `;
        return colHtml;
      };

      html += generateCarColumn('Car 1 - Matin', totauxCar1Matin, '#f97316', '#fff7ed'); // Orange
      html += generateCarColumn('Car 2 - Matin', totauxCar2Matin, '#f97316', '#fff7ed'); // Orange
      html += generateCarColumn('Car - Soir', totauxCarSoir, '#4b5563', '#f3f4f6');     // Gray

      html += `
            </div>
          </div>
       `;
    }
    // --- FIN NOUVELLE SECTION ---

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
    const logoUrl = this.getLogoUrl();

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
              <img src="${logoUrl}" alt="Boulangerie Chez Mina" style="height: 50px; margin-bottom: 10px;" />
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
