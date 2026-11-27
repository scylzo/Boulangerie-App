import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import React, { useState, useEffect } from 'react';
import { useDepenseStore } from '../../store/depenseStore';
import { Modal } from '../../components/ui/Modal';
import { DepenseForm } from '../../components/depenses/DepenseForm';
import { DepenseList } from '../../components/depenses/DepenseList';
import { FournisseurList } from '../../components/stock/FournisseurList';
import { TrendingDown, Plus, Users, Wallet, FileText, RefreshCw } from 'lucide-react';
import type { Depense, CategorieDepense } from '../../types/depense';

const CATEGORIES: CategorieDepense[] = [
  'Carburant Véhicule',
  'Carburant Moto',
  'Électricité',
  'Eau',
  'Loyer',
  'Salaires',
  'Entretien',
  'Marketing',
  'Transport',
  'Divers'
];

export const GestionDepenses: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'generales' | 'fournisseurs'>('generales');
  const [showForm, setShowForm] = useState(false);
  const [editingDepense, setEditingDepense] = useState<Depense | null>(null);
  const [dateFilter, setDateFilter] = useState({
    debut: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    fin: new Date().toISOString().split('T')[0]
  });
  const [selectedCategory, setSelectedCategory] = useState<CategorieDepense | 'Toutes'>('Toutes');
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportConfig, setReportConfig] = useState({
    debut: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    fin: new Date().toISOString().split('T')[0],
    categorie: 'Toutes' as CategorieDepense | 'Toutes'
  });

  const { chargerDepenses, depenses } = useDepenseStore();

  useEffect(() => {
    if (dateFilter.debut && dateFilter.fin) {
      chargerDepenses(new Date(dateFilter.debut), new Date(dateFilter.fin));
    }
  }, [chargerDepenses, dateFilter.debut, dateFilter.fin]);

  useEffect(() => {
    setReportConfig(prev => ({
      ...prev,
      debut: dateFilter.debut,
      fin: dateFilter.fin,
      categorie: selectedCategory
    }));
  }, [dateFilter.debut, dateFilter.fin, selectedCategory]);

  // Uniquement les dépenses hors Intrants (le stock est géré exclusivement dans l'onglet Stock)
  const filteredDepenses = depenses.filter(d => {
    if (d.categorie === 'Intrants') return false;
    if (selectedCategory !== 'Toutes' && d.categorie !== selectedCategory) {
      return false;
    }

    const startFilter = new Date(dateFilter.debut); startFilter.setHours(0, 0, 0, 0);
    const endFilter = new Date(dateFilter.fin); endFilter.setHours(23, 59, 59, 999);

    const simpleDate = new Date(d.date);
    return simpleDate >= startFilter && simpleDate <= endFilter;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalDepenses = filteredDepenses.reduce((sum, d) => sum + d.montant, 0);

  const parCategorie = filteredDepenses.reduce((acc, d) => {
    acc[d.categorie] = (acc[d.categorie] || 0) + d.montant;
    return acc;
  }, {} as Record<string, number>);

  const handleEditDepense = (depense: Depense) => {
    setEditingDepense(depense);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingDepense(null);
  };

  const handleRefresh = async () => {
    if (dateFilter.debut && dateFilter.fin) {
      await chargerDepenses(new Date(dateFilter.debut), new Date(dateFilter.fin));
    }
  };

  // Aperçu pour la modale de rapport
  const modalPreviewExpenses = React.useMemo(() => {
    const s = new Date(reportConfig.debut); s.setHours(0, 0, 0, 0);
    const e = new Date(reportConfig.fin); e.setHours(23, 59, 59, 999);

    return depenses.filter(d => {
      if (d.categorie === 'Intrants') return false;
      if (reportConfig.categorie !== 'Toutes' && d.categorie !== reportConfig.categorie) {
        return false;
      }
      const simpleDate = new Date(d.date);
      return simpleDate >= s && simpleDate <= e;
    });
  }, [depenses, reportConfig]);

  const modalPreviewTotal = modalPreviewExpenses.reduce((sum, d) => sum + d.montant, 0);

  const genererRapportPDF = (config?: { debut: string; fin: string; categorie: string }) => {
    const activeConfig = config || {
      debut: dateFilter.debut,
      fin: dateFilter.fin,
      categorie: selectedCategory
    };

    const doc = new jsPDF();

    const formatPdfCurrency = (amount: number) => {
      return Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + ' FCFA';
    };

    const sFilter = new Date(activeConfig.debut); sFilter.setHours(0, 0, 0, 0);
    const eFilter = new Date(activeConfig.fin); eFilter.setHours(23, 59, 59, 999);

    const depensesExport = depenses.filter(d => {
      if (d.categorie === 'Intrants') return false;
      if (activeConfig.categorie !== 'Toutes' && d.categorie !== activeConfig.categorie) {
        return false;
      }
      const simpleDate = new Date(d.date);
      return simpleDate >= sFilter && simpleDate <= eFilter;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const totalExport = depensesExport.reduce((sum, d) => sum + d.montant, 0);

    const titreRapport = activeConfig.categorie !== 'Toutes'
      ? `RAPPORT DÉPENSES - ${activeConfig.categorie.toUpperCase()}`
      : "RAPPORT DÉPENSES";

    // --- EN-TÊTE ---
    doc.setFillColor(230, 126, 34);
    doc.rect(0, 0, 210, 42, 'F');

    doc.setFontSize(20);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text(titreRapport, 105, 18, { align: 'center' });

    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "normal");
    const sousTitre = `Période : ${new Date(activeConfig.debut).toLocaleDateString('fr-FR')} au ${new Date(activeConfig.fin).toLocaleDateString('fr-FR')} | Catégorie : ${activeConfig.categorie}`;
    doc.text(sousTitre, 105, 28, { align: 'center' });

    const generatedDate = `Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`;
    doc.setFontSize(8);
    doc.text(generatedDate, 200, 38, { align: 'right' });

    let finalY = 50;

    // 1. SYNTHÈSE
    doc.setFontSize(13);
    doc.setTextColor(192, 57, 43);
    doc.setFont("helvetica", "bold");
    doc.text("1. Synthèse", 14, finalY);

    const summaryData: string[][] = [
      ['Total Dépenses', formatPdfCurrency(totalExport)],
      ['Nombre d\'enregistrements', depensesExport.length.toString()]
    ];

    if (activeConfig.categorie === 'Toutes') {
      const parCatExport = depensesExport.reduce((acc, d) => {
        acc[d.categorie] = (acc[d.categorie] || 0) + d.montant;
        return acc;
      }, {} as Record<string, number>);

      Object.entries(parCatExport).forEach(([cat, mt]) => {
        summaryData.push([`Catégorie : ${cat}`, formatPdfCurrency(mt)]);
      });
    }

    autoTable(doc, {
      startY: finalY + 4,
      head: [['Indicateur', 'Montant / Valeur']],
      body: summaryData,
      theme: 'grid',
      headStyles: { fillColor: [192, 57, 43], halign: 'left' },
      columnStyles: {
        0: { cellWidth: 110, fontStyle: 'bold' },
        1: { halign: 'right' }
      },
      didParseCell: function (data) {
        if (data.row.index === 0 && data.section === 'body') {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [253, 237, 236];
        }
      }
    });

    finalY = (doc as any).lastAutoTable.finalY + 12;

    // 2. DÉTAIL DES DÉPENSES
    doc.setFontSize(13);
    doc.setTextColor(44, 62, 80);
    doc.text("2. Détail des Dépenses", 14, finalY);

    const detailsData = depensesExport.map(d => [
      new Date(d.date).toLocaleDateString('fr-FR'),
      d.categorie,
      d.description,
      d.fournisseur || '-',
      formatPdfCurrency(d.montant)
    ]);

    autoTable(doc, {
      startY: finalY + 4,
      head: [['Date', 'Catégorie', 'Description', 'Fournisseur', 'Montant']],
      body: detailsData,
      theme: 'striped',
      headStyles: { fillColor: [44, 62, 80] },
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 34 },
        2: { cellWidth: 62 },
        3: { cellWidth: 34 },
        4: { halign: 'right', fontStyle: 'bold', cellWidth: 28 }
      },
      styles: { fontSize: 8.5 }
    });

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Page ${i} / ${pageCount}`, 105, 290, { align: 'center' });
      doc.text("Boulangerie App - Document interne", 14, 290, { align: 'left' });
    }

    const cleanCat = activeConfig.categorie.replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`Rapport_Depenses_${cleanCat}_${activeConfig.debut}_${activeConfig.fin}.pdf`);
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
            <p className="text-sand-500 text-sm truncate">Frais de fonctionnement (carburant, électricité, salaires, loyer…)</p>
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
                onClick={() => {
                  setReportConfig({
                    debut: dateFilter.debut,
                    fin: dateFilter.fin,
                    categorie: selectedCategory
                  });
                  setShowReportModal(true);
                }}
                className="flex items-center space-x-2 bg-white border border-sand-300 text-sand-700 hover:bg-sand-50 px-4 py-2 rounded-lg transition-colors shadow-sm"
                title="Générer Rapport PDF"
              >
                <FileText size={20} />
                <span className="hidden sm:inline">Rapport</span>
              </button>
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
            </>
          )}
        </div>
      </div>

      {activeTab !== 'fournisseurs' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-card border border-sand-200">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sand-600 font-semibold text-sm">
                  {selectedCategory !== 'Toutes'
                    ? `Total : ${selectedCategory}`
                    : 'Total des dépenses'}
                </h3>
                <p className="text-[11px] text-sand-400">
                  Frais de fonctionnement sur la période
                </p>
              </div>
              <div className="w-11 h-11 bg-danger-50 text-danger-600 rounded-full flex items-center justify-center shrink-0">
                <TrendingDown size={20} />
              </div>
            </div>
            <p className="font-display text-3xl font-semibold text-sand-900">{totalDepenses.toLocaleString()} FCFA</p>
            <p className="text-xs text-sand-500 mt-1.5">
              {filteredDepenses.length} dépense{filteredDepenses.length > 1 ? 's' : ''} trouvée{filteredDepenses.length > 1 ? 's' : ''}
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-card border border-sand-200 md:col-span-2">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
              <h3 className="text-sand-500 font-medium">Répartition par catégorie</h3>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value as CategorieDepense | 'Toutes')}
                  className="bg-sand-50 border border-sand-200 text-sand-700 text-xs rounded-lg px-2 py-1.5 outline-none focus:border-warning-500 focus:ring-1 focus:ring-warning-500"
                  title="Filtrer par catégorie"
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

                {selectedCategory !== 'Toutes' && (
                  <button
                    onClick={() => setSelectedCategory('Toutes')}
                    className="text-xs text-amber-700 hover:text-amber-900 font-medium underline px-1"
                    title="Réinitialiser les filtres"
                  >
                    Effacer
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {Object.entries(parCategorie).map(([cat, montant]) => (
                <div
                  key={cat}
                  onClick={() => setSelectedCategory(selectedCategory === cat ? 'Toutes' : (cat as CategorieDepense))}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-all ${
                    selectedCategory === cat
                      ? 'bg-amber-100 border-amber-400 text-amber-950 font-semibold shadow-sm'
                      : 'bg-sand-50 border-sand-100 hover:bg-amber-50 hover:border-amber-200'
                  }`}
                  title="Cliquer pour filtrer"
                >
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
              <span>Dépenses</span>
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
                depenses={filteredDepenses}
              />
            </>
          )}

          {activeTab === 'fournisseurs' && (
            <FournisseurList />
          )}
        </div>
      </div>

      {/* Modale de génération de rapport personnalisé */}
      <Modal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        title="Générer un Rapport de Dépenses"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-sand-500">
            Sélectionnez la période et la catégorie souhaitées pour exporter votre rapport au format PDF.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-sand-700 mb-1">Date début</label>
              <input
                type="date"
                value={reportConfig.debut}
                onChange={e => setReportConfig(prev => ({ ...prev, debut: e.target.value }))}
                className="w-full p-2 border border-sand-300 rounded-lg text-sm outline-none focus:border-warning-500 focus:ring-1 focus:ring-warning-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-sand-700 mb-1">Date fin</label>
              <input
                type="date"
                value={reportConfig.fin}
                onChange={e => setReportConfig(prev => ({ ...prev, fin: e.target.value }))}
                className="w-full p-2 border border-sand-300 rounded-lg text-sm outline-none focus:border-warning-500 focus:ring-1 focus:ring-warning-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-sand-700 mb-1">Catégorie</label>
            <select
              value={reportConfig.categorie}
              onChange={e =>
                setReportConfig(prev => ({
                  ...prev,
                  categorie: e.target.value as CategorieDepense | 'Toutes'
                }))
              }
              className="w-full p-2 border border-sand-300 rounded-lg text-sm bg-white outline-none focus:border-warning-500 focus:ring-1 focus:ring-warning-500"
            >
              <option value="Toutes">Toutes les catégories</option>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Résumé en direct */}
          <div className="bg-sand-50 rounded-xl p-3 border border-sand-200">
            <h4 className="text-xs font-semibold text-sand-600 uppercase tracking-wider mb-2">Aperçu du rapport</h4>
            <div className="flex justify-between items-center text-sm py-1 border-b border-sand-200">
              <span className="text-sand-600">Nombre de dépenses</span>
              <span className="font-semibold text-sand-900">{modalPreviewExpenses.length}</span>
            </div>
            <div className="flex justify-between items-center text-sm pt-2">
              <span className="text-sand-600">Montant total</span>
              <span className="font-bold text-terracotta-600 text-base">
                {modalPreviewTotal.toLocaleString()} FCFA
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-sand-100">
            <button
              type="button"
              onClick={() => setShowReportModal(false)}
              className="px-4 py-2 border border-sand-300 rounded-lg text-sm text-sand-600 hover:bg-sand-50"
            >
              Fermer
            </button>
            <button
              type="button"
              onClick={() => {
                genererRapportPDF(reportConfig);
                setShowReportModal(false);
              }}
              className="px-4 py-2 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm"
            >
              <FileText size={16} />
              <span>Télécharger le PDF</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
