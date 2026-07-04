import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import React, { useState, useEffect } from 'react';
import { useDepenseStore } from '../../store/depenseStore';
import { useStockStore } from '../../store/stockStore';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { DepenseForm } from '../../components/depenses/DepenseForm';
import { DepenseList } from '../../components/depenses/DepenseList';
import { FournisseurList } from '../../components/stock/FournisseurList';
import { TrendingDown, Plus, Users, Wallet, FileText, RefreshCw, Package } from 'lucide-react';
import type { Depense, CategorieDepense } from '../../types/depense';

const CATEGORIES: CategorieDepense[] = [
  'Carburant Véhicule',
  'Carburant Moto',
  'Carburant Four',
  'Électricité',
  'Eau',
  'Loyer',
  'Salaires',
  'Entretien',
  'Intrants',
  'Marketing',
  'Transport',
  'Divers'
];

export const GestionDepenses: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'generales' | 'stock' | 'fournisseurs'>('generales');
  const [showForm, setShowForm] = useState(false);
  const [showStockAlert, setShowStockAlert] = useState(false);
  const [editingDepense, setEditingDepense] = useState<Depense | null>(null);
  const [dateFilter, setDateFilter] = useState({
    debut: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    fin: new Date().toISOString().split('T')[0]
  });
  const [selectedCategory, setSelectedCategory] = useState<CategorieDepense | 'Toutes'>('Toutes');

  const { chargerDepenses, depenses } = useDepenseStore();
  const { chargerDonnees: chargerStock, mouvements, matieres, fournisseurs } = useStockStore();

  useEffect(() => {
    if (dateFilter.debut && dateFilter.fin) {
      chargerDepenses(new Date(dateFilter.debut), new Date(dateFilter.fin));
      chargerStock();
    }
  }, [chargerDepenses, chargerStock, dateFilter.debut, dateFilter.fin]); // Added chargerStock

  // Transformation des achats de stock en "Dépenses Virtuelles"
  const stockExpenses: Depense[] = mouvements
    .filter(m => m.type === 'achat')
    .map(m => {
      const matiere = matieres.find(mat => mat.id === m.matiereId);
      const fournisseur = fournisseurs.find(f => f.id === m.fournisseurId);

      // Le coût est toujours Quantité * Prix Unitaire (stocké en HT normalement)
      // Consistance : Si l'utilisateur a saisi TTC, le Form a converti en HT si case cochée.
      // Ici on affiche ce qui est en base. Pour la trésorerie on veut le HT ou TTC?
      // En général Trésorerie = Cash Out = TTC.
      // Mais on a stocké le HT (Coût).
      // Dilemme comptable : Si récup TVA, CashOut = HT + TVA.
      // Si pas récup, CashOut = TTC.
      // Simplification: On affiche le montant stocké * Quantité.
      let montant = 0;

      if (m.montantPaye) {
        montant = m.montantPaye;
      } else if (m.prixUnitaire) {
        montant = m.quantite * m.prixUnitaire;
        // Si c'était du TTC déduit, on affiche du HT ici pour les vieilles données.
        // C'est le compromis accepté.
      }

      montant = Math.round(montant);

      return {
        id: `stock_${m.id}`,
        date: new Date(m.date), // Objet Date requis pour le tri
        montant: montant,
        categorie: 'Intrants', // On les classe en Intrants
        description: `Achat Stock : ${matiere ? matiere.nom : 'Matière inconnue'} (${m.quantite} ${matiere?.unite})`,
        fournisseur: fournisseur ? fournisseur.nom : undefined,
        auteur: m.auteur,
        validee: true,
        createdAt: m.createdAt,
        updatedAt: m.createdAt || new Date(),
        userId: m.userId || 'system' // Ajout du userId requis
      } as Depense;
    });

  // Filtrage local unifié
  const allExpenses = [...depenses, ...stockExpenses];

  const filteredDepenses = allExpenses.filter(d => {
    // 1. Filtrer par Categorie
    if (selectedCategory !== 'Toutes' && d.categorie !== selectedCategory) {
      // Exception: Si on sélectionne 'Intrants', on veut voir le stock
      if (selectedCategory === 'Intrants' && d.id.startsWith('stock_')) {
        // keep it
      } else if (d.categorie !== selectedCategory) {
        return false;
      }
    }

    // 2. Filtrer par Date stricte (Date de la dépense/paiement uniquement)
    const startFilter = new Date(dateFilter.debut); startFilter.setHours(0, 0, 0, 0);
    const endFilter = new Date(dateFilter.fin); endFilter.setHours(23, 59, 59, 999);

    const simpleDate = new Date(d.date);
    return simpleDate >= startFilter && simpleDate <= endFilter;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Calculer les totaux basés sur la liste affichée (WYSIWYG)
  const totalDepenses = filteredDepenses.reduce((sum, d) => sum + d.montant, 0);

  const parCategorie = filteredDepenses.reduce((acc, d) => {
    acc[d.categorie] = (acc[d.categorie] || 0) + d.montant;
    return acc;
  }, {} as Record<string, number>);

  const handleEditDepense = (depense: Depense) => {
    // Si c'est une dépense de stock, on ne peut pas l'éditer ici (il faut aller dans Stock)
    if (depense.id.startsWith('stock_')) {
      setShowStockAlert(true);
      return;
    }
    setEditingDepense(depense);
    setShowForm(true);
  };


  // ... suite du code (closeForm, genererRapportPDF qui utilisera filteredDepenses donc c'est bon) ...


  const closeForm = () => {
    setShowForm(false);
    setEditingDepense(null);
  };

  const handleRefresh = async () => {
    if (dateFilter.debut && dateFilter.fin) {
      await Promise.all([
        chargerDepenses(new Date(dateFilter.debut), new Date(dateFilter.fin)),
        chargerStock()
      ]);
    }
  };

  const genererRapportPDF = () => {
    const doc = new jsPDF();

    const formatPdfCurrency = (amount: number) => {
      return Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + ' FCFA';
    };

    // --- EN-TÊTE ---
    doc.setFillColor(230, 126, 34); // Orange (comme le thème dépenses)
    doc.rect(0, 0, 210, 40, 'F');

    doc.setFontSize(24);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text("RAPPORT DÉPENSES", 105, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "normal");
    doc.text(`Période : ${new Date(dateFilter.debut).toLocaleDateString('fr-FR')} au ${new Date(dateFilter.fin).toLocaleDateString('fr-FR')}`, 105, 30, { align: 'center' });

    const generatedDate = `Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`;
    doc.setFontSize(8);
    doc.text(generatedDate, 200, 38, { align: 'right' });

    let finalY = 50;

    // 1. SYNTHÈSE
    doc.setFontSize(14);
    doc.setTextColor(192, 57, 43); // Rouge foncé
    doc.setFont("helvetica", "bold");
    doc.text("1. Synthèse", 14, finalY);

    const summaryData = [
      ['Total Dépenses', formatPdfCurrency(totalDepenses)],
      ...Object.entries(parCategorie).map(([cat, montant]) => [cat, formatPdfCurrency(montant)])
    ];

    autoTable(doc, {
      startY: finalY + 5,
      head: [['Catégorie', 'Montant']],
      body: summaryData,
      theme: 'grid',
      headStyles: { fillColor: [192, 57, 43], halign: 'left' },
      columnStyles: {
        0: { cellWidth: 100, fontStyle: 'bold' },
        1: { halign: 'right' }
      },
      didParseCell: function (data) {
        if (data.row.index === 0 && data.section === 'body') {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [253, 237, 236];
        }
      }
    });

    finalY = (doc as any).lastAutoTable.finalY + 15;

    // 2. DÉTAIL DES DÉPENSES
    doc.setFontSize(14);
    doc.setTextColor(44, 62, 80);
    doc.text("2. Liste des Dépenses", 14, finalY);

    // Filtrer et trier les dépenses (utilise la liste filtrée si on veut que le PDF reflète le filtre catégorie, 
    // ou la liste complète du store. Pour l'instant je garde le comportement global store comme avant pour pas casser,
    // mais si l'utilisateur filtre visuellement, il s'attend surement à ce que le PDF soit filtré aussi.
    // Je vais utiliser `filteredDepenses` pour la consistance vue/export).
    const depensesTriees = [...filteredDepenses];

    const detailsData = depensesTriees.map(d => [
      new Date(d.date).toLocaleDateString('fr-FR'),
      d.categorie,
      d.description,
      d.fournisseur || '-',
      formatPdfCurrency(d.montant)
    ]);

    autoTable(doc, {
      startY: finalY + 5,
      head: [['Date', 'Catégorie', 'Description', 'Fournisseur', 'Montant']],
      body: detailsData,
      theme: 'striped',
      headStyles: { fillColor: [44, 62, 80] },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 30 },
        2: { cellWidth: 50 },
        3: { cellWidth: 40 },
        4: { halign: 'right', fontStyle: 'bold' }
      },
      styles: { fontSize: 9 }
    });

    // Pied de page
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Page ${i} / ${pageCount}`, 105, 290, { align: 'center' });
      doc.text("Boulangerie App - Document interne", 14, 290, { align: 'left' });
    }

    doc.save(`Rapport_Depenses_${dateFilter.debut}_${dateFilter.fin}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 bg-terracotta-50 rounded-xl flex items-center justify-center shrink-0">
            <Wallet size={20} className="text-terracotta-600" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold text-sand-900 truncate">Dépenses</h1>
            <p className="text-sand-500 text-sm truncate">Suivi des coûts d'exploitation & fournisseurs</p>
          </div>
        </div>
        <div className="flex gap-2">
          {activeTab !== 'fournisseurs' && (
            <>
              <button
                onClick={handleRefresh}
                className="p-2 text-sand-500 hover:text-warning-600 hover:bg-warning-50 rounded-lg transition-colors border border-sand-200 bg-white shadow-sm"
                title="Actualiser les données"
              >
                <RefreshCw size={20} />
              </button>
              <button
                onClick={genererRapportPDF}
                className="flex items-center space-x-2 bg-white border border-sand-300 text-sand-700 hover:bg-sand-50 px-4 py-2 rounded-lg transition-colors shadow-sm"
                title="Générer Rapport PDF"
              >
                <FileText size={20} />
                <span className="hidden sm:inline">Rapport</span>
              </button>
              {activeTab === 'generales' && (
                <button
                  onClick={() => {
                    setEditingDepense(null);
                    setShowForm(!showForm);
                  }}
                  className="flex items-center space-x-2 bg-terracotta-500 hover:bg-terracotta-600 text-white px-4 py-2 rounded-lg transition-colors shadow-soft"
                >
                  <Plus size={20} />
                  <span>Nouvelle Dépense</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {activeTab !== 'fournisseurs' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-card border border-sand-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sand-500 font-medium">{
                dateFilter.debut === new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0] &&
                  (dateFilter.fin === new Date().toISOString().split('T')[0] ||
                    dateFilter.fin === new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0])
                  ? 'Total ce mois'
                  : 'Total sur la période'
              }</h3>
              <div className="w-11 h-11 bg-danger-50 text-danger-600 rounded-full flex items-center justify-center">
                <TrendingDown size={20} />
              </div>
            </div>
            <p className="font-display text-3xl font-semibold text-sand-900">{totalDepenses.toLocaleString()} FCFA</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-card border border-sand-200 md:col-span-2">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
              <h3 className="text-sand-500 font-medium">Répartition par catégorie</h3>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value as CategorieDepense | 'Toutes')}
                  className="bg-sand-50 border border-sand-200 text-sand-700 text-xs rounded-lg px-2 py-1.5 outline-none focus:border-warning-500 focus:ring-1 focus:ring-warning-500"
                >
                  <option value="Toutes">Toutes les catégories</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>

                <div className="flex items-center gap-2 bg-sand-50 p-1.5 rounded-lg border border-sand-200">
                  <input
                    type="date"
                    value={dateFilter.debut}
                    onChange={(e) => setDateFilter(prev => ({ ...prev, debut: e.target.value }))}
                    className="bg-white border border-sand-300 text-sand-900 text-xs rounded px-2 py-1 outline-none focus:border-warning-500"
                  />
                  <span className="text-sand-400 text-xs">au</span>
                  <input
                    type="date"
                    value={dateFilter.fin}
                    onChange={(e) => setDateFilter(prev => ({ ...prev, fin: e.target.value }))}
                    className="bg-white border border-sand-300 text-sand-900 text-xs rounded px-2 py-1 outline-none focus:border-warning-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {Object.entries(parCategorie).map(([cat, montant]) => (
                <div key={cat} className="flex items-center space-x-2 bg-sand-50 px-3 py-1.5 rounded-lg border border-sand-100">
                  <span className="text-xs font-medium text-sand-500">{cat}</span>
                  <span className="text-sm font-semibold text-sand-900">{montant.toLocaleString()} FCFA</span>
                </div>
              ))}
              {Object.keys(parCategorie).length === 0 && (
                <p className="text-sm text-sand-400 italic">Aucune dépense sur cette période</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-card border border-sand-200 overflow-hidden">
        <div className="border-b border-sand-100">
          <nav className="flex space-x-4 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('generales')}
              className={`flex items-center space-x-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors ${activeTab === 'generales'
                ? 'border-terracotta-500 text-terracotta-600'
                : 'border-transparent text-sand-500 hover:text-sand-700 hover:border-sand-300'
                }`}
            >
              <Wallet size={18} />
              <span>Dépenses Générales</span>
            </button>
            <button
              onClick={() => setActiveTab('stock')}
              className={`flex items-center space-x-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors ${activeTab === 'stock'
                ? 'border-terracotta-500 text-terracotta-600'
                : 'border-transparent text-sand-500 hover:text-sand-700 hover:border-sand-300'
                }`}
            >
              <Package size={18} />
              <span>Achats Stock</span>
            </button>
            <button
              onClick={() => setActiveTab('fournisseurs')}
              className={`flex items-center space-x-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors ${activeTab === 'fournisseurs'
                ? 'border-terracotta-500 text-terracotta-600'
                : 'border-transparent text-sand-500 hover:text-sand-700 hover:border-sand-300'
                }`}
            >
              <Users size={18} />
              <span>Fournisseurs</span>
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'generales' && (
            <>
              {showForm && (
                <DepenseForm
                  onDesc={closeForm}
                  initialData={editingDepense || undefined}
                />
              )}
              <DepenseList
                onEdit={handleEditDepense}
                depenses={filteredDepenses.filter(d => !d.id.startsWith('stock_'))}
              />
            </>
          )}

          {activeTab === 'stock' && (
            <DepenseList
              depenses={filteredDepenses.filter(d => d.id.startsWith('stock_'))}
              readOnly={true}
            />
          )}

          {activeTab === 'fournisseurs' && (
            <FournisseurList />
          )}
        </div>
      </div>
      <ConfirmModal
        isOpen={showStockAlert}
        onClose={() => setShowStockAlert(false)}
        onConfirm={() => setShowStockAlert(false)}
        title="Modification impossible"
        message="Ceci est un mouvement de stock. Pour modifier cette dépense (prix, quantité...), veuillez passer par le module 'Gestion de Stock'."
        confirmText="Compris"
        cancelText="Fermer"
        type="info"
      />
    </div>
  );
};
